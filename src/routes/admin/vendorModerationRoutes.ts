import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as c from "../../controllers/admin/vendorModeration.controller";

const r = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin-Vendors
 *     description: إدارة وتفعيل حسابات التجّار
 */
r.use(verifyFirebase, requireRole(["admin", "superadmin", "reviewer"]));

r.get("/admin/vendors", c.list);
r.get("/admin/vendors/:id", c.getOne);
r.get("/admin/stores/:storeId/vendors", c.listByStore);

r.post("/admin/vendors/:id/activate", c.activate);
r.post("/admin/vendors/:id/deactivate", c.deactivate);
r.patch("/admin/vendors/:id", c.update);
r.post("/admin/vendors/:id/reset-password", c.resetPassword);

r.delete("/admin/vendors/:id", c.remove);

export default r;
