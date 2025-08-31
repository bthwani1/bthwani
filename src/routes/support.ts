// routes/support.ts
import { Router } from "express";
import { z } from "zod";
import { validate, validate2 } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import { guardSensitive } from "../middleware/idorGuard";
import SupportTicket from "../models/support/SupportTicket";
import TicketMessage from "../models/support/TicketMessage";
import Counter from "../models/support/Counter";
import SlaPolicy from "../models/support/SlaPolicy";

const r = Router();

// GET /support/tickets
r.get("/tickets", requireRole("support:read"), async (req, res) => {
  const {
    q,
    status,
    priority,
    assignee,
    tag,
    page = "1",
    limit = "20",
  } = req.query as any;
  const lim = Math.min(parseInt(limit, 10) || 20, 200);
  const skip = (parseInt(page, 10) || 1 - 1) * lim;
  const filter: any = {};
  if (q) filter.$text = { $search: q };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignee = assignee;
  if (tag) filter.tags = tag;
  const [items, total] = await Promise.all([
    SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(lim),
    SupportTicket.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: lim });
});

// POST /support/tickets
const CreateSchema = z.object({
  body: z.object({
    subject: z.string().min(3),
    description: z.string().optional(),
    requester: z
      .object({
        userId: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      })
      .optional(),
    links: z
      .object({
        orderId: z.string().length(24).optional(),
        store: z.string().length(24).optional(),
        driver: z.string().length(24).optional(),
      })
      .optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    channel: z.string().optional(),
    source: z.string().optional(),
  }),
});
r.post(
  "/tickets",
  requireRole("support:write"),
  guardSensitive,
  validate2(CreateSchema),
  async (req: any, res) => {
    const number = await Counter.next("ticket");
    const doc = await SupportTicket.create({
      ...req.body,
      number,
      requester: {
        ...(req.body.requester || {}),
        userId: req.body.requester?.userId || req.user?.id,
      },
    });
    if (req.body.description) {
      await TicketMessage.create({
        ticketId: doc._id,
        author: {
          type: req.user?.id ? "user" : "system",
          id: req.user?.id || "system",
        },
        isInternalNote: false,
        body: req.body.description,
      });
    }
    res.json(doc);
  }
);

// PATCH /support/tickets/:id
const PatchSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    status: z
      .enum(["new", "open", "pending", "on_hold", "resolved", "closed"])
      .optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignee: z.string().optional(),
    tags: z.array(z.string()).optional(),
    group: z.string().optional(),
  }),
});
r.patch(
  "/tickets/:id",
  requireRole("support:write"),
  guardSensitive,
  validate2(PatchSchema),
  async (req, res) => {
    const before = await SupportTicket.findById(req.params.id);
    const doc = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    // إذا انتقل للحل لأول مرة، عبّي resolvedAt
    if (
      doc &&
      !doc.resolvedAt &&
      (doc.status === "resolved" || doc.status === "closed")
    ) {
      doc.resolvedAt = new Date();
      await doc.save();
    }
    // إرسال دعوة CSAT (سيُطلقها الكرون/أو هنا إن أردت)
    res.json(doc);
  }
);

// POST /support/tickets/:id/messages
const MsgSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    isInternalNote: z.boolean().default(false),
    body: z.string().min(1),
    attachments: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url(),
          size: z.number().optional(),
        })
      )
      .optional(),
  }),
});
r.post(
  "/tickets/:id/messages",
  requireRole("support:write"),
  validate2(MsgSchema),
  async (req: any, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const msg = await TicketMessage.create({
      ticketId: ticket._id,
      author: { type: "agent", id: req.user?.email || req.user?.id || "agent" },
      isInternalNote: !!req.body.isInternalNote,
      body: req.body.body,
      attachments: req.body.attachments || [],
    });
    // أول رد وكيل؟
    if (!ticket.firstResponseAt && !msg.isInternalNote) {
      ticket.firstResponseAt = new Date();
      await ticket.save();
    }
    res.json(msg);
  }
);

// GET /support/tickets/:id/messages
r.get(
  "/tickets/:id/messages",
  requireRole("support:read"),
  async (req, res) => {
    const items = await TicketMessage.find({ ticketId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(5000);
    res.json({ items });
  }
);

// CSAT: POST /support/tickets/:id/csat
const CsatSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    score: z.number().min(1).max(5),
    comment: z.string().optional(),
  }),
});
r.post("/tickets/:id/csat", validate2(CsatSchema), async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (!(t.status === "resolved" || t.status === "closed")) {
    res.status(400).json({ message: "Ticket not closed/resolved" });
    return;
  }
  if (t.csatScore) {
    res.status(400).json({ message: "CSAT already submitted" });
    return;
  }
  t.csatScore = req.body.score;
  t.csatComment = req.body.comment;
  t.csatSentAt = new Date();
  await t.save();
  res.json({ ok: true });
});

