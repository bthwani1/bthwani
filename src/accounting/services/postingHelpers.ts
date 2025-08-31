// src/accounting/services/postingHelpers.ts
import { Types, Connection } from "mongoose";
import { ChartAccount } from "../../models/er/chartAccount.model";
import { JournalEntry } from "../../models/er/journalEntry.model";
import { JournalBook } from "../../models/er/journalBook.model";
import mongoose from "mongoose";
import { nextVoucherNo } from "../../models/er/counter.model";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import { ensureGLForStore } from "./ensureEntityGL";
import Order from "../../models/delivry_Marketplace_V1/Order";

// ===== Types =====
export type EntryLine = {
  account: Types.ObjectId;      // ChartAccount _id
  debit?: number;
  credit?: number;
  desc?: string;                // وصف السطر (اختياري)
  currency?: string;            // افتراضي YER
  rate?: number;                // افتراضي 1
};

export type CreateAndPostOptions = {
  date?: Date;
  description?: string;
  reference?: string;           // مثال: orderId أو voucher ref
  branchNo?: string;
  voucherType?: string;         // "journal" | "order" | "settlement"...
  lines: EntryLine[];
};
const ACCOUNTS = {
    COMMISSION_REV: "4201", // عمولة من التجار
    DELIVERY_REV:   "4101", // إيراد التوصيل
    STORE_PAY_PARENT: "2102", // ذمم التجار (مستحقات لهم) - أب
    COD_CLEARING:   "2103", // تحصيلات COD قيد التسوية
    GATEWAY_AR:     "1131", // بوابات دفع – أرصدة معلّقة
    WALLET_LIAB:    "2122", // قسائم/محافظ مسبقة الدفع – التزام
  };
  
  // أداة صغيرة لإحضار حساب بالـcode
  async function getAccountIdByCodeOrThrow(code: string): Promise<Types.ObjectId> {
    const acc = await ChartAccount.findOne({ code }).lean();
    if (!acc) throw new Error(`GL account with code ${code} not found`);
    return acc._id as Types.ObjectId;
  }
  
  // حسابات الطلب من النموذج الحالي
  function calcOrderNumbers(order: any) {
    const deliveryFee = Number(order.deliveryFee || 0);
    // إجمالي السلع = price - deliveryFee (بحسب إنشاء الطلب عندك)
    const goodsTotal = Number(order.price || 0) - deliveryFee;
    const commission = Number(order.companyShare || 0); // عمولة المنصة من السلع
    const storeNet = Math.max(goodsTotal - commission, 0); // صافي التاجر
    const walletUsed = Number(order.walletUsed || 0);
    const cashDue = Number(order.cashDue || 0);
    return { goodsTotal, deliveryFee, commission, storeNet, walletUsed, cashDue };
  }
  
  /**
   * ينشئ قيد "تسليم الطلب" وفق طريقة الدفع:
   * Debit:
   *   - COD: 2103 بقيمة إجمالي الطلب (walletUsed جزءه يذهب لـ 2122 بدلاً من 2103)
   *   - Card: 1131 بقيمة إجمالي الطلب
   *   - Wallet: 2122 بقيمة إجمالي الطلب
   * Credit:
   *   - 4201 عمولة = companyShare
   *   - 4101 إيراد التوصيل = deliveryFee
   *   - 2102-<store> مستحق للتاجر = storeNet
   *
   * Mixed:
   *   Dr 2122 (walletUsed) + Dr 2103 (cashDue)
   *   Cr كما بالأعلى
   */
  export async function postOrderDelivered(orderId: string) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");
  
    if (order.status !== "delivered") {
      // يمكن تغيير هذا الشرط لو أردت السماح بالترحيل حتى في حالات أخرى
      throw new Error("Order is not delivered yet");
    }
  
    const { goodsTotal, deliveryFee, commission, storeNet, walletUsed, cashDue } = calcOrderNumbers(order);
  
    // ضمان GL للتجّار داخل subOrders
    // سنبني خريطة مستحق التاجر حسب المتجر (قد يتعدد التجار)
    const payablePerStore = new Map<string, number>(); // storeId -> net
    for (const so of (order.subOrders || [])) {
      const subTotal = (so.items || []).reduce((s: number, it: any) => s + Number(it.unitPrice || 0) * Number(it.quantity || 0), 0);
      // عمولة هذا المتجر حسب نفس منطقك (قد تختلف إذا أردت العدالة الدقيقة لكل متجر)
      // هنا سنوزّع العمولة نسبةً وتناسباً مع إجمالي السلع
      const ratio = goodsTotal > 0 ? subTotal / goodsTotal : 0;
      const subCommission = commission * ratio;
      const subNet = Math.max(subTotal - subCommission, 0);
  
      // ensure store GL
      const store = await DeliveryStore.findById(so.store).lean();
      if (!store) continue;
      const { glId: storePayAccId } = await ensureGLForStore(store._id.toString(), {
        storeName: store.name,
        storeCodeSuffix: store._id.toString().slice(-6),
        payableParentCode: ACCOUNTS.STORE_PAY_PARENT,
      });
  
      // خزّن المبالغ لكل حساب تاجر (ObjectId كسلسلة)
      const key = String(storePayAccId);
      payablePerStore.set(key, (payablePerStore.get(key) || 0) + subNet);
    }
  
    // حسابات رئيسية مشتركة
    const revCommissionAcc = await getAccountIdByCodeOrThrow(ACCOUNTS.COMMISSION_REV);
    const revDeliveryAcc   = await getAccountIdByCodeOrThrow(ACCOUNTS.DELIVERY_REV);
    const codAcc           = await getAccountIdByCodeOrThrow(ACCOUNTS.COD_CLEARING);
    const gatewayAcc       = await getAccountIdByCodeOrThrow(ACCOUNTS.GATEWAY_AR);
    const walletLiabAcc    = await getAccountIdByCodeOrThrow(ACCOUNTS.WALLET_LIAB);
  
    // نبني السطور
    const lines: any[] = [];
  
    // المدين حسب طريقة الدفع
    const totalPrice = Number(order.price || 0);
  
    switch (order.paymentMethod) {
      case "cash": {
        // Dr 2103 = كامل المبلغ
        lines.push({
          account: codAcc,
          debit: totalPrice,
          credit: 0,
          desc: "تحصيلات COD قيد التسوية",
        });
        break;
      }
      case "card": {
        // Dr 1131 = كامل المبلغ
        lines.push({
          account: gatewayAcc,
          debit: totalPrice,
          credit: 0,
          desc: "ذمم بوابة الدفع",
        });
        break;
      }
      case "wallet": {
        // Dr 2122 = كامل المبلغ (خفض التزام محفظة العملاء)
        lines.push({
          account: walletLiabAcc,
          debit: totalPrice,
          credit: 0,
          desc: "استهلاك رصيد محفظة العميل",
        });
        break;
      }
      case "mixed": {
        if (walletUsed > 0) {
          lines.push({
            account: walletLiabAcc,
            debit: walletUsed,
            credit: 0,
            desc: "استهلاك رصيد محفظة العميل (جزئي)",
          });
        }
        if (cashDue > 0) {
          lines.push({
            account: codAcc,
            debit: cashDue,
            credit: 0,
            desc: "تحصيلات COD قيد التسوية (جزئي)",
          });
        }
        break;
      }
      default: {
        // كحالة أمان، اعتبرها COD
        lines.push({
          account: codAcc,
          debit: totalPrice,
          credit: 0,
          desc: "تحصيلات COD قيد التسوية (افتراضي)",
        });
      }
    }
  
    // الدائن: إيرادات + مستحقات للتجار
    if (commission > 0) {
      lines.push({
        account: revCommissionAcc,
        debit: 0,
        credit: commission,
        desc: "عمولة منصة من التاجر",
      });
    }
  
    if (deliveryFee > 0) {
      lines.push({
        account: revDeliveryAcc,
        debit: 0,
        credit: deliveryFee,
        desc: "إيراد توصيل",
      });
    }
  
    // مستحقات التجار (قد تكون متعددة)
    for (const [accIdStr, amount] of payablePerStore.entries()) {
      if (amount <= 0) continue;
      lines.push({
        account: new Types.ObjectId(accIdStr),
        debit: 0,
        credit: amount,
        desc: "مستحق للتاجر",
      });
    }
  
    // تأكد من توازن القيد
    const debitSum = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const creditSum = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const epsilon = Math.abs(debitSum - creditSum);
    if (epsilon > 0.01) {
      throw new Error(`Journal out of balance: Dr=${debitSum} Cr=${creditSum}`);
    }
  
    // أنشئ قيد يومية
    const entry = await JournalEntry.create({
      date: new Date(),
      description: `قيد تسليم الطلب #${order._id}`,
      reference: String(order._id),
      voucherType: "delivery",
      isPosted: true, // نعتبره مُرحّل مباشرة (أو اجعله false ثم استعمل postEntry لاحقاً)
      lines: lines.map((l) => ({
        account: l.account,
        debit: l.debit || 0,
        credit: l.credit || 0,
        desc: l.desc,
      })),
    });
  
    return entry;
  }
