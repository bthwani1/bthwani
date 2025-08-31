import cron from "node-cron";
import dayjs from "dayjs";
import PartnerPerformanceDaily from "../models/parenter/PartnerPerformanceDaily";
import mongoose from "mongoose";

// ملاحظة: استخدم اسم موديل الطلبات لديك (مثال شائع)
const DeliveryOrder = mongoose.model("DeliveryOrder"); 

let lastRun = { at: null as null | string, updated: 0, durationMs: 0 };

export async function buildPartnerDaily(dayISO?: string) {
  const day = dayISO || dayjs().subtract(1,"day").tz().format("YYYY-MM-DD");
  const start = dayjs.tz(day).startOf("day").toDate();
  const end = dayjs.tz(day).endOf("day").toDate();

  // Pipeline يحسب: orders, gmv, cancels, avgPrepMin, complaints
  const res = await DeliveryOrder.aggregate([
    { $match: {
      createdAt: { $gte: start, $lte: end },
      status: { $in: ["delivered","paid","cancelled"] }
    }},
    { $group: {
      _id: { store: "$store" },
      orders: { $sum: { $cond: [{ $in: ["$status", ["delivered","paid"]] }, 1, 0] } },
      gmv: { $sum: { $cond: [{ $in: ["$status", ["delivered","paid"]] }, "$totalAmount", 0] } },
      cancels: { $sum: { $cond: [{ $eq: ["$status","cancelled"] }, 1, 0] } },
      // متوسط التحضير بالدقائق إذا كان لديك حقول readyAt/acceptedAt
      avgPrepMin: { $avg: {
        $divide: [
          { $subtract: ["$readyAt","$acceptedAt"] }, 60000
        ]
      }},
      complaints: { $sum: { $cond: ["$hasComplaint", 1, 0] } }
    }},
    { $project: {
      store: "$_id.store", _id: 0, day,
      orders: 1, gmv: { $ifNull: ["$gmv", 0] },
      cancels: { $ifNull: ["$cancels", 0] },
      avgPrepMin: { $ifNull: ["$avgPrepMin", 0] },
      complaints: { $ifNull: ["$complaints", 0] },
    }}
  ]);

  let updated = 0;
  for (const row of res) {
    await PartnerPerformanceDaily.updateOne(
      { store: row.store, day },
      { $set: row },
      { upsert: true }
    );
    updated++;
  }
  return updated;
}

export function scheduleDailyPerf() {
  // 01:00 بتوقيت Asia/Aden
  cron.schedule("0 1 * * *", async () => {
    const t0 = Date.now();
    const day = dayjs().subtract(1,"day").format("YYYY-MM-DD");
    const updated = await buildPartnerDaily(day);
    lastRun = { at: new Date().toISOString(), updated, durationMs: Date.now()-t0 };
  }, { timezone: "Asia/Aden" });
}

export function getCronHealth() {
  return lastRun;
}
