import { Schema, model } from "mongoose";

const PerfSchema = new Schema({
  store: { type: Schema.Types.ObjectId, ref: "DeliveryStore", required: true },
  day: { type: String, required: true }, // "YYYY-MM-DD" بتوقيت Asia/Aden
  orders: { type: Number, default: 0 },
  gmv: { type: Number, default: 0 },
  cancels: { type: Number, default: 0 },
  avgPrepMin: { type: Number, default: 0 },
  complaints: { type: Number, default: 0 },
},{ timestamps:true });

PerfSchema.index({ store: 1, day: 1 }, { unique: true });

export default model("PartnerPerformanceDaily", PerfSchema);
