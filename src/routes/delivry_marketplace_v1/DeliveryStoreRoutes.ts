// src/routes/deliveryMarketplaceV1/deliveryStoreRoutes.ts

import express from "express";
import * as controller from "../../controllers/delivry_Marketplace_V1/DeliveryStoreController";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import { verifyAdmin } from "../../middleware/verifyAdmin";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: DeliveryStores
 *     description: إدارة المتاجر في سوق التوصيل V1
 */

/**
 * @swagger
 * /delivery/stores:
 *   post:
 *     summary: إنشاء متجر جديد
 *     description: يتيح للمستخدم المصادق عليه (Firebase) مع صلاحية الأدمن إضافة متجر جديد في سوق التوصيل V1.
 *     tags: [DeliveryStores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: بيانات المتجر الجديد (الاسم، الوصف، الموقع، إلخ).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeliveryStoreInput'
 *     responses:
 *       201:
 *         description: تم إنشاء المتجر بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryStore'
 *       400:
 *         description: البيانات المقدمة غير صالحة أو ناقصة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       500:
 *         description: خطأ في الخادم أثناء إنشاء المتجر.
 */
router.post("/", verifyFirebase, verifyAdmin, controller.create);
router.get("/search", verifyFirebase, verifyAdmin, controller.searchStores);
/**
 * @swagger
 * /delivery/stores:
 *   get:
 *     summary: جلب قائمة المتاجر
 *     description: يعرض قائمة بجميع المتاجر المسجلة في سوق التوصيل V1.
 *     tags: [DeliveryStores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم جلب قائمة المتاجر بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeliveryStore'
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       500:
 *         description: خطأ في الخادم أثناء جلب المتاجر.
 */
router.get("/", controller.getAll);

/**
 * @swagger
 * /delivery/stores/{id}:
 *   get:
 *     summary: جلب تفاصيل متجر بواسطة المعرف
 *     description: يعرض تفاصيل متجر محدد في سوق التوصيل V1 بواسطة معرّف المتجر.
 *     tags: [DeliveryStores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: معرّف المتجر المطلوب جلبه
 *     responses:
 *       200:
 *         description: تم جلب تفاصيل المتجر بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryStore'
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       404:
 *         description: لم يتم العثور على المتجر المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء جلب تفاصيل المتجر.
 */
router.get("/:id", controller.getById);

/**
 * @swagger
 * /delivery/stores/{id}:
 *   put:
 *     summary: تحديث متجر بواسطة المعرف
 *     description: يتيح للمستخدم المصادق عليه (Firebase) مع صلاحية الأدمن تعديل بيانات متجر موجود في سوق التوصيل V1 بواسطة معرّف المتجر.
 *     tags: [DeliveryStores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: معرّف المتجر المراد تحديثه
 *     requestBody:
 *       description: الحقول المراد تحديثها في المتجر (مثل الاسم، الوصف، الموقع، إلخ).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeliveryStoreInput'
 *     responses:
 *       200:
 *         description: تم تحديث المتجر بنجاح.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryStore'
 *       400:
 *         description: البيانات المقدمة غير صالحة أو ناقصة.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على المتجر المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء تحديث المتجر.
 */
router.put("/:id", verifyFirebase, verifyAdmin, controller.update);

/**
 * @swagger
 * /delivery/stores/{id}:
 *   delete:
 *     summary: حذف متجر بواسطة المعرف
 *     description: يتيح للمستخدم المصادق عليه (Firebase) مع صلاحية الأدمن حذف متجر من سوق التوصيل V1 بواسطة معرّف المتجر.
 *     tags: [DeliveryStores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: معرّف المتجر المراد حذفه
 *     responses:
 *       200:
 *         description: تم حذف المتجر بنجاح.
 *       400:
 *         description: معرّف غير صالح.
 *       401:
 *         description: توكين غير صالح أو مفقود.
 *       403:
 *         description: صلاحيات الأدمن فقط يمكنها الوصول.
 *       404:
 *         description: لم يتم العثور على المتجر المطلوب.
 *       500:
 *         description: خطأ في الخادم أثناء حذف المتجر.
 */
router.delete(
  "/:id",
  verifyFirebase,
  requireRole(["admin", "vendor", "superadmin"]),
  controller.remove
);

export default router;
