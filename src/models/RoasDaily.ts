// models/RoasDaily.ts
import { Schema, model } from 'mongoose';

const RoasDaily = new Schema({
  day:      { type: Date, index: true },        // بداية اليوم (UTC)
  source:   { type: String, default: 'unknown', index: true },  // google/meta/tiktok/organic/...
  campaign: { type: String, default: 'unknown', index: true },  // اختياري لو تسميتك متطابقة
  revenue:      { type: Number, default: 0 },
  conversions:  { type: Number, default: 0 },
  cost:         { type: Number, default: 0 },
  roas:         { type: Number, default: 0 },   // revenue / cost
  cpa:          { type: Number, default: 0 },   // cost / conversions
  updatedAt:    { type: Date, default: Date.now }
});
// فريد لكل (يوم، مصدر، حملة)
RoasDaily.index({ day: 1, source: 1, campaign: 1 }, { unique: true });

export default model('RoasDaily', RoasDaily);
