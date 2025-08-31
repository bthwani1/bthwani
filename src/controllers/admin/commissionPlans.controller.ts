import { Request, Response } from "express";
import Plan from "../../models/fieldMarketingV1/CommissionPlan";

export async function list(_req: Request, res: Response) {
  res.json(await Plan.find().sort({ createdAt: -1 }));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await Plan.create(req.body));
}
export async function patch(req: Request, res: Response) {
  const p = await Plan.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!p) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(p);
}
export async function setStatus(req: Request, res: Response) {
  const p = await Plan.findByIdAndUpdate(
    req.params.id,
    { active: !!req.body.active },
    { new: true }
  );
  if (!p) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json(p);
}
export async function remove(req: Request, res: Response) {
  const p = await Plan.findByIdAndDelete(req.params.id);
  if (!p) {
    res.status(404).json({ message: "غير موجود" });
    return;
  }
  res.json({ ok: true });
}
