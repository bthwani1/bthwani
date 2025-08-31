// src/routes/userRoutes.ts

import { Router, Request, Response } from "express";
import * as crypto from "crypto";
import { verifyFirebase } from "../middleware/verifyFirebase";
import {
  registerOrUpdateUser,
  getCurrentUser,
  updateProfile,
  updateSecurity,
  setPinCode,
  verifyPinCode,
  getUserStats,
  deactivateAccount,
  getAddresses,
  searchUsers,
} from "../controllers/user/userController";
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "../controllers/user/addressController";
import {
  getTransactions,
  getTransferHistory,
  getWallet,
  transferFunds,
} from "../controllers/Wallet_V8/walletController";

import {
  getNotifications,
  markAllNotificationsRead,
} from "../controllers/user/notificationsController";
import { uploadAvatar } from "../controllers/user/userAvatarController";
import { sendEmailOTP, verifyOTP } from "../controllers/otpControllers";
import { User } from "../models/user";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: عمليات إدارة وملفّات المستخدم
 *   - name: Wallet
 *     description: عمليات المحفظة والتحويلات
 *   - name: Social
 *     description: وظائف المتابعة والنشاط الاجتماعي
 *   - name: Notifications
 *     description: إدارة التنبيهات للمستخدم
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: استرجاع معلومات المستخدم الحالي
 *     description: يُعيد معلومات المستخدم بناءً على التوكين (JWT) الصالح.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: لقد تمَّ العثور على بيانات المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: لم يتم تقديم توكين صالح أو انتهت صلاحيته.
 */
router.get("/me", verifyFirebase, getCurrentUser);
router.get(
  "/search",
 verifyFirebase,                   // ← هذا يحلّل الـ JWT ويضع req.user
  searchUsers
);
/**
 * @swagger
 * /api/v1/users/init:
 *   post:
 *     summary: تسجيل أو تحديث بيانات المستخدم
 *     description: إذا كان المستخدم موجودًا، يتم تحديث بياناته؛ وإلا يتم إنشاء سجل جديد.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: حقول النموذج لإنشاء أو تحديث المستخدم
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegisterInput'
 *     responses:
 *       200:
 *         description: تمَّ إنشاء أو تحديث بيانات المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: الطلب يحتوي على بيانات غير صالحة.
 *       401:
 *         description: التوكين مفقود أو غير صالح.
 */
router.post("/init", verifyFirebase, registerOrUpdateUser);



/**
 * @swagger
 * /users/profile:
 *   patch:
 *     summary: تعديل بيانات الحساب
 *     description: يُمكِّن المستخدم من تحديث بياناته الشخصية مثل الاسم أو المدينة.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: الحقول المسموح بتحديثها
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: الاسم الكامل الجديد
 *               city:
 *                 type: string
 *                 description: المدينة الجديدة
 *             required:
 *               - fullName
 *     responses:
 *       200:
 *         description: تمَّ تحديث بيانات المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: القيمة المقدَّمة غير صحيحة.
 *       401:
 *         description: توكين غير صالح أو غير موجود.
 */
router.patch("/profile", verifyFirebase, updateProfile);

