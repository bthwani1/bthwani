import { Schema, model } from "mongoose";

const TermsSchema = new Schema({
  commissionPct: Number,
  notes: String,
},{ _id:false });

const HistorySchema = new Schema({
  at: { type: Date, default: Date.now },
  by: String, // user id/email
  diff: Schema.Types.Mixed
},{ _id:false });

const PartnerContractSchema = new Schema({
  store: { type: Schema.Types.ObjectId, ref: "DeliveryStore", required: true },
  version: { type: Number, required: true },
  status: { type: String, enum: ["draft","signed","active","expired","terminated"], default: "draft" },
  start: Date,
  end: Date,
  terms: TermsSchema,
  files: [{ name: String, url: String }],
  history: [HistorySchema],
},{ timestamps:true });

PartnerContractSchema.index({ store: 1, version: 1 }, { unique: true });
PartnerContractSchema.index({ end: 1 });
PartnerContractSchema.index({ status: 1 });

export default model("PartnerContract", PartnerContractSchema);
