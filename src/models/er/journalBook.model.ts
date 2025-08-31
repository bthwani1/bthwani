// models/er/journalBook.model.ts
import { Schema, model, Types } from 'mongoose';

const JournalBookSchema = new Schema({
  account: { type: Types.ObjectId, ref: 'ChartAccount', required: true, unique: true },
  entries: [
    {
      entryId: { type: Types.ObjectId, ref: 'JournalEntry', index: true }, // 👈 مهم للتزامن
      lineIndex: { type: Number },                                         // لو حبيت تميّز السطر
      voucherNo: String,
      date: { type: Date, required: true },
      description: String,
      reference: String,
      debit: Number,
      credit: Number,
    }
  ],
}, { timestamps: true });

export const JournalBook = model('JournalBook', JournalBookSchema);
// models/journalBook.model.ts
JournalBookSchema.index({ account: 1, 'entries.reference': 1 });
