import { Request, Response } from "express";
import bcrypt from "bcrypt";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Vendor from "../../models/vendor_app/Vendor";
import mongoose from "mongoose";

// تحقق سريع للحقول الأساسية
function validateStoreInput(b: any) {
  const errs: string[] = [];
  if (!b?.name) errs.push("name مطلوب");
  if (!b?.address) errs.push("address مطلوب");
  if (!b?.category) errs.push("category (ObjectId) مطلوب");
  if (!b?.location || typeof b.location !== "object") errs.push("location {lat,lng} مطلوب");
  else {
    const { lat, lng } = b.location;
    if (typeof lat !== "number" || lat < -90 || lat > 90) errs.push("location.lat خارج النطاق");
    if (typeof lng !== "number" || lng < -180 || lng > 180) errs.push("location.lng خارج النطاق");
  }
  return errs;
}

// 1) المسوّق ينشئ متجر رسمي مباشرة (غير مفعّل)
// NOTE: نضبط isActive=false + forceClosed=true + source='marketer' + createdByUid
export async function createStoreByMarketer(req: Request, res: Response) {
  const uid = (req as any).user?.id;
  if (!uid) {
    res.status(401).json({ message: "مصادقة مطلوبة" });
    return;
  }

  const errors = validateStoreInput(req.body);
  if (errors.length) {
    res.status(400).json({ message: "بيانات غير صالحة", errors });
    return;
  }

  // منع تكرار بالاسم والموقع (اختياري — تبسيط)
  const exists = await DeliveryStore.findOne({
    name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    "location.lat": req.body.location.lat,
    "location.lng": req.body.location.lng,
  }).lean();

  if (exists) {
    res.status(409).json({ message: "متجر بنفس الاسم والموقع موجود مسبقًا" });
    return;
  }

  const doc = await DeliveryStore.create({
    name: req.body.name,
    address: req.body.address,
    category: req.body.category,
    location: { lat: req.body.location.lat, lng: req.body.location.lng },
    // حقول اختيارية إن وجدت في الطلب:
    usageType: req.body.usageType,
    tags: req.body.tags || [],
    schedule: req.body.workSchedule || req.body.schedule || [],
    image: req.body.image,
    logo: req.body.logo,

    // سياسات الخيار B:
    isActive: false,
    forceClosed: true,
    source: "marketer",
    createdByUid: uid,

    // حافظ على افتراضاتك الحالية:
    takeCommission: typeof req.body.takeCommission === "boolean" ? req.body.takeCommission : true,
    commissionRate: typeof req.body.commissionRate === "number" ? req.body.commissionRate : 0,
    pricingStrategyType: req.body.pricingStrategyType || "",
    pricingStrategy: req.body.pricingStrategy || null,
    minOrderAmount: req.body.minOrderAmount || 0,
    deliveryRadiusKm: req.body.deliveryRadiusKm || 0,
    deliveryBaseFee: req.body.deliveryBaseFee || 0,
    deliveryPerKmFee: req.body.deliveryPerKmFee || 0,
  });

  res.status(201).json(doc);
  return;
}

// 2) المسوّق ينشئ تاجر مربوط بالمتجر الذي أنشأه
// القيود:
// - storeId مطلوب
// - يجب أن يكون المتجر source='marketer' و createdByUid == uid (ملكيتي)
// - التاجر يُنشأ isActive=false، ويُفعّل لاحقًا من الأدمن
export async function createVendorByMarketer(req: any, res: any) {
    const uid = req.user?.id;
    if (!uid) {
      res.status(401).json({ message: "مصادقة مطلوبة" });
      return;
    }
  
    const { storeId, fullName, phone, email, password } = req.body || {};
  
    // تحقق أساسي
    if (!storeId || !mongoose.isValidObjectId(storeId)) {
      res.status(400).json({ message: "storeId غير صالح" });
      return;
    }
    if (!fullName || !phone || !email || !password) {
      res.status(400).json({ message: "fullName, phone, email, password مطلوبة" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      return;
    }
  
    // تأكد أن المتجر من إنشاء هذا المسوّق (وفق خيار B)
    const store = await DeliveryStore.findById(storeId).lean();
    if (!store) {
      res.status(404).json({ message: "المتجر غير موجود" });
      return;
    }
    if (store.source !== "marketer" || store.createdByUid !== uid) {
      res.status(403).json({ message: "غير مسموح: المتجر ليس ضمن متاجرك" });
      return;
    }
  
    // تفادي ازدواجية البريد/الهاتف
    const dup = await Vendor.findOne({ $or: [ { email: email.toLowerCase() }, { phone } ] }).lean();
    if (dup) {
      res.status(409).json({ message: "يوجد تاجر بهذا البريد أو الهاتف" });
      return;
    }
  
    // تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(password, 10);
  
    const vendor = await Vendor.create({
      fullName,
      phone,
      email: email.toLowerCase(),
      password: passwordHash,
      store: store._id,
      isActive: false, // يفعّله الأدمن لاحقًا
    });
  
    // لا نرجّع كلمة المرور
    res.status(201).json({ vendorId: vendor._id, storeId: store._id });
    return;
  }

// 3) قائمة متاجري التي أنشأتها (اختيارية للموبايل)
export async function listMyStores(req: Request, res: Response) {
  const uid = (req as any).user?.id;
  if (!uid) {
    res.status(401).json({ message: "مصادقة مطلوبة" });
    return;
  } 
  const list = await DeliveryStore.find({ source: "marketer", createdByUid: uid })
    .sort({ createdAt: -1 })
    .lean();
  res.json(list);
}
