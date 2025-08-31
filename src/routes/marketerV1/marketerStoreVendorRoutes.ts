import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as controller from "../../controllers/marketer_v1/marketerStoreVendor.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: MarketerV1
 *     description: عمليات المسوّق لإنشاء متجر وتاجر مباشرة (غير مفعّل افتراضيًا)
 */

// إنشاء متجر جديد بواسطة المسوّق (غير مفعّل + مغلق بالقوة حتى يفعّله الأدمن)
router.post(
  "/marketer/stores",
  verifyFirebase,
  requireRole(["marketer"]),
  controller.createStoreByMarketer
);

// جلب متاجري التي أنشأتها أنا (اختياري للموبايل)
router.get(
  "/marketer/stores",
  verifyFirebase,
  requireRole(["marketer"]),
  controller.listMyStores
);

// إنشاء تاجر مربوط بمتجر أنشأه المسوّق (غير مفعّل افتراضيًا)
router.post(
  "/marketer/vendors",
  verifyFirebase,
  requireRole(["marketer"]),
  controller.createVendorByMarketer
);

export default router;
