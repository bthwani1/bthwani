import { Types } from "mongoose";
import { OTP } from "../models/otp";
import { User } from "../models/user";
import { generateOTP } from "../utils/otpAll";
import { sendOtpEmail } from "../utils/sendEmail"; // استخدم ما جهزناه سابقًا

export const sendEmailOTP = async (
  email: string,
  userId: string,
  purpose: string
): Promise<string> => {
  const code = await generateOTP({ userId, purpose, metadata: { email } });

  // في التطوير: لا تعتمد على SMTP
  const channel = "smtp"; // default: smtp
  if (channel !== "smtp") {
    return code; // console/mock
  }

  await sendOtpEmail(email, code);
  return code;
};

export const verifyOTP = async ({
  userId,
  email,
  purpose,
  code,
}: {
  userId?: string;
  email?: string;
  purpose: string;
  code: string;
}) => {
  const query: any = {
    purpose,
    code,
    used: false,
    expiresAt: { $gt: new Date() },
  };

  if (userId) query.userId = new Types.ObjectId(userId); // 👈 هذا هو الصح
  else if (email) query["metadata.email"] = email;

  console.log("🔍 التحقق من OTP:", query);

let otp;
try {
  otp = await OTP.findOne(query);
  console.log("🔍 نتائج البحث:", otp);
} catch (err) {
  console.error("❌ خطأ أثناء البحث في OTP:", err);
  throw new Error("فشل التحقق من قاعدة البيانات");
}
  if (!otp) {
    return { valid: false };
  }

  if (otp.metadata?.email) {
    await User.updateOne(
      { email: otp.metadata.email },
      { emailVerified: true }
    );
  }

  otp.used = true;
  await otp.save();

  return { valid: true };
};
