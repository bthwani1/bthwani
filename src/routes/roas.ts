import express from "express";
import { z, ZodTypeAny } from "zod";
import RoasDaily from "../models/RoasDaily";
import { validate } from "../middleware/validate";

const r = express.Router();

r.get("/api/v1/marketing/roas",
  validate({ query: z.object({
    from: z.string().optional(), // YYYY-MM-DD
    to:   z.string().optional(),
    groupBy: z.enum(["source","campaign"]).default("campaign")
  }) as ZodTypeAny }),
  async (req, res, next) => {
    try {
      const tz = "Asia/Aden";
      const { from, to, groupBy } = req.query as any;
      const $match: any = {};
      if (from) $match.day = { ...( $match.day || {} ), $gte: new Date(from + "T00:00:00") };
      if (to)   $match.day = { ...( $match.day || {} ), $lt:  new Date(to   + "T00:00:00") };

      const groupKey = groupBy === "source" ? "$source" : "$campaign";
      const agg = await RoasDaily.aggregate([
        { $match: $match },
        { $group: {
            _id: { group: groupKey },
            cost: { $sum: "$cost" },
            revenue: { $sum: "$revenue" },
            conversions: { $sum: "$conversions" }
        }},
        { $project: {
            _id:0,
            group: "$_id.group",
            cost:1, revenue:1, conversions:1,
            cpa: { $cond: [ { $gt:["$conversions",0] }, { $divide: ["$cost","$conversions"] }, 0 ] },
            roas: { $cond: [ { $gt:["$cost",0] }, { $divide:["$revenue","$cost"] }, { $cond:[ { $gt:["$revenue",0] }, Infinity, 0 ] } ] }
        }},
        { $sort: { revenue:-1 } }
      ]);
      res.json({ rows: agg });
    } catch (e) { next(e); }
  }
);

export default r;
