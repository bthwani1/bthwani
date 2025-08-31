// src/routes/admin/driverAdminRoutes.ts

import express from "express";
import {
  createDriver,
  listDrivers,
  resetPassword,
  searchDrivers,
  setJokerStatus,
  toggleBan,
  updateWallet,
  verifyDriver,
} from "../../controllers/admin/admin.driver.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import {
  confirmTransferToUser,
  initiateTransferToUser,
  updateJokerWindow,
} from "../../controllers/driver_app/driver.controller";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import {
  approveVacation,
  getActiveDriversCount,
} from "../../controllers/driver_app/vacation.controller";
import { verifyAdmin } from "../../middleware/verifyAdmin";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: AdminDrivers
 *     description: إدارة سائقي التوصيل من قِبَل الأدمن
 */

/**
 * @swagger
 * /admin/drivers/create:
 *   post:
 *     summary: إنشاء سائق جديد
 *     description: يتيح للأدمن أو السوبر أدمن إضافة سائق جديد إلى النظام.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات السائق الجديد (الاسم، الجوال، البريد، إلخ)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "محمد علي"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "driver@example.com"
 *               phone:
 *                 type: string
 *                 example: "+966501234567"
 *               password:
 *                 type: string
 *                 example: "StrongPass123"
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - password
 *     responses:
 *       201:
 *         description: تم إنشاء السائق بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Driver'
 *       400:
 *         description: بيانات غير صالحة أو ناقصة.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       500:
 *         description: خطأ في الخادم أثناء إنشاء السائق.
 */
router.post(
  "/create",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  createDriver
);

router.put(
  "/joker",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  setJokerStatus
);
router.patch(
  "vacations/:id/approve",
  verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  approveVacation
);
router.get(
  "/active/count",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  getActiveDriversCount
);

router.get(
  "/search",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  searchDrivers
);
/**
 * @swagger
 * /admin/drivers:
 *   get:
 *     summary: جلب قائمة جميع السائقين
 *     description: يتيح للأدمن أو السوبر أدمن عرض جميع السائقين المسجلين في النظام.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب قائمة السائقين بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Driver'
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       500:
 *         description: خطأ في الخادم أثناء جلب السائقين.
 */
router.get(
  "/",
  verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  listDrivers
);
/**
 * @swagger
 * /admin/drivers/{id}/block:
 *   patch:
 *     summary: حظر أو رفع حظر عن سائق
 *     description: يتيح للأدمن أو السوبر أدمن حظر سائق أو رفع الحظر عنه بواسطة معرّف السائق.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف السائق المراد حظره أو رفع الحظر عنه
 *     responses:
 *       200:
 *         description: تم تحديث حالة الحظر بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 driverId:
 *                   type: string
 *                   example: "driver123"
 *                 isBanned:
 *                   type: boolean
 *                   example: true
 *                   description: الحالة الحالية للحظر (true إذا محظور، false إذا مرفوع الحظر)
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على السائق المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تحديث حالة الحظر.
 */
router.patch(
  "/:id/block",
  verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  toggleBan
);

/**
 * @swagger
 * /admin/drivers/{id}/verify:
 *   patch:
 *     summary: توثيق سائق جديد
 *     description: يتيح للأدمن أو السوبر أدمن توثيق حساب السائق بواسطة معرّفه.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف السائق المراد توثيقه
 *     responses:
 *       200:
 *         description: تم توثيق الحساب بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Driver'
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على السائق المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء توثيق الحساب.
 */
router.patch(
  "/:id/verify",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  verifyDriver
);

