// controller: journalBook.controller.ts
import { Request, Response } from 'express';
import { JournalBook } from '../../models/er/journalBook.model';
import { ChartAccount } from '../../models/er/chartAccount.model';
import { JournalEntry } from '../../models/er/journalEntry.model';
import { Types } from 'mongoose';


export const addJournalEntry = async (req: Request, res: Response) => {
    const { date, description, reference, lines } = req.body;
    // تحقق أن المجموع = صفر (توازن المدين والدائن)
    const total = lines.reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);
    if (total !== 0) {
        res.status(400).json({ message: 'القيود غير متوازنة (المدين لا يساوي الدائن)' });
        return;
    } 
  
    // تحقق أن كل حساب تحليلي فعلاً
    for (const line of lines) {
      const hasChildren = await ChartAccount.exists({ parent: line.account });
      if (hasChildren) {
        res.status(400).json({ message: 'يمكن القيد فقط للحسابات التحليلية' });
        return;
      }
    }
  
    // احفظ القيد
    const entry = await JournalEntry.create({ date, description, reference, lines });
  
    // أضف لكل دفتر أستاذ الطرف المناسب
    for (const line of lines) {
      let book = await JournalBook.findOne({ account: line.account });
      if (!book) book = await JournalBook.create({ account: line.account, entries: [] });
  
      book.entries.push({
        date,
        description,
        reference,
        debit: line.debit,
        credit: line.credit
      });
      await book.save();
    }
  
    res.status(201).json(entry);
  };

// controllers/er/journalBook.controller.ts
export const getJournal = async (req, res) => {
  const { accountId, from, to, voucherType, all, includeDescendants } = req.query as any;
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 500);

  const match: any = { isPosted: true };
  if (from) match.date = { ...(match.date || {}), $gte: new Date(from) };
  if (to)   match.date = { ...(match.date || {}), $lte: new Date(to) };
  if (voucherType) match.voucherType = voucherType;

  // فلتر الحساب/الأبناء (كما هو)
  let accountFilterStage: any[] = [];
  const wantAll = all === '1' || accountId === 'ALL' || !accountId;
  if (!wantAll) {
    let ids: Types.ObjectId[] = [new Types.ObjectId(accountId)];
    if (includeDescendants === '1') {
      const allAcc = await ChartAccount.find().select('_id parent').lean();
      const map = new Map<string, string[]>();
      for (const a of allAcc) {
        const p = a.parent?.toString();
        if (p) (map.get(p) ?? map.set(p, []).get(p)!).push(a._id.toString());
      }
      const stack = [accountId as string], out: string[] = [];
      while (stack.length) {
        const id = stack.pop()!; out.push(id);
        (map.get(id) || []).forEach(k => stack.push(k));
      }
      ids = out.map(id => new Types.ObjectId(id));
    }
    accountFilterStage = [{ $match: { 'lines.account': { $in: ids } } }];
  }

  // بايبلاين البيانات داخل الفترة
  const dataPipe: any[] = [
    { $match: match },
    { $unwind: '$lines' },
    ...accountFilterStage,
    { $lookup: { from: 'chartaccounts', localField: 'lines.account', foreignField: '_id', as: 'acc' } },
    { $addFields: { acc: { $arrayElemAt: ['$acc', 0] } } },
    {
      $project: {
        _id: 1, voucherNo: 1, date: 1,
        description: { $ifNull: ['$lines.desc', '$description'] }, // ← وصف البند أولاً
        reference: '$reference',
        debit: '$lines.debit', credit: '$lines.credit',
        accountId: '$lines.account',
        accountCode: '$acc.code', accountName: '$acc.name',
      }
    },
    { $sort: { date: 1, voucherNo: 1, _id: 1 } },
    { $facet: {
        data: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        total: [{ $count: 'count' }]
      }
    }
  ];

  // بايبلاين الرصيد الافتتاحي: كل ما قبل from
  const openingPipe: any[] = from ? [
    { $match: { isPosted: true, ...(voucherType ? { voucherType } : {}), date: { $lt: new Date(from) } } },
    { $unwind: '$lines' },
    ...accountFilterStage,
    { $group: { _id: null, d: { $sum: '$lines.debit' }, c: { $sum: '$lines.credit' } } },
    { $project: { _id: 0, openingBalance: { $subtract: ['$d', '$c'] } } }
  ] : [
    { $project: { _id: 0, openingBalance: { $literal: 0 } } }, { $limit: 1 }
  ];

  // نفّذ كلاهما معًا
  const [dataFacet] = await JournalEntry.aggregate(dataPipe);
  const [openingFacet] = await JournalEntry.aggregate(openingPipe);

  const entries = dataFacet?.data ?? [];
  const total = dataFacet?.total?.[0]?.count ?? 0;
  const openingBalance = Number(openingFacet?.openingBalance ?? 0);

  res.json({ entries, total, page, pageSize, openingBalance });
};
