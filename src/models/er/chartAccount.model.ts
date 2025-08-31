import { Schema, model, Document, Types } from 'mongoose';

export interface IChartAccount extends Document {
  name: string;
  code: string;
  parent?: Types.ObjectId | null;
  isActive: boolean;
}

const ChartAccountSchema = new Schema<IChartAccount>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },

  parent: { type: Schema.Types.ObjectId, ref: 'ChartAccount', default: null },
}, { timestamps: true });

export const ChartAccount = model<IChartAccount>('ChartAccount', ChartAccountSchema);
