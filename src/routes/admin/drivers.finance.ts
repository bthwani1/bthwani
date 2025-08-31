// routes/admin/drivers.finance.ts
import { Router } from "express";
import { z } from "zod";
import { validate, validate2 } from "../../middleware/validate";
import { requireRole } from "../../middleware/rbac";
import DriverAdjustment from "../../models/Driver_app/DriverAdjustment";
import DriverPayoutCycle from "../../models/Driver_app/DriverPayoutCycle";

const r = Router();

r.post("/:id/adjustments",
  requireRole("drivers:finance"), validate2(z.object({
    params: z.object({ id: z.string().length(24) }),
    body: z.object({ type: z.enum(["bonus","penalty"]), amount: z.number(), reason: z.string().optional() })
  })), async (req,res)=>{
    const a = await DriverAdjustment.create({
      driver: req.params.id, type: req.body.type, amount: req.body.amount,
      reason: req.body.reason, createdBy: req.user?.email
    });
    res.json(a);
});
r.get("/:id/adjustments", requireRole("drivers:finance","drivers:read"), async (req,res)=>{
    const items = await DriverAdjustment.find({ driver: req.params.id }).sort({ createdAt:-1 }).limit(2000);
    res.json({ items });
  });
r.post("/run",
  requireRole("drivers:finance"),
  validate2(z.object({ query: z.object({
    period: z.enum(["weekly","biweekly","monthly"]),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })})),
  async (req,res)=>{
    // يولّد دورات تسوية (حساب earnings من أوامر/عمولات حسب نظامك)
    // هنا نصنع placeholder فقط – الحساب الفعلي اربطه بالطلبات
    const { period, from, to } = req.query as any;
    // example: iterate drivers list…
    // تأكد من unique({driver,start,end})
    res.json({ ok:true, message:"Payout cycles enqueued/created" });
});

r.get("/", requireRole("drivers:finance","drivers:read"), async (req,res)=>{
  const { from, to, status, driver } = req.query as any;
  const q:any = {};
  if (driver) q.driver = driver;
  if (status) q.status = status;
  if (from && to) q.start = from, q.end = to;
  const items = await DriverPayoutCycle.find(q).limit(2000);
  res.json({ items });
});

r.patch("/:payoutId/approve", requireRole("drivers:finance"), async (req,res)=>{
  const p = await DriverPayoutCycle.findByIdAndUpdate(req.params.payoutId, { $set: { status:"approved" }}, { new:true });
  res.json(p);
});
r.patch("/:payoutId/pay", requireRole("drivers:finance"), validate2(z.object({
  body: z.object({ reference: z.string() })
})), async (req,res)=>{
  const p = await DriverPayoutCycle.findByIdAndUpdate(req.params.payoutId, {
    $set: { status:"paid", reference: req.body.reference }
  }, { new:true });
  res.json(p);
});

export default r;
