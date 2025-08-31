// models/SegmentMember.ts
import { Schema, model } from 'mongoose';

const SegmentMember = new Schema({
  segmentId: { type: Schema.Types.ObjectId, ref:'Segment', index: true },
  userId:    { type: String, index: true },
  addedAt:   { type: Date, default: Date.now }
});
SegmentMember.index({ segmentId:1, userId:1 }, { unique: true });

export default model('SegmentMember', SegmentMember);
