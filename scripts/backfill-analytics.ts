// scripts/backfill-analytics.ts
import mongoose from "mongoose";
import DeliveryStore from "../src/models/delivry_Marketplace_V1/DeliveryStore";
import Driver from "../src/models/Driver_app/driver";
import { ensureGLForStore, ensureGLForDriver } from "../src/accounting/services/ensureEntityGL";

(async () => {
  await mongoose.connect(process.env.MONGO_URI!);

  for await (const s of DeliveryStore.find().select("_id name glPayableAccount")) {
    if (!s.glPayableAccount) await ensureGLForStore(s.id.toString());
  }
  for await (const d of Driver.find().select("_id fullName glReceivableAccount glDepositAccount")) {
    if (!d.glReceivableAccount || !d.glDepositAccount) await ensureGLForDriver(d.id.toString());
  }

  console.log("✅ Backfill done");
  await mongoose.disconnect();
})();
