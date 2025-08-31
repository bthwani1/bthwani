import { Request, Response } from "express";
import DeliveryOrder, {
  OrderStatus,
} from "../../models/delivry_Marketplace_V1/Order";
import DeliveryCart from "../../models/delivry_Marketplace_V1/DeliveryCart";
import { User } from "../../models/user";
import mongoose from "mongoose";
import { io } from "../..";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Driver from "../../models/Driver_app/driver";
import { calculateDeliveryPrice } from "../../utils/deliveryPricing";
import { getDistance } from "geolib";
import PricingStrategy from "../../models/delivry_Marketplace_V1/PricingStrategy";
import { getActor } from "../../utils/actor";
import { canTransition } from "../../constants/orderStatus";
import { pushStatusHistory } from "../../utils/orderHistory";
import { broadcastOrder } from "../../sockets/orderEvents";
import { postIfDeliveredOnce } from "../../accounting/hooks";
import { broadcastOffersForOrder } from "../../services/dispatch";

// 👇 ضِف أعلى هذا الملف
function sanitizeNotes(raw: any): any[] {
  const toNote = (v: any) => {
    if (typeof v === "string") {
      const body = v.trim();
      if (!body) return null;
      return {
        body,
        visibility: "internal",
        byRole: "system",
        createdAt: new Date(),
      };
    }
    if (v && typeof v === "object") {
      const body = (v.body ?? "").toString().trim();
      if (!body) return null;
      const visibility = v.visibility === "public" ? "public" : "internal";
      const byRole = ["customer","admin","store","driver","system"].includes(v.byRole)
        ? v.byRole
        : "system";
      const byId = v.byId ?? undefined;
      const createdAt = v.createdAt ? new Date(v.createdAt) : new Date();
      return { body, visibility, byRole, byId, createdAt };
    }
    return null;
  };

  if (!Array.isArray(raw)) {
    const n = toNote(raw);
    return n ? [n] : [];
  }
  return raw.map(toNote).filter(Boolean) as any[];
}


