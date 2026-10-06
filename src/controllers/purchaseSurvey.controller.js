import PurchaseSurvey from "../models/PurchaseSurvey.js";
import User from "../models/User.js";
import {
  SURVEY_REASONS,
  SURVEY_USE_CASES,
  SURVEY_PLATFORMS,
  MAX_FEEDBACK_LENGTH,
} from "../config/purchaseSurvey.js";

// Trims, drops control characters and caps length. Returns null for anything
// that isn't a non-empty string.
function cleanString(value, maxLength) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

// POST /api/survey/purchase-abandonment   (auth required)
//
// Body: { attemptId, reason, platform, appVersion?, appLanguage?, plan?,
//         productId?, trialOffered?, priceString?, currencyCode?,
//         paywallSource?, feedback?, useCase?, cancelled? }
//
// The user id comes from the verified Firebase token (req.user.uid), never
// from the body. One response per (uid, attemptId): a repeat for the same
// checkout attempt is acknowledged but not stored again.
const submitPurchaseAbandonmentSurvey = async (req, res) => {
  try {
    const body = req.body || {};

    const attemptId = cleanString(body.attemptId, 80);
    if (!attemptId || attemptId.length < 8) {
      return res.status(400).json({ success: false, message: "attemptId is required." });
    }

    if (!SURVEY_REASONS.includes(body.reason)) {
      return res.status(400).json({ success: false, message: "A valid reason is required." });
    }

    const platform = typeof body.platform === "string" ? body.platform.toLowerCase() : "";
    if (!SURVEY_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: "A valid platform is required." });
    }

    // Only a user-cancelled checkout is ever surveyed. A store/technical error
    // is handled separately by the app and must not be recorded as "chose not
    // to buy".
    if (body.cancelled !== true) {
      return res.status(400).json({
        success: false,
        message: "Only cancelled purchases are surveyed.",
      });
    }

    const useCase = SURVEY_USE_CASES.includes(body.useCase) ? body.useCase : null;

    // Already-subscribed users shouldn't be surveyed (the app already avoids
    // this; this is the server-side backstop). Acknowledge without storing.
    const user = await User.findOne({ uid: req.user.uid }).select("premium").lean();
    if (user?.premium) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const doc = {
      uid: req.user.uid,
      attemptId,
      platform,
      appVersion: cleanString(body.appVersion, 20),
      appLanguage: cleanString(body.appLanguage, 10),
      plan: cleanString(body.plan, 20),
      productId: cleanString(body.productId, 100),
      trialOffered: body.trialOffered === true,
      priceString: cleanString(body.priceString, 30),
      currencyCode: cleanString(body.currencyCode, 5),
      paywallSource: cleanString(body.paywallSource, 40),
      reason: body.reason,
      feedback: cleanString(body.feedback, MAX_FEEDBACK_LENGTH) || "",
      useCase,
      cancelled: true,
    };

    try {
      await PurchaseSurvey.create(doc);
    } catch (error) {
      // Unique index (uid + attemptId): this attempt was already answered.
      if (error?.code === 11000) {
        return res.status(200).json({ success: true, duplicate: true });
      }
      throw error;
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("[survey] Failed to store purchase-abandonment survey:", error.message);
    return res.status(500).json({ success: false, message: "Could not save feedback." });
  }
};

export { submitPurchaseAbandonmentSurvey };
