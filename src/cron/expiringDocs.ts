// crons/drivers/expiringDocs.ts
import dayjs from "dayjs";
import DriverDocument from "../models/Driver_app/DriverDocument";
export async function collectExpiringDocs(days=30){
  const now = dayjs(); const to = now.add(days,"day").toDate();
  const docs = await DriverDocument.find({ expiresAt: { $gte: now.toDate(), $lte: to }});
  // TODO: إشعار/تنبيه داخلي
  return { count: docs.length };
}
