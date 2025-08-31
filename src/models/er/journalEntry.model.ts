// models/journalEntry.model.ts
import { Schema, model, Types } from 'mongoose';

const JournalEntrySchema = new Schema({
  voucherNo: { type: String, unique: true },               // رقم القيد
  date: { type: Date, required: true },
  description: String,
  reference: String,
  branchNo: String,                                        // فرع (اختياري)
  voucherType: { type: String, default: 'journal' },       // نوع المستند
  isPosted: { type: Boolean, default: false },             // حالة الترحيل
  lines: [
    {
      account: { type: Types.ObjectId, ref: 'ChartAccount', required: true },
      name: String,                 // (اختياري) تخزين الاسم لسهولة العرض
      desc: String,                 // (اختياري) وصف السطر
      debit: { type: Number, default: 0 },
      credit: { type: Number, default: 0 },
      currency: { type: String, default: 'YER' },
      rate: { type: Number, default: 1 },
    }
  ]
}, { timestamps: true });

export const JournalEntry = model('JournalEntry', JournalEntrySchema);
