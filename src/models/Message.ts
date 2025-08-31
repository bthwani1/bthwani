// models/Message.ts
import { Schema, model } from 'mongoose';

const Message = new Schema({
  channel: { type: String, enum: ['push','sms','inapp'], required: true },
  title:   { type: String },
  body:    { type: String, required: true },
  segmentId: { type: Schema.Types.ObjectId, ref:'Segment' },
  userIds: [String], // بديل عن segment
  scheduleAt: { type: Date }, // إن كان null → إرسال فوري
  status: { type: String, enum: ['draft','scheduled','sent','failed'], default: 'scheduled' },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  sentAt: { type: Date }
});
Message.index({ status:1, scheduleAt:1 });
export default model('Message', Message);
