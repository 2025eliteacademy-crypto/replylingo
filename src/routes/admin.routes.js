import express from "express";
import { getFunnelReport, getUserJourney, getAiUsageReport } from "../controllers/admin.controller.js";

const router = express.Router();

// Shared-secret protected (see admin.controller.js's isAuthorized), same
// pattern as notifications.routes.js — there's no admin-role concept on
// User yet, and these are meant for direct browser/curl use, not the app.
router.get("/funnel", getFunnelReport);
router.get("/user-journey", getUserJourney);
router.get("/ai-usage", getAiUsageReport);

export default router;
