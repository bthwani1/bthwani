// models/er/counter.model.ts
import { Schema, model } from 'mongoose';

const CounterSchema = new Schema({
  key:  { type: String, required: true, unique: true }, // مثلا: JV-2025
  year: { type: Number, required: true },
  seq:  { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const Counter = model('Counter', CounterSchema);

// يعيد الرقم التالي مثل: JV-2025-000001
export async function nextVoucherNo() {
  const yyyy = new Date().getFullYear();
  const key  = `JV-${yyyy}`;

  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 }, $setOnInsert: { year: yyyy } },  // 👈 ممنوع لمس seq هنا
    { new: true, upsert: true /*, setDefaultsOnInsert: false*/ }
  );

  const seqStr = String(doc!.seq).padStart(6, '0');
  return `${key}-${seqStr}`;
}

// قراءة رقم القيد القادم بدون زيادة
export async function peekNextVoucherNo() {
  const yyyy = new Date().getFullYear();
  const key  = `JV-${yyyy}`;
  const doc  = await Counter.findOne({ key });
  const next = (doc?.seq ?? 0) + 1;
  return `${key}-${String(next).padStart(6,'0')}`;
}
