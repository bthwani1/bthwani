import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import * as r from "../../controllers/admin/reports.marketers.controller";

const x = Router();
/**
 * @swagger
 * tags:
 *  - name: Admin-Reports
 *    description: تقارير أداء المسوّقين
 */
x.use(verifyFirebase, requireRole(["admin", "superadmin", "reviewer"]));
x.get("/v1/reports/marketers/overview", r.overview);
x.get("/v1/reports/marketers/:id", r.perMarketer);
export default x;
