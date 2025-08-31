// models/DriverAssetAssignment.ts
import { Schema, model } from "mongoose";
const AssetAssignSchema = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "DriverAsset", required: true, index: true },
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
  assignedAt: { type: Date, required: true },
  expectedReturnAt: Date,
  returnedAt: Date,
  depositAmount: Number,
  status: { type: String, enum: ["active","returned","overdue"], default: "active", index: true },
  notes: String,
}, { timestamps: true });
AssetAssignSchema.index({ asset:1, status:1 });
export default model("DriverAssetAssignment", AssetAssignSchema);
