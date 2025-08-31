import { Request, Response } from "express";
import Marketer from "../../models/fieldMarketingV1/Marketer";
import bcrypt from "bcrypt";
import { Parser } from "json2csv";

// Helpers (Firebase claims اختياري)
async function setFirebaseCustomClaims(firebaseUid: string, role = "marketer") {
  // TODO: admin.auth().setCustomUserClaims(firebaseUid, { role })
  return true;
}

export async function invite(req: Request, res: Response) {
  const {
    fullName,
    phone,
    email,
    password,
    city,
    team,
    area,
    commissionPlanId,
    firebaseUid,
  } = req.body;
  if (!fullName || !phone)
    return res.status(400).json({ message: "fullName و phone مطلوبة" });

  const exists = await Marketer.findOne({
    $or: [{ phone }, { email: email?.toLowerCase() }],
  });
  if (exists)
    return res
      .status(409)
      .json({ message: "رقم الهاتف أو البريد مستخدم مسبقًا" });

  let hashed: string | undefined;
  if (password) {
    if (String(password).length < 8)
      return res
        .status(400)
        .json({ message: "الحد الأدنى 8 أحرف لكلمة المرور" });
    hashed = await bcrypt.hash(password, 10);
  }

  const mk = await Marketer.create({
    fullName,
    phone,
    email: email?.toLowerCase(),
    city,
    team,
    area,
    status: "active",
    commissionPlanId,
    firebaseUid,
    ...(hashed ? { password: hashed } : {}),
  });

  if (firebaseUid) await setFirebaseCustomClaims(firebaseUid, "marketer");
  // TODO: إرسال بريد ترحيبي إن رغبت
  res.status(201).json(mk);
}

export async function list(req: Request, res: Response) {
  const { q, status, team, area } = req.query as any;
  const filter: any = {};
  if (status) filter.status = status;
  if (team) filter.team = team;
  if (area) filter.area = area;
  if (q)
    filter.$or = [
      { fullName: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
    ];
  const list = await Marketer.find(filter).sort({ createdAt: -1 });
  res.json(list);
}

export async function getById(req: Request, res: Response) {
  const mk = await Marketer.findById(req.params.id);
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json(mk);
}

export async function update(req: Request, res: Response) {
  const mk = await Marketer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json(mk);
}

export async function setStatus(req: Request, res: Response) {
  const { status } = req.body as { status: "active" | "suspended" };
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json(mk);
}

export async function linkFirebase(req: Request, res: Response) {
  const { firebaseUid } = req.body;
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { firebaseUid },
    { new: true }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  if (firebaseUid) await setFirebaseCustomClaims(firebaseUid, "marketer");
  res.json(mk);
}

export async function resetPassword(req: Request, res: Response) {
  const { password } = req.body;
  if (!password || String(password).length < 8)
    return res.status(400).json({ message: "كلمة مرور غير صالحة" });
  const hash = await bcrypt.hash(password, 10);
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { password: hash },
    { new: true, select: "-password" }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json({ ok: true });
}

export async function assignAreaTeamPlan(req: Request, res: Response) {
  const { area, team, commissionPlanId } = req.body;
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { area, team, commissionPlanId },
    { new: true }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json(mk);
}

export async function setTargets(req: Request, res: Response) {
  // حقول خفيفة توضع داخل marketer أو جدول منفصل حسب حاجتك
  const { monthlyStoresTarget, monthlyApprovalRateTarget } = req.body;
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { monthlyStoresTarget, monthlyApprovalRateTarget },
    { new: true }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json(mk);
}

export async function softDelete(req: Request, res: Response) {
  const mk = await Marketer.findByIdAndUpdate(
    req.params.id,
    { status: "suspended" },
    { new: true }
  );
  if (!mk) return res.status(404).json({ message: "غير موجود" });
  res.json({ ok: true });
}

export async function exportCSV(_req: Request, res: Response) {
  const rows = await Marketer.find().lean();
  const parser = new Parser({
    fields: [
      "_id",
      "fullName",
      "phone",
      "email",
      "city",
      "team",
      "area",
      "status",
      "createdAt",
    ],
  });
  const csv = parser.parse(rows);
  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment("marketers-export.csv");
  res.send(csv);
}
