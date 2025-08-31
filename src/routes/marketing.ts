// routes/marketing.ts
import express from 'express';
import MarketingEvent from '../models/MarketingEvent';
import Order from '../models/delivry_Marketplace_V1/Order';
import { User } from '../models/user';
import AdSpend from '../models/AdSpend';

const r = express.Router();

// حفظ حدث (محمي أو عام حسب ميدلوير المصادقة عندك)
r.post('/events', async (req, res) => {
  const userId = (req as any).user?.id; // إن كان عندك ميدلوير تحقق Firebase
  const { type, ts, ...props } = req.body;
  await MarketingEvent.create({ userId, type, ts, props });
  res.json({ ok: true });
});

// KPIs أساسية
r.get('/marketing/kpis', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30*864e5);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  const newUsers = await User.countDocuments({ createdAt: { $gte: from, $lte: to } });
  const firstOrders = await MarketingEvent.countDocuments({ type:'first_order', ts: { $gte: from, $lte: to } });

  const spendAgg = await AdSpend.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $group: { _id: null, cost: { $sum: '$cost' } } }
  ]);
  const spend = spendAgg?.[0]?.cost || 0;

  res.json({ newUsers, conversions: firstOrders, spend });
});

export default r;