// src/accounting/helpers/accountLookup.ts
import { ChartAccount } from "../models/er/chartAccount.model";

const cache = new Map<string, string>(); // code -> _id

export async function getAccountIdByCode(code: string) {
  if (cache.has(code)) return cache.get(code)!;
  const acc = await ChartAccount.findOne({ code, isActive: true }).select("_id").lean();
  if (!acc) throw new Error(`ChartAccount code not found (or inactive): ${code}`);
  cache.set(code, acc._id.toString());
  return acc._id.toString();
}
