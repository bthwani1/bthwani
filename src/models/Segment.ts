// models/Segment.ts
import { Schema, model } from 'mongoose';

const Segment = new Schema({
  name: { type:String, required:true, unique:true },
  rules: { type: Schema.Types.Mixed, required: true }, // rules_json
  dynamic: { type:Boolean, default:true }, // إذا false نخزّن لقطة أعضاء
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastSyncedAt: { type: Date }
});
Segment.index({ name: 1 }, { unique: true });
export default model('Segment', Segment);
