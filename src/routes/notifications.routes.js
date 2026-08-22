import express from "express";
import { triggerReengagement } from "../controllers/notifications.controller.js";

const router = express.Router();

// No `auth` middleware here on purpose — this isn't a signed-in user
// request, it's a server-to-server trigger protected by CRON_SECRET
// inside the controller. GET (not POST) specifically so UptimeRobot's
// free-plan HTTP monitor can hit it — it only supports plain GET, no
// custom headers or request bodies.
router.get("/reengagement", triggerReengagement);

export default router;