// ===== Cache لحسابات الكود → _id =====
const acctCache = new Map<string, Types.ObjectId>();
const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheStamp = Date.now();

function maybeClearCache() {
  if (Date.now() - cacheStamp > CACHE_TTL_MS) {
    acctCache.clear();
    cacheStamp = Date.now();
  }
}

/** جلب _id لحساب عبر كوده (مع كاش) */
export async function byCode(code: string): Promise<Types.ObjectId> {
  maybeClearCache();
  const key = String(code).trim();
  const hit = acctCache.get(key);
  if (hit) return hit;
  const acc = await ChartAccount.findOne({ code: key }).select("_id code name").lean();
  if (!acc) {
    throw new Error(`لم يتم العثور على حساب بالكود ${key}. تأكد من إدراجه في شجرة الحسابات.`);
  }
  const id = new Types.ObjectId(acc.id);
  acctCache.set(key, id);
  return id;
}

// ===== Helpers =====
function isBalanced(lines: EntryLine[]): boolean {
  const sum = lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);
  return Math.abs(sum) < 0.01 && lines.some(l => (l.debit || 0) > 0 || (l.credit || 0) > 0);
}

/** ينشئ قيد مسودّة فقط (بدون ترحيل) */
export async function createEntryDraft(opts: CreateAndPostOptions) {
  const date = opts.date || new Date();
  const voucherType = opts.voucherType || "journal";
  const description = opts.description || "";
  const reference = opts.reference || "";
  const branchNo = opts.branchNo;

  // طبّع السطور
  const lines = (opts.lines || []).map(l => ({
    account: l.account,
    name: undefined,                    // اختيارياً ممكن تعبّيه من الحساب
    desc: l.desc || description || "",
    debit: l.debit || 0,
    credit: l.credit || 0,
    currency: l.currency || "YER",
    rate: l.rate || 1,
  }));

  if (!isBalanced(lines)) {
    throw new Error("القيد غير متوازن أو فارغ (المدين لا يساوي الدائن).");
  }

  const voucherNo = await nextVoucherNo();
  const entry = await JournalEntry.create({
    voucherNo,
    date,
    description,
    reference,
    branchNo,
    voucherType,
    isPosted: false,
    lines,
  });

  return entry;
}

