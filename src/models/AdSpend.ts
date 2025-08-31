// models/AdSpend.ts
import { Schema, model } from 'mongoose';

const AdSpend = new Schema({
  date:       { type: Date, index: true },
  source:     { type: String, enum: ['google','meta','tiktok','other'], index: true },
  campaignId: { type: String, index: true },
  impressions: Number,
  clicks: Number,
  conversions: Number,
  cost: Number
});

// ضمان عدم التكرار لنفس اليوم/المصدر/الحملة
AdSpend.index({ date: 1, source: 1, campaignId: 1 }, { unique: true });

export default model('AdSpend', AdSpend);
