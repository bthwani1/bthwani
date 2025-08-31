// scripts/ensure-2161-driver-deposits.ts
import mongoose from "mongoose";
import { ChartAccount } from "../src/models/er/chartAccount.model";

(async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  const exists = await ChartAccount.findOne({ code: "2161" });
  if (!exists) {
    const parent = await ChartAccount.findOne({ code: "2000" }).lean(); // مجموعة الخصوم
    if (!parent) throw new Error("لم يتم العثور على مجموعة الخصوم 2000");
    await ChartAccount.create({
      name: "ودائع السائقين (التزام)",
      code: "2161",
      parent: parent._id, // أو اجعله مستوى 2 تحت 2000 إن رغبت شجرة ثلاثية
      isActive: true,
    });
    console.log("✅ أنشئنا 2161");
  } else {
    console.log("✔︎ 2161 موجود مسبقًا");
  }
  await mongoose.disconnect();
})();
