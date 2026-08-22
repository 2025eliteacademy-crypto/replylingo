import { getMessaging } from "firebase-admin/messaging";
import User from "../models/User.js";
import CronState from "../models/CronState.js";

const INACTIVE_DAYS = 3; // nudge users who haven't opened the app in this long
const RESEND_GAP_DAYS = 3; // don't nudge the same user more than this often
const MIN_HOURS_BETWEEN_RUNS = 20; // lets an uptime monitor ping often without double-sending

// Sends one push notification. Fails safe — a bad/expired token clears
// itself from the user doc instead of throwing, since a dead token just
// means the app was uninstalled or reinstalled with a new one.
async function sendPushNotification({ uid, token, title, body }) {
  try {
    await getMessaging().send({
      token,
      notification: { title, body },
    });
    return true;
  } catch (error) {
    const code = error?.errorInfo?.code || error?.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
      await User.updateOne({ uid }, { $set: { pushToken: null } });
    } else {
      console.error(`[push] Failed to notify ${uid}:`, error.message);
    }
    return false;
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
  }).select("uid pushToken");

  let sent = 0;
  for (const user of candidates) {
    const ok = await sendPushNotification({
      uid: user.uid,
      token: user.pushToken,
      title: "Got a voice note waiting?",
      body: "Share it into ReplyLingo and hear it translated in seconds.",
    });
    if (ok) {
      await User.updateOne({ uid: user.uid }, { $set: { lastReengagementSentAt: new Date() } });
      sent += 1;
    }
  }

  return { ran: true, candidates: candidates.length, sent };
}