/**
 * @swagger
 * /admin/drivers/{id}/wallet:
 *   patch:
 *     summary: تعديل رصيد السائق في المحفظة
 *     description: يتيح للأدمن أو السوبر أدمن إضافة أو سحب مبلغ من محفظة السائق بواسطة معرّفه.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف السائق المراد تعديل محفظته
 *     requestBody:
 *       description: بيانات التعديل في المحفظة (المبلغ الجديد أو العملية)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100.0
 *                 description: المبلغ المراد إضافته (إيجابي) أو سحبه (سلبي)
 *             required:
 *               - amount
 *     responses:
 *       200:
 *         description: تم تحديث رصيد السائق بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DriverWallet'
 *       400:
 *         description: بيانات المحفظة غير صالحة.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على السائق المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تعديل رصيد المحفظة.
 */
router.patch(
  "/:id/wallet",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  updateWallet
);

/**
 * @swagger
 * /admin/drivers/{id}/reset-password:
 *   patch:
 *     summary: إعادة تعيين كلمة مرور السائق
 *     description: يتيح للأدمن أو السوبر أدمن إعادة تعيين كلمة مرور السائق بواسطة معرّفه.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف السائق المراد إعادة تعيين كلمة مروره
 *     responses:
 *       200:
 *         description: تم إعادة تعيين كلمة المرور بنجاح، وستصل عبر البريد إلكتروني.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "تم إرسال رابط إعادة التعيين إلى البريد الإلكتروني."
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على السائق المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء إعادة تعيين كلمة المرور.
 */
router.patch(
  "/:id/reset-password",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  resetPassword
);

/**
 * @swagger
 * /admin/drivers/wallet/initiate-transfer:
 *   post:
 *     summary: بدء تحويل مبلغ إلى السائق
 *     description: يتيح للأدمن أو السوبر أدمن بدء عملية تحويل مبلغ مالي إلى سائق.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات التحويل (معرّف السائق والمبلغ المراد تحويله)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               driverId:
 *                 type: string
 *                 example: "driver123"
 *                 description: معرّف السائق المستفيد من التحويل
 *               amount:
 *                 type: number
 *                 example: 150.0
 *                 description: المبلغ المراد تحويله للرصيد المتوفر للسائق
 *             required:
 *               - driverId
 *               - amount
 *     responses:
 *       200:
 *         description: تم بدء عملية التحويل بنجاح، ينتظر التأكيد.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transferId:
 *                   type: string
 *                   example: "tx123"
 *                 status:
 *                   type: string
 *                   example: "pending"
 *       400:
 *         description: بيانات غير صالحة أو رصيد غير كافٍ.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على السائق المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء بدء عملية التحويل.
 */
router.post("/wallet/initiate-transfer", authenticate, initiateTransferToUser);

/**
 * @swagger
 * /admin/drivers/wallet/confirm-transfer:
 *   post:
 *     summary: تأكيد تحويل مبلغ إلى السائق
 *     description: يتيح للأدمن أو السوبر أدمن تأكيد عملية تحويل المبلغ بعد التحقق منها.
 *     tags: [AdminDrivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات تأكيد التحويل (معرّف عملية التحويل ورمز التأكيد)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transferId:
 *                 type: string
 *                 example: "tx123"
 *                 description: معرّف عملية التحويل المراد تأكيدها
 *               confirmationCode:
 *                 type: string
 *                 example: "987654"
 *                 description: رمز التأكيد المستلم للتحقق من عملية التحويل
 *             required:
 *               - transferId
 *               - confirmationCode
 *     responses:
 *       200:
 *         description: تم تأكيد عملية التحويل بنجاح وتحديث رصيد السائق.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transferId:
 *                   type: string
 *                   example: "tx123"
 *                 status:
 *                   type: string
 *                   example: "completed"
 *       400:
 *         description: رمز التأكيد غير صالح أو منتهي الصلاحية.
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 *       403:
 *         description: صلاحيات الأدمن أو السوبر أدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على عملية التحويل المطلوب تأكيدها.
 *       500:
 *         description: خطأ في الخادم أثناء تأكيد عملية التحويل.
 */
router.post("/wallet/confirm-transfer", authenticate, confirmTransferToUser);
router.patch(
  "/drivers/:id/joker-window",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
verifyAdmin,
  updateJokerWindow
);
export default router;
