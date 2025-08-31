import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Driver from "../../models/Driver_app/driver";

import { User } from "../../models/user";
import { OTP } from "../../models/otp";
import { generateOTP } from "../../utils/otp";
import { sendWhatsAppMessage } from "../../utils/whatsapp";
import Order from "../../models/delivry_Marketplace_V1/Order";
import driverReviewModel from "../../models/Driver_app/driverReview.model";
import mongoose, { Types } from "mongoose";
import dispatchOffer from "../../models/dispatchOffer";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

// تسجيل الدخول
// controllers/driver_app/driver.controller.ts
export const loginDriver = async (req: Request, res: Response) => {
  try {
    const { phone, password, emailOrPhone } = req.body;

    const identifier = (emailOrPhone ?? phone ?? "").toString().trim();
    if (!identifier || !password) {
      res
        .status(400)
        .json({ message: "phone/email and password are required" });
      return;
    }

    const query = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    const driver = await Driver.findOne(query);
    if (!driver) {
      res.status(404).json({ message: "Driver not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      {
        id: driver._id.toString(),
        role: "driver",
        driverType: driver.driverType,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      driver: {
        _id: driver._id,
        fullName: driver.fullName,
        phone: driver.phone,
        email: driver.email,
        role: driver.role,
        vehicleType: driver.vehicleType,
        driverType: driver.driverType,
        isAvailable: driver.isAvailable,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// تغيير كلمة المرور
export const changePassword = async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const driver = await Driver.findById(req.user.id);

  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  const isMatch = await bcrypt.compare(oldPassword, driver.password);
  if (!isMatch) {
    res.status(400).json({ message: "Incorrect old password" });
    return;
  }

  driver.password = await bcrypt.hash(newPassword, 10);
  await driver.save();

  res.json({ message: "Password updated successfully" });
};

export const updateLocation = async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  const driver = await Driver.findByIdAndUpdate(
    req.user.id,
    {
      // تحديث currentLocation القديم (إبق عليه لو تريد عرض آخر موقع)
      currentLocation: {
        lat,
        lng,
        updatedAt: new Date(),
      },
      // تحديث الحقل الجديد location
      location: {
        type: "Point",
        coordinates: [lng, lat], // GeoJSON expects [lng, lat]
      },
    },
    { new: true }
  );
  res.json(driver);
};

export const updateAvailability = async (req: Request, res: Response) => {
  const { isAvailable } = req.body;
  const driver = await Driver.findByIdAndUpdate(
    req.user.id,
    { isAvailable },
    { new: true }
  );
  res.json(driver);
};

export const getMyProfile = async (req: Request, res: Response) => {
  const driver = await Driver.findById(req.user.id).select("-password");
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }
  res.json(driver);
};

export const updateMyProfile = async (req: Request, res: Response) => {
  const allowedFields = [
    "fullName",
    "email",
    "vehicleType",
    "residenceLocation",
  ];
  const updates: any = {};

  for (const field of allowedFields) {
    if (req.body[field]) updates[field] = req.body[field];
  }

  const driver = await Driver.findByIdAndUpdate(req.user.id, updates, {
    new: true,
  }).select("-password");
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }
  res.json(driver);
};

export const addOtherLocation = async (req: Request, res: Response) => {
  const { label, lat, lng } = req.body;
  const driver = await Driver.findById(req.user.id);
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  driver.otherLocations.push({ label, lat, lng, updatedAt: new Date() });
  await driver.save();

  res.json(driver.otherLocations);
};
export const deleteOtherLocation = async (req: Request, res: Response) => {
  const index = parseInt(req.params.index);
  const driver = await Driver.findById(req.user.id);
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  if (index < 0 || index >= driver.otherLocations.length) {
    res.status(400).json({ message: "Invalid location index" });
    return;
  }

  driver.otherLocations.splice(index, 1);
  await driver.save();

  res.json(driver.otherLocations);
};

export const getMyOrders = async (req: Request, res: Response) => {
  const did = new Types.ObjectId(req.user.id);
  const allowed = ["preparing", "assigned", "out_for_delivery"]; // ما يظهر في تطبيق السائق

  // طلبات مسندة على المستوى العلوي:
  const top = await Order.find({ driver: did, status: { $in: allowed } })
    .select("_id status price address")
    .sort({ createdAt: -1 })
    .lean();

  // طلبات مسندة على مستوى subOrders:
  const subs = await Order.aggregate([
    { $match: { "subOrders.driver": did } },
    {
      $project: {
        _id: 1,
        address: 1,
        price: 1,
        subOrders: {
          $filter: {
            input: "$subOrders",
            as: "s",
            cond: {
              $and: [
                { $eq: ["$$s.driver", did] },
                { $in: ["$$s.status", allowed] },
              ],
            },
          },
        },
      },
    },
    { $unwind: "$subOrders" },
    {
      $project: {
        _id: 1,
        status: "$subOrders.status",
        price: 1,
        address: 1,
        subId: "$subOrders._id",
      },
    },
  ]);

  // توحيد الشكل للفرونت
  const combined = [
    ...top.map((o) => ({
      _id: o._id,
      status: o.status,
      price: o.price,
      address: o.address,
      subId: null,
    })),
    ...subs.map((s) => ({
      _id: s._id,
      status: s.status,
      price: s.price,
      address: s.address,
      subId: s.subId,
    })),
  ];

  res.json(combined);
};

// POST /driver/complete/:orderId  (?subId=...)
export const completeOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { subId } = req.query as { subId?: string };
  const driverId = req.user.id;

  const order: any = await Order.findById(orderId);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (subId) {
    const sub = order.subOrders.id(subId);
    if (!sub) {
      res.status(404).json({ message: "SubOrder not found" });
      return;
    }
    if (!sub.driver || sub.driver.toString() !== driverId) {
      res.status(403).json({ message: "Not your sub-order" });
      return;
    }
    // سلّم الفرعي
    sub.status = "delivered";
    sub.statusHistory.push({ status: "delivered", changedAt: new Date(), changedBy: "driver" });

    // إن اكتملت كل الـ subOrders، أكمِل العلوي
    if (order.subOrders.every((s: any) => s.status === "delivered")) {
      order.status = "delivered";
      order.deliveredAt = new Date();
      order.statusHistory.push({ status: "delivered", changedAt: new Date(), changedBy: "driver" });
    }
  } else {
    // علوي
    if (!order.driver || order.driver.toString() !== driverId) {
      res.status(403).json({ message: "Not your order" });
      return;
    }
    order.status = "delivered";
    order.deliveredAt = new Date();
    order.statusHistory.push({ status: "delivered", changedAt: new Date(), changedBy: "driver" });
  }

  // لو عندك مشكلة notes قديمة:
  // order.notes = sanitizeNotes(order.notes);
  await order.save({ validateModifiedOnly: true });

  res.json({ message: "Order marked as delivered", order });
};


export const addReviewForUser = async (req: Request, res: Response) => {
  const { orderId, userId, rating, comment } = req.body;

  const existing = await driverReviewModel.findOne({
    orderId,
    driverId: req.user.id,
  });
  if (existing) {
    res.status(400).json({ message: "You have already reviewed this order." });
    return;
  }

  const review = await driverReviewModel.create({
    orderId,
    driverId: req.user.id,
    userId,
    rating,
    comment,
  });

  res.status(201).json(review);
};
export const listDriverOffers = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const now = new Date();

  const offers = await dispatchOffer.find({
    driver: driverId,
    status: "pending",
    expiresAt: { $gt: now },
  }).lean();

  // جِب مختصر الطلبات
  const orderIds = [...new Set(offers.map((o) => o.order.toString()))];
  const orders = await Order.find({ _id: { $in: orderIds } })
    .select("_id price address status")
    .lean();

  const map = new Map(orders.map((o) => [o._id.toString(), o]));
  const payload = offers.map((o) => ({
    offerId: o._id.toString(),
    orderId: o.order.toString(),
    subId: o.subOrder ? o.subOrder.toString() : null,
    expiresAt: o.expiresAt,
    order: map.get(o.order.toString()) || null,
  }));

  res.json(payload);
};