/** يرحّل قيد موجود إلى دفاتر الأستاذ (مثل POST /entries/:voucherNo/post) */
export async function postExistingEntry(voucherNo: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const entry = await JournalEntry.findOne({ voucherNo }).session(session);
      if (!entry) throw new Error("القيد غير موجود");
      if (entry.isPosted) return entry;

      // امسح أي إدراج قديم بنفس رقم القيد
      await JournalBook.updateMany(
        {},
        { $pull: { entries: { $or: [{ entryId: entry._id }, { reference: voucherNo }] } } },
        { session }
      );

      // اكتب السطور لكل دفتر حساب
      for (let i = 0; i < entry.lines.length; i++) {
        const line = entry.lines[i];
        await JournalBook.updateOne(
          { account: line.account },
          { $setOnInsert: { account: line.account, entries: [] } },
          { upsert: true, session }
        );
        await JournalBook.updateOne(
          { account: line.account },
          {
            $push: {
              entries: {
                entryId: entry._id,
                lineIndex: i,
                voucherNo: entry.voucherNo,
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

      entry.isPosted = true;
      await entry.save({ session });
    });

    const fresh = await JournalEntry.findOne({ voucherNo });
    return fresh;
  } finally {
    session.endSession();
  }
}

/** واجهة مختصرة: أنشئ ثم رحّل قيد محاسبي */
export async function createAndPostEntry(opts: CreateAndPostOptions) {
  const draft = await createEntryDraft(opts);
  const posted = await postExistingEntry(draft.voucherNo);
  return posted!;
}
