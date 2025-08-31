import { Schema, model, Document } from "mongoose";

export interface ICommissionPlan extends Document {
  name: string;
  active: boolean;
  rules: { trigger: string; amountYER: number; caps?: number; tiers?: any[] }[];
}

const Sch = new Schema<ICommissionPlan>({
  name: { type: String, required: true },
  active: { type: Boolean, default: true, index: true },
  rules: [{ trigger: String, amountYER: Number, caps: Number, tiers: Array }]
},{ timestamps: true });

export default model<ICommissionPlan>("CommissionPlan", Sch);
