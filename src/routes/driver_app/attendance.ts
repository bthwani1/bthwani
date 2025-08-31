// routes/drivers/attendance.ts (للسائق نفسه)
import { Router } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import DriverAttendanceSession from "../../models/Driver_app/DriverAttendanceSession";
import { validate, validate2 } from "../../middleware/validate";
import { requireDriverSelf } from "../../middleware/driverGuard";
import DriverDocument from "../../models/Driver_app/DriverDocument";

const r = Router();

const CheckInSchema = z.object({
  body: z.object({
    lat: z.number(),
    lng: z.number(),
    deviceInfo: z.any().optional(),
  }),
});
r.post("/:id/docs",
    requireDriverSelf,
    validate2(z.object({ body: z.object({
      type: z.string(), number: z.string().optional(),
      issuedAt: z.string().optional(), expiresAt: z.string().optional(),
      fileUrl: z.string().url()
    })})),
    async (req:any,res)=>{
      const d = await DriverDocument.create({
        driver: req.params.id, type: req.body.type, number: req.body.number,
        issuedAt: req.body.issuedAt ? new Date(req.body.issuedAt) : undefined,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        fileUrl: req.body.fileUrl, status: "pending"
      });
      res.json(d);
  });
r.post(
  "/:id/attendance/check-in",
  requireDriverSelf,
  validate2(CheckInSchema),
  async (req: any, res) => {
    const driver = req.params.id;
    const open = await DriverAttendanceSession.findOne({
      driver,
      status: "open",
    });
    if (open) {
      res.status(400).json({ message: "Session already open" });
      return;
    }
    const doc = await DriverAttendanceSession.create({
      driver,
      startAt: new Date(),
      startLoc: { lat: req.body.lat, lng: req.body.lng },
      deviceInfo: req.body.deviceInfo,
      status: "open",
    });
    res.json(doc);
  }
);

const CheckOutSchema = z.object({
  body: z.object({ lat: z.number(), lng: z.number() }),
});
r.post(
  "/:id/attendance/check-out",
  requireDriverSelf,
  validate2(CheckOutSchema),
  async (req: any, res) => {
    const driver = req.params.id;
    const sess = await DriverAttendanceSession.findOne({
      driver,
      status: "open",
    }).sort({ startAt: -1 });
    if (!sess) {
      res.status(400).json({ message: "No open session" });
      return;
    }
    sess.endAt = new Date();
    sess.endLoc = { lat: req.body.lat, lng: req.body.lng };
    sess.status = "closed";
    await sess.save();
    res.json(sess);
  }
);

r.get("/:id/attendance/daily", requireDriverSelf, async (req: any, res) => {
  // يُفضّل توفير aggregation من DriverAttendanceDaily
  // (يمكنك لاحقًا إضافة تجميعة حسب from/to)
  // Placeholder: رجّع آخر 30 يومًا من DriverAttendanceDaily
  const from =
    (req.query.from as string) ||
    dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const to = (req.query.to as string) || dayjs().format("YYYY-MM-DD");
  const DriverAttendanceDaily = (
    await import("../../models/Driver_app/DriverAttendanceDaily")
  ).default;
  const items = await DriverAttendanceDaily.find({
    driver: req.params.id,
    day: { $gte: from, $lte: to },
  }).sort({ day: 1 });
  res.json({ items });
});

export default r;
