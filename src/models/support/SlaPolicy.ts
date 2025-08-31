// models/SlaPolicy.ts
import { Schema, model } from "mongoose";
const SlaPolicySchema = new Schema({
  name: { type:String, required:true },
  firstResponseMins: { type: Number, default: 30 },
  resolveMins: { type: Number, default: 1440 },
  appliesTo: { // قواعد تطبيق بسيطة
    tags: [String], priorities: [String], channels: [String]
  }
}, { timestamps:true });
export default model("SlaPolicy", SlaPolicySchema);
