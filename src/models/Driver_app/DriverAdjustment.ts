// models/DriverAdjustment.ts
import { Schema, model } from "mongoose";
const AdjSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
  type: { type: String, enum: ["bonus","penalty"], required: true },
  amount: { type: Number, required: true },
  reason: String,
  ref: String,
  createdBy: String,
}, { timestamps: true });
export default model("DriverAdjustment", AdjSchema);
