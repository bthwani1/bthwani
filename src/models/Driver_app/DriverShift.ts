// models/DriverShift.ts
import { Schema, model } from "mongoose";
const ShiftSchema = new Schema({
  name: { type: String, required: true },
  dayOfWeek: { type: Number },            // 0-6 (اختياري)
  specificDate: { type: String },         // "YYYY-MM-DD" (اختياري)
  startLocal: { type: String, required: true }, // "HH:mm"
  endLocal:   { type: String, required: true }, // "HH:mm"
  area: { type: String },
  capacity: { type: Number, default: 0 },
}, { timestamps: true });
export default model("DriverShift", ShiftSchema);
