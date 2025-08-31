// models/DriverShiftAssignment.ts
import { Schema, model } from "mongoose";
const AssignSchema = new Schema({
  shiftId: { type: Schema.Types.ObjectId, ref: "DriverShift", required: true, index: true },
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
  status: { type: String, enum: ["assigned","attended","absent","late"], default: "assigned", index: true },
  checkInAt: Date,
  checkOutAt: Date,
}, { timestamps: true });
AssignSchema.index({ shiftId:1, driver:1 }, { unique: true });
export default model("DriverShiftAssignment", AssignSchema);
