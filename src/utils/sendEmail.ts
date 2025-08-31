// utils/sendEmail.ts
import nodemailer from "nodemailer";

const FROM_USER = "ceo@bthwani.com";        // يفضَّل no-reply@
const FROM_PASS = "C*h5u=/iDXJ";            // انقلها إلى .env
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465 = SSL
  auth: { user: FROM_USER, pass: FROM_PASS },
  // logger: true, debug: true, // شغّلها مؤقتًا إذا أردت تتبعًا مفصلًا
});

async function sendMailSafe(opts: Parameters<typeof transporter.sendMail>[0]) {
  try {
    await transporter.verify();            // يعطيك EAUTH/ETIMEDOUT إن وُجدت مشكلة اتصال
    return await transporter.sendMail({
      from: `"بثواني — عدم الرد" <${FROM_USER}>`, // مهم: from = نفس SMTP_USER
      replyTo: "support@bthwani.com",
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
        "Precedence": "bulk",
      },
      ...opts,
    });
  } catch (e: any) {
    console.error("SMTP send error:", e?.code, e?.message);
    throw e;
  }
}

export async function sendResetEmail(email: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; direction:rtl; text-align:right">
      <h2>إعادة تعيين كلمة المرور</h2>
      <p>رمزك هو:</p>
      <div style="font-size:22px;font-weight:bold;letter-spacing:3px;color:#D84315">${code}</div>
      <p>ينتهي خلال 5 دقائق.</p>
    </div>
  `;
  await sendMailSafe({ to: email, subject: "رمز إعادة تعيين كلمة المرور", html, text: `رمزك: ${code}` });
}

export async function sendOtpEmail(email: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; direction:rtl; text-align:right">
      <h2>رمز التحقق من البريد</h2>
      <p>رمزك هو:</p>
      <div style="font-size:22px;font-weight:bold;letter-spacing:3px;color:#D84315">${code}</div>
      <p>ينتهي خلال 5 دقائق.</p>
    </div>
  `;
  await sendMailSafe({ to: email, subject: "رمز التحقق - بثواني", html, text: `رمزك: ${code}` });
}