export const acceptOffer = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const { offerId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const offer: any = await dispatchOffer.findOne({
      _id: offerId,
      driver: driverId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).session(session);

    if (!offer) {
      await session.abortTransaction();
      res.status(409).json({ message: "Offer not available" });
      return;
    }

    const order: any = await Order.findById(offer.order).session(session);
    if (!order) {
      await session.abortTransaction();
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // هل تم الإسناد مسبقًا؟
    if (offer.subOrder) {
      const sub = order.subOrders.id(offer.subOrder);
      if (!sub) {
        await session.abortTransaction();
        res.status(404).json({ message: "SubOrder not found" });
        return;
      }
      if (sub.driver) {
        // ضاعت عليك — حدّث العرض كمنتهي
        await dispatchOffer.findByIdAndUpdate(offer._id, { status: "expired" }, { session });
        await session.commitTransaction();
        res.status(409).json({ message: "Already assigned" });
        return;
      }

      // إسناد فعلي للفرعي
      sub.driver = new mongoose.Types.ObjectId(driverId);
      order.assignedAt = order.assignedAt ?? new Date();
      order.statusHistory.push({ status: "assigned", changedAt: new Date(), changedBy: "driver" });
    } else {
      if (order.driver) {
        await dispatchOffer.findByIdAndUpdate(offer._id, { status: "expired" }, { session });
        await session.commitTransaction();
        res.status(409).json({ message: "Already assigned" });
        return;
      }
      // إسناد علوي
      order.driver = new mongoose.Types.ObjectId(driverId);
      order.assignedAt = new Date();
      order.statusHistory.push({ status: "assigned", changedAt: new Date(), changedBy: "driver" });
    }

    await order.save({ session, validateModifiedOnly: true });

    // قَبِل العرض
    await dispatchOffer.findByIdAndUpdate(
      offer._id,
      { status: "accepted", acceptedAt: new Date() },
      { session }
    );

    // ألغِ بقية العروض المعلقة لهذا الطلب/الفرعي
    await dispatchOffer.updateMany(
      { order: offer.order, subOrder: offer.subOrder, status: "pending" },
      { $set: { status: "canceled" } },
      { session }
    );

    await session.commitTransaction();

    // إشعارات (اختياري)
    // io.to(`user_${order.user.toString()}`).emit("notification", { ... });
    // io.to(`driver_${driverId}`).emit("assignment:confirmed", { orderId: order._id });

    res.json({ message: "Assigned to you", orderId: order._id.toString(), subId: offer.subOrder || null });
  } catch (e: any) {
    await session.abortTransaction();
    res.status(500).json({ message: e.message });
  } finally {
    session.endSession();
  }
};

export const initiateTransferToUser = async (req: Request, res: Response) => {
  const { amount, transferToPhone, transferToName } = req.body;

  const driver = await Driver.findById(req.user.id);
  if (driver.wallet.balance < amount) {
    res.status(400).json({ message: "Insufficient balance" });
    return;
  }

  const user = await User.findOne({
    phone: transferToPhone,
    fullName: transferToName,
  });
  if (!user) {
    res.status(404).json({ message: "No matching user found" });
    return;
  }
  if (!amount || amount <= 0) {
    res.status(400).json({ message: "Invalid amount" });
    return;
  }

  const otpCode = generateOTP(); // e.g., returns '438201'
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OTP.create({
    userId: req.user.id,
    purpose: "driver_wallet_transfer",
    code: otpCode,
    expiresAt,
    metadata: { amount, userId: user._id },
  });
  await OTP.deleteMany({
    userId: req.user.id,
    purpose: "driver_wallet_transfer",
    used: false,
  });

  try {
    await sendWhatsAppMessage(
      driver.phone,
      `📲 رمز تحويل الرصيد هو: *${otpCode}*...`
    );
  } catch (err) {
    console.error("WhatsApp Error", err);
  }
  res.json({ message: "Verification code sent to your phone" });
};
export const updateJokerWindow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { jokerFrom, jokerTo } = req.body;

  // تأكد من أن معرّف سليم
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid driver ID" });
    return;
  }

  // يجب أن يُرسل الأدمن التوقيتين
  if (!jokerFrom || !jokerTo) {
    res
      .status(400)
      .json({ message: "jokerFrom and jokerTo are both required" });
    return;
  }

  const fromDate = new Date(jokerFrom);
  const toDate = new Date(jokerTo);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ message: "Invalid date format" });
    return;
  }

  // حدِّد التحديث؛ لا نغيّر driverType هنا، فقط نحدّث الأوقات
  const updates: Partial<{ jokerFrom: Date; jokerTo: Date }> = {
    jokerFrom: fromDate,
    jokerTo: toDate,
  };

  const driver = await Driver.findByIdAndUpdate(id, updates, { new: true });
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  res.json({
    message: "Joker window updated successfully",
    jokerFrom: driver.jokerFrom,
    jokerTo: driver.jokerTo,
  });
  return;
};
export const changeDriverType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { driverType, jokerFrom, jokerTo } = req.body;
  const updates: any = { driverType };

  if (driverType === "joker") {
    // حقلَي الوقت إجباريّان لمن هم من نوع جوكر
    if (!jokerFrom || !jokerTo) {
      res.status(400).json({ message: "يجب تحديد jokerFrom و jokerTo للجوكر" });
      return;
    }
    updates.jokerFrom = new Date(jokerFrom);
    updates.jokerTo = new Date(jokerTo);
  } else {
    // لو حولناه لأساسي، ننظف القيم القديمة
    updates.jokerFrom = undefined;
    updates.jokerTo = undefined;
  }

  const driver = await Driver.findByIdAndUpdate(id, updates, { new: true });
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};
export const confirmTransferToUser = async (req: Request, res: Response) => {
  const { code } = req.body;

  const otp = await OTP.findOne({
    userId: req.user.id,
    code,
    purpose: "driver_wallet_transfer",
    expiresAt: { $gt: new Date() },
    used: false,
  });

  if (!otp) {
    res.status(400).json({ message: "Invalid or expired code" });
    return;
  }

  const driver = await Driver.findById(req.user.id);
  const user = await User.findById(otp.metadata.userId);

  const amount = otp.metadata.amount;
  if (driver.wallet.balance < amount) {
    res.status(400).json({ message: "Insufficient balance" });
    return;
  }

  driver.wallet.balance -= amount;
  user.wallet.balance += amount;

  await driver.save();
  await user.save();

  otp.used = true;
  await otp.save();

  res.json({ message: "Transfer successful", amount, target: user.phone });
};
