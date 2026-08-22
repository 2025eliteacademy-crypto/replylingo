import { runReengagementBatch } from "../services/pushNotification.service.js";

// POST /api/notifications/reengagement — meant to be pinged on a schedule
// by an external monitor (e.g. UptimeRobot), not called by the app.
// Protected by a shared secret rather than user auth, since there's no
// signed-in user making this request.
const triggerReengagement = async (req, res) => {
  const provided = req.headers["x-cron-secret"];

  if (!process.env.CRON_SECRET) {
    console.error("[notifications] CRON_SECRET is not set — refusing to run.");
    return res.status(503).json({ success: false, message: "Not configured." });
  }

  if (provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  try {
    const result = await runReengagementBatch();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[notifications] Reengagement batch failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { triggerReengagement };
