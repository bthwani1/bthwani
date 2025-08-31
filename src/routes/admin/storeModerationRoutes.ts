import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as s from "../../controllers/admin/storeModeration.controller";

const r = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin-Stores
 *     description: إدارة وتفعيل متاجر المسوّقين
 */
r.use(verifyFirebase, requireRole(["admin","superadmin","reviewer"]));

// قوائم & بحث
r.get("/admin/marketer-stores", s.list);                    // source='marketer' مع فلاتر
r.get("/admin/marketer-stores/:id", s.getOne);                          // تفاصيل متجر

// تفعيل/تعطيل/إغلاق قسري
r.post("/admin/marketer-stores/:id/activate", s.activate);           // isActive=true, forceClosed=false
r.post("/admin/marketer-stores/:id/deactivate", s.deactivate);       // isActive=false
r.post("/admin/marketer-stores/:id/force-close", s.forceClose);      // forceClosed=true
r.post("/admin/marketer-stores/:id/force-open", s.forceOpen);        // forceClosed=false

// تحديث إداري للحقول الحساسة
r.patch("/admin/marketer-stores/:id", s.adminPatch);

// حذف (حسب السياسة: soft/hard)
r.delete("/admin/marketer-stores/:id", s.remove);

export default r;
