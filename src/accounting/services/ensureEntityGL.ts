// src/accounting/services/ensureEntityGL.ts
import { Types } from "mongoose";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Driver from "../../models/Driver_app/driver";

import { ChartAccount } from "../../models/er/chartAccount.model";

export type EnsureStoreGLOptions = {
    storeName?: string;
    storeCodeSuffix?: string;
    payableParentCode?: string; // افتراضي 2102
  };
  
  export async function ensureGLForStore(
    storeId: string,
    opts: EnsureStoreGLOptions = {}
  ): Promise<{ glId: Types.ObjectId; code: string }> {
    const store = await DeliveryStore.findById(storeId);
    if (!store) throw new Error("Store not found");
  
    if (store.glPayableAccount) {
      const acc = await ChartAccount.findById(store.glPayableAccount).lean();
      if (acc) return { glId: acc._id as Types.ObjectId, code: acc.code };
    }
  
    const parentCode = opts.payableParentCode || "2102";
    const parent = await ChartAccount.findOne({ code: parentCode }).lean();
    if (!parent) throw new Error(`GL parent ${parentCode} not found`);
  
    const name = (opts.storeName || store.name || "متجر").trim();
    const suffix = (opts.storeCodeSuffix || store._id.toString().slice(-6)).replace(/\s+/g, "");
    const code = `${parentCode}-${suffix}`;
  
    // إن وجد بنفس الكود، استخدمه
    let acc = await ChartAccount.findOne({ code });
    if (!acc) {
      acc = await ChartAccount.create({
        parent: parent._id,
        code,
        name: `${name} - ذمم تاجر`,
        isActive: true,
      });
    }
  
    // اربطه بالمتجر
    store.glPayableAccount = acc._id as any;
    await store.save();
  
    return { glId: acc._id as Types.ObjectId, code };
  }

export type EnsureDriverGLOptions = {
    driverName?: string;
    driverCodeSuffix?: string;      // مثال: آخر 6 من الـ _id
    arParentCode?: string;          // افتراضي "1211"
    depositParentCode?: string;     // افتراضي "1601" (أو غيّرها لـ "2161" لو عندك)
  };
  
  async function getParentByCodeOrThrow(code: string) {
    const p = await ChartAccount.findOne({ code }).lean();
    if (!p) throw new Error(`لم يتم العثور على حساب الأب بالكود ${code}`);
    return p;
  }
  
  async function findByCode(code: string) {
    return ChartAccount.findOne({ code }).lean();
  }
  
  async function createChildAccount(parentId: Types.ObjectId, code: string, name: string) {
    return ChartAccount.create({
      parent: parentId,
      code,
      name,
      isActive: true,
    });
  }
  
  /**
   * يضمن إنشاء وربط حسابات GL للسائق:
   * - ذمم/عهد السائقين (تحت 1211 افتراضيًا)
   * - وديعة/تأمين السائق (تحت 1601 افتراضيًا)
   * يرجع ObjectIds للحسابات التي تم التأكد منها/إنشاؤها.
   */
  export async function ensureGLForDriver(
    driverId: string,
    opts: EnsureDriverGLOptions = {}
  ): Promise<{ ar: Types.ObjectId; deposit?: Types.ObjectId }> {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error("Driver not found");
  
    const arParentCode = opts.arParentCode || "1211";     // ذمم السائقين
    const depParentCode = opts.depositParentCode || "1601"; // ودائع/تأمينات (بدّلها إلى "2161" لو تستخدمها كخصوم)
  
    const driverName = (opts.driverName || driver.fullName || "سائق").trim();
    const suffix = (opts.driverCodeSuffix || driver._id.toString().slice(-6)).replace(/\s+/g, "");
  
    // === حساب الذمم (AR) ===
    let arId: Types.ObjectId;
    if (driver.glReceivableAccount) {
      arId = driver.glReceivableAccount as Types.ObjectId;
    } else {
      const arParent = await getParentByCodeOrThrow(arParentCode);
      const arCode = `${arParentCode}-${suffix}`;
      const existingAR = await findByCode(arCode);
      if (existingAR) {
        arId = existingAR._id as Types.ObjectId;
      } else {
        const ar = await createChildAccount(arParent._id as Types.ObjectId, arCode, `${driverName} - ذمة/عهد`);
        arId = ar._id as Types.ObjectId;
      }
    }
  
    // === حساب الوديعة/التأمين (Deposit) ===
    let depId: Types.ObjectId | undefined;
    if (driver.glDepositAccount) {
      depId = driver.glDepositAccount as Types.ObjectId;
    } else if (depParentCode) {
      const depParent = await getParentByCodeOrThrow(depParentCode);
      const depCode = `${depParentCode}-${suffix}`;
      const existingDep = await findByCode(depCode);
      if (existingDep) {
        depId = existingDep._id as Types.ObjectId;
      } else {
        const dep = await createChildAccount(depParent._id as Types.ObjectId, depCode, `${driverName} - وديعة`);
        depId = dep._id as Types.ObjectId;
      }
    }
  
    return { ar: arId, deposit: depId };
  }
