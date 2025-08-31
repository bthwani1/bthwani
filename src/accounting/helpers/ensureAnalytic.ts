// src/accounting/helpers/ensureAnalytic.ts
import { ChartAccount } from "../../models/er/chartAccount.model";
import { Types } from "mongoose";

async function getParentByCode(code: string) {
  const parent = await ChartAccount.findOne({ code, isActive: true }).lean();
  if (!parent) throw new Error(`لم يتم العثور على حساب الأب بالكود: ${code}`);
  return parent;
}

// يولّد كودًا جديدًا فريدًا على نمط parentCode-000001
async function nextChildCode(parentCode: string) {
  const children = await ChartAccount.find({ code: { $regex: `^${parentCode}-\\d+$` } })
    .select("code").lean();
  const max = children.reduce((m, c) => {
    const n = parseInt(c.code.split("-")[1] || "0", 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const next = (max + 1).toString().padStart(6, "0");
  return `${parentCode}-${next}`;
}

export async function createAnalyticUnderCode(parentCode: string, arabicName: string) {
  const parent = await getParentByCode(parentCode);
  const code = await nextChildCode(parent.code);
  const doc = await ChartAccount.create({
    name: arabicName,
    code,
    parent: new Types.ObjectId(parent.id),
    isActive: true,
  });
  return doc._id as Types.ObjectId;
}

export async function getAccountIdByCode(code: string) {
  const acc = await ChartAccount.findOne({ code, isActive: true }).select("_id").lean();
  if (!acc) throw new Error(`GL account not found for code ${code}`);
  return new Types.ObjectId(acc.id);
}
