// crons/support/slaMonitor.ts
import cron from "node-cron";
import dayjs from "dayjs";
import SupportTicket from "../models/support/SupportTicket";
import SlaPolicy from "../models/support/SlaPolicy";

let health = { at:null as string|null, checked:0, breachedFR:0, breachedRES:0, durationMs:0 };

export async function runSlaOnce() {
  const t0 = Date.now();
  const openStatuses = ["new","open","pending","on_hold"];
  const tickets = await SupportTicket.find({ status: { $in: openStatuses } }).limit(10000);
  const policies = await SlaPolicy.find({});
  let checked=0, bFR=0, bRES=0;

  for (const t of tickets) {
    checked++;
    // اختر سياسة بسيطة (أول واحدة تنطبق)
    const p = policies.find(p =>
      (!p.appliesTo?.priorities?.length || p.appliesTo.priorities.includes(t.priority)) &&
      (!p.appliesTo?.channels?.length || p.appliesTo.channels.includes(t.channel)) &&
      (!p.appliesTo?.tags?.length || (t.tags||[]).some((tag:string)=>p.appliesTo.tags.includes(tag)))
    );
    if (!p) continue;

    const created = dayjs(t.createdAt);
    if (!t.firstResponseAt) {
      const frDue = created.add(p.firstResponseMins, "minute");
      if (dayjs().isAfter(frDue)) { t.breachFirstResponse = true; bFR++; await t.save(); }
    }
    if (!t.resolvedAt) {
      const resDue = created.add(p.resolveMins, "minute");
      if (dayjs().isAfter(resDue)) { t.breachResolve = true; bRES++; await t.save(); }
    }
  }
  health = { at:new Date().toISOString(), checked, breachedFR:bFR, breachedRES:bRES, durationMs:Date.now()-t0 };
}

export function scheduleSlaMonitor() {
  cron.schedule("*/5 * * * *", runSlaOnce, { timezone:"Asia/Aden" });
}
export function getSlaHealth(){ return health; }
