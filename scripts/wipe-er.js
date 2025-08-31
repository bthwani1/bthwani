// scripts/wipe-er.js
//node .\scripts\wipe-er.js I_UNDERSTAND
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb+srv://m775071580:KPU8TxhRilLbgtyB@cluster0.hgb9fu2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  const confirm = process.argv[2];
  if (confirm !== "I_UNDERSTAND") {
    console.error("أكتب I_UNDERSTAND بعد اسم السكربت للتأكيد.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  async function clear(name) {
    const exists = await db.listCollections({ name }).hasNext();
    if (exists) {
      const res = await db.collection(name).deleteMany({});
      console.log(`cleared ${name}: ${res.deletedCount}`);
    } else {
      console.log(`skip ${name} (not found)`);
    }
  }

  await clear("journalentries");
  await clear("journalbooks");
  await clear("chartaccounts");
  await clear("openingbalances");
  await clear("counters");

  await mongoose.disconnect();
  console.log("✅ تم المسح.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
