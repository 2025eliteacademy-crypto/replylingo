import {
  runReengagementBatch,
  sendTestNotification,
  sendAnnouncementPushToAllUsers,
} from "../services/pushNotification.service.js";

function isAuthorized(req) {
  return !!process.env.CRON_SECRET && req.query.secret === process.env.CRON_SECRET;
}

// GET /api/notifications/reengagement?secret=... — meant to be pinged on a
// schedule by an external monitor (e.g. UptimeRobot's free plan, which only
// supports plain GET requests, not custom headers), not called by the app.
// Protected by a shared secret rather than user auth, since there's no
// signed-in user making this request.
const triggerReengagement = async (req, res) => {
  if (!process.env.CRON_SECRET) {
    console.error("[notifications] CRON_SECRET is not set — refusing to run.");
    return res.status(503).json({ success: false, message: "Not configured." });
  }

  if (!isAuthorized(req)) {
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

// GET /api/notifications/test?secret=...&uid=... — sends one notification to
// a specific user immediately, ignoring the inactivity/resend rules. For
// manually confirming delivery works during development.
const triggerTestNotification = async (req, res) => {
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ success: false, message: "Not configured." });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const { uid } = req.query;
  if (!uid) {
    return res.status(400).json({ success: false, message: "uid query param is required." });
  }

  try {
    const result = await sendTestNotification(uid);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[notifications] Test notification failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/notifications/announcement?secret=... — broadcasts one push
// notification to every user with a saved push token. Admin-triggered
// (not a cron target), so it's POST with the title/body in the JSON body
// rather than GET with query params like the other two endpoints.
const triggerAnnouncement = async (req, res) => {
  if (!process.env.CRON_SECRET) {
    console.error("[notifications] CRON_SECRET is not set — refusing to run.");
    return res.status(503).json({ success: false, message: "Not configured." });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const { title, body } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ success: false, message: "title and body are required." });
  }

  try {
    const result = await sendAnnouncementPushToAllUsers({ title, body });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[notifications] Announcement broadcast failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { triggerReengagement, triggerTestNotification, triggerAnnouncement };
