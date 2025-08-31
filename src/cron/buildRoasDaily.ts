// TZ = Asia/Aden في بيئة التشغيل
import mongoose from "mongoose";
import RoasDaily from "../models/RoasDaily";
import AdSpend from "../models/AdSpend";

// ملاحظة: غيّر أسماء الحقول في orders أدناه حسب سكيمتك (total/amount/grandTotal)
const ORDERS = () => mongoose.connection.collection("orders");

export async function buildRoasForDay(dayISO: string) {
  // dayISO بصيغة YYYY-MM-DD (بالتقويم المحلي آسيا/عدن)
  const day = new Date(dayISO + "T00:00:00"); // سيُستخدم مع $dateTrunc TZ
  const tz = "Asia/Aden";

  // 1) إيراد اليوم حسب الحملة (إن كنت تُخزّن campaign/utm في الطلب/المستخدم)
  const revenueAgg = await ORDERS().aggregate([
    { $match: {
        status: { $in: ["delivered", "paid"] },
        createdAt: {
          $gte: day,
          $lt: new Date(new Date(day).setDate(day.getDate()+1))
        }
      } },
    { $addFields: {
        day: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: tz } },
        revenue: { $ifNull: ["$total", { $ifNull:["$amount","$grandTotal"] }] },
        campaign: { $ifNull: ["$utm.campaign", { $ifNull:["$campaignId","unknown"] }] },
        source:   { $ifNull: ["$utm.source",   { $ifNull:["$source","unknown"] }] }
      } },
    { $group: {
        _id: { day:"$day", source:"$source", campaign:"$campaign" },
        revenue: { $sum: "$revenue" },
        conversions: { $sum: 1 }
      } }
  ]).toArray();

  // 2) تكلفة الإعلانات (AdSpend) لنفس اليوم/المصدر/الحملة
  // نفترض AdSpend.date محفوظ بالتاريخ (بلا وقت) أو UTC — نطبّق dateTrunc في الاستعلام
  const spendDocs = await AdSpend.aggregate([
    { $addFields: {
        dday: { $dateTrunc: { date: "$date", unit: "day", timezone: tz } }
      } },
    { $match: {
        dday: day
      } },
    { $project: {
        _id:0, source:1, campaignId:1,
        cost: { $ifNull:["$cost", { $ifNull:["$Spend",0] }] }
      } }
  ]);

  const spendKey = (s: any) => `${s.source}::${s.campaignId||"unknown"}`;
  const spendMap = new Map(spendDocs.map(s => [spendKey(s), s.cost||0]));

  // 3) Upsert في RoasDaily
  for (const r of revenueAgg) {
    const source = r._id.source || "unknown";
    const campaign = r._id.campaign || "unknown";
    const cost = spendMap.get(`${source}::${campaign}`) || 0;
    const revenue = r.revenue || 0;
    const conversions = r.conversions || 0;

    const cpa = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? revenue / cost : (revenue > 0 ? Infinity : 0);

    await RoasDaily.updateOne(
      { day, source, campaign },
      { $set: { revenue, conversions, cost, cpa, roas, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}