/**
 * @swagger
 * /users/security:
 *   patch:
 *     summary: تحديث إعدادات الأمان
 *     description: يتيح للمستخدم تحديث إعدادات الأمان مثل كلمة المرور أو البريد الإلكتروني.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: مثال لبقية حقول الأمان (غير موزّع هنا تفصيليًا)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: كلمة المرور الجديدة
 *             required:
 *               - password
 *     responses:
 *       200:
 *         description: تمَّ تحديث إعدادات الأمان بنجاح.
 *       400:
 *         description: البيانات المقدَّمة غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.patch("/security", verifyFirebase, updateSecurity);

/**
 * @swagger
 * /users/security/set-pin:
 *   patch:
 *     summary: تعيين رمز PIN
 *     description: يقوم المستخدم بتعيين رمز PIN جديد لأغراض الأمان.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: رُسالة الطلب التي تحتوي الرمز الجديد
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pinCode:
 *                 type: string
 *                 description: الرمز السري الجديد
 *             required:
 *               - pinCode
 *     responses:
 *       200:
 *         description: تمَّ تعيين رمز PIN بنجاح.
 *       400:
 *         description: الرمز غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.patch("/security/set-pin", verifyFirebase, setPinCode);

/**
 * @swagger
 * /users/security/verify-pin:
 *   patch:
 *     summary: التحقق من رمز PIN
 *     description: يتحقّق من أنّ الرمز الذي أدخله المستخدم صحيح.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: يحتوي على الرمز للتحقق
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pinCode:
 *                 type: string
 *                 description: الرمز المراد التحقق منه
 *             required:
 *               - pinCode
 *     responses:
 *       200:
 *         description: تمَّ التحقق من الرمز بنجاح.
 *       400:
 *         description: الرمز غير صحيح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.patch("/security/verify-pin", verifyFirebase, verifyPinCode);

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     summary: إحصائيات المستخدم
 *     description: يُرجع بيانات إحصائية عن نشاط المستخدم مثل عدد المنشورات والمتابعين.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات الإحصائيات تمَّ جلبها بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 postsCount:
 *                   type: integer
 *                   example: 12
 *                 followersCount:
 *                   type: integer
 *                   example: 45
 *                 followingCount:
 *                   type: integer
 *                   example: 32
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/me/stats", verifyFirebase, getUserStats);

/**
 * @swagger
 * /users/me/deactivate:
 *   delete:
 *     summary: تعطيل الحساب (إلغاء التفعيل)
 *     description: يقوم المستخدم بحذف أو تعطيل حسابه نهائيًا من المنصة.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم تعطيل الحساب بنجاح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.delete("/me/deactivate", verifyFirebase, deactivateAccount);

/**
 * @swagger
 * /users/address:
 *   get:
 *     summary: الحصول على قائمة العناوين
 *     description: يعرض جميع العناوين المخزنة للمستخدم.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة العناوين تمَّ جلبها بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/address", verifyFirebase, getAddresses);

/**
 * @swagger
 * /users/address:
 *   post:
 *     summary: إضافة عنوان جديد
 *     description: يتيح للمستخدم إضافة عنوان جديد إلى قائمته.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات العنوان الجديد
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       201:
 *         description: تمَّت إضافة العنوان بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         description: بيانات غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.post("/address", verifyFirebase, addAddress);

/**
 * @swagger
 * /users/address/{id}:
 *   patch:
 *     summary: تحديث عنوان موجود
 *     description: يقوم المستخدم بتحديث تفاصيل عنوان معيَّن بناءً على معرِّفه.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرِّف العنوان المراد تحديثه
 *     requestBody:
 *       description: بيانات الحقول المراد تحديثها في العنوان
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       200:
 *         description: تم تحديث العنوان بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         description: بيانات غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على العنوان المطلوب.
 */
router.patch("/address/:id", verifyFirebase, updateAddress);

/**
 * @swagger
 * /users/address/{id}:
 *   delete:
 *     summary: حذف عنوان محدد
 *     description: يقوم المستخدم بحذف عنوانٍ معيَّن من قائمته.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرِّف العنوان المراد حذفه
 *     responses:
 *       200:
 *         description: تم حذف العنوان بنجاح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على العنوان المطلوب.
 */
router.delete("/address/:id", verifyFirebase, deleteAddress);

/**
 * @swagger
 * /users/default-address:
 *   patch:
 *     summary: تعيين عنوان افتراضي
 *     description: يجعل العنوان الحالي الافتراضي الرئيسي للمستخدم.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: يحتوي على معرِّف العنوان الذي يراد تعيينه افتراضيًا
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: معرِّف العنوان المراد تعيينه أفتراضيًا
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: تم تعيين العنوان الافتراضي بنجاح.
 *       400:
 *         description: معرِّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على العنوان المطلوب.
 */
router.patch("/default-address", verifyFirebase, setDefaultAddress);

