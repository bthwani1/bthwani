import mongoose from "mongoose";
import Driver from "../models/Driver_app/driver";
import DeliveryStore from "../models/delivry_Marketplace_V1/DeliveryStore";
import DeliveryOrder from "../models/delivry_Marketplace_V1/Order";
import DispatchOffer from "../models/dispatchOffer";
import { io } from ".."; // عدّل المسار حسب مشروعك

function nowPlus(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function jokerWindowMatch() {
  const now = new Date();
  return {
    $or: [
      { isJoker: false },
      { isJoker: true, jokerFrom: { $lte: now }, jokerTo: { $gte: now } },
    ],
  };
}

export async function getNearestAvailableDrivers(lng: number, lat: number, limit = 5, exclude: string[] = []) {
  const q: any = {
    isAvailable: true,
    isBanned: false,
    ...jokerWindowMatch(),
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 5000,
      },
    },
  };
  if (exclude.length) q._id = { $nin: exclude.map((id) => new mongoose.Types.ObjectId(id)) };
  return Driver.find(q).select("_id fullName phone driverType").limit(limit).lean();
}

/** بث عروض لسائقي unified (على مستوى order) */
export async function broadcastUnified(order: any, offerTTLmin = 2) {
  const storeId = order.subOrders?.[0]?.store;
  if (!storeId) return { sent: 0 };

  const store = await DeliveryStore.findById(storeId).lean();
  if (!store?.location) return { sent: 0 };

  const drivers = await getNearestAvailableDrivers(store.location.lng, store.location.lat, 5);
  let sent = 0;
  for (const d of drivers) {
    try {
      await DispatchOffer.create({
        order: order._id,
        subOrder: null,
        driver: d._id,
        status: "pending",
        expiresAt: nowPlus(offerTTLmin),
      });
      // Socket إشعار للسائق
      io.to(`driver_${d._id.toString()}`).emit("offer:new", {
        orderId: order._id.toString(),
        subId: null,
        expiresAt: nowPlus(offerTTLmin),
      });
      sent++;
    } catch (e) {
      // احتمال unique index أو غيره—تجاهله
    }
  }
  return { sent };
}

/** بث عروض لسائقي split (على مستوى subOrder) */
export async function broadcastSplit(order: any, offerTTLmin = 2) {
  let total = 0;
  for (const sub of order.subOrders) {
    const store = await DeliveryStore.findById(sub.store).lean();
    if (!store?.location) continue;

    const drivers = await getNearestAvailableDrivers(store.location.lng, store.location.lat, 5);
    for (const d of drivers) {
      try {
        await DispatchOffer.create({
          order: order._id,
          subOrder: sub._id,
          driver: d._id,
          status: "pending",
          expiresAt: nowPlus(offerTTLmin),
        });
        io.to(`driver_${d._id.toString()}`).emit("offer:new", {
          orderId: order._id.toString(),
          subId: sub._id.toString(),
          expiresAt: nowPlus(offerTTLmin),
        });
        total++;
      } catch (e) {}
    }
  }
  return { sent: total };
}

/** نقطة دخول عامة */
export async function broadcastOffersForOrder(orderId: string, offerTTLmin = 2) {
  const order = await DeliveryOrder.findById(orderId).lean();
  if (!order) return { sent: 0 };

  if (order.deliveryMode === "unified") {
    return broadcastUnified(order, offerTTLmin);
  } else {
    return broadcastSplit(order, offerTTLmin);
  }
}
