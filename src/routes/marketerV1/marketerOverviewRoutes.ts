// src/routes/marketerV1/marketerOverviewRoutes.ts
import { Router } from "express";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import { getMarketerOverview } from "../../controllers/marketer_v1/marketerOverview.controller";

const r = Router();
r.get("/marketer/overview", verifyFirebase, requireRole(["marketer"]), getMarketerOverview);
export default r;
