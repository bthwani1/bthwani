// models/DriverPayoutCycle.ts
import { Schema, model } from "mongoose";
const PayoutSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
  period: { type: String, enum: ["weekly","biweekly","monthly"], required: true },
  start: { type: String, required: true }, // "YYYY-MM-DD"
  end:   { type: String, required: true }, // "YYYY-MM-DD"
  earnings: { type: Number, default: 0 },
  adjustments: { type: Number, default: 0 },
  fees: { type: Number, default: 0 },
  withdrawals: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  status: { type: String, enum: ["pending","approved","paid"], default: "pending", index: true },
  reference: String,
}, { timestamps: true });
PayoutSchema.index({ driver:1, start:1, end:1 }, { unique: true });
export default model("DriverPayoutCycle", PayoutSchema);
