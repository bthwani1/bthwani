// crons/drivers/buildAttendanceDaily.ts
import dayjs from "dayjs";
import DriverAttendanceSession from "../models/Driver_app/DriverAttendanceSession";
import DriverAttendanceDaily from "../models/Driver_app/DriverAttendanceDaily";


export async function buildAttendanceDaily(forDay?: string) {
  const day = forDay || dayjs().subtract(1,"day").format("YYYY-MM-DD");
  const start = dayjs.tz(day).startOf("day").toDate();
  const end   = dayjs.tz(day).endOf("day").toDate();

  const sessions = await DriverAttendanceSession.aggregate([
    { $match: { startAt: { $lte: end }, $or: [{ endAt: { $gte: start } }, { status:"open" }] } },
    { $group: {
      _id: "$driver",
      totalOnlineMs: { $sum: {
        $multiply: [
          { $subtract: [ { $ifNull:["$endAt", end] }, { $max: [ "$startAt", start ] } ] }, 1
        ]
      }},
      firstCheckInAt: { $min: "$startAt" },
      lastCheckOutAt: { $max: "$endAt" }
    }},
    { $project: {
      driver: "$_id", _id:0,
      day, totalOnlineMins: { $divide: ["$totalOnlineMs", 1000*60] },
      firstCheckInAt:1, lastCheckOutAt:1
    }}
  ]);

  let updated = 0;
  for (const row of sessions) {
    await DriverAttendanceDaily.updateOne(
      { driver: row.driver, day },
      { $set: row },
      { upsert: true }
    );
    updated++;
  }
  return { day, updated };
}
