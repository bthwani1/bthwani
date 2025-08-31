import { Request, Response } from "express";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import mongoose from "mongoose";

export async function list(req: Request, res: Response) {
  const { q, active, usageType, source } = req.query as any;
  const filter: any = {};
  if (typeof active !== "undefined") filter.isActive = active === "true";
  if (usageType) filter.usageType = usageType;
  if (source) filter.source = source; // إن كنت أضفت حقل source='marketer' كما اقترحنا
  if (q)
    filter.$or = [
      { name: new RegExp(q, "i") },
      { address: new RegExp(q, "i") },
    ];
  const rows = await DeliveryStore.find(filter).sort({ createdAt: -1 }).lean();
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "id غير صالح" });
    return;
  }
  const s = await DeliveryStore.findById(req.params.id).lean();
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function activate(req: Request, res: Response) {
  const s = await DeliveryStore.findByIdAndUpdate(
    req.params.id,
    { isActive: true, forceClosed: false },
    { new: true }
  );
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function deactivate(req: Request, res: Response) {
  const s = await DeliveryStore.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function forceClose(req: Request, res: Response) {
  const s = await DeliveryStore.findByIdAndUpdate(
    req.params.id,
    { forceClosed: true },
    { new: true }
  );
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function forceOpen(req: Request, res: Response) {
  const s = await DeliveryStore.findByIdAndUpdate(
    req.params.id,
    { forceClosed: false },
    { new: true }
  );
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function adminPatch(req: Request, res: Response) {
  const allow = [
    "name",
    "address",
    "category",
    "location",
    "tags",
    "usageType",
    "commissionRate",
    "takeCommission",
    "schedule",
    "image",
    "logo",
    "pricingStrategy",
    "pricingStrategyType",
    "deliveryRadiusKm",
    "deliveryBaseFee",
    "deliveryPerKmFee",
    "minOrderAmount",
    "isTrending",
    "isFeatured",
  ];
  const patch: any = {};
  for (const k of allow) if (k in req.body) patch[k] = req.body[k];
  const s = await DeliveryStore.findByIdAndUpdate(req.params.id, patch, {
    new: true,
  });
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(s);
}

export async function remove(req: Request, res: Response) {
  const s = await DeliveryStore.findByIdAndDelete(req.params.id);
  if (!s) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json({ ok: true });
}
