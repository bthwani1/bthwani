// models/MessageMetric.ts
import { Schema, model } from 'mongoose';
const MessageMetric = new Schema({
  userId: { type: String, index: true },
  messageId: { type: Schema.Types.ObjectId, ref:'Message', index: true },
  channel: { type: String, enum: ['push','sms','inapp'] },
  event: { type: String, enum: ['sent','delivered','opened','clicked','converted'], index: true },
  ts: { type: Date, default: Date.now, index: true }
});
MessageMetric.index({ userId:1, ts:-1 });
export default model('MessageMetric', MessageMetric);
