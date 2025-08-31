// crons/drivers/markShiftAttendance.ts
import dayjs from "dayjs";
import DriverShift from "../models/Driver_app/DriverShift";
import DriverShiftAssignment from "../models/Driver_app/DriverShiftAssignment";
export async function markShiftAttendanceTick() {
  // تبسيط: من خلال التوقيت المحلي الحالي نحدد الشفتات الجارية ونوسم المتأخرين/الحضور
  const now = dayjs(); const hhmm = now.format("HH:mm");
  const dow = now.day(); const dateStr = now.format("YYYY-MM-DD");
  const shifts = await DriverShift.find({
    $or: [{ dayOfWeek: dow }, { specificDate: dateStr }]
  }).limit(2000);

  for (const s of shifts) {
    const assigns = await DriverShiftAssignment.find({ shiftId: s._id });
    for (const a of assigns) {
      if (a.status === "assigned" && hhmm > s.startLocal) {
        // لو لم يتحقق check-in ضمن النافذة، اعتبر late مؤقتًا (يمكنك ربطه بـ sessions)
        a.status = "late"; await a.save();
      }
      // يمكنك توسيع المنطق بقراءة أحدث Session للسائق وتحديد attended
    }
  }
  return { checked: shifts.length };
}
