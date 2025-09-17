// controllers/delivry/AkhdimniController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { getDistance } from "geolib";
import DeliveryOrder from "../../models/delivry_Marketplace_V1/Order";
import { User } from "../../models/user";
import PricingStrategy from "../../models/delivry_Marketplace_V1/PricingStrategy";
import { calculateDeliveryPrice } from "../../utils/deliveryPricing";
// @ts-ignore
import io from "../.."; // أو المكان الصحيح للـ io لديك

export const createErrandOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1) تحقق المستخدم
    const firebaseUID = (req as any).firebaseUser?.uid || req.user?.id;
    if (!firebaseUID) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await User.findOne({ firebaseUID }).session(session);
    if (!user) throw new Error("المستخدم غير موجود");

    // 2) استلام بيانات "اخدمني" من الـ body
    const {
      scheduledFor,
      paymentMethod, // "wallet" | "cash" | "card" | "mixed"
      tip = 0,
      errand, // { category, description, size, weightKg, pickup{...}, dropoff{...}, waypoints? }
    } = req.body;

    if (!errand?.pickup?.location || !errand?.dropoff?.location) {
      throw new Error("نقطة الاستلام/التسليم مطلوبة");
    }
    if (scheduledFor && new Date(scheduledFor) <= new Date()) {
      throw new Error("الوقت المجدوَل يجب أن يكون في المستقبل.");
    }

    // 3) احتساب المسافة كيلومتر
    const distMeters = getDistance(
      {
        latitude: errand.pickup.location.lat,
        longitude: errand.pickup.location.lng,
      },
      {
        latitude: errand.dropoff.location.lat,
        longitude: errand.dropoff.location.lng,
      }
    );
    const distanceKm = distMeters / 1000;

    // 4) جلب استراتيجية التسعير
    const strategy = await PricingStrategy.findOne({}).session(session);
    if (!strategy) throw new Error("استراتيجية التسعير غير مكوَّنة");

    // 5) حساب رسوم التوصيل بنفس محركك الحالي
    const deliveryFee = calculateDeliveryPrice(distanceKm, strategy);

    // 6) الإجمالي = رسوم التوصيل + بقشيش/إكرامية (إن وجدت)
    const itemsTotal = 0; // لا توجد سلع
    const totalPrice = deliveryFee + (tip > 0 ? tip : 0);

    // 7) محفظة/كاش/بطاقة (نفس منطقك)
    let walletUsed = 0;
    if (paymentMethod === "wallet" || paymentMethod === "mixed") {
      walletUsed = Math.min(user.wallet.balance, totalPrice);
      if (walletUsed > 0) {
        user.wallet.balance -= walletUsed;
        await user.save({ session });
      }
    }
    const cashDue = totalPrice - walletUsed;
    let finalPaymentMethod: "wallet" | "cash" | "card" | "mixed" = "wallet";
    if (cashDue > 0)
      finalPaymentMethod = paymentMethod === "card" ? "card" : "mixed";
    const paid = cashDue === 0 && finalPaymentMethod !== "card";

    // 8) اختيار سائق قريب من نقطة الاستلام
    const driver = await mongoose
      .model("Driver")
      .findOne({
        status: "active",
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [
                errand.pickup.location.lng,
                errand.pickup.location.lat,
              ],
            },
            $maxDistance: 5000,
          },
        },
      })
      .session(session);

    // 9) تحضير حقول العنوان الإلزامية الموجودة عندك — سنجعلها "عنوان التسليم"
    const drop = errand.dropoff;
    const orderDoc = new DeliveryOrder({
      orderType: "errand",
      user: user._id,
      driver: driver?._id || null,

      items: [], // لا توجد عناصر
      subOrders: [], // لا توجد متاجر

      price: totalPrice,
      deliveryFee,
      companyShare: 0, // لا عمولة متجر
      platformShare: deliveryFee, // دخل المنصة من هذه الخدمة

      walletUsed,
      cashDue,

      address: {
        label: drop.label || "Dropoff",
        street: drop.street || "",
        city: drop.city || errand.pickup?.city || "",
        location: { lat: drop.location.lat, lng: drop.location.lng },
      },

      deliveryMode: "unified", // لا تأثير فعلي هنا
      paymentMethod: finalPaymentMethod,
      paid,
      status: "pending_confirmation",
      scheduledFor: scheduledFor || null,

      // حقل "اخدمني"
      errand: {
        category: errand.category || "other",
        description: errand.description,
        size: errand.size,
        weightKg: errand.weightKg,
        pickup: {
          ...errand.pickup,
          geo: {
            type: "Point",
            coordinates: [
              errand.pickup.location.lng,
              errand.pickup.location.lat,
            ],
          },
        },
        dropoff: {
          ...errand.dropoff,
          geo: {
            type: "Point",
            coordinates: [
              errand.dropoff.location.lng,
              errand.dropoff.location.lat,
            ],
          },
        },
        waypoints: errand.waypoints || [],
        distanceKm,
        tip,
      },

      // يمكنك الإبقاء على notes والمنطق نفسه إن أردت
      notes: req.body.notes
        ? [
            {
              body: String(req.body.notes).trim(),
              visibility: "public",
              byRole: "customer",
              byId: user._id,
              createdAt: new Date(),
            },
          ]
        : [],
    });

    await orderDoc.save({ session });
    await session.commitTransaction();

    // 10) إشعار المستخدم
    const notif = {
      title: `طلب اخدمني #${orderDoc._id} تم إنشاؤه`,
      body: `المبلغ: ${orderDoc.price} ريال. في انتظار تأكيد الإدارة.`,
      data: { orderId: orderDoc._id.toString() },
      isRead: false,
      createdAt: new Date(),
    };
    await User.findByIdAndUpdate(user._id, {
      $push: { notificationsFeed: notif },
    });
    // بث سوكيت
    // io.to(`user_${user._id.toString()}`).emit("notification", notif);

    res.status(201).json(orderDoc);
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};
