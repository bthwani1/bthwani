import { Schema, model, Types } from "mongoose";

export type Lifecycle = "prospect" | "onboarding" | "active" | "paused" | "terminated";
export type Tier = "A" | "B" | "C";

const BankSchema = new Schema({
  name: String,
  iban: String,   // يُخفى في الواجهة
  accountName: String,
}, { _id: false });

const ContractEmbed = new Schema({
  start: Date,
  end: Date,
  status: { type: String, enum: ["draft","signed","active","expired","terminated"] },
}, { _id: false });

const PartnerProfileSchema = new Schema({
  store: { type: Schema.Types.ObjectId, ref: "DeliveryStore", unique: true, required: true },
  lifecycle: { type: String, enum: ["prospect","onboarding","active","paused","terminated"], default: "prospect" },
  tier: { type: String, enum: ["A","B","C"], default: "C" },
  commissionPct: { type: Number, min: 0, max: 100, default: 10 },
  settlementCycle: { type: String, default: "weekly" }, // weekly/biweekly/monthly...
  bank: BankSchema,
  docs: [{ label: String, url: String }],
  contract: ContractEmbed,
  healthScore: { type: Number, min: 0, max: 100, default: 70 },
}, { timestamps: true });

PartnerProfileSchema.index({ store: 1 });
PartnerProfileSchema.index({ lifecycle: 1, tier: 1 });
PartnerProfileSchema.index({ healthScore: -1 });
PartnerProfileSchema.index({ "contract.end": 1 });

export default model("PartnerProfile", PartnerProfileSchema);
