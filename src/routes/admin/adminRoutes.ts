// src/routes/admin/userAdminRoutes.ts

import { Router, Request, Response } from "express";
import {
  createAdminUser,
  getAllUsers,
  getUserById,
  updateAdminUser,
  updateUserAdmin,
  updateUserRole,
} from "../../controllers/admin/adminUserController";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { verifyAdmin } from "../../middleware/verifyAdmin";
import { User } from "../../models/user";
import { getAdminStats } from "../../controllers/admin/adminUserController";
import { verifyCapability } from "../../middleware/verifyCapability";
import { getDeliveryKPIs } from "../../controllers/admin/adminDeliveryController";
import { listUsersStats } from "../../models/delivry_Marketplace_V1/adminUsers";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: AdminUsers
 *     description: إدارة المستخدمين من قِبَل الأدمن
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: جلب جميع المستخدمين
 *     description: يتيح للأدمن المصادق عليه (Firebase) عرض قائمة بجميع المستخدمين المسجلين.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب قائمة المستخدمين بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       500:
 *         description: خطأ في الخادم أثناء جلب المستخدمين.
 */
router.get("/users", verifyFirebase, getAllUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: جلب تفاصيل مستخدم بالمعرّف
 *     description: يتيح للأدمن المصادق عليه (Firebase) عرض تفاصيل مستخدم محدد بواسطة معرفه.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف المستخدم المطلوب جلب تفاصيله
 *     responses:
 *       200:
 *         description: تم جلب تفاصيل المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على المستخدم المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء جلب تفاصيل المستخدم.
 */
router.get("/users/:id", verifyFirebase, getUserById);
router.post("/users", verifyFirebase, verifyAdmin, createAdminUser);
router.patch("/admin-users/:id", verifyFirebase, verifyAdmin, updateAdminUser);

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: تعديل بيانات مستخدم بواسطة المعرف
 *     description: يتيح للأدمن المصادق عليه (Firebase) تعديل بيانات مستخدم معين (غير دوره).
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف المستخدم المراد تعديل بياناته
 *     requestBody:
 *       description: حقول البيانات التي سيتم تحديثها للمستخدم (مثل الاسم، الحالة، إلخ)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "أحمد علي"
 *                 description: الاسم الجديد للمستخدم
 *               isBlocked:
 *                 type: boolean
 *                 example: false
 *                 description: حالة الحظر للمستخدم
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: تم تعديل بيانات المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: البيانات المقدمة غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على المستخدم المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تعديل البيانات.
 */
router.patch("/users/:id", verifyFirebase, updateUserAdmin);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: تعديل دور مستخدم بواسطة المعرف
 *     description: يتيح للأدمن المصادق عليه (Firebase + صلاحية Admin) تعديل دور مستخدم معين.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف المستخدم المراد تعديل دوره
 *     requestBody:
 *       description: الدور الجديد الذي سيتم تخصيصه للمستخدم (مثل "admin" أو "user")
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin, superadmin]
 *                 example: "admin"
 *                 description: الدور الجديد للمستخدم
 *             required:
 *               - role
 *     responses:
 *       200:
 *         description: تم تعديل دور المستخدم بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: البيانات المقدمة غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على المستخدم المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تعديل الدور.
 */
router.patch("/users/:id/role", verifyFirebase, verifyAdmin, updateUserRole);

/**
 * @swagger
 * /admin/check-role:
 *   get:
 *     summary: التحقق من دور المستخدم الحالي
 *     description: يعرض دور المستخدم المصادق عليه حالياً بناءً على توكينه.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب الدور بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role:
 *                   type: string
 *                   example: "admin"
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: المستخدم غير موجود.
 *       500:
 *         description: خطأ في الخادم أثناء التحقق من الدور.
 */
