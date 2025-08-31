// routes/admin/drivers.shifts.ts
import { Router } from "express";
import { z } from "zod";
import { validate, validate2 } from "../../middleware/validate";
import { requireRole } from "../../middleware/rbac";
import DriverShift from "../../models/Driver_app/DriverShift";
import DriverShiftAssignment from "../../models/Driver_app/DriverShiftAssignment";

const r = Router();

const ShiftSchema = z.object({ body: z.object({
  name: z.string(), dayOfWeek: z.number().min(0).max(6).optional(),
  specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startLocal: z.string().regex(/^\d{2}:\d{2}$/),
  endLocal: z.string().regex(/^\d{2}:\d{2}$/),
  area: z.string().optional(), capacity: z.number().int().min(0).default(0),
})});
r.post("/", requireRole("drivers:shifts"), validate2(ShiftSchema), async (req,res)=>{
  const s = await DriverShift.create(req.body); res.json(s);
});

const AssignSchema = z.object({ params: z.object({ id: z.string().length(24) }),
  body: z.object({ driverId: z.array(z.string().length(24)) })});
r.post("/:id/assign", requireRole("drivers:shifts"), validate2(AssignSchema), async (req,res)=>{
  const { id } = req.params; const { driverId } = req.body;
  const bulk = driverId.map(d => ({ updateOne: {
    filter: { shiftId: id, driver: d },
    update: { $setOnInsert: { shiftId: id, driver: d, status:"assigned" } },
    upsert: true
  }}));
  const rlt = await DriverShiftAssignment.bulkWrite(bulk);
  res.json({ ok:true, result:rlt });
});

r.get("/", requireRole("drivers:shifts","drivers:read"), async (req,res)=>{
  const { from, to, driver } = req.query as any;
  const q:any = {};
  if (driver) q.driver = driver;
  // تُعاد assignments مع معلومات الشفت
  const items = await DriverShiftAssignment.find(q).limit(2000).populate("shiftId");
  res.json({ items });
});

const PatchSchema = z.object({ params: z.object({ id: z.string().length(24) }),
  body: z.object({ startLocal:z.string().optional(), endLocal:z.string().optional(), capacity:z.number().int().optional() })});
r.patch("/:id", requireRole("drivers:shifts"), validate2(PatchSchema), async (req,res)=>{
  const s = await DriverShift.findByIdAndUpdate(req.params.id, { $set: req.body }, { new:true });
  res.json(s);
});

const MarkSchema = z.object({ params: z.object({ id: z.string().length(24) }),
  body: z.object({ driver:z.string().length(24), status: z.enum(["attended","absent","late"]) })});
r.patch("/:id/mark", requireRole("drivers:shifts"), validate2(MarkSchema), async (req,res)=>{
  const a = await DriverShiftAssignment.findOneAndUpdate(
    { shiftId: req.params.id, driver: req.body.driver },
    { $set: { status: req.body.status } }, { new:true, upsert:false });
  res.json(a);
});

export default r;
