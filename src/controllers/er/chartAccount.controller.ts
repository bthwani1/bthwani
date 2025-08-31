import { Request, Response } from 'express';
import { ChartAccount } from '../../models/er/chartAccount.model';
import { JournalBook } from '../../models/er/journalBook.model';
import { Types } from 'mongoose';

// controllers/er/chartAccount.controller.ts
// controllers/er/chartAccount.controller.ts
export const getAccounts = async (req, res) => {
  const { query = '', onlyLeaf, limit = '200' } = req.query as any;
  const q = String(query).trim();
  const base: any = q
    ? { $or: [ { code: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } } ] }
    : {};

  // جيب كل النتائج أولاً (بدون limit) علشان ما نخسر الـleaf
  const all = await ChartAccount.find(base).lean();

  if (onlyLeaf) {
    const ids = all.map(a => a._id.toString());
    const children = await ChartAccount.find({ parent: { $in: ids } }, { parent: 1 }).lean();
    const parentSet = new Set(children.map(c => c.parent.toString()));
    const leaf = all.filter(a => !parentSet.has(a._id.toString()));
    res.json(leaf.slice(0, Number(limit)));
    return;
  }

  // بدون leaf: رجّع limit عادي
  res.json(all.slice(0, Number(limit)));
};



export const getAccount = async (req: Request, res: Response) => {
  const account = await ChartAccount.findById(req.params.id);
  res.json(account);
};
export const getAccountsAnalysis = async (req: Request, res: Response) => {
  const { onlyLeaf } = req.query;

  // إذا طلب فقط الحسابات التحليلية (بدون أبناء)
  if (onlyLeaf) {
    // استخرج جميع الحسابات
    const all = await ChartAccount.find().lean();

    // حدد الحسابات التحليلية: ليس لها أي ابن
    const leafAccounts = all.filter(acc =>
      !all.some(other => other.parent && other.parent.toString() === acc._id.toString())
    );

     res.json(leafAccounts);
     return;
  }

  // باقي الاستعلامات (بدون فلترة)
  const accounts = await ChartAccount.find();
  res.json(accounts);
};

export const deleteAccountAndChildren = async (req, res) => {
  const { id } = req.params;

  // اجلب كل الحسابات من نفس الشجرة
  const allAccounts = await ChartAccount.find().lean();

  // دالة recursive لجمع كل أبناء الحساب
  function collectIds(parentId) {
    const children = allAccounts.filter(acc => acc.parent && acc.parent.toString() === parentId);
    let ids = [parentId];
    for (const child of children) {
      ids = ids.concat(collectIds(child._id.toString()));
    }
    return ids;
  }

  const idsToDelete = collectIds(id);

  await ChartAccount.deleteMany({ _id: { $in: idsToDelete } });
  // يمكنك هنا أيضًا حذف دفاتر الإسناد المرتبطة بنفس الحسابات إن أردت
  // await JournalBook.deleteMany({ account: { $in: idsToDelete } });

  res.status(204).send();
};

export const createAccount = async (req: Request, res: Response) => {
  try{
    const account = new ChartAccount(req.body);
    await account.save();

    res.status(201).json(account);
  }catch (err) {
    if (err.code === 11000) {
       res.status(400).json({ message: 'الكود مستخدم مسبقًا. الرجاء اختيار كود آخر.' });
       return;
    }
    throw err;
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  const updated = await ChartAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteAccount = async (req: Request, res: Response) => {
  await ChartAccount.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
export const listAccounts = async (req: Request, res: Response) => {
  const { limit, query, onlyLeaf } = req.query as any;

  // فلترة نصية اختيارية
  const text: any = query
    ? { $or: [
        { code: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
      ] }
    : {};

  if (onlyLeaf === '1') {
    // IDs لكل من لديه أبناء
    const parentIds = await ChartAccount.distinct('parent', { parent: { $ne: null } });
    // الأوراق = ليست ضمن parentIds
    const rows = await ChartAccount.find({
      _id: { $nin: parentIds as Types.ObjectId[] },
      isActive: true,
      ...text,
    })
      .select('_id code name parent')
      .sort({ code: 1 })
      .limit(Math.min(parseInt(limit || '1000', 10), 5000))
      .lean();

     res.json(rows);
     return;
  }

  // الافتراضي (كل الحسابات)
  const rows = await ChartAccount.find({ isActive: true, ...text })
    .select('_id code name parent')
    .sort({ code: 1 })
    .limit(Math.min(parseInt(limit || '1000', 10), 5000))
    .lean();

  res.json(rows);
};
export const getAccountTree = async (_req: Request, res: Response) => {
  const accounts = await ChartAccount.find().lean();
  const map = new Map<string, any>();
  accounts.forEach((acc: any) => {
    map.set(acc._id.toString(), { ...acc, children: [] });
  });
  const roots: any[] = [];
  map.forEach((acc) => {
    if (acc.parent) {
      const parent = map.get(acc.parent.toString());
      if (parent) parent.children.push(acc);
    } else {
      roots.push(acc);
    }
  });
  res.json(roots);
};
