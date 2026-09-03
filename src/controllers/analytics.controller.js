import Event from "../models/Event.js";

const MAX_EVENTS_PER_REQUEST = 20;

// POST /api/analytics/track
// Body is either a single event { name, distinctId, ... } or a batch
// { events: [...] }. Always responds 200 — this endpoint is fire-and-forget
// from the client's perspective (see mobile trackEvent.js) and must never
// give a caller a reason to retry-loop or treat analytics as a real error.
const trackEvents = async (req, res) => {
  const body = req.body || {};
  const rawEvents = Array.isArray(body.events)
    ? body.events
    : typeof body.name === "string"
    ? [body]
    : [];

  const docs = rawEvents
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .filter((e) => e && typeof e.name === "string" && typeof e.distinctId === "string")
    .map((e) => ({
      eventName: e.name,
      distinctId: e.distinctId,
      uid: e.uid || req.user?.uid || null,
      isGuest:
        typeof e.isGuest === "boolean"
          ? e.isGuest
          : req.user
          ? req.user.firebase?.sign_in_provider === "anonymous"
          : null,
      platform: e.platform || null,
      appVersion: e.appVersion || null,
      params: e.params && typeof e.params === "object" ? e.params : {},
      clientTimestamp:
        typeof e.clientTimestamp === "number" ? new Date(e.clientTimestamp) : null,
    }));

  try {
    if (docs.length > 0) {
      await Event.insertMany(docs, { ordered: false });
    }
    res.status(200).json({ success: true, stored: docs.length });
  } catch (error) {
    // A dropped analytics write is not worth surfacing as a failure to the
    // client — just log it server-side and move on.
    console.error("[analytics] Failed to store event(s):", error.message);
    res.status(200).json({ success: false });
  }
};

export { trackEvents };
