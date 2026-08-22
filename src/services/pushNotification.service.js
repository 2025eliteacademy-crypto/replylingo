import { Expo } from "expo-server-sdk";
import User from "../models/User.js";
import CronState from "../models/CronState.js";

// Must match ANDROID_NOTIFICATION_CHANNEL_ID in ReplyLingo-Mobile/src/utils/pushNotifications.js.
// Android ignores per-notification sound on API 26+ — it's the channel's sound
// that plays, so this has to point at a channel the client actually created.
const ANDROID_NOTIFICATION_CHANNEL_ID = "default-v2";

const INACTIVE_DAYS = 3; // nudge users who haven't opened the app in this long
const RESEND_GAP_DAYS = 3; // don't nudge the same user more than this often
const MIN_HOURS_BETWEEN_RUNS = 20; // lets an uptime monitor ping often without double-sending

// How many messages to send per Expo API call. There's no hard cap from
// Expo itself here (chunkPushNotifications() already splits into
// Expo-sized batches internally), this just bounds how many chunks are
// in flight at once for a large broadcast.
const ANNOUNCEMENT_CONCURRENCY = 6;

let expoClient;
function getExpoClient() {
  if (!expoClient) {
    expoClient = process.env.EXPO_ACCESS_TOKEN
      ? new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })
      : new Expo();
  }
  return expoClient;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Clears a user's stale token so the next app launch re-registers a fresh
// one instead of the batch repeatedly failing against a dead token.
async function clearStaleToken(uid) {
  await User.updateOne({ uid }, { $set: { pushToken: null } });
}

// Sends one push notification via Expo's push service. Tokens left over
// from the old FCM/raw-APNs architecture aren't valid Expo push tokens —
// those get skipped (and cleared) rather than sent, so migration is
// self-healing as users' apps re-register on their next cold start.
async function sendPushNotification({ uid, token, title, body }) {
  if (!Expo.isExpoPushToken(token)) {
    await clearStaleToken(uid);
    return { ok: false, code: "invalid-token", message: "Not a valid Expo push token." };
  }

  const expo = getExpoClient();

  let tickets;
  try {
    tickets = await expo.sendPushNotificationsAsync([
      { to: token, sound: "default", title, body, channelId: ANDROID_NOTIFICATION_CHANNEL_ID },
    ]);
  } catch (error) {
    console.error(`[push] Failed to notify ${uid}:`, error.message);
    return { ok: false, code: error.code || "send-error", message: error.message };
  }

  const ticket = tickets[0];
  if (ticket.status === "error") {
    if (ticket.details?.error === "DeviceNotRegistered") {
      await clearStaleToken(uid);
    } else {
      console.error(`[push] Failed to notify ${uid}:`, ticket.message);
    }
    return { ok: false, code: ticket.details?.error || "UNKNOWN", message: ticket.message };
  }

  return { ok: true };
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
    const result = await sendPushNotification({
      uid: user.uid,
      token: user.pushToken,
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

// Broadcasts one push notification to every user with a saved push token —
// the ReplyLingo equivalent of FlexFlow's sendAnnouncementPushToTenantMembers,
// minus the tenant scoping (this app has no tenant concept, so it's just
// "every user"). Uses Expo's real chunking/ticket API instead of a
// hand-rolled per-user loop.
export async function sendAnnouncementPushToAllUsers({ title, body }) {
  const users = await User.find({ pushToken: { $ne: null } }).select("uid pushToken");

  const validUsers = [];
  const invalidUids = [];
  for (const user of users) {
    if (Expo.isExpoPushToken(user.pushToken)) {
      validUsers.push(user);
    } else {
      invalidUids.push(user.uid);
    }
  }
  const invalidTokenCount = invalidUids.length;

  if (invalidTokenCount > 0) {
    // Fire-and-forget cleanup — doesn't block the send.
    User.updateMany({ uid: { $in: invalidUids } }, { $set: { pushToken: null } }).catch((error) =>
      console.error("[push] Stale token cleanup failed:", error.message)
    );
  }

  if (validUsers.length === 0) {
    return {
      sent: false,
      totalTargetUsers: users.length,
      invalidTokenCount,
      totalValidTokens: 0,
      totalTickets: 0,
      totalTicketErrors: 0,
      ticketErrors: [],
    };
  }

  const expo = getExpoClient();
  const messages = validUsers.map((user) => ({
    to: user.pushToken,
    sound: "default",
    title,
    body,
    priority: "high",
    channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const wave of chunk(chunks, ANNOUNCEMENT_CONCURRENCY)) {
    const waveTickets = await Promise.all(wave.map((c) => expo.sendPushNotificationsAsync(c)));
    tickets.push(...waveTickets.flat());
  }

  const staleUids = [];
  const ticketErrors = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status !== "error") return;

    const uid = validUsers[index]?.uid;
    if (ticket.details?.error === "DeviceNotRegistered" && uid) {
      staleUids.push(uid);
    }
    ticketErrors.push({
      uid,
      code: ticket.details?.error || "UNKNOWN",
      message: ticket.message || "Unknown Expo push error",
    });
  });

  if (staleUids.length > 0) {
    await User.updateMany({ uid: { $in: staleUids } }, { $set: { pushToken: null } });
  }

  const totalTicketErrors = ticketErrors.length;
  if (totalTicketErrors > 0) {
    console.warn("[push] Announcement ticket errors:", ticketErrors);
  }

  return {
    sent: true,
    totalTargetUsers: users.length,
    invalidTokenCount,
    totalValidTokens: validUsers.length,
    totalTickets: tickets.length,
    totalTicketErrors,
    ticketErrors,
  };
}

// Sends one notification to a specific user immediately, bypassing the
// inactivity/resend/idempotency checks above entirely. For manually
// verifying delivery during development — never called by the batch job.
export async function sendTestNotification(uid) {
  const user = await User.findOne({ uid }).select("uid pushToken");

  if (!user) {
    return { ok: false, reason: "no such user" };
  }
  if (!user.pushToken) {
    return { ok: false, reason: "user has no pushToken saved" };
  }

  const result = await sendPushNotification({
    uid: user.uid,
    token: user.pushToken,
    title: "Test notification",
    body: "If you're seeing this, push notifications are working.",
  });

  return result;
}
