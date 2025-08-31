// crons/drivers/scheduler.ts
import cron from "node-cron";
import { buildAttendanceDaily } from "./buildAttendanceDaily";
import { markShiftAttendanceTick } from "./markShiftAttendance";
import { collectExpiringDocs } from "./expiringDocs";
import { buildPayouts } from "./buildPayouts";

const health = {
  attendanceDaily: { at:null as string|null, result:null as any },
  markShift:       { at:null as string|null, result:null as any },
  expiringDocs:    { at:null as string|null, result:null as any },
  payouts:         { at:null as string|null, result:null as any },
};

export function scheduleBuildAttendanceDaily(){
  cron.schedule("15 1 * * *", async ()=>{
    const r = await buildAttendanceDaily(); health.attendanceDaily = { at: new Date().toISOString(), result: r };
  }, { timezone: "Asia/Aden" });
}
export function scheduleMarkShiftAttendance(){
  cron.schedule("*/15 * * * *", async ()=>{
    const r = await markShiftAttendanceTick(); health.markShift = { at: new Date().toISOString(), result: r };
  }, { timezone: "Asia/Aden" });
}
export function scheduleExpiringDocs(){
  cron.schedule("0 2 * * *", async ()=>{
    const r = await collectExpiringDocs(30); health.expiringDocs = { at: new Date().toISOString(), result: r };
  }, { timezone: "Asia/Aden" });
}
export function scheduleBuildPayouts(){
  // مثال: كل اثنين 03:00
  cron.schedule("0 3 * * 1", async ()=>{
    const r = await buildPayouts("weekly","auto","auto"); health.payouts = { at: new Date().toISOString(), result: r };
  }, { timezone: "Asia/Aden" });
}
export function getDriversCronHealth(){ return health; }
