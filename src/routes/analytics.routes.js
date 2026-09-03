import express from "express";
import optionalAuth from "../middleware/optionalAuth.js";
import { trackEvents } from "../controllers/analytics.controller.js";

const router = express.Router();

// POST /api/analytics/track — one event or { events: [...] }. No hard auth
// requirement: app-open/onboarding events fire before any Firebase user
// exists. optionalAuth attaches req.user when a valid token is present but
// never blocks the request without one.
router.post("/track", optionalAuth, trackEvents);

export default router;
