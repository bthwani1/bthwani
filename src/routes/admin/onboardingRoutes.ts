import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as c from "../../controllers/admin/onboarding.controller";

const r = Router();
/**
 * @swagger
 * tags:
 *   - name: Admin-Onboarding
 *     description: طابور مراجعة طلبات المتاجر من المسوّقين
 */
r.use(verifyFirebase, requireRole(["admin", "reviewer", "superadmin"]));

r.get("/field/onboarding/queue", c.queue);
r.get("/field/onboarding/:id", c.getOne);
r.post("/field/onboarding/:id/approve", c.approve);
r.post("/field/onboarding/:id/reject", c.reject);
r.post("/field/onboarding/:id/needs-fix", c.needsFix);

export default r;
