import type { Express, Request } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

function buildCors() {
  // اسمح بمصادرك فقط (عدّل القائمة من المتغير البيئي)
  const allow = new Set(
    (process.env.CORS_ORIGINS ??
      "http://localhost:3000,http://localhost:19006,http://192.168.0.108:3000")
      .split(",")
      .map(s => s.trim())
  );

  const options: cors.CorsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // طلبات أدوات CLI الخ..
      if (allow.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 3600,
  };
  return options;
}

export function applySecurity(app: Express) {
  // مهم على Render/NGINX حتى يرى IP الحقيقي للعميل
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({
    // API فقط، لا تحتاج CSP الآن. فعّلها لاحقاً لو بتخدم HTML.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  const corsOptions = buildCors();
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // preflight

  // Rate limit عام لكل الطلبات
  const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600, // اضبطها حسب حملك
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, slow down." },
  });
  app.use(baseLimiter);
}

// محددات إضافية لكل سيناريو
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // تسجيل/تسجيل دخول
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts. Please try later." },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // POST/PUT/PATCH كثيفة
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Write rate limit exceeded." },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3, // OTP/SMS
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests." },
});
