// services/analytics/roas.ts
import MarketingEvent from '../../models/MarketingEvent';
import AdSpend from '../../models/AdSpend';
import RoasDaily from '../../models/RoasDaily';

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0,0,0,0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x;
}

// احسب يومًا واحدًا
export async function computeRoasForDay(dayUTC: Date) {
  const from = startOfDayUTC(dayUTC);
  const to   = addDays(from, 1);

  // 1) إيراد/كونفرجنز من الأحداث
  const revenueRows = await MarketingEvent.aggregate([
    { $match: { type: 'first_order', ts: { $gte: from, $lt: to } } },
    { $lookup: {               // اربط المستخدم للحصول على UTM
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'u'
    }},
    { $addFields: {
        utm: { $ifNull: [{ $arrayElemAt: ['$u.utm', 0] }, {}] },
        day: { $dateTrunc: { date: '$ts', unit: 'day', timezone: 'UTC' } },
        revenueFromEvent: '$props.value'
    }},
    // لو لم توجد قيمة في الحدث، جرّب قراءة Order.total (اختياري)
    { $lookup: {
        from: 'orders',
        localField: 'props.orderId',
        foreignField: '_id',
        as: 'ord', pipeline: [{ $project: { total: 1 } }]
    }},
    { $addFields: {
        revenue: { $ifNull: ['$revenueFromEvent', { $first: '$ord.total' }] }
    }},
    { $project: {
        day: 1,
        source:   { $ifNull: ['$utm.source', 'unknown'] },
        campaign: { $ifNull: ['$utm.campaign', 'unknown'] },
        revenue:  { $ifNull: ['$revenue', 0] }
    }},
    { $group: {
        _id: { day: '$day', source: '$source', campaign: '$campaign' },
        revenue:     { $sum: '$revenue' },
        conversions: { $sum: 1 }
    }}
  ]);

  // 2) التكلفة (AdSpend) لليوم نفسه
  const costRows = await AdSpend.aggregate([
    { $match: { date: { $gte: from, $lt: to } } },
    { $group: {
        _id: { day: { $dateTrunc: { date: '$date', unit: 'day', timezone: 'UTC' } },
               source: '$source', campaign: '$campaignId' },
        cost: { $sum: '$cost' }
    }}
  ]);

  // 3) دمج النتيجتين (بالمصدر + الحملة). إن لم تتطابق أسماء الحملات، ستحصل على دمجين منفصلين — يمكنك لاحقًا إضافة جدول Mapping.
  const key = (d: any) => `${d._id.source}__${d._id.campaign}`;
  const map: Record<string, {day: Date; source: string; campaign: string; revenue: number; conversions: number; cost: number}> = {};

  revenueRows.forEach(r => {
    const k = `${r._id.source}__${r._id.campaign}`;
    map[k] = {
      day: r._id.day,
      source: r._id.source,
      campaign: r._id.campaign,
      revenue: r.revenue || 0,
      conversions: r.conversions || 0,
      cost: 0
    };
  });
  costRows.forEach(c => {
    const k = `${c._id.source}__${c._id.campaign}`;
    if (!map[k]) {
      map[k] = {
        day: c._id.day,
        source: c._id.source,
        campaign: c._id.campaign ?? 'unknown',
        revenue: 0,
        conversions: 0,
        cost: c.cost || 0
      };
    } else {
      map[k].cost += c.cost || 0;
    }
  });

  // 4) كتابة RoasDaily (upsert)
  for (const v of Object.values(map)) {
    const roas = v.cost > 0 ? v.revenue / v.cost : (v.revenue > 0 ? Infinity : 0);
    const cpa  = v.conversions > 0 ? v.cost / v.conversions : 0;
    await RoasDaily.updateOne(
      { day: v.day, source: v.source, campaign: v.campaign },
      { $set: {
          revenue: v.revenue, conversions: v.conversions, cost: v.cost,
          roas, cpa, updatedAt: new Date()
      }},
      { upsert: true }
    );
  }
}

// احسب مدى زمني (للباك-فِل)
export async function computeRoasRange(from: Date, to: Date) {
  for (let d = startOfDayUTC(from); d < to; d = addDays(d, 1)) {
    await computeRoasForDay(d);
  }
}
