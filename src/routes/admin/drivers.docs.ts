// routes/admin/drivers.docs.ts
import { Router } from "express";
import { z } from "zod";
import {  validate2 } from "../../middleware/validate";
import { requireRole } from "../../middleware/rbac";
import DriverDocument from "../../models/Driver_app/DriverDocument";
import dayjs from "dayjs";

const r = Router();

r.patch("/:docId", requireRole("drivers:read","drivers:write"), validate2(z.object({
  params: z.object({ docId: z.string().length(24) }),
  body: z.object({ status: z.enum(["approved","rejected"]) })
})), async (req,res)=>{
  const d = await DriverDocument.findByIdAndUpdate(req.params.docId, { $set: { status: req.body.status }}, { new:true });
  res.json(d);
});
r.get("/", requireRole("drivers:read"), async (req,res)=>{
    const { driver, status } = req.query as any;
    const q:any = {};
    if (driver) q.driver = driver;
    if (status) q.status = status;
    const items = await DriverDocument.find(q).sort({ createdAt:-1 }).limit(2000);
    res.json({ items });
  });
r.get("/expiring", requireRole("drivers:read"), async (req,res)=>{
  const days = Number((req.query.days as string) || 30);
  const now = dayjs();
  const to = now.add(days,"day").toDate();
  const docs = await DriverDocument.find({ expiresAt: { $gte: now.toDate(), $lte: to }}).sort({ expiresAt:1 }).limit(2000);
  res.json({ count: docs.length, items: docs });
});

export default r;
