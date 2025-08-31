import { Request, Response } from "express";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { OTP } from "../models/otp";
import { generateOTP } from "../utils/otpAll";
import { sendOtpEmail, sendResetEmail } from "../utils/sendEmail";
import { adminAuth } from "../config/firebaseAdmin";

/** اعدادات */
const RESET_TOKEN_TTL = "10m"; // صلاحية توكن إعادة التعيين
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_ENV";

/** فائدة: منع اكواد قديمة لنفس الغرض */
async function invalidateOldResetOtps(userId: string) {
  await OTP.deleteMany({ userId, purpose: "resetPassword" });
}

/** POST /auth/password/forgot */
export const requestPasswordReset = async (req: Request, res: Response) => {
  // فحص المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const email = String(req.body.email).toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "EMAIL_NOT_FOUND" });
      return;
    }

    // افحص مزودي الدخول في فيربيز
    const fbUser = await adminAuth.getUser(user.firebaseUID);
    const providers = fbUser.providerData.map((p) => p.providerId);
    if (!providers.includes("password")) {
      // الحساب Google only: لا معنى لكلمة مرور
      res.status(409).json({ message: "NO_PASSWORD_PROVIDER" });
      return;
    }

    await invalidateOldResetOtps(String(user._id));

    // ولّد كود OTP جديد (صلاحية داخل generateOTP مثلاً 5 دقائق)
    const code = await generateOTP({
      userId: String(user._id),
      purpose: "resetPassword",
      metadata: { email },
    });

    // إرسال عبر بريدك الرسمي
    await sendResetEmail(email, code);

    // وضع التطوير: اطبع الكود بدل الإرسال (إن أردت)
    // if (process.env.NODE_ENV !== "production" || process.env.OTP_CHANNEL === "console") {
    //   console.log(`📧 DEV RESET OTP to ${email}: ${code}`);
    //   res.json({ ok: true, dev: true });
    //   return;
    // }

    res.json({ ok: true });
    return;
  } catch (e: any) {
    console.error("requestPasswordReset error:", e?.message || e);
    res.status(500).json({ message: "FAILED_TO_SEND", error: e?.message });
    return;
  }
};

/** POST /auth/password/verify */
export const verifyResetCode = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const email = String(req.body.email).toLowerCase().trim();
    const code = String(req.body.code).trim();

    const user = await User.findOne({ email }).lean();
    if (!user) {
      res.status(404).json({ message: "EMAIL_NOT_FOUND" });
      return;
    }

    // تحقق من OTP صالح وغير مستخدم وغير منتهي
    const otp = await OTP.findOne({
      userId: user._id,
      purpose: "resetPassword",
      code,            // ملاحظة: لو تخزن الكود مُجزّأ، عدّل للمقارنة بالهاش
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) {
      res.status(400).json({ message: "INVALID_OR_EXPIRED_CODE" });
      return;
    }

    // علم الكود كمستخدم
    otp.used = true;
    await otp.save();

    // أصدر resetToken قصير العمر مربوط بالـ UID
    const resetToken = jwt.sign(
      { sub: user.firebaseUID, uid: user.firebaseUID, purpose: "resetPassword" },
      JWT_SECRET,
      { expiresIn: RESET_TOKEN_TTL }
    );

    res.json({ ok: true, resetToken });
    return;
  } catch (e: any) {
    console.error("verifyResetCode error:", e?.message || e);
    res.status(500).json({ message: "FAILED_TO_VERIFY", error: e?.message });
    return;
  }
};

/** POST /auth/password/reset */
export const submitNewPassword = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { resetToken, newPassword } = req.body;

    let payload: any;
    try {
      payload = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      res.status(400).json({ message: "INVALID_OR_EXPIRED_TOKEN" });
      return;
    }

    if (!payload?.uid || payload?.purpose !== "resetPassword") {
      res.status(400).json({ message: "BAD_TOKEN" });
      return;
    }

    // حدّث كلمة المرور في Firebase
    await adminAuth.updateUser(payload.uid, { password: String(newPassword) });

    // ألغِ جميع الجلسات القديمة
    await adminAuth.revokeRefreshTokens(payload.uid);

    // (اختياري) أرسل إشعار أمني إلى البريد
    // await sendSecurityEmail(...)

    res.json({ ok: true });
    return;
  } catch (e: any) {
    console.error("submitNewPassword error:", e?.message || e);
    res.status(500).json({ message: "FAILED_TO_RESET", error: e?.message });
    return;
  }
};