// (MVP) تقارير مختصرة
r.get(
  "/reports/summary",
  requireRole("support:report", "support:read"),
  async (req, res) => {
    const from = (req.query.from as string) || new Date(0).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();
    const match: any = {
      createdAt: { $gte: new Date(from), $lte: new Date(to) },
    };
    const agg = await SupportTicket.aggregate([
      { $match: match },
      {
        $project: {
          status: 1,
          firstResponseAt: 1,
          createdAt: 1,
          resolvedAt: 1,
          csatScore: 1,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          backlogOpen: {
            $sum: {
              $cond: [
                { $in: ["$status", ["new", "open", "pending", "on_hold"]] },
                1,
                0,
              ],
            },
          },
          avgFRT: {
            $avg: {
              $cond: [
                [
                  { $and: ["$firstResponseAt", "$createdAt"] },
                  { $subtract: ["$firstResponseAt", "$createdAt"] },
                  null,
                ],
              ],
            },
          },
          avgART: {
            $avg: {
              $cond: [
                [
                  { $and: ["$resolvedAt", "$createdAt"] },
                  { $subtract: ["$resolvedAt", "$createdAt"] },
                  null,
                ],
              ],
            },
          },
          csatAvg: { $avg: "$csatScore" },
        },
      },
    ]);
    const s = agg[0] || {};
    res.json({
      total: s.total || 0,
      backlog: s.backlogOpen || 0,
      frtMinutes: s.avgFRT ? Math.round(s.avgFRT / 60000) : 0,
      artMinutes: s.avgART ? Math.round(s.avgART / 60000) : 0,
      csatAvg: s.csatAvg || 0,
    });
  }
);

// CRUD مبسّط: SlaPolicy / CannedResponse / Macro
// لنُعرّف كائنين بسيطين لـ CannedResponse/Macro دون موديلات منفصلة (MVP) أو يمكنك إنشاء موديلات مماثلة.
import { Schema, model } from "mongoose";
const Canned = model(
  "CannedResponse",
  new Schema({ title: String, body: String }, { timestamps: true })
);
const Macro = model(
  "Macro",
  new Schema(
    {
      name: String,
      changes: Schema.Types.Mixed,
      reply: String,
      internal: Boolean,
    },
    { timestamps: true }
  )
);

r.get("/canned", requireRole("support:read"), async (_req, res) => {
  res.json({ items: await Canned.find({}).sort({ updatedAt: -1 }).limit(500) });
});
r.post("/canned", requireRole("support:manage"), async (req, res) => {
  res.json(await Canned.create(req.body));
});
r.patch("/canned/:id", requireRole("support:manage"), async (req, res) => {
  res.json(
    await Canned.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    )
  );
});
r.delete("/canned/:id", requireRole("support:manage"), async (req, res) => {
  await Canned.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

r.get("/macros", requireRole("support:read"), async (_req, res) => {
  res.json({ items: await Macro.find({}).sort({ updatedAt: -1 }).limit(500) });
});
r.post("/macros", requireRole("support:manage"), async (req, res) => {
  res.json(await Macro.create(req.body));
});
r.post(
  "/tickets/:id/apply-macro/:macroId",
  requireRole("support:write"),
  async (req, res) => {
    const [t, m] = await Promise.all([
      SupportTicket.findById(req.params.id),
      Macro.findById(req.params.macroId),
    ]);
    if (!t || !m) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (m.changes)
      await SupportTicket.updateOne({ _id: t._id }, { $set: m.changes });
    if (m.reply)
      await TicketMessage.create({
        ticketId: t._id,
        author: { type: "agent", id: req.user?.email || "agent" },
        isInternalNote: !!m.internal,
        body: m.reply,
      });
    res.json({ ok: true });
  }
);

r.get("/sla-policies", requireRole("support:manage"), async (_req, res) => {
  res.json({ items: await SlaPolicy.find({}).sort({ updatedAt: -1 }) });
});
r.post("/sla-policies", requireRole("support:manage"), async (req, res) => {
  res.json(await SlaPolicy.create(req.body));
});

r.patch("/sla-policies/:id", requireRole("support:manage"), async (req, res) => {
  res.json(
    await SlaPolicy.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    )
  );
});

r.delete(
  "/sla-policies/:id",
  requireRole("support:manage"),
  async (req, res) => {
    await SlaPolicy.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  }
);

export default r;
