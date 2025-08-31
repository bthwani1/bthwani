// routes/admin/drivers.attendance.ts
import { Router } from "express";
import { z } from "zod";
import { validate, validate2 } from "../../middleware/validate";
import { requireRole } from "../../middleware/rbac";
import dayjs from "dayjs";
import DriverAttendanceSession from "../../models/Driver_app/DriverAttendanceSession";
import DriverAttendanceDaily from "../../models/Driver_app/DriverAttendanceDaily";

const r = Router();

// قائمة حضور اليوم حسب الحالة
r.get("/attendance", requireRole("drivers:read"), async (req,res)=>{
  const day = (req.query.day as string) || dayjs().format("YYYY-MM-DD");
  const status = (req.query.status as string); // online_now / absent / attended
  // تبسيط: online_now = يوجد session مفتوحة
  if (status === "online_now") {
    const open = await DriverAttendanceSession.find({ status:"open" }).sort({ startAt:-1 }).limit(1000);
    res.json({ items: open });
    return;
  }
  // absent/attended: اعتمد على Daily (يُبنى بالكرون)
  const daily = await DriverAttendanceDaily.find({ day }).limit(5000);
  res.json({ items: daily });
  return;
});

// Force-close
const ForceCloseSchema = z.object({ params: z.object({ sessionId: z.string().length(24) })});
r.patch("/attendance/sessions/:sessionId/force-close",
  requireRole("drivers:write"),
  validate2(ForceCloseSchema),
  async (req,res)=>{
    const s = await DriverAttendanceSession.findById(req.params.sessionId);
    if (!s) {
      res.status(404).json({ message:"Not found" });
      return;
    }
    if (s.status === "closed") {
      res.json(s);
      return;
    }
    s.status = "closed"; s.endAt = new Date();
    await s.save();
    res.json(s);
    return;
});

export default r;
