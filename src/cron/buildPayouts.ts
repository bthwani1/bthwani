// crons/drivers/buildPayouts.ts
import DriverPayoutCycle from "../models/Driver_app/DriverPayoutCycle";
// Placeholder: اربط بحساب الأرباح من أوامر/عمولات/رسومك
export async function buildPayouts(period:"weekly"|"biweekly"|"monthly", from:string, to:string) {
  // أنشئ وثائق فريدة لكل سائق ضمن {start,end}
  // …
  return { ok:true };
}
