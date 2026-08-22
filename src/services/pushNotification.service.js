import { getMessaging } from "firebase-admin/messaging";
import { sendApnsNotification } from "../config/apns.js";
import User from "../models/User.js";
import CronState from "../models/CronState.js";

const INACTIVE_DAYS = 3; // nudge users who haven't opened the app in this long
const RESEND_GAP_DAYS = 3; // don't nudge the same user more than this often
const MIN_HOURS_BETWEEN_RUNS = 20; // lets an uptime monitor ping often without double-sending

const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
  "apns/Unregistered",
  "apns/BadDeviceToken",
]);

// Sends one push notification, routed by platform: Android goes through
// Firebase Admin/FCM, iOS goes directly to Apple APNs. Fails safe — a
// bad/expired token clears itself (and its platform/environment) from the
// user doc instead of throwing, since a dead token just means the app was
// uninstalled or reinstalled with a new one. Returns the provider's error
// code/message on failure so callers can surface a real reason instead of
// a bare boolean.
//
// pushPlatform is null on docs saved before the iOS/Android split existed;
// those are treated as Android (the only platform that was ever correctly
// wired to firebase-admin) — a stale iOS token from that era will just
// fail cleanly against FCM and get cleared below, and the next app launch
// re-registers it with a proper platform tag.
async function sendPushNotification({ uid, token, platform, environment, title, body }) {
  try {
    if (platform === "ios") {
      const result = await sendApnsNotification({ token, title, body, environment });
      if (!result.ok) {
        throw Object.assign(new Error(result.message), { code: result.code });
      }
    } else {
      await getMessaging().send({
        token,
        notification: { title, body },
      });
    }
    return { ok: true };
  } catch (error) {
    const code = error?.errorInfo?.code || error?.code;
    if (STALE_TOKEN_CODES.has(code)) {
      await User.updateOne({ uid }, { $set: { pushToken: null, pushPlatform: null, pushEnvironment: null } });
    } else {
      console.error(`[push] Failed to notify ${uid}:`, error.message);
    }
    return { ok: false, code, message: error.message };
  }
}

// The re-engagement batch: finds users who have a push token, haven't
// opened the app in INACTIVE_DAYS, and haven't already been nudged in the
// last RESEND_GAP_DAYS — then sends each one a reminder.
//
// Safe to call as often as an uptime monitor likes: it only actually runs
// if at least MIN_HOURS_BETWEEN_RUNS has passed since the last real run,
// tracked in the CronState collection. Everything else is a no-op.
export async function runReengagementBatch() {
  const state = await CronState.findOneAndUpdate(
    { key: "reengagement" },
    { $setOnInsert: { lastRunAt: null } },
    { upsert: true, returnDocument: "after" }
  );

  const hoursSinceLastRun = state.lastRunAt
    ? (Date.now() - state.lastRunAt.getTime()) / (1000 * 60 * 60)
    : Infinity;

  if (hoursSinceLastRun < MIN_HOURS_BETWEEN_RUNS) {
    return { ran: false, reason: "too soon since last run", hoursSinceLastRun };
  }

  // Claim the run immediately so a second ping arriving while this batch
  // is still sending doesn't start a duplicate run.
  await CronState.updateOne({ key: "reengagement" }, { $set: { lastRunAt: new Date() } });

  const inactiveSince = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const resendCutoff = new Date(Date.now() - RESEND_GAP_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await User.find({
    pushToken: { $ne: null },
    lastActiveAt: { $lte: inactiveSince },
    $or: [{ lastReengagementSentAt: null }, { lastReengagementSentAt: { $lte: resendCutoff } }],
  }).select("uid pushToken pushPlatform pushEnvironment");

  let sent = 0;
  for (const user of candidates) {
    const result = await sendPushNotification({
      uid: user.uid,
      token: user.pushToken,
      platform: user.pushPlatform,
      environment: user.pushEnvironment,
      title: "Got a voice note waiting?",
      body: "Share it into ReplyLingo and hear it translated in seconds.",
    });
    if (result.ok) {
      await User.updateOne({ uid: user.uid }, { $set: { lastReengagementSentAt: new Date() } });
      sent += 1;
    }
  }

  return { ran: true, candidates: candidates.length, sent };
}

// Sends one notification to a specific user immediately, bypassing the
// inactivity/resend/idempotency checks above entirely. For manually
// verifying delivery during development — never called by the batch job.
export async function sendTestNotification(uid) {
  const user = await User.findOne({ uid }).select("uid pushToken pushPlatform pushEnvironment");

  if (!user) {
    return { ok: false, reason: "no such user" };
  }
  if (!user.pushToken) {
    return { ok: false, reason: "user has no pushToken saved" };
  }

  const result = await sendPushNotification({
    uid: user.uid,
    token: user.pushToken,
    platform: user.pushPlatform,
    environment: user.pushEnvironment,
    title: "Test notification",
    body: "If you're seeing this, push notifications are working.",
  });

  return result;
}
