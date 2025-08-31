// services/mailer.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true ل 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmailOTP(to: string, code: string) {
  const from = process.env.FROM_EMAIL || "no-reply@yourapp.com";
  await transporter.sendMail({
    from,
    to,
    subject: "رمز التحقق",
    html: `<p>رمز التحقق الخاص بك: <b style="font-size:18px">${code}</b></p>`,
  });
}
