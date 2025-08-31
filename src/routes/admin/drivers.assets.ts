// routes/admin/drivers.assets.ts
import { Router } from "express";
import { z } from "zod";
import { validate2 } from "../../middleware/validate";
import { requireRole } from "../../middleware/rbac";
import DriverAsset from "../../models/Driver_app/DriverAsset";
import DriverAssetAssignment from "../../models/Driver_app/DriverAssetAssignment";

const r = Router();

r.post("/", requireRole("drivers:assets"), validate2(z.object({ body: z.object({
  code: z.string(), type: z.string(), brand: z.string().optional(),
  model: z.string().optional(), serial: z.string().optional()
})})), async (req,res)=>{
  const a = await DriverAsset.create({ ...req.body, status:"available" });
  res.json(a);
});

r.post("/:assetId/assign", requireRole("drivers:assets"), validate2(z.object({
  params: z.object({ assetId: z.string().length(24) }),
  body: z.object({ driverId: z.string().length(24), deposit: z.number().optional(), expectedReturnAt: z.string().datetime().optional() })
})), async (req,res)=>{
  const { assetId } = req.params; const { driverId, deposit, expectedReturnAt } = req.body;

  // منع ازدواجية: أصل واحد نشط لشخصين
  const existing = await DriverAssetAssignment.findOne({ asset: assetId, status:"active" });
  if (existing) {
    res.status(400).json({ message:"Asset already assigned" });
    return;
  }

  const assign = await DriverAssetAssignment.create({
    asset: assetId, driver: driverId, assignedAt: new Date(),
    expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : undefined,
    depositAmount: deposit, status: "active"
  });
  await DriverAsset.findByIdAndUpdate(assetId, { $set: { status:"assigned" }});
  res.json(assign);
});

r.post("/:assetId/return", requireRole("drivers:assets"), validate2(z.object({
  params: z.object({ assetId: z.string().length(24) }),
  body: z.object({ conditionOnReturn: z.string().optional(), notes: z.string().optional() })
})), async (req,res)=>{
  const { assetId } = req.params;
  const a = await DriverAssetAssignment.findOne({ asset: assetId, status:"active" });
  if (!a) {
    res.status(400).json({ message:"No active assignment" });
    return;
  }
  a.status = "returned"; a.returnedAt = new Date(); a.set("notes", req.body.notes);
  await a.save();
  await DriverAsset.findByIdAndUpdate(assetId, { $set: { status:"available" }});
  res.json(a);
});

r.get("/", requireRole("drivers:assets","drivers:read"), async (req,res)=>{
  const { status, type, driver } = req.query as any;
  const q:any = {};
  if (status) q.status = status;
  if (driver) q.driver = driver;
  const items = await DriverAssetAssignment.find(q).populate("asset").limit(2000);
  res.json({ items });
});

export default r;
