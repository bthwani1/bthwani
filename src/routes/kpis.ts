import express from "express";
import { z, ZodTypeAny } from "zod";
import { validate } from "../middleware/validate";
const r = express.Router();

const ORDERS = (req:any) => req.app.get("db").collection("orders");
const USERS  = (req:any) => req.app.get("db").collection("users");

r.get("/api/v1/marketing/kpis",
  validate({ query: z.object({
    from: z.string().optional(),
    to: z.string().optional()
  }) as ZodTypeAny }),
  async (req,res,next)=>{
    try{
      const { from, to } = req.query as any;
      const $match:any = {};
      if (from) $match.createdAt = { ...( $match.createdAt || {} ), $gte: new Date(from + "T00:00:00") };
      if (to)   $match.createdAt = { ...( $match.createdAt || {} ), $lt:  new Date(to   + "T00:00:00") };

      const [newUsers, firstOrders, revenue] = await Promise.all([
        USERS(req).countDocuments($match),
        ORDERS(req).countDocuments({ ...$match, isFirstOrder:true }),
        ORDERS(req).aggregate([
          { $match: { ...$match, status: { $in:["delivered","paid"] } } },
          { $group: { _id:null, v:{ $sum: { $ifNull:["$total", { $ifNull:["$amount","$grandTotal"] }] } } } }
        ]).toArray().then(a=>a[0]?.v||0)
      ]);

      res.json({ newUsers, firstOrders, revenue });
    }catch(e){ next(e); }
  }
);

export default r;
