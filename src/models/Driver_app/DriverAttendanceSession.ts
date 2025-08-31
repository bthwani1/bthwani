// models/DriverAttendanceSession.ts
import { Schema, model, Types } from "mongoose";
const SessionSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver", index: true, required: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date },
  startLoc: { lat: Number, lng: Number },
  endLoc: { lat: Number, lng: Number },
  deviceInfo: { type: Schema.Types.Mixed },
  status: { type: String, enum: ["open","closed"], default: "open", index: true },
}, { timestamps: true });
SessionSchema.index({ driver:1, startAt:-1 });
export default model("DriverAttendanceSession", SessionSchema);
