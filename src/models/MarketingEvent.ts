// models/MarketingEvent.ts
import { Schema, model } from 'mongoose';

const MarketingEvent = new Schema({
  userId: { type: String, index: true }, // استخرجه من الـtoken إن وجد
  type: { type: String, required: true },
  props: { type: Schema.Types.Mixed },
  ts: { type: Date, default: Date.now, index: true },
});
MarketingEvent.index({ userId: 1, ts: -1 });
MarketingEvent.index({ type: 1, ts: -1 });

export default model('MarketingEvent', MarketingEvent);
