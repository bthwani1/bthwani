// controllers/orders/CreateSheinOrder.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../../models/user";
import SheinCart from "../../models/delivry_Marketplace_V1/SheinCart";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import PricingStrategy from "../../models/delivry_Marketplace_V1/PricingStrategy";
import DeliveryOrder from "../../models/delivry_Marketplace_V1/Order";
import { getDistance } from "geolib";
import { calculateDeliveryPrice } from "../../utils/deliveryPricing";

const SHEIN_HUB_STORE_ID = "66e..."; // ضع ObjectId لمتجر SHEIN Hub بعد Seed

export const checkoutShein = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const uid = (req as any).firebaseUser?.uid || req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const user = await User.findOne({ firebaseUID: uid }).session(session);
    if (!user) throw new Error("المستخدم غير موجود");

    const cart = await SheinCart.findOne({ user: user._id }).session(session);
    if (!cart || !cart.items.length) throw new Error("سلة SHEIN فارغة");

    const { addressId, paymentMethod = "wallet" } = req.body;
    const targetId = addressId || user.defaultAddressId?.toString();
    const addr = user.addresses.find((a) => a._id.toString() === targetId);
    if (!addr?.location) throw new Error("العنوان غير صالح");

    const strategy = await PricingStrategy.findOne({}).session(session);
    if (!strategy) throw new Error("Pricing strategy not configured");

    // رسوم التوصيل من SHEIN Hub إلى العميل
    const hub = await DeliveryStore.findById(SHEIN_HUB_STORE_ID).session(
      session
    );
    if (!hub) throw new Error("SHEIN Hub store غير موجود");

    const distKm =
      getDistance(
        { latitude: hub.location.lat, longitude: hub.location.lng },
        { latitude: addr.location.lat, longitude: addr.location.lng }
      ) / 1000;
    const deliveryFee = calculateDeliveryPrice(distKm, strategy);

    const itemsTotal = cart.items.reduce(
      (s, it: any) => s + (it.price || 0) * (it.quantity || 1),
      0
    );
    const total = itemsTotal + deliveryFee;

    // محفظة/دفع
    let walletUsed = 0;
    if (paymentMethod === "wallet" || paymentMethod === "mixed") {
      walletUsed = Math.min(user.wallet.balance, total);
      if (walletUsed > 0) {
        user.wallet.balance -= walletUsed;
        await user.save({ session });
      }
    }
    const cashDue = total - walletUsed;
    const paid = cashDue === 0;
    const finalMethod = paid ? "wallet" : paymentMethod; // أو "mixed"

    // نبني الطلب (نستخدم متجر SHEIN Hub كـ store لكل عنصر لتوافق السكيمة)
    const orderItems = cart.items.map((it: any) => ({
      productType: "deliveryProduct", // أو "merchantProduct" حسب تقاريرك
      productId: hub._id, // hack: ضع أي ObjectId صالح إن إجباري. أو غيّر السكيمة لتسمح externalRef
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.price,
      store: hub._id,
      image: it.image,
    }));

    const order = await DeliveryOrder.create(
      [
        {
          user: user._id,
          items: orderItems,
          subOrders: [
            {
              store: hub._id,
              items: orderItems.map((it) => ({
                product: it.productId, // وفق سكيمتك
                productType: "sheinProduct", // يفضّل إضافة هذا النوع في enum إن أحببت تتبعًا أدق
                quantity: it.quantity,
                unitPrice: it.unitPrice,
              })),
              status: "awaiting_procurement",
              statusHistory: [
                {
                  status: "awaiting_procurement",
                  changedAt: new Date(),
                  changedBy: "customer",
                },
              ],
            },
          ],
          price: total,
          deliveryFee,
          companyShare: 0, // SHEIN ليس شريكًا داخليًا، تستطيع وضع هوامشك في بند منفصل إن أردت
          platformShare: total, // أو قسّم كما يناسب تقاريرك
          walletUsed,
          cashDue,
          paymentMethod: finalMethod,
          paid,
          address: {
            label: addr.label,
            street: addr.street,
            city: addr.city,
            location: { lat: addr.location.lat, lng: addr.location.lng },
          },
          deliveryMode: "unified",
          status: "awaiting_procurement",
          statusHistory: [
            {
              status: "awaiting_procurement",
              changedAt: new Date(),
              changedBy: "customer",
            },
          ],
          notes: [
            {
              body: "طلب شراء بالإنابة من SHEIN (سيتم الشراء ثم التوصيل المحلي).",
              visibility: "internal",
              byRole: "system",
              createdAt: new Date(),
            },
          ],
        },
      ],
      { session }
    );

    await SheinCart.deleteOne({ _id: cart._id }).session(session);
    await session.commitTransaction();

    res
      .status(201)
      .json({ orderId: order[0]._id, status: "awaiting_procurement" });
  } catch (e: any) {
    await session.abortTransaction();
    res.status(500).json({ message: e.message });
  } finally {
    session.endSession();
  }
};