router.get("/check-role", verifyFirebase, async (req: Request, res: Response) => {
  const firebaseUser = (req as any).firebaseUser;          // set by verifyFirebase
  const uid = firebaseUser?.uid;                            // <-- هذا هو الحقل الصحيح
  const email = firebaseUser?.email;

  if (!uid) {
    res.status(401).json({ message: "Unauthorized (no uid)" });
    return;
  }

  try {
    // ابحث بالمطابقة على firebaseUID أو البريد كخيار ثانٍ
    const user = await User.findOne({
      $or: [{ firebaseUID: uid }, { email }],
    })
      .select("role firebaseUID email")
      .lean();

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ role: user.role });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Server error" });
  }
});

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: جلب إحصائيات المستخدمين
 *     description: يتيح للأدمن المصادق عليه (Firebase + صلاحية Admin أو ضمان قدرة المشاهدة) جلب إحصائيات حسابات المستخدمين.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب الإحصائيات بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 1000
 *                   description: إجمالي عدد المستخدمين
 *                 admins:
 *                   type: integer
 *                   example: 50
 *                   description: عدد المستخدمين ذوي دور admin
 *                 users:
 *                   type: integer
 *                   example: 950
 *                   description: عدد المستخدمين ذوي دور user
 *                 active:
 *                   type: integer
 *                   example: 900
 *                   description: عدد المستخدمين النشطين (غير محظورين)
 *                 blocked:
 *                   type: integer
 *                   example: 100
 *                   description: عدد المستخدمين المحظورين
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط أو القدرة المطلوبة يمكنها الوصول.
 *       500:
 *         description: خطأ في الخادم أثناء جلب الإحصائيات.
 */
router.get(
  "/stats",
  verifyFirebase,
  verifyAdmin,
  verifyCapability("admin", "canViewStats"),
  getAdminStats
);

router.get(
  "/delivery/kpis",
  verifyFirebase,
  verifyAdmin,
  getDeliveryKPIs
);
/**
 * @swagger
 * /admin/delivery/{id}/status:
 *   patch:
 *     summary: تحديث حالة الطلب الجزئي بواسطة السائق
 *     description: يتيح للسائق المصادق عليه (ذات دور driver) تحديث حالة التوصيل للطلب الجزئي.
 *     tags: [AdminUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف الطلب الجزئي (subOrder) المراد تحديث حالته
 *     requestBody:
 *       description: الحالة الجديدة للطلب الجزئي (مثل "delivered" أو "in_transit")
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "delivered"
 *                 description: الحالة الجديدة للطلب الجزئي
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: تم تحديث حالة الطلب الجزئي بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "تم التحديث"
 *                 status:
 *                   type: string
 *                   example: "delivered"
 *       400:
 *         description: البيانات المقدمة غير صالحة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات السائق فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على الطلب الجزئي المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تحديث الحالة.
 */

router.get("/delivery/stores/:storeId/stats", async (req, res) => {
  const storeId = req.params.storeId;

  // جلب الإحصائيات اليومية
  const dailyStats = await getStoreStats(storeId, "daily");

  // جلب الإحصائيات الأسبوعية
  const weeklyStats = await getStoreStats(storeId, "weekly");

  // جلب الإحصائيات الشهرية
  const monthlyStats = await getStoreStats(storeId, "monthly");

  res.json({
    dailyStats,
    weeklyStats,
    monthlyStats,
  });
});
router.get("/users", verifyFirebase, verifyAdmin, listUsersStats);
router.patch("/users/:id", verifyFirebase, verifyAdmin, updateUserAdmin);
const getStoreStats = async (storeId: string, period: "daily" | "weekly" | "monthly") => {
  // تنفيذ الاستعلام لحساب عدد المنتجات، عدد الطلبات، والإيرادات حسب الفترة المحددة
  // هنا يمكنك استبدال الاستعلام الفعلي بناءً على الهيكل الخاص بك في قاعدة البيانات
  return {
    productsCount: 10, // قيمة افتراضية
    ordersCount: 5,    // قيمة افتراضية
    totalRevenue: 100, // قيمة افتراضية
  };
};

export default router;
