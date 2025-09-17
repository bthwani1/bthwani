import { Request, Response } from "express";
import mongoose from "mongoose";
import DeliveryOrder from "../../models/delivry_Marketplace_V1/Order";
import { User } from "../../models/user";
import { feeUtility, priceUtility } from "../../utils/pricing";
import { io } from "../../index";
import { broadcastOrder } from "../../sockets/orderEvents";

function sanitizeNotes(raw: any): any[] {
  const toNote = (v: any) => {
    if (typeof v === "string") {
      const body = v.trim();
      if (!body) return null;
      return {
        body,
        visibility: "public",
        byRole: "customer",
        createdAt: new Date(),
      };
    }
    if (v && typeof v === "object") {
      const body = (v.body ?? "").toString().trim();
      if (!body) return null;
      const visibility = v.visibility === "public" ? "public" : "internal";
      const byRole = [
        "customer",
        "admin",
        "store",
        "driver",
        "system",
      ].includes(v.byRole)
        ? v.byRole
        : "customer";
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

export const createUtilityOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const firebaseUID = (req as any).firebaseUser?.uid;
    if (!firebaseUID) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await User.findOne({ firebaseUID }).session(session);
    if (!user) throw new Error("المستخدم غير موجود");

    const {
      kind, // "gas" | "water"
      variant, // "20L" أو "small|medium|large"
      quantity, // الماء يسمح 0.5
      city, // إن ما انذكر: نستخدم City من العنوان
      addressId,
      scheduledFor,
      paymentMethod, // "cash" | "wallet" | "card" | "mixed"
      notes,
    } = req.body as any;

    if (
      !kind ||
      !variant ||
      typeof quantity === "undefined" ||
      !paymentMethod
    ) {
      res.status(400).json({ message: "بيانات ناقصة" });
      return;
    }
    if (scheduledFor && new Date(scheduledFor) <= new Date()) {
      throw new Error("الوقت المجدول يجب أن يكون في المستقبل");
    }

    // اختيار العنوان
    const targetId = addressId || user.defaultAddressId?.toString();
    const chosenAddress = user.addresses.find(
      (a: any) => a._id.toString() === targetId
    );
    if (!chosenAddress?.location) throw new Error("العنوان غير صالح");

    const finalCity = city || chosenAddress.city;

    // تسعير الوحدة (تجميد السعر)
    const priceInfo = await priceUtility({
      city: finalCity,
      kind,
      variant,
      quantity: Number(quantity),
    });

    // رسوم التوصيل (حسب سياسة المدينة/النوع)
    const deliveryFee = await feeUtility({
      city: finalCity,
      kind,
      destination: {
        lat: chosenAddress.location.lat,
        lng: chosenAddress.location.lng,
      },
    });

    const itemsTotal = priceInfo.subtotal;
    const totalPrice = itemsTotal + deliveryFee;

    // محفظة/كاش
    let walletUsed = 0;
    if (paymentMethod === "wallet" || paymentMethod === "mixed") {
      walletUsed = Math.min(user.wallet.balance, totalPrice);
      user.wallet.balance -= walletUsed;
      await user.save({ session });
    }
    const cashDue = totalPrice - walletUsed;
    const finalPaymentMethod: "wallet" | "cash" | "card" | "mixed" =
      cashDue > 0
        ? paymentMethod === "wallet"
          ? "mixed"
          : paymentMethod
        : "wallet";
    const paid = cashDue === 0;

    // subOrder واحد بدون متجر؛ الأوبس يملؤوا origin لاحقاً
    const subOrders = [
      {
        store: undefined, // لا متجر
        origin: undefined, // يمكن تعبئته لاحقاً من لوحة التحكم
        items: [],
        driver: null,
        status: "pending_confirmation" as const,
        statusHistory: [
          {
            status: "pending_confirmation",
            changedAt: new Date(),
            changedBy: "customer" as const,
          },
        ],
      },
    ];

    // حصص المنصة: لا تاجر → كل المبلغ للمنصة
    const companyShare = 0;
    const platformShare = itemsTotal;

    const order = new DeliveryOrder({
      user: user._id,
      driver: null,
      items: [],
      subOrders,
      price: totalPrice,
      deliveryFee,
      companyShare,
      platformShare,
      walletUsed,
      cashDue,
      address: {
        label: chosenAddress.label,
        street: chosenAddress.street,
        city: chosenAddress.city,
        location: {
          lat: chosenAddress.location.lat,
          lng: chosenAddress.location.lng,
        },
      },
      deliveryMode: "unified",
      paymentMethod: finalPaymentMethod,
      paid,
      status: "pending_confirmation",
      statusHistory: [
        {
          status: "pending_confirmation",
          changedAt: new Date(),
          changedBy: "customer",
        },
      ],
      scheduledFor: scheduledFor || null,
      notes: sanitizeNotes(notes),
      orderType: "utility",
      utility: {
        kind,
        city: finalCity,
        variant,
        quantity: Number(quantity),
        unitPrice: priceInfo.unitPrice,
        subtotal: itemsTotal,
        cylinderSizeLiters: priceInfo.cylinderSizeLiters,
        tankerCapacityLiters: priceInfo.tankerCapacityLiters,
      },
    });

    await order.save({ session });
    await session.commitTransaction();

    // إشعار + بث
    io.to(`user_${user._id.toString()}`).emit("notification", {
      title: `تم إنشاء طلب الخدمة #${order._id}`,
      body: `المبلغ: ${order.price} ريال. بانتظار المعالجة.`,
      data: { orderId: order._id.toString() },
      isRead: false,
      createdAt: new Date(),
    });
    broadcastOrder("order.created", order._id.toString(), {
      status: order.status,
      price: order.price,
      city: order.address.city,
      kind,
    });

    res.status(201).json(order);
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};
// controllers/orders.utility.controller.ts (أضف)
export const setUtilitySubOrigin = async (req: Request, res: Response) => {
  try {
    const { orderId, subId } = req.params as any;
    const { label, city, lat, lng } = req.body as any;

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

    sub.origin = {
      label: label || "Utility Origin",
      city: city || order.address.city,
      location: { lat: Number(lat), lng: Number(lng) },
    };
    await order.save();

    res.json(sub.origin);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
