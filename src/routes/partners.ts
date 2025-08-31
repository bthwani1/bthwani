import { Router } from "express";
import { z } from "zod";
import PartnerProfile from "../models/parenter/PartnerProfile";
import PartnerContract from "../models/parenter/PartnerContract";
import PartnerPerformanceDaily from "../models/parenter/PartnerPerformanceDaily";
import { validate, validate2 } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import dayjs from "dayjs";
import { Parser } from "json2csv";

const r = Router();

// GET /api/v1/partners
r.get("/",
  requireRole("partnerships:read"),
  async (req, res) => {
    const { q, lifecycle, tier, contractStatus, page="1", limit="20" } = req.query as any;
    const lim = Math.min(parseInt(limit,10)||20, 200);
    const skip = (parseInt(page,10)||1 - 1) * lim;

    const filter:any = {};
    if (q) filter.$text = { $search: q };         // اختياري: أضف index نصي لاحقًا
    if (lifecycle) filter.lifecycle = lifecycle;
    if (tier) filter.tier = tier;
    if (contractStatus) filter["contract.status"] = contractStatus;

    const [items, total] = await Promise.all([
      PartnerProfile.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(lim),
      PartnerProfile.countDocuments(filter)
    ]);

    res.json({ items, total, page: Number(page), limit: lim });
  }
);

// POST /api/v1/partners/upsert
const UpsertSchema = z.object({
  body: z.object({
    store: z.string().length(24),
    lifecycle: z.enum(["prospect","onboarding","active","paused","terminated"]).optional(),
    tier: z.enum(["A","B","C"]).optional(),
    commissionPct: z.number().min(0).max(100).optional(),
    settlementCycle: z.string().optional(),
  })
});
r.post("/upsert",
  requireRole("partnerships:write"),
  validate2(UpsertSchema),
  async (req:any,res) => {
    const { store, ...patch } = req.body;
    const doc = await PartnerProfile.findOneAndUpdate(
      { store },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // TODO: Audit log (مثال أدناه)
    res.json(doc);
  }
);

// GET /api/v1/partners/contracts/expiring?days=30
r.get("/contracts/expiring",
  requireRole("partnerships:contracts","partnerships:read"),
  async (req,res) => {
    const days = Number((req.query as any).days || 30);
    const now = dayjs();
    const to = now.add(days,"day").toDate();

    const contracts = await PartnerContract.find({
      status: { $in: ["signed","active"] },
      end: { $lte: to, $gte: now.toDate() }
    }).sort({ end: 1 }).limit(500);

    res.json({ count: contracts.length, items: contracts });
  }
);

// GET /api/v1/partners/:store/performance?from&to
r.get("/:store/performance",
  requireRole("partnerships:read"),
  async (req,res) => {
    const { store } = req.params;
    const from = (req.query as any).from || dayjs().subtract(30,"day").format("YYYY-MM-DD");
    const to   = (req.query as any).to   || dayjs().format("YYYY-MM-DD");

    const items = await PartnerPerformanceDaily.find({
      store,
      day: { $gte: from, $lte: to }
    }).sort({ day: 1 });

    res.json({ items });
  }
);

// (اختياري) GET /api/v1/partners/contracts/export/csv
r.get("/contracts/export/csv",
  requireRole("partnerships:contracts"),
  async (req,res) => {
    const docs = await PartnerContract.find({}).lean();
    const parser = new Parser({ fields: ["store","version","status","start","end","terms.commissionPct"] });
    const csv = parser.parse(docs);
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition","attachment; filename=\"contracts.csv\"");
    res.send(csv);
  }
);

export default r;
