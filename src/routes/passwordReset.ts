import { Router } from "express";
import { body } from "express-validator";
import {
  requestPasswordReset,
  verifyResetCode,
  submitNewPassword,
} from "../controllers/passwordReset.controller";

const router = Router();

/**
 * POST /api/v1/auth/password/forgot
 * يرسل OTP إلى الإيميل (purpose=resetPassword)
 */
router.post(
  "/auth/password/forgot",
  body("email").isString().trim().isLength({ min: 5 }).isEmail(),
  requestPasswordReset
);

/**
 * POST /api/v1/auth/password/verify
 * يتحقق من OTP ويُصدر resetToken (JWT قصير العمر)
 */
router.post(
  "/auth/password/verify",
  body("email").isString().trim().isLength({ min: 5 }).isEmail(),
  body("code").isString().trim().isLength({ min: 4, max: 8 }),
  verifyResetCode
);

/**
 * POST /api/v1/auth/password/reset
 * يعيّن كلمة مرور جديدة في Firebase Admin باستخدام resetToken
 */
router.post(
  "/auth/password/reset",
  body("resetToken").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 6, max: 128 }),
  submitNewPassword
);

export default router;
