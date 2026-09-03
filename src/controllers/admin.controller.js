import Event from "../models/Event.js";
import {
  EVENTS,
  ERROR_TYPES,
  ONBOARDING_SCREEN_COUNT,
  PRODUCT_SCREENS,
  RETENTION_DAYS,
} from "../config/analyticsEvents.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Same shared-secret pattern as notifications.routes.js — there's no
// admin-role concept on User yet. Set ADMIN_SECRET in .env; falls back to
// CRON_SECRET so this works without extra config, but a dedicated
// ADMIN_SECRET is recommended since the two protect very different things.
function isAuthorized(req) {
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET || 'im12khore';
  return !!secret && req.query.secret === secret;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function parseRange(req) {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 30 * DAY_MS);
  return { from, to };
}

// Unique-distinctId count per event name, in range.
async function uniqueUserCounts(eventNames, from, to) {
  const rows = await Event.aggregate([
    { $match: { eventName: { $in: eventNames }, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { eventName: "$eventName", distinctId: "$distinctId" } } },
    { $group: { _id: "$_id.eventName", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(eventNames.map((n) => [n, 0]));
  rows.forEach((r) => {
    map[r._id] = r.count;
  });
  return map;
}

// Raw row count per event name, in range (not deduped by user).
async function totalCounts(eventNames, from, to) {
  const rows = await Event.aggregate([
    { $match: { eventName: { $in: eventNames }, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$eventName", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(eventNames.map((n) => [n, 0]));
  rows.forEach((r) => {
    map[r._id] = r.count;
  });
  return map;
}

// Unique-user counts for one event, bucketed by a params field (e.g.
// onboarding slide number, permission type, signup method, error type).
async function uniqueUserCountsByParam(eventName, paramKey, from, to) {
  const rows = await Event.aggregate([
    { $match: { eventName, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { val: `$params.${paramKey}`, distinctId: "$distinctId" } } },
    { $group: { _id: "$_id.val", count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = r.count;
  });
  return map;
}

async function totalCountsByParam(eventName, paramKey, from, to) {
  const rows = await Event.aggregate([
    { $match: { eventName, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: `$params.${paramKey}`, count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = r.count;
  });
  return map;
}

// Day-N retention for the cohort of users whose very first-ever app_open
// falls inside [from, to]. Looks forward from each user's own first open,
// so activity can (and should) extend past `to`.
async function computeRetention(from, to) {
  const cohortRows = await Event.aggregate([
    { $match: { eventName: EVENTS.APP_OPEN } },
    { $group: { _id: "$distinctId", firstOpenAt: { $min: "$createdAt" } } },
    { $match: { firstOpenAt: { $gte: from, $lte: to } } },
  ]);

  const empty = () =>
    RETENTION_DAYS.reduce((acc, d) => {
      acc[`d${d}`] = { eligible: 0, returned: 0, pct: 0 };
      return acc;
    }, {});

  if (cohortRows.length === 0) return empty();

  const cohortIds = cohortRows.map((r) => r._id);
  const firstOpenById = new Map(cohortRows.map((r) => [r._id, r.firstOpenAt]));

  const activity = await Event.find({
    eventName: EVENTS.APP_OPEN,
    distinctId: { $in: cohortIds },
  })
    .select("distinctId createdAt")
    .lean();

  const activityByUser = new Map();
  activity.forEach((e) => {
    if (!activityByUser.has(e.distinctId)) activityByUser.set(e.distinctId, []);
    activityByUser.get(e.distinctId).push(e.createdAt);
  });

  const now = new Date();
  const result = {};

  RETENTION_DAYS.forEach((day) => {
    let eligible = 0;
    let returned = 0;

    cohortIds.forEach((id) => {
      const firstOpen = firstOpenById.get(id);
      const windowStart = new Date(firstOpen.getTime() + day * DAY_MS);
      const windowEnd = new Date(firstOpen.getTime() + (day + 1) * DAY_MS);

      // Can't judge Day-N retention until that day has fully elapsed.
      if (windowEnd > now) return;
      eligible += 1;

      const opens = activityByUser.get(id) || [];
      if (opens.some((t) => t >= windowStart && t < windowEnd)) returned += 1;
    });

    result[`d${day}`] = { eligible, returned, pct: pct(returned, eligible) };
  });

  return result;
}

// GET /api/admin/funnel?secret=...&from=ISO&to=ISO
// `from`/`to` default to the trailing 30 days. Every count is a unique-user
// (distinctId) count within the range unless noted otherwise.
const getFunnelReport = async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  try {
    const { from, to } = parseRange(req);
    const onboardingSlideNums = Array.from({ length: ONBOARDING_SCREEN_COUNT }, (_, i) => i + 1);

    const topLevelEventNames = [
      EVENTS.APP_OPEN,
      EVENTS.ONBOARDING_STARTED,
      EVENTS.ONBOARDING_COMPLETED,
      EVENTS.AUTH_SCREEN_REACHED,
      EVENTS.SIGNUP_STARTED,
      EVENTS.SIGNUP_COMPLETED,
      EVENTS.TRANSLATE_SCREEN_OPENED,
      EVENTS.AUDIO_SELECTED,
      EVENTS.AUDIO_UPLOAD_STARTED,
      EVENTS.AUDIO_UPLOAD_SUCCEEDED,
      EVENTS.AUDIO_UPLOAD_FAILED,
      EVENTS.TRANSLATION_STARTED,
      EVENTS.TRANSLATION_SUCCEEDED,
      EVENTS.TRANSLATION_FAILED,
    ];

    const [
      topLevelUnique,
      appOpenTotal,
      slideViewedByNum,
      slideCompletedByNum,
      signupMethodCounts,
      permShownByType,
      permGrantedByType,
      permDeniedByType,
      productScreensUnique,
      uploadFailedByType,
      translationFailedByType,
      retention,
    ] = await Promise.all([
      uniqueUserCounts(topLevelEventNames, from, to),
      totalCounts([EVENTS.APP_OPEN], from, to),
      uniqueUserCountsByParam(EVENTS.ONBOARDING_SLIDE_VIEWED, "slide_number", from, to),
      uniqueUserCountsByParam(EVENTS.ONBOARDING_SLIDE_COMPLETED, "slide_number", from, to),
      uniqueUserCountsByParam(EVENTS.SIGNUP_COMPLETED, "method", from, to),
      totalCountsByParam(EVENTS.PERMISSION_SHOWN, "type", from, to),
      totalCountsByParam(EVENTS.PERMISSION_GRANTED, "type", from, to),
      totalCountsByParam(EVENTS.PERMISSION_DENIED, "type", from, to),
      uniqueUserCountsByParam(EVENTS.SCREEN_REACHED, "screen", from, to),
      uniqueUserCountsByParam(EVENTS.AUDIO_UPLOAD_FAILED, "error_type", from, to),
      uniqueUserCountsByParam(EVENTS.TRANSLATION_FAILED, "error_type", from, to),
      computeRetention(from, to),
    ]);

    const appOpenUnique = topLevelUnique[EVENTS.APP_OPEN];

    // First-time vs returning opens: compare each opener's very first-ever
    // app_open (all time) against this range.
    const firstOpenRows = await Event.aggregate([
      { $match: { eventName: EVENTS.APP_OPEN } },
      { $group: { _id: "$distinctId", firstOpenAt: { $min: "$createdAt" } } },
    ]);
    const firstOpenMap = new Map(firstOpenRows.map((r) => [r._id, r.firstOpenAt]));
    const openersInRange = await Event.aggregate([
      { $match: { eventName: EVENTS.APP_OPEN, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: "$distinctId" } },
    ]);
    let firstTimeUsers = 0;
    openersInRange.forEach((r) => {
      const firstOpen = firstOpenMap.get(r._id);
      if (firstOpen && firstOpen >= from && firstOpen <= to) firstTimeUsers += 1;
    });
    const returningUsers = openersInRange.length - firstTimeUsers;

    const failureBreakdown = {};
    ERROR_TYPES.forEach((type) => {
      failureBreakdown[type] = (uploadFailedByType[type] || 0) + (translationFailedByType[type] || 0);
    });

    const onboardingDropOff = {};
    onboardingSlideNums.forEach((n) => {
      const reached = slideViewedByNum[String(n)] || 0;
      const completed = slideCompletedByNum[String(n)] || 0;
      onboardingDropOff[`slide_${n}`] = {
        reached,
        reachedPct: pct(reached, appOpenUnique),
        completed,
        completedPct: pct(completed, appOpenUnique),
      };
    });

    const coreSuccessFunnel = [
      { key: "app_opened", label: "App opened", count: appOpenUnique },
      { key: "onboarding_started", label: "Onboarding started", count: topLevelUnique[EVENTS.ONBOARDING_STARTED] },
      { key: "onboarding_completed", label: "Onboarding completed", count: topLevelUnique[EVENTS.ONBOARDING_COMPLETED] },
      { key: "signup_started", label: "Signup started", count: topLevelUnique[EVENTS.SIGNUP_STARTED] },
      { key: "signup_completed", label: "Signup completed", count: topLevelUnique[EVENTS.SIGNUP_COMPLETED] },
      { key: "translate_reached", label: "Translate screen reached", count: topLevelUnique[EVENTS.TRANSLATE_SCREEN_OPENED] },
      { key: "audio_selected", label: "Audio selected/uploaded", count: topLevelUnique[EVENTS.AUDIO_SELECTED] },
      { key: "translation_started", label: "Translation started", count: topLevelUnique[EVENTS.TRANSLATION_STARTED] },
      { key: "translation_succeeded", label: "Translation succeeded", count: topLevelUnique[EVENTS.TRANSLATION_SUCCEEDED] },
    ].map((step) => ({ ...step, pctOfAppOpens: pct(step.count, appOpenUnique) }));

    res.status(200).json({
      success: true,
      range: { from, to },
      totals: {
        appOpened: appOpenUnique,
        appOpensTotal: appOpenTotal[EVENTS.APP_OPEN],
        firstTimeOpens: firstTimeUsers,
        returningOpens: returningUsers,
        onboardingStarted: topLevelUnique[EVENTS.ONBOARDING_STARTED],
        onboardingCompleted: topLevelUnique[EVENTS.ONBOARDING_COMPLETED],
        signupStarted: topLevelUnique[EVENTS.SIGNUP_STARTED],
        signupCompleted: topLevelUnique[EVENTS.SIGNUP_COMPLETED],
      },
      onboardingDropOff,
      onboardingCompletionRate: pct(topLevelUnique[EVENTS.ONBOARDING_COMPLETED], appOpenUnique),
      signup: {
        reached: topLevelUnique[EVENTS.AUTH_SCREEN_REACHED],
        completed: topLevelUnique[EVENTS.SIGNUP_COMPLETED],
        completionRate: pct(topLevelUnique[EVENTS.SIGNUP_COMPLETED], topLevelUnique[EVENTS.AUTH_SCREEN_REACHED]),
        byMethod: Object.fromEntries(
          Object.entries(signupMethodCounts).map(([method, count]) => [
            method,
            { count, pct: pct(count, topLevelUnique[EVENTS.SIGNUP_COMPLETED]) },
          ])
        ),
      },
      permissions: ["microphone", "notification"].reduce((acc, type) => {
        const shown = permShownByType[type] || 0;
        const granted = permGrantedByType[type] || 0;
        const denied = permDeniedByType[type] || 0;
        acc[type] = {
          shown,
          granted,
          grantedPct: pct(granted, shown),
          denied,
          deniedPct: pct(denied, shown),
        };
        return acc;
      }, {}),
      coreProduct: {
        translateScreenReached: topLevelUnique[EVENTS.TRANSLATE_SCREEN_OPENED],
        audioSelected: topLevelUnique[EVENTS.AUDIO_SELECTED],
        translationAttempted: topLevelUnique[EVENTS.TRANSLATION_STARTED],
        translationSucceeded: topLevelUnique[EVENTS.TRANSLATION_SUCCEEDED],
        translationFailed: topLevelUnique[EVENTS.TRANSLATION_FAILED],
        screensReached: PRODUCT_SCREENS.reduce((acc, screen) => {
          acc[screen] = productScreensUnique[screen] || 0;
          return acc;
        }, {}),
      },
      failureBreakdown,
      coreSuccessFunnel,
      retention,
    });
  } catch (error) {
    console.error("[admin] Funnel report failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/user-journey?secret=...&distinctId=...  (or &uid=...)
// Full chronological event list for one user, plus the per-user retention
// summary fields (first_seen_at, last_seen_at, translation attempt/success
// counts) — for debugging exactly where one person's journey diverged.
const getUserJourney = async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const { distinctId, uid } = req.query;
  if (!distinctId && !uid) {
    return res.status(400).json({ success: false, message: "distinctId or uid query param is required." });
  }

  try {
    const filter = distinctId ? { distinctId } : { uid };
    const events = await Event.find(filter).sort({ createdAt: 1 }).lean();

    if (events.length === 0) {
      return res.status(200).json({ success: true, summary: null, events: [] });
    }

    const appOpens = events.filter((e) => e.eventName === EVENTS.APP_OPEN);
    const translationAttempts = events.filter((e) => e.eventName === EVENTS.TRANSLATION_STARTED);
    const translationSuccesses = events.filter((e) => e.eventName === EVENTS.TRANSLATION_SUCCEEDED);

    const summary = {
      distinctId: events[0].distinctId,
      uid: events.find((e) => e.uid)?.uid || null,
      firstSeenAt: events[0].createdAt,
      lastSeenAt: events[events.length - 1].createdAt,
      appOpens: appOpens.length,
      translationAttempts: translationAttempts.length,
      translationSuccesses: translationSuccesses.length,
      lastSuccessfulTranslationAt:
        translationSuccesses.length > 0
          ? translationSuccesses[translationSuccesses.length - 1].createdAt
          : null,
    };

    res.status(200).json({
      success: true,
      summary,
      events: events.map((e) => ({
        name: e.eventName,
        params: e.params,
        platform: e.platform,
        uid: e.uid,
        at: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin] User journey lookup failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getFunnelReport, getUserJourney };
