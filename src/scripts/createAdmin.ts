import mongoose from "mongoose";
import { admin } from "../config/firebaseAdmin"; // Firebase Admin SDK
import { User } from "../models/user"; // نموذج المستخدم من مشروعك

const MONGO_URI = "mongodb+srv://m775071580:KPU8TxhRilLbgtyB@cluster0.hgb9fu2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const email = "admin@bthwani.com";
const password = "admin1234";
const fullName = "مدير النظام";
const role: "admin" | "superadmin" = "superadmin"; // 👈 غيّره إن أردت

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // تحقق إذا كان موجود مسبقًا
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("⚠️ المستخدم موجود بالفعل في قاعدة البيانات");
      return;
    }

    // إنشاء المستخدم في Firebase
    const fbUser = await admin.auth().createUser({ email, password });
    console.log("✅ Firebase user created:", fbUser.uid);

    // حفظ المستخدم في MongoDB
    const newUser = new User({
      fullName,
      email,
      firebaseUID: fbUser.uid,
      role,
    });

    await newUser.save();
    console.log(`✅ MongoDB user saved with role: ${role}`);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

run();
