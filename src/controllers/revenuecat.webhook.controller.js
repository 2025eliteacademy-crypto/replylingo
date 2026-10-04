import crypto from "crypto";
import User from "../models/User.js";
import RevenueCatEvent from "../models/RevenueCatEvent.js";

// Entitlement that unlocks Pro. RevenueCat sends the entitlement identifier
// ("ReplyLingo Pro", what the app checks) and, in some payloads, the
// entitlement id — accept either.
const PRO_ENTITLEMENTS = ["ReplyLingo Pro", "entl5916853415"];

// Events that (re)grant access until expiration_at_ms.
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
// User turned off auto-renew / billing is failing: access continues until
// expiration_at_ms (store grace periods extend it), only willRenew flips.
const KEEP_UNTIL_EXPIRY_EVENTS = new Set(["CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_EXTENDED"]);
// Access ends now.
const REVOKE_EVENTS = new Set(["EXPIRATION"]);

const isAnonymousId = (id) => typeof id === "string" && id.startsWith("$RCAnonymousID:");

function isAuthorized(req) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) return false; // fail closed if not configured
  const header = req.headers.authorization || "";
  const expectedBuf = Buffer.from(expected);
  return [header, header.replace(/^Bearer\s+/i, "")].some((candidate) => {
    const buf = Buffer.from(candidate);
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}

function candidateUids(event) {
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])];
  return [...new Set(ids.filter((id) => typeof id === "string" && id && !isAnonymousId(id)))];
}

// Pure: what should this event do to the user's premium state? null = nothing.
function computeUpdate(event, now = Date.now()) {
  const expiresMs = typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  const base = {
    premiumProductId: event.new_product_id || event.product_id || null,
    premiumStore: event.store || null,
    premiumExpiresAt: expiresMs ? new Date(expiresMs) : null,
  };
  // No expiration (e.g. lifetime) => active; otherwise only while unexpired.
  const stillActive = expiresMs === null || expiresMs > now;

  if (REVOKE_EVENTS.has(event.type)) {
    return { ...base, premium: false, premiumWillRenew: false };
  }
  if (GRANT_EVENTS.has(event.type)) {
    return { ...base, premium: stillActive, premiumWillRenew: event.type !== "NON_RENEWING_PURCHASE" };
  }
  if (KEEP_UNTIL_EXPIRY_EVENTS.has(event.type)) {
    return { ...base, premium: stillActive, premiumWillRenew: false };
  }
  return null;
}

async function applyToUsers(uids, ts, update) {
  // The $or guard drops events older than what we've already applied.
  return User.updateMany(
    {
      uid: { $in: uids },
      $or: [{ revenueCatLastEventMs: null }, { revenueCatLastEventMs: { $lte: ts } }],
    },
    { $set: { ...update, revenueCatLastEventMs: ts } }
  );
}

async function processEvent(event) {
  const ts = event.event_timestamp_ms ?? Date.now();

  if (event.type === "TEST") return "ignored_irrelevant";

  // TRANSFER moves entitlements between app user ids (e.g. anonymous -> real).
  if (event.type === "TRANSFER") {
    const from = (event.transferred_from || []).filter((id) => !isAnonymousId(id));
    const to = (event.transferred_to || []).filter((id) => !isAnonymousId(id));
    if (from.length) {
      await applyToUsers(from, ts, { premium: false, premiumWillRenew: false, premiumExpiresAt: null });
    }
    if (to.length) {
      await applyToUsers(to, ts, { premium: true });
    }
    return "applied";
  }

  const entitlements = event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
  if (entitlements.length && !entitlements.some((e) => PRO_ENTITLEMENTS.includes(e))) {
    return "ignored_irrelevant";
  }

  const update = computeUpdate(event);
  if (!update) return "ignored_irrelevant";

  const uids = candidateUids(event);
  if (!uids.length) return "user_not_found";

  const result = await applyToUsers(uids, ts, update);
  if (result.matchedCount > 0) return "applied";

  const exists = await User.exists({ uid: { $in: uids } });
  return exists ? "ignored_stale" : "user_not_found";
}

// POST /api/webhooks/revenuecat
const handleRevenueCatWebhook = async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const event = req.body?.event;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  // Idempotency: claim the event id first. A duplicate delivery hits the
  // unique index and is acknowledged without being applied again.
  let ledger;
  try {
    ledger = await RevenueCatEvent.create({
      eventId: event.id,
      type: event.type,
      appUserId: event.app_user_id || null,
      environment: event.environment || null,
      store: event.store || null,
      productId: event.product_id || null,
      eventTimestampMs: event.event_timestamp_ms ?? null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ success: true, duplicate: true });
    }
    console.error("[revenuecat-webhook] Ledger write failed:", error);
    return res.status(500).json({ success: false });
  }

  try {
    const outcome = await processEvent(event);
    await RevenueCatEvent.updateOne({ _id: ledger._id }, { $set: { outcome } });
    console.log(
      `[revenuecat-webhook] ${event.type} user=${event.app_user_id} store=${event.store} env=${event.environment} -> ${outcome}`
    );
    return res.status(200).json({ success: true, outcome });
  } catch (error) {
    console.error("[revenuecat-webhook] Processing failed:", error);
    // Release the claim so RevenueCat's retry is processed, not skipped as a duplicate.
    await RevenueCatEvent.deleteOne({ _id: ledger._id }).catch(() => {});
    return res.status(500).json({ success: false });
  }
};

export { handleRevenueCatWebhook, computeUpdate };
