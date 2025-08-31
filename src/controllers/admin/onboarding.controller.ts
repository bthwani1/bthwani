import { Request, Response } from "express";
import mongoose from "mongoose";
import Onboarding from "../../models/fieldMarketingV1/Onboarding";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Vendor from "../../models/vendor_app/Vendor";
import bcrypt from "bcryptjs";

export async function queue(req: Request, res: Response) {
  const { status = "submitted", q } = req.query as any;
  const filter: any = { status };
  if (q) filter["storeDraft.name"] = new RegExp(q, "i");
  const list = await Onboarding.find(filter).sort({ createdAt: 1 }).lean();
  res.json(list);
}

export async function getOne(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)){
    res.status(400).json({ message: "id غير صالح" });
    return;
  }
  const doc = await Onboarding.findById(req.params.id).lean();
  if (!doc) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(doc);
}

export async function needsFix(req: Request, res: Response) {
  const { notes } = req.body || {};
  const doc = await Onboarding.findByIdAndUpdate(
    req.params.id,
    {
      status: "needs_fix",
      notes,
      reviewedAt: new Date(),
      reviewedBy: (req as any).user?.id,
    },
    { new: true }
  );
  if (!doc) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(doc);
}

export async function reject(req: Request, res: Response) {
  const { reason } = req.body || {};
  const doc = await Onboarding.findByIdAndUpdate(
    req.params.id,
    {
      status: "rejected",
      notes: reason,
      reviewedAt: new Date(),
      reviewedBy: (req as any).user?.id,
    },
    { new: true }
  );
  if (!doc) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(doc);
}

export async function approve(req: Request, res: Response) {
  const onb = await Onboarding.findById(req.params.id);
    if (!onb) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }

  // 1) إنشاء المتجر
  const store = await DeliveryStore.create({
    name: onb.storeDraft.name,
    address: onb.storeDraft.address,
    category: onb.storeDraft.category,
    location: onb.storeDraft.location,
    image: onb.storeDraft.image,
    logo: onb.storeDraft.logo,
    tags: onb.storeDraft.tags || [],
    usageType: onb.storeDraft.usageType || "restaurant",
    isActive: true,
    forceClosed: false,
    source: "marketer",
  } as any);

  // 2) (اختياري) إنشاء تاجر إن كان هناك بيانات مالك
  let vendorId: mongoose.Types.ObjectId | null = null;
  if (
    onb.ownerDraft?.fullName &&
    (onb.ownerDraft.phone || onb.ownerDraft.email)
  ) {
    const rawPass =
      req.body?.vendorPassword || Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(rawPass, 10);
    const vendor = await Vendor.create({
      fullName: onb.ownerDraft.fullName,
      phone: onb.ownerDraft.phone,
      email: onb.ownerDraft.email?.toLowerCase(),
      password: hash,
      store: store._id,
      isActive: true,
    });
    vendorId = vendor._id as mongoose.Types.ObjectId;
  }

  onb.status = "approved";
  onb.reviewedAt = new Date();
  (onb as any).reviewedBy = (req as any).user?.id;
  await onb.save();

  res.json({ ok: true, storeId: store._id, vendorId });
}
