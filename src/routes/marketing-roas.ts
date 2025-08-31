// routes/marketing-roas.ts
import express from 'express';
import RoasDaily from '../models/RoasDaily';

const r = express.Router();

// GET /api/v1/marketing/roas?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=source|campaign|none
r.get('/marketing/roas', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now()-30*864e5);
    const to   = req.query.to   ? new Date(String(req.query.to))   : new Date();
    const groupBy = (req.query.groupBy as string) || 'source';

    const rows = await RoasDaily.find({ day: { $gte: from, $lt: to } }).lean().sort({ day: 1 });
    // شكل مُبسّط للواجهة الأمامية
    const byDay: Record<string, any> = {};
    for (const x of rows) {
      const k = x.day.toISOString().slice(0,10);
      if (!byDay[k]) byDay[k] = { day: k, revenue:0, cost:0, conversions:0, roas:0, cpa:0, series:{} as any };
      byDay[k].revenue += x.revenue;
      byDay[k].cost += x.cost;
      byDay[k].conversions += x.conversions;
      const key = groupBy === 'campaign' ? x.campaign : (groupBy === 'none' ? 'total' : x.source);
      byDay[k].series[key] = (byDay[k].series[key] || 0) + (x.revenue || 0);
    }
    const out = Object.values(byDay).map((d:any) => {
      d.roas = d.cost>0 ? d.revenue/d.cost : (d.revenue>0?Infinity:0);
      d.cpa  = d.conversions>0 ? d.cost/d.conversions : 0;
      return d;
    });
    res.json({ points: out });
  } catch (e) { next(e); }
});

export default r;
