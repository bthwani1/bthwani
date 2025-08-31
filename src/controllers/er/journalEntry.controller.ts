// controllers/er/journalEntry.controller.ts
import { Request, Response } from 'express';
import { JournalEntry } from '../../models/er/journalEntry.model';
import { ChartAccount } from '../../models/er/chartAccount.model';
import { JournalBook } from '../../models/er/journalBook.model';
import { nextVoucherNo } from '../../models/er/counter.model';
import mongoose from 'mongoose';

// التحقق الأساسي لتوازن القيد
function isBalanced(lines: any[]) {
  const debit = lines.reduce((s, l) => s + (l.debit || 0) * (l.rate || 1), 0);
  const credit = lines.reduce((s, l) => s + (l.credit || 0) * (l.rate || 1), 0);
  return Math.abs(debit - credit) < 0.01 && debit > 0;
}
async function syncJournalBookForEntry(entry: any) {
    // امسح أي تدوين سابق لنفس القيد (لو أُعيد الترحيل بعد تعديل)
    await JournalBook.updateMany(
      { }, // سنحذف على مستوى جميع الدفاتر التي تحتوي هذا القيد
      { $pull: { entries: { entryId: entry._id } } }
    );
  
    // أضف سطور القيد لكل حساب
    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i];
      const where = { account: line.account };
      const push = {
        entryId: entry._id,
        lineIndex: i,
        voucherNo: entry.voucherNo,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        debit: line.debit || 0,
        credit: line.credit || 0,
      };
      await JournalBook.updateOne(
        where,
        { $push: { entries: push } },
        { upsert: true } // ينشئ دفتر للحساب إن لم يوجد
      );
    }
  }
// POST /entries
// controllers/er/journalEntry.controller.ts

export const createEntry = async (req, res) => {
    const { date, description, reference, branchNo, voucherType } = req.body;
  
    // ✅ طبّع السطور واستخدم المتغيّر المطبّع
    const inputLines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const lines = inputLines.map((l: any) => ({
      ...l,
      desc: (l.desc && String(l.desc).trim()) || (description || ""), // fallback
    }));
  
    if (!lines.length) {
        res.status(400).json({ message: 'لا توجد سطور صحيحة' });
        return;
    } 
    if (!isBalanced(lines)) {
        res.status(400).json({ message: 'القيد غير متوازن أو فارغ' });
        return;
    } 
  
    // ... تحقق الحسابات التحليلية كما لديك ...
  
    const voucherNo = await nextVoucherNo();
  
    const entry = await JournalEntry.create({
      voucherNo, date, description, reference, branchNo,
      voucherType: voucherType || 'journal',
      lines, // 👈 استخدم المطبّع
    });
  
    // ✅ اكتب للدفاتر وصف البند إن وُجد وإلا البيان العام
    for (const line of lines) {
      await JournalBook.updateOne(
        { account: line.account },
        {
          $push: {
            entries: {
              date,
              // مهم: استخدم وصف السطر
              description: line.desc || description || "",
              reference: voucherNo,        // لو بت dedupe لاحقًا
              debit: line.debit || 0,
              credit: line.credit || 0,
            },
          },
        },
        { upsert: true }
      );
    }
  
    res.status(201).json(entry);
  };
  
  

// GET /entries?search=&posted=
export const listEntries = async (req: Request, res: Response) => {
  const { search, posted } = req.query as any;
  const where: any = {};
  if (search) {
    where.$or = [
      { voucherNo: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { reference: { $regex: search, $options: 'i' } },
    ];
  }
  if (posted === 'true') where.isPosted = true;
  if (posted === 'false') where.isPosted = false;

  const rows = await JournalEntry.find(where).sort({ date: -1 }).limit(100).lean();
  res.json(rows);
};

// GET /entries/:voucherNo
export const getEntry = async (req: Request, res: Response) => {
  const v = await JournalEntry.findOne({ voucherNo: req.params.voucherNo }).lean();
  if (!v) {
    res.status(404).json({ message: 'القيد غير موجود' });
    return;
  } 
  res.json(v);
};

// PUT /entries/:voucherNo (ممنوع لو مرحل)
export const updateEntry = async (req: Request, res: Response) => {
  const existing = await JournalEntry.findOne({ voucherNo: req.params.voucherNo });
  if (!existing) {
    res.status(404).json({ message: 'القيد غير موجود' });
    return;
  }
  if (existing.isPosted) {
    res.status(400).json({ message: 'تم ترحيل القيد بالفعل' });
    return;
  }

  const { date, description, reference, branchNo, voucherType, lines } = req.body;
  if (!Array.isArray(lines) || !isBalanced(lines)) {
    res.status(400).json({ message: 'القيد غير متوازن أو فارغ' });
    return;
  }

  // تحديث القيد (بدون تغيير voucherNo)
  existing.set({ date, description, reference, branchNo, voucherType, lines });
  await existing.save();

  // (اختياري) تحديث دفاتر الأستاذ — لو تحتاج مزامنة كاملة، نظّف ثم أعد الإدراج.
  // هنا سنتركها كما هي لتبسيط العملية.

  res.json(existing);
};

// POST /entries/:voucherNo/post
export const postEntry = async (req, res) => {
    const { voucherNo } = req.params;
    const session = await mongoose.startSession();
  
    try {
      await session.withTransaction(async () => {
        const entry = await JournalEntry.findOne({ voucherNo }).session(session);
        if (!entry) {
            res.status(404).json({ message: 'القيد غير موجود' });
            return;
        } 
        if (entry.isPosted) {
            res.status(400).json({ message: 'تم ترحيل القيد مسبقًا' });
            return;
        } 
  
        entry.isPosted = true;
        await entry.save({ session });
  
        for (const line of entry.lines) {
          await JournalBook.updateOne(
            { account: line.account },
            { $setOnInsert: { account: line.account, entries: [] } },
            { upsert: true, session }
          );
  
          // امسح أي إدراج قديم بنفس رقم القيد
          await JournalBook.updateOne(
            { account: line.account },
            { $pull: { entries: { reference: voucherNo } } },
            { session }
          );
  
          // ✅ استخدم وصف السطر هنا
          await JournalBook.updateOne(
            { account: line.account },
            {
              $push: {
                entries: {
                  date: entry.date,
                  description: line.desc || entry.description || "",
                  reference: voucherNo,
                  debit: line.debit || 0,
                  credit: line.credit || 0,
                },
              },
            },
            { session }
          );
        }
      });
  
      const fresh = await JournalEntry.findOne({ voucherNo });
      res.json(fresh);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'فشل ترحيل القيد' });
    } finally {
      session.endSession();
    }
  };
  
  export const unpostEntry = async (req: Request, res: Response) => {
    const v = await JournalEntry.findOne({ voucherNo: req.params.voucherNo });
    if (!v) {
        res.status(404).json({ message: 'القيد غير موجود' });
        return;
    } 
    if (!v.isPosted) {
        res.status(400).json({ message: 'غير مرحّل' });  
        return;
    } 
  
    // امسح من الدفاتر
// unpostEntry
await JournalBook.updateMany(
    {},
    { $pull: { entries: { $or: [{ entryId: v._id }, { reference: v.voucherNo }] } } }
  );
    
    v.isPosted = false;
    await v.save();
    res.json(v);
  };