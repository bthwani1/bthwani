// models/DriverAsset.ts
import { Schema, model } from "mongoose";
const AssetSchema = new Schema({
  code: { type: String, unique: true, required: true },
  type: String, brand: String, model: String, serial: String,
  status: { type: String, enum: ["available","assigned","repair","lost","retired"], default: "available", index: true }
}, { timestamps: true });
export default model("DriverAsset", AssetSchema);
