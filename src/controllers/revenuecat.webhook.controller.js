import crypto from "crypto";
import User from "../models/User.js";
import RevenueCatEvent from "../models/RevenueCatEvent.js";
import Event from "../models/Event.js";
import { EVENTS } from "../config/analyticsEvents.js";

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
    // "TRIAL" while in the free trial; flips to "NORMAL" once it converts.
    premiumPeriodType: event.period_type || null,
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

const PLATFORM_BY_STORE = { APP_STORE: "ios", MAC_APP_STORE: "ios", PLAY_STORE: "android" };

function planFromProduct(productId) {
  if (/year|annual/i.test(productId || "")) return "annual";
  if (/month/i.test(productId || "")) return "monthly";
  return "unknown";
}

function isProEvent(event) {
  const entitlements = event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
  return !entitlements.length || entitlements.some((e) => PRO_ENTITLEMENTS.includes(e));
}

// Pure: which subscription-lifecycle analytics event (if any) does this
// RevenueCat event represent? Trials are kept strictly separate from paid
// events, and only PAID_STARTED / TRIAL_CONVERTED / RENEWED carry revenue.
function buildLifecycleEvent(event, prevPeriodType) {
  const period = event.period_type || null;
  const inTrial = period ? period === "TRIAL" : prevPeriodType === "TRIAL";
  let name = null;

  switch (event.type) {
    case "INITIAL_PURCHASE":
      name = period === "TRIAL" ? EVENTS.SUB_TRIAL_STARTED : EVENTS.SUB_PAID_STARTED;
      break;
    case "RENEWAL": {
      const converted =
        event.is_trial_conversion === true || (prevPeriodType === "TRIAL" && period === "NORMAL");
      name = converted ? EVENTS.SUB_TRIAL_CONVERTED : EVENTS.SUB_RENEWED;
      break;
    }
    case "CANCELLATION":
      name = inTrial ? EVENTS.SUB_TRIAL_CANCELLED : EVENTS.SUB_CANCELLED;
      break;
    case "EXPIRATION":
      name = inTrial ? EVENTS.SUB_TRIAL_EXPIRED : EVENTS.SUB_EXPIRED;
      break;
    default:
      return null;
  }

  const earnsRevenue = [EVENTS.SUB_PAID_STARTED, EVENTS.SUB_TRIAL_CONVERTED, EVENTS.SUB_RENEWED].includes(name);
  const price = Number(event.price);

  return {
    name,
    platform: PLATFORM_BY_STORE[event.store] || null,
    params: {
      rc_event_id: event.id,
      plan: planFromProduct(event.product_id),
      product_id: event.product_id || null,
      store: event.store || null,
      environment: event.environment || null,
      period_type: period,
      is_trial: name === EVENTS.SUB_TRIAL_STARTED,
      cancel_reason: event.cancel_reason || event.expiration_reason || null,
      currency: event.currency || null,
      // RevenueCat's `price` is USD for the transaction. Strictly 0 for anything
      // that isn't a real charge so trials can never leak into revenue.
      revenue_usd: earnsRevenue && Number.isFinite(price) ? price : 0,
    },
  };
}

// Idempotent on rc_event_id: a retried webhook never double-counts.
async function recordLifecycleEvent(event, lifecycle) {
  const set = {
    distinctId: event.app_user_id,
    uid: isAnonymousId(event.app_user_id) ? null : event.app_user_id,
    isGuest: null,
    platform: lifecycle.platform,
    appVersion: null,
    clientTimestamp: event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : null,
  };
  Object.entries(lifecycle.params).forEach(([k, v]) => {
    set[`params.${k}`] = v;
  });
  await Event.updateOne(
    { eventName: lifecycle.name, "params.rc_event_id": event.id },
    { $setOnInsert: set },
    { upsert: true }
  );
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

  if (!isProEvent(event)) return "ignored_irrelevant";

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
    // Analytics first, and idempotent: if the user update below fails and
    // RevenueCat retries, nothing is double-counted, and prevPeriodType is
    // still the pre-event value (needed to recognise a trial conversion).
    if (isProEvent(event)) {
      const prevUser = await User.findOne({ uid: { $in: candidateUids(event) } })
        .select("premiumPeriodType")
        .lean();
      const lifecycle = buildLifecycleEvent(event, prevUser?.premiumPeriodType ?? null);
      if (lifecycle) await recordLifecycleEvent(event, lifecycle);
    }

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

export { handleRevenueCatWebhook, computeUpdate, buildLifecycleEvent };
