import { Request, Response } from "express";
import Onboarding from "../../models/fieldMarketingV1/Onboarding";

function dt(s?: string) {
  return s ? new Date(s) : undefined;
}

export async function overview(req: Request, res: Response) {
  const { from, to } = req.query as any;
  const match: any = {};
  if (from || to) match.createdAt = {};
  if (from) match.createdAt.$gte = dt(from);
  if (to) match.createdAt.$lte = dt(to);

  const base = await Onboarding.aggregate([
    { $match: match },
    { $unwind: "$participants" },
    {
      $group: {
        _id: "$participants.uid",
        submittedW: {
          $sum: {
            $cond: [
              { $eq: ["$status", "submitted"] },
              { $ifNull: ["$participants.weight", 0.5] },
              0,
            ],
          },
        },
        approvedW: {
          $sum: {
            $cond: [
              { $eq: ["$status", "approved"] },
              { $ifNull: ["$participants.weight", 0.5] },
              0,
            ],
          },
        },
        rejectedW: {
          $sum: {
            $cond: [
              { $eq: ["$status", "rejected"] },
              { $ifNull: ["$participants.weight", 0.5] },
              0,
            ],
          },
        },
        needsFixW: {
          $sum: {
            $cond: [
              { $eq: ["$status", "needs_fix"] },
              { $ifNull: ["$participants.weight", 0.5] },
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        uid: "$._id",
        _id: 0,
        submittedW: 1,
        approvedW: 1,
        rejectedW: 1,
        needsFixW: 1,
        approvalRate: {
          $cond: [
            { $gt: ["$submittedW", 0] },
            { $divide: ["$approvedW", "$submittedW"] },
            0,
          ],
        },
      },
    },
    { $sort: { approvedW: -1 } },
  ]);

  res.json(base);
}

export async function perMarketer(req: Request, res: Response) {
  const { id } = req.params;
  const { from, to } = req.query as any;
  const match: any = { "participants.uid": id };
  if (from || to) match.createdAt = {};
  if (from) match.createdAt.$gte = dt(from);
  if (to) match.createdAt.$lte = dt(to);

  const rows = await Onboarding.find(match).sort({ createdAt: -1 }).lean();
  const submitted = rows.filter((r) => r.status === "submitted").length;
  const approved = rows.filter((r) => r.status === "approved").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const needsFix = rows.filter((r) => r.status === "needs_fix").length;

  res.json({
    uid: id,
    submitted,
    approved,
    rejected,
    needsFix,
    approvalRate: submitted ? approved / submitted : 0,
    items: rows,
  });
}
