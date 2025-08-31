// models/DriverAttendanceDaily.ts
import { Schema, model } from "mongoose";
const DailySchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
  day: { type: String, required: true }, // "YYYY-MM-DD" Asia/Aden
  totalOnlineMins: { type: Number, default: 0 },
  firstCheckInAt: Date,
  lastCheckOutAt: Date,
  ordersDelivered: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 },
  breaksCount: { type: Number, default: 0 },
  shiftsMatched: [{ type: Schema.Types.ObjectId, ref: "DriverShift" }],
}, { timestamps: true });
DailySchema.index({ driver:1, day:1 }, { unique: true });
export default model("DriverAttendanceDaily", DailySchema);