export const createOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. تحقق من المستخدم
    const firebaseUID = (req as any).firebaseUser?.uid;
    if (!firebaseUID) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await User.findOne({ firebaseUID }).session(session);
    if (!user) throw new Error("المستخدم غير موجود");

    // 2. جلب سلة المشتريات
    const cart = await DeliveryCart.findOne({ user: user._id }).session(
      session
    );

    if (!cart || cart.items.length === 0) throw new Error("السلة فارغة");

    // 3. بيانات الطلب الواردة
    const {
      scheduledFor,
      addressId,
      notes,
      paymentMethod,
      deliveryMode = "split",
    } = req.body;

    if (scheduledFor && new Date(scheduledFor) <= new Date()) {
      throw new Error("الوقت المجدوَل يجب أن يكون في المستقبل.");
    }

    // 4. اختر العنوان (من body أو الافتراضي)
    const targetId = addressId || user.defaultAddressId?.toString();
    const chosenAddress = user.addresses.find(
      (a) => a._id.toString() === targetId
    );
    if (!chosenAddress || !chosenAddress.location)
      throw new Error("العنوان غير صالح");

    // 5. تحقق من رصيد المحفظة إذا كان الدفع Wallet

    // 6. تجميع العناصر بحسب المتجر
    const grouped: Record<string, typeof cart.items> = {};
    for (const item of cart.items) {
      const key = item.store.toString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    // 7. جلب استراتيجية التسعير (شرائح + سعر افتراضي)
    const strategy = await PricingStrategy.findOne({}).session(session);
    if (!strategy) throw new Error("استراتيجية التسعير غير مكوَّنة");

    // 8. حساب رسوم التوصيل
    let deliveryFee = 0;
    const stores = Object.keys(grouped);
    if (deliveryMode === "unified") {
      // استخدم أول متجر فقط
      const s = await DeliveryStore.findById(stores[0]).session(session);
      if (!s) throw new Error("المتجر غير موجود");
      const distKm =
      getDistance(
  { latitude: s.location.lat, longitude: s.location.lng },
  { latitude: chosenAddress.location.lat, longitude: chosenAddress.location.lng }
)
/ 1000;
      deliveryFee = calculateDeliveryPrice(distKm, strategy);
    } else {
      // لكل متجر ضمن السلة
      for (const storeId of stores) {
        const s = await DeliveryStore.findById(storeId).session(session);
        if (!s) throw new Error(`المتجر ${storeId} غير موجود`);
        const distKm =
          getDistance(
            { latitude: s.location.lat, longitude: s.location.lng },
            {
              latitude: chosenAddress.location.lat,
              longitude: chosenAddress.location.lng,
            }
          ) / 1000;
        deliveryFee += calculateDeliveryPrice(distKm, strategy);
      }
    }

    // 9. إعداد subOrders واختيار السائق
    let commonDriver = null;
    if (deliveryMode === "unified") {
      const origin = await DeliveryStore.findById(stores[0]).session(session);
      if (origin) {
        commonDriver = await mongoose
          .model("Driver")
          .findOne({
            status: "active",
            location: {
              $near: {
                $geometry: {
                  type: "Point",
                  coordinates: [origin.location.lng, origin.location.lat],
                },
                $maxDistance: 5000,
              },
            },
          })
          .session(session);
      }
    }

    const subOrders = await Promise.all(
      stores.map(async (storeId) => {
        const items = grouped[storeId];
        let driver = commonDriver;
        if (!driver) {
          const s = await DeliveryStore.findById(storeId).session(session)!;
          driver = await mongoose
            .model("Driver")
            .findOne({
              status: "active",
              location: {
                $near: {
                  $geometry: {
                    type: "Point",
                    coordinates: [s.location.lng, s.location.lat],
                  },
                  $maxDistance: 5000,
                },
              },
            })
            .session(session);
        }
        return {
          store: storeId,
          items: items.map((i) => ({
            product: i.productId, // هذا هو المعرف
            productType: i.productType, // أضف هذا السطر
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          driver: driver?._id || null,
          status: "pending_confirmation" as const,
        };
      })
    );
    // 10. حساب المشاركة حسب كل متجر
    // 10. حساب companyShare و platformShare
    let totalCompanyShare = 0;
    let totalPlatformShare = 0;
    for (const so of subOrders) {
      const s = await DeliveryStore.findById(so.store).session(session);
      if (!s) continue;
      const subTotal = so.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0
      );
      const rate = s.takeCommission ? s.commissionRate : 0;
      const companyShare = subTotal * rate;
      totalCompanyShare += companyShare;
      totalPlatformShare += subTotal - companyShare;
    }

   // 11) المبلغ النهائي
const totalPrice = cart.total + deliveryFee;

// 11.1) احسب من المحفظة والكاش
let walletUsed = 0;
if (paymentMethod === "wallet" || paymentMethod === "mixed") {
  walletUsed = Math.min(user.wallet.balance, totalPrice);
}
const cashDue = totalPrice - walletUsed;

// 11.2) خصم المحفظة مرة واحدة
if (walletUsed > 0) {
  user.wallet.balance -= walletUsed;
  await user.save({ session });
}

// 11.3) حدد الـ paymentMethod النهائي و paid
let finalPaymentMethod: "wallet" | "cash" | "card" | "mixed" = "wallet";
if (cashDue > 0) {
  // لو العميل اختار بطاقة: mixed (wallet + card)
  // لو اختار كاش: mixed (wallet + cash)
  finalPaymentMethod = "mixed";
} else {
  finalPaymentMethod = "wallet";
}

const paid = cashDue === 0; // لو الكاش/البطاقة لاحقًا، خليه false الآن
let initialNotes: any[] = [];
if (typeof notes === "string" && notes.trim()) {
  initialNotes.push({
    body: notes.trim(),
    visibility: "public",     // العميل يشوفها
    byRole: "customer",
    byId: user._id,
    createdAt: new Date(),
  });
}

// 13) إنشاء الطلب
const order = new DeliveryOrder({
  user: user._id,
  deliveryMode,
  scheduledFor: scheduledFor || null,
  address: {
    label: chosenAddress.label,
    street: chosenAddress.street,
    city: chosenAddress.city,
    location: {
      lat: chosenAddress.location.lat,
      lng: chosenAddress.location.lng,
    },
  },
  subOrders,
  deliveryFee,
  price: totalPrice,
  companyShare: totalCompanyShare,     // <-- مهم
  platformShare: totalPlatformShare,   // <-- مهم
  walletUsed,
  cashDue,
  paymentMethod: finalPaymentMethod,
  status: "pending_confirmation",
  paid,
  // لو ما في ملاحظة، اتركه undefined ليشتغل default: []
  notes: initialNotes.length ? initialNotes : undefined,
});

    // 13. إنشاء الطلب
    await order.save({ session });

    await DeliveryCart.deleteOne({ _id: cart._id }).session(session);
    await session.commitTransaction();

    broadcastOrder("order.created", order._id.toString(), {
      status: order.status,
      price: order.price,
      city: order.address.city,
      subCount: order.subOrders.length,
    });
    // 14. إشعار العميل
    const notif = {
      title: `طلبك #${order._id} تم إنشاؤه`,
      body: `المبلغ: ${order.price} ريال. في انتظار تأكيد الإدارة.`,
      data: { orderId: order._id.toString() },
      isRead: false,
      createdAt: new Date(),
    };
    await User.findByIdAndUpdate(user._id, {
      $push: { notificationsFeed: notif },
    });
    io.to(`user_${user._id.toString()}`).emit("notification", notif);

    res.status(201).json(order);
    return;
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
    return;
  } finally {
    session.endSession();
  }
};
export const assignDriver = async (req: Request, res: Response) => {
  try {
    const { driverId } = req.body;
    const { id } = req.params;

    const order: any = await DeliveryOrder.findById(id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return
    } 

    const actor = getActor(req);
    if (actor.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return;
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      res.status(404).json({ message: "Driver not found" });
      return;
    }

    // 👇 عالج notes قبل أي حفظ
    order.notes = sanitizeNotes(order.notes);

    order.driver = driver._id;
    order.status = "assigned";                // 👈 اجعلها حالة إسناد (لو مدعومة عندك)
    order.assignedAt = new Date();
    order.statusHistory.push({
      status: "assigned",
      changedAt: new Date(),
      changedBy: "admin",
    });

    // ملاحظة نظامية
    order.notes.push({
      body: `تم إسناد الطلب إلى الكابتن: ${driver._id}`,
      visibility: "internal",
      byRole: "admin",
      byId: actor.id,
      createdAt: new Date(),
    });

    await order.save({ validateModifiedOnly: true });
    broadcastOrder("order.driver.assigned", order._id.toString(), { driverId });

    res.json(order);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

export const assignDriverToSubOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, subId } = req.params as any;
    const { driverId } = req.body;

    const actor = getActor(req);
    if (actor.role !== "admin" && actor.role !== "store"){
      res.status(403).json({ message: "Forbidden" });

      return;
    }

    const order: any = await DeliveryOrder.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const sub = order.subOrders.id(subId);
    if (!sub) {
      res.status(404).json({ message: "SubOrder not found" });
      return;
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      res.status(404).json({ message: "Driver not found" });
      return;
    }

    sub.driver = driver._id;
    await order.save();
    broadcastOrder("order.sub.driver.assigned", order._id.toString(), { subId, driverId });

    res.json(order);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

export const updateSubOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId, subId } = req.params as any;
    const { status, reason, returnBy } = req.body as { status: OrderStatus; reason?: string; returnBy?: string };

    const actor = getActor(req);
    if (!["admin", "store", "driver"].includes(actor.role)){
      res.status(403).json({ message: "Forbidden" });

      return;
    }

    const order: any = await DeliveryOrder.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const sub = order.subOrders.id(subId);
    if (!sub) {
      res.status(404).json({ message: "SubOrder not found" });
      return;
    }

    // حارس الانتقال لــ subOrder
    if (!canTransition(sub.status, status)) {
      res.status(400).json({ message: `Invalid transition from ${sub.status} to ${status}` });
      return;
    }

    // حدّث subOrder
    pushStatusHistory(sub, status, actor.role as any, reason, returnBy as any);

    // يمكنك أيضًا مزامنة حالة order العليا (اختياريًا):
    // مثال: إذا كل subOrders = delivered → order.status=delivered
    if (order.subOrders.every((s: any) => s.status === "delivered")) {
      pushStatusHistory(order, "delivered", "admin");
    }

    await order.save();
    broadcastOrder("order.sub.status", order._id.toString(), {
      subId,
      status,
      by: getActor(req).role,
    });
    try {
      await postIfDeliveredOnce(order);
    } catch (e) {
      console.error("Accounting posting failed (updateSubOrderStatus):", (e as Error).message);
    }
    
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
export const setOrderPOD = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deliveryReceiptNumber } = req.body;

    const actor = getActor(req);
    if (!["admin", "driver"].includes(actor.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const order: any = await DeliveryOrder.findById(id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    order.deliveryReceiptNumber = deliveryReceiptNumber;
    await order.save();
    broadcastOrder("order.pod.set", id, { deliveryReceiptNumber });

    
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
export const addOrderNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { body, visibility = "internal" } = req.body as {
      body: string;
      visibility?: "public" | "internal";
    };

    if (!body?.trim()) {
      res.status(400).json({ message: "note body required" });
      return;
    }

    const actor = getActor(req);

    // العميل لا يُسمح له بإنشاء internal
    if (actor.role === "customer" && visibility !== "public") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // لو أردت منع vendor/driver من public: عدّل الشرط أعلاه كما تريد

    const order: any = await DeliveryOrder.findById(id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const note = {
      body: body.trim(),
      visibility,
      byRole: actor.role,
      byId: actor.id,
      createdAt: new Date(),
    };

    order.notes.push(note as any);
    await order.save();
    broadcastOrder("order.note.added", id, {
      visibility,
      by: getActor(req).role,
    });
    
    res.status(201).json(order.notes[order.notes.length - 1]);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

export const listOrderNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const scope = (req.query.visibility as string) || "auto"; // auto = حسب الدور

    const order: any = await DeliveryOrder.findById(id).select("notes").lean();
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    let notes = order.notes || [];

    if (scope === "public") notes = notes.filter((n: any) => n.visibility === "public");
    else if (scope === "internal") notes = notes.filter((n: any) => n.visibility === "internal");
    else {
      // auto
      if (actor.role === "customer") {
        notes = notes.filter((n: any) => n.visibility === "public");
      }
    }

    res.json(notes);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
export const setSubOrderPOD = async (req: Request, res: Response) => {
  try {
    const { orderId, subId } = req.params;
    const { deliveryReceiptNumber } = req.body;

    const actor = getActor(req);
    if (!["admin", "driver", "store"].includes(actor.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const order: any = await DeliveryOrder.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const sub = order.subOrders.id(subId);
    if (!sub) {
      res.status(404).json({ message: "SubOrder not found" });
      return;
    }

    sub.deliveryReceiptNumber = deliveryReceiptNumber;
    await order.save();
    broadcastOrder("order.sub.pod.set", orderId, { subId, deliveryReceiptNumber });

    res.json(order);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /orders/:id/vendor-accept
export const vendorAcceptOrder = async (req: Request, res: Response) => {
  const order: any = await DeliveryOrder.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (!canTransition(order.status, "preparing")) {
    res.status(400).json({ message: `Invalid transition from ${order.status} to preparing` });
    return;
  }

  // ✅ اسناد سائق
  if (order.deliveryMode === "unified") {
    const store = await DeliveryStore.findById(order.subOrders[0].store);
    if (!store) {
      res.status(404).json({ message: "Store not found" });
      return;
    }

    const driver = await Driver.findOne({
      isAvailable: true,
      isBanned: false,
      $or: [
        { isJoker: false },
        { isJoker: true, jokerFrom: { $lte: new Date() }, jokerTo: { $gte: new Date() } },
      ],
      currentLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [store.location.lng, store.location.lat] },
          $maxDistance: 5000,
        },
      },
    });

    if (!driver) {
      res.status(400).json({ message: "No available driver nearby" });
      return;
    }

    order.driver = driver._id;            // 👈 اسناد فعلي
    if (!order.assignedAt) order.assignedAt = new Date();
  } else {
    // split: اسناد لكل subOrder
    for (const sub of order.subOrders) {
      if (sub.driver) continue;
      const s = await DeliveryStore.findById(sub.store);
      if (!s) continue;

      const drv = await Driver.findOne({
        isAvailable: true, isBanned: false,
        currentLocation: {
          $near: {
            $geometry: { type: "Point", coordinates: [s.location.lng, s.location.lat] },
            $maxDistance: 5000,
          },
        },
      });
      if (drv) sub.driver = drv._id;      // 👈 اسناد السائق للـ subOrder
    }
    if (!order.assignedAt) order.assignedAt = new Date();
  }

  // الحالة: المتجر بدأ التحضير
  pushStatusHistory(order, "preparing", "store");

  // ⚠️ لو عندك مشكلة موروثة في notes:
  // order.notes = sanitizeNotes(order.notes);
  await order.save({ validateModifiedOnly: true });

  res.json(order);
};



export const exportOrdersToExcel = async (req, res: Response) => {
  try {
    const orders = await DeliveryOrder.find()
      .populate({ path: 'user', select: 'fullName phone' })
      .lean();

    // const excelData = orders.map((order) => ({
    //   OrderID: order._id.toString(),
    //   Status: order.status,
    //   Customer: order.user?.fullName || '', // ✅ الآن تعمل
    //   Phone: order.user?.phone || '',
    //   Amount: order.price,
    //   Date: new Date(order.createdAt).toLocaleString('ar-YE'),
    // }));

    // باقي الكود نفسه...
  } catch (error) {
    res.status(500).json({ message: 'فشل التصدير', error });
  }
};

// PATCH /orders/:id/admin-status
export const adminChangeStatus = async (req: Request, res: Response) => {
  const { status, reason, returnBy } = req.body;
  const validStatuses = [
    "pending_confirmation",
    "under_review",
    "preparing",
    "out_for_delivery",
    "delivered",
    "returned",
    "cancelled",
    "assigned", // 👈 لو أضفتها في الـ enum العام
  ];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ message: "حالة غير صحيحة" });
    return;
  }

  const update: any = {
    $set: { status },
    $push: {
      statusHistory: { status, changedAt: new Date(), changedBy: "admin" },
    },
  };

  if (status === "assigned") {
    update.$set.assignedAt = new Date();
  }

  if (status === "returned" || status === "cancelled") {
    update.$set.returnReason = reason || "بدون تحديد";
    update.$set.returnBy = returnBy || "admin";
  } else {
    update.$unset = { returnReason: "", returnBy: "" };
  }

  const order = await DeliveryOrder.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true, context: "query" }
  );

  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  if (status === "preparing") {
    try {
      // ابث عروض لأقرب 5
      await broadcastOffersForOrder(order._id.toString(), 2); // 2 دقيقة صلاحية العرض
    } catch (e) {
      console.error("Broadcast offers error:", (e as Error).message);
    }
  }
  // ⚠️ لا تعيد تعديل/حفظ الوثيقة هنا
  try { await postIfDeliveredOnce(order); } catch (e) {
    console.error("Accounting posting failed (adminChangeStatus):", (e as Error).message);
  }

  broadcastOrder("order.status", order._id.toString(), {
    status,
    by: getActor(req).role,
  });

  res.json(order);
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const firebaseUID = (req as any).firebaseUser?.uid;
    if (!firebaseUID) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const orderId = req.params.id;
    const user = await User.findOne({ firebaseUID }).exec();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const order: any = await DeliveryOrder.findOne({ _id: orderId, user: user._id });
    if (!order) {
      res.status(404).json({ message: "Order not found or not yours" });
      return;
    }

    if (!canTransition(order.status, "cancelled")) {
      res.status(400).json({ message: "Cannot cancel at this stage" });
      return;
    }

    pushStatusHistory(order, "cancelled", "customer", "User cancelled", "customer");
    await order.save({ validateModifiedOnly: true }); 
    res.json({ message: "Order cancelled", order });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrderNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const scope = (req.query.visibility as string) || "auto"; // "public" | "internal" | "auto"
    const sort = ((req.query.sort as string) || "asc").toLowerCase() as "asc" | "desc";

    // العميل لا يُسمح له بقراءة ملاحظات طلب لا يملكه
    let query: any = { _id: id };
    if (actor.role === "customer") {
      const firebaseUID = (req as any).firebaseUser?.uid;
      const dbUser = await User.findOne({ firebaseUID }).select("_id");
      if (!dbUser) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      query.user = dbUser._id;
    }

    const order: any = await DeliveryOrder.findOne(query).select("notes").lean();
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    let notes = order.notes || [];

    // فلترة بحسب الـvisibility المطلوبة
    if (scope === "public") {
      notes = notes.filter((n: any) => n.visibility === "public");
    } else if (scope === "internal") {
      if (actor.role === "customer") {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      notes = notes.filter((n: any) => n.visibility === "internal");
    } else {
      // auto: العميل يرى العامة فقط، والباقون يرون الكل
      if (actor.role === "customer") {
        notes = notes.filter((n: any) => n.visibility === "public");
      }
    }

    // ترتيب
    notes.sort((a: any, b: any) =>
      sort === "asc"
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    notes = sanitizeNotes(notes);

    res.json(notes);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orders = await DeliveryOrder.find({ user: userId }).sort({ createdAt: -1 }).lean();
    const actor = getActor(req);
    const sanitized = orders.map(o => ({
      ...o,
      notes: actor.role === "customer" ? (o.notes || []).filter((n:any)=> n.visibility==="public") : o.notes
    }));
    res.json(sanitized);
    
    
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
// POST /orders/:id/repeat
export const repeatOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. التحقق من هوية المستخدم
    const firebaseUID = req.user?.id;
    if (!firebaseUID) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await User.findOne({ firebaseUID }).session(session);
    if (!user) {
      throw new Error("المستخدم غير موجود");
    }

    // 2. جلب الطلب القديم والتأكد من ملكية المستخدم
    const oldOrder = await DeliveryOrder.findById(req.params.id).session(
      session
    );
    if (!oldOrder) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    if (!oldOrder.user.equals(user._id)) {
      res.status(403).json({ message: "Not your order" });
      return;
    }

    // 3. جلب استراتيجية التسعير
    const strategy = await PricingStrategy.findOne().session(session);
    if (!strategy) {
      throw new Error("استراتيجية التسعير غير مكوَّنة");
    }

    // 4. إعادة بناء subOrders بدون سائق وحالة أولية
    const subOrdersData = oldOrder.subOrders.map((so) => ({
      store: so.store,
      items: so.items.map((i) => ({
        product: i.product,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      driver: null,
      status: "pending_confirmation" as const,
    }));

    // 5. حساب رسوم التوصيل مرة أخرى بناءً على العنوان القديم
    let deliveryFee = 0;
    for (const so of subOrdersData) {
      const store = await DeliveryStore.findById(so.store).session(session);
      if (!store) continue;
      const distKm =
        getDistance(
          { latitude: store.location.lat, longitude: store.location.lng },
          {
            latitude: oldOrder.address.location.lat,
            longitude: oldOrder.address.location.lng,
          }
        ) / 1000;
      deliveryFee += calculateDeliveryPrice(distKm, strategy);
    }

    // 6. حساب companyShare و platformShare بناءً على الأسعار القديمة
    let totalCompanyShare = 0;
    let totalPlatformShare = 0;
    for (const so of subOrdersData) {
      const store = await DeliveryStore.findById(so.store).session(session);
      if (!store) continue;
      const subTotal = so.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0
      );
      const rate = store.takeCommission ? store.commissionRate : 0;
      const companyShare = subTotal * rate;
      totalCompanyShare += companyShare;
      totalPlatformShare += subTotal - companyShare;
    }

    // 7. التجهيز للنشر (سعر السلع + الرسوم)
    const cartTotal = oldOrder.subOrders
      .flatMap((so) => so.items)
      .reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    const totalPrice = cartTotal + deliveryFee;

    // 8. إعداد الطلب الجديد
    const newOrder = new DeliveryOrder({
      user: user._id,
      deliveryMode: oldOrder.deliveryMode,
      scheduledFor: req.body.scheduledFor || null,
      address: oldOrder.address,
      subOrders: subOrdersData,
      deliveryFee,
      price: totalPrice,
      companyShare: totalCompanyShare,
      platformShare: totalPlatformShare,
      notes: sanitizeNotes(oldOrder.notes),
      paymentMethod: oldOrder.paymentMethod,
      status: "pending_confirmation",
      paid: false,
    });

    // 9. حفظ الطلب
    await newOrder.save({ session });
    await session.commitTransaction();

    res.status(201).json(newOrder);
    return;
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
    return;
  } finally {
    session.endSession();
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await DeliveryOrder.findById(req.params.id)
    .populate({ path: 'user', select: 'fullName name email phone' })
    .populate({ path: 'driver', select: 'fullName phone' })
    .populate({ path: 'subOrders.store', select: 'name logo address' })
    .populate({ path: 'subOrders.driver', select: 'fullName phone' })
    .populate({ path: 'items.store', select: 'name logo' });
  
    if (!order) {
      res.status(404).json({ message: "الطلب غير موجود" });
      return;
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, city, storeId, driverId, from, to, paymentMethod } = req.query as any;

    const and: any[] = [];
    if (status) and.push({ status });
    if (city) and.push({ "address.city": city });
    if (paymentMethod) and.push({ paymentMethod });

    if (storeId) {
      and.push({
        $or: [
          { "subOrders.store": storeId },
          { "items.store": storeId },
        ],
      });
    }

    if (driverId) {
      and.push({
        $or: [
          { driver: driverId },
          { "subOrders.driver": driverId },
        ],
      });
    }

    if (from || to) {
      const range: any = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      and.push({ createdAt: range });
    }

    const filter = and.length ? { $and: and } : {};

    const orders = await DeliveryOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "user", select: "fullName name email phone" })
      .populate({ path: "driver", select: "fullName phone" })
      .populate({ path: "subOrders.store", select: "name logo address" })
      .populate({ path: "subOrders.driver", select: "fullName phone" })
      .populate({ path: "items.store", select: "name logo" });

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// تحديث الحالة - مخصص للسائق أو الأدمن فقط
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason, returnBy } = req.body as {
      status: OrderStatus; reason?: string; returnBy?: string;
    };

    const actor = getActor(req);
    if (!["admin","driver","store"].includes(actor.role)) {
       res.status(403).json({ message: "Forbidden" });
       return;
    }

    const order: any = await DeliveryOrder.findById(id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (!canTransition(order.status, status)) {
      res.status(400).json({ message: `Invalid transition from ${order.status} to ${status}` });
      return;
    }
    if (status === "assigned" && !order.assignedAt) order.assignedAt = new Date();

    pushStatusHistory(order, status, actor.role as any, reason, returnBy as any);
    await order.save();
    try {
      await postIfDeliveredOnce(order);
    } catch (e) {
      console.error("Accounting posting failed (updateOrderStatus):", (e as Error).message);
    }
    // إشعار مختصر (اختياري)
    io.to(`user_${order.user.toString()}`).emit("notification", {
      title: `حالة الطلب #${order._id}`,
      body: `الحالة: ${status}`,
      data: { orderId: order._id.toString() },
      isRead: false,
      createdAt: new Date(),
    });
    broadcastOrder("order.status", order._id.toString(), {
      status,
      by: getActor(req).role,
    });
    
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

