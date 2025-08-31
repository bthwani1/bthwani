import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as c from "../../controllers/admin/storeModeration.controller";

const r = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin-Stores
 *     description: إدارة وتفعيل المتاجر
 */
r.use(verifyFirebase, requireRole(["admin", "superadmin", "reviewer"]));

r.get("/admin/stores", c.list);
r.get("/admin/stores/:id", c.getOne);

r.post("/admin/stores/:id/activate", c.activate);
r.post("/admin/stores/:id/deactivate", c.deactivate);
r.post("/admin/stores/:id/force-close", c.forceClose);
r.post("/admin/stores/:id/force-open", c.forceOpen);

r.patch("/admin/stores/:id", c.adminPatch);
r.delete("/admin/stores/:id", c.remove);

export default r;
