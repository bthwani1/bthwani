// src/routes/deliveryMarketplaceV1/deliveryCategoryRoutes.ts

import express from "express";
import * as controller from "../../controllers/delivry_Marketplace_V1/DeliveryCategoryController";
import { verifyAdmin } from "../../middleware/verifyAdmin";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: DeliveryCategories
 *     description: إدارة فئات سوق التوصيل V1
 */

/**
 * @swagger
 * /delivery/categories:
 *   post:
 *     summary: إنشاء فئة جديدة
 *     description: يتيح للأدمن المصادق عليه (Firebase + صلاحية Admin) إضافة فئة جديدة في سوق التوصيل V1.
 *     tags: [DeliveryCategories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات الفئة الجديدة (الاسم والوصف إن وجد).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "طعام"
 *                 description: اسم الفئة (مثلاً: طعام، مشروبات، إلخ)
 *               description:
 *                 type: string
 *                 example: "وجبات سريعة وخفيفة"
 *                 description: وصف اختياري للفئة
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: تم إنشاء الفئة بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryCategory'
 *       400:
 *         description: البيانات المقدمة غير صالحة أو ناقصة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       500:
 *         description: خطأ في الخادم أثناء إنشاء الفئة.
 */
router.post("/", verifyFirebase, verifyAdmin, controller.create);

router.get("/children/:parentId", controller.getChildren);

router.get("/main", controller.getMainCategories);
router.post(
  "/bulk-reorder",
  verifyFirebase,
  verifyAdmin,
  controller.bulkReorder
);
router.post("/:id/move-up", verifyFirebase, verifyAdmin, controller.moveUp);
router.post("/:id/move-down", verifyFirebase, verifyAdmin, controller.moveDown);
/**
 * @swagger
 * /delivery/categories/{id}:
 *   put:
 *     summary: تعديل فئة معينة
 *     description: يتيح للأدمن المصادق عليه (Firebase + صلاحية Admin) تعديل بيانات فئة موجودة بواسطة معرّفها.
 *     tags: [DeliveryCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف الفئة المراد تعديلها
 *     requestBody:
 *       description: الحقول المراد تحديثها في الفئة (مثل الاسم أو الوصف).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "مشروبات"
 *                 description: الاسم المحدث للفئة
 *               description:
 *                 type: string
 *                 example: "عصائر ومشروبات باردة وساخنة"
 *                 description: الوصف المحدث للفئة
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: تم تعديل الفئة بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryCategory'
 *       400:
 *         description: البيانات المقدمة غير صالحة أو ناقصة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على الفئة المطلوبة.
 *       500:
 *         description: خطأ في الخادم أثناء تعديل الفئة.
 */
router.put("/:id", verifyFirebase, verifyAdmin, controller.update);

/**
 * @swagger
 * /delivery/categories:
 *   get:
 *     summary: جلب جميع الفئات
 *     description: يعرض قائمة بجميع فئات سوق التوصيل V1.
 *     tags: [DeliveryCategories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب قائمة الفئات بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeliveryCategory'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       500:
 *         description: خطأ في الخادم أثناء جلب الفئات.
 */
router.get("/", controller.getAll);

/**
 * @swagger
 * /delivery/categories/{id}:
 *   get:
 *     summary: جلب فئة معينة بواسطة المعرف
 *     description: يعرض تفاصيل فئة محددة في سوق التوصيل V1 بواسطة معرّفها.
 *     tags: [DeliveryCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف الفئة المطلوب جلبها
 *     responses:
 *       200:
 *         description: تم جلب الفئة بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryCategory'
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على الفئة المطلوبة.
 *       500:
 *         description: خطأ في الخادم أثناء جلب الفئة.
 */
router.get("/:id", verifyFirebase, verifyAdmin, controller.getById);

/**
 * @swagger
 * /delivery/categories/{id}:
 *   delete:
 *     summary: حذف فئة معينة بواسطة المعرف
 *     description: يتيح للأدمن المصادق عليه (Firebase + صلاحية Admin) حذف فئة من سوق التوصيل V1 بواسطة معرّفها.
 *     tags: [DeliveryCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف الفئة المراد حذفها
 *     responses:
 *       200:
 *         description: تم حذف الفئة بنجاح.
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على الفئة المطلوبة.
 *       500:
 *         description: خطأ في الخادم أثناء حذف الفئة.
 */
router.delete("/:id", verifyFirebase, verifyAdmin, controller.remove);

export default router;
