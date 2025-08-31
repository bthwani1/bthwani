import { PipelineStage } from "mongoose";

type Rule = { field:string; op:string; value:any };

export function buildUserPipeline(rules: Rule[]): PipelineStage[] {
  const and:any[] = [];

  for (const r of rules) {
    if (r.field === "orders_count") {
      and.push({ $expr: compare(r.op, "$ordersCount", r.value) });
    } else if (r.field === "last_order_days") {
      and.push({ $expr: compare(r.op,
        { $divide: [{ $subtract: [new Date(), "$lastOrderAt"] }, 86400000] },
        r.value
      )});
    } else if (r.field === "utm.campaign") {
      and.push({ "utm.campaign": opVal(r.op, r.value) });
    } else if (r.field === "city") {
      and.push({ "addresses.city": opVal(r.op, r.value) });
    }
    // أضف مزيدًا حسب حاجتك
  }

  return [{ $match: and.length ? { $and: and } : {} }];
}

function opVal(op:string, v:any) { return op === "==" ? v : { $ne: v }; }
function compare(op:string, l:any, r:any) {
  const m:any = { ">":"$gt","<":"$lt",">=":"$gte","<=":"$lte","=":"$eq" };
  return { [m[op]]: [l, r] };
}