/**
 * @swagger
 * /users/wallet:
 *   get:
 *     summary: عرض رصيد المحفظة
 *     description: يعرض معلومات المحفظة الحالية مثل الرصيد والحالة المالية.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب بيانات المحفظة بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Wallet'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/wallet", verifyFirebase, getWallet);

/**
 * @swagger
 * /users/transactions:
 *   get:
 *     summary: سجل المعاملات
 *     description: يعرض سجل كافة المعاملات المالية المرتبطة بالمستخدم.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب سجل المعاملات بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/transactions", verifyFirebase, getTransactions);

/**
 * @swagger
 * /users/wallet/transfer:
 *   post:
 *     summary: تحويل أموال
 *     description: ينقل مبلغًا ماليًا من محفظة المستخدم إلى مستخدم آخر.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات الحوالة المالية
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WalletTransferInput'
 *     responses:
 *       200:
 *         description: تم إجراء الحوالة بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResult'
 *       400:
 *         description: بيانات غير صالحة أو رصيد غير كافٍ.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.post("/wallet/transfer", verifyFirebase, transferFunds);

/**
 * @swagger
 * /users/wallet/transfer-history:
 *   get:
 *     summary: سجل التحويلات
 *     description: يعرض قائمة بجميع التحويلات التي قام بها المستخدم.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب قائمة التحويلات بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TransferRecord'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/wallet/transfer-history", verifyFirebase, getTransferHistory);


/**
 * @swagger
 * /users/notifications:
 *   get:
 *     summary: عرض التنبيهات
 *     description: يعرض جميع التنبيهات المجدَّدة للمستخدم.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تمَّ جلب التنبيهات بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.get("/notifications", verifyFirebase, getNotifications);

/**
 * @swagger
 * /users/notifications/mark-read:
 *   patch:
 *     summary: تعليم جميع التنبيهات بأنها مقروءة
 *     description: يقوم بوضع جميع التنبيهات بحالة “مقروءة” للمستخدم الحالي.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تمَّ تعليم التنبيهات كمقروءة بنجاح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 */
router.patch(
  "/notifications/mark-read",
  verifyFirebase,
  markAllNotificationsRead
);
/**
 * @swagger
 * tags:
 *   - name: UserAvatar
 *     description: إدارة صور المستخدمين
 */

/**
 * @swagger
 * /users/avatar:
 *   patch:
 *     summary: تحديث صورة الملف الشخصي للمستخدم
 *     description: يتيح للمستخدم المصادَق عليه (Firebase) رفع صورة جديدة لملفه الشخصي.
 *     tags: [UserAvatar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: يجب إرسال ملف الصورة باستخدام صيغة FormData تحت الحقل "avatar"
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: ملف الصورة (JPEG, PNG, إلخ)
 *             required:
 *               - avatar
 *     responses:
 *       200:
 *         description: تم تحديث الصورة بنجاح، ويُعاد عنوان URL للصورة الجديدة.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 avatarUrl:
 *                   type: string
 *                   example: "https://cdn.example.com/avatars/64a0f2c7ae3c8b39f9d4d3e1.png"
 *       400:
 *         description: لم يتم تضمين ملف أو نوع الملف غير مدعوم.
 *       401:
 *         description: المستخدم غير مصادَق عليه أو توكين غير صالح.
 *       500:
 *         description: خطأ في الخادم أثناء معالجة الصورة.
 */
router.patch("/avatar", verifyFirebase, uploadAvatar);


router.post("/otp/send", verifyFirebase, async (req, res) => {
  try {
    const fb = (req as any).firebaseUser;
    const uid = fb?.uid;
    const email = fb?.email;

    if (!uid || !email) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await User.findOne({ firebaseUID: uid }).lean();
    if (!user) {
      res.status(404).json({ message: "المستخدم غير موجود" });
      return;
    }

    // 🟢 استدعِ دالتك كما هي: (email, userId, purpose)
    const code = await sendEmailOTP(email, String(user._id), "verifyEmail");

    // وضع التطوير: أطبع الكود بدل الاعتماد على SMTP
    const ch =  "smtp";
    if (ch !== "smtp") {
      console.log(`📧 DEV OTP to ${email}: ${code}`);
      res.json({ ok: true, dev: true });
      return;
    }
    res.json({ ok: true });
    return;

  } catch (err: any) {
    console.error("❌ /users/otp/send failed:", err?.message || err);
    res.status(500).json({ message: "فشل الإرسال", error: err?.message });
  }
});

router.post("/otp/verify", verifyFirebase, async (req, res) => {
  try {
    const fb = (req as any).firebaseUser;
    const uid = fb?.uid;
    if (!uid) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { code } = req.body || {};
    if (!code) {
      res.status(400).json({ message: "رمز التحقق مطلوب" });
      return;
    }

    const user = await User.findOne({ firebaseUID: uid }).lean();
    if (!user) {
      res.status(404).json({ message: "المستخدم غير موجود" });
      return;
    }

    const result = await verifyOTP({
      userId: String(user._id),
      purpose: "verifyEmail",
      code: String(code),
    });

    if (!result.valid) {
      res.status(400).json({ message: "رمز غير صحيح أو منتهي" });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("❌ /users/otp/verify failed:", err?.message || err);
    res.status(500).json({ message: "فشل التحقق", error: err?.message });
  }
});   

export default router;
