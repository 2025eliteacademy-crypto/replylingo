import { runReengagementBatch } from "../services/pushNotification.service.js";

// GET /api/notifications/reengagement?secret=... — meant to be pinged on a
// schedule by an external monitor (e.g. UptimeRobot's free plan, which only
// supports plain GET requests, not custom headers), not called by the app.
// Protected by a shared secret rather than user auth, since there's no
// signed-in user making this request.
const triggerReengagement = async (req, res) => {
  const provided = req.query.secret;
  console.log("CRON_SECRET: ",process.env.CRON_SECRET);
  console.log("req.query.secret: ",provided);
  console.log("Does they match?")
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
