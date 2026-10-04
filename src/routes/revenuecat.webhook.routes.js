import express from "express";
import { handleRevenueCatWebhook } from "../controllers/revenuecat.webhook.controller.js";

const router = express.Router();

// POST /api/webhooks/revenuecat — called by RevenueCat, not by the app, so it
// uses a shared-secret Authorization header instead of Firebase auth.
router.post("/", handleRevenueCatWebhook);

export default router;
