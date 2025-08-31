// models/DriverDocument.ts
import { Schema, model } from "mongoose";
const DocSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
  type: { type: String, required: true }, // id, license, vehicle_insurance ...
  number: String,
  issuedAt: Date,
  expiresAt: { type: Date, index: true },
  fileUrl: String,
  status: { type: String, enum: ["pending","approved","rejected"], default: "pending", index: true }
}, { timestamps: true });
export default model("DriverDocument", DocSchema);
