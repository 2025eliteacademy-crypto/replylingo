import mongoose from "mongoose";

// One row per answered "why didn't you subscribe?" survey — shown only after a
// user started checkout and then cancelled it (see the mobile app's
// PaywallScreen). Kept in its own collection, separate from the funnel Event
// log, so free-text answers never mix with translation/funnel analytics.
//
// Privacy: stores only the answer codes, the user's optional free text, and
// non-sensitive purchase context (plan, store product id, displayed price).
// Never payment details, tokens, or message/translation content.
const purchaseSurveySchema = new mongoose.Schema(
  {
    // From the verified Firebase token, never from the request body.
    uid: { type: String, required: true },

    // Client-generated id for ONE checkout attempt. Together with uid it is
    // unique, which is what prevents a second submission for the same attempt.
    attemptId: { type: String, required: true },

    platform: { type: String, enum: ["ios", "android"], required: true },
    appVersion: { type: String, default: null },
    appLanguage: { type: String, default: null },

    // Purchase context.
    plan: { type: String, default: null }, // "annual" | "monthly"
    productId: { type: String, default: null }, // store product identifier
    trialOffered: { type: Boolean, default: false },
    priceString: { type: String, default: null }, // as displayed, e.g. "$29.99"
    currencyCode: { type: String, default: null },
    paywallSource: { type: String, default: null }, // which entry point opened the paywall

    // Answers.
    reason: { type: String, required: true },
    feedback: { type: String, default: "" },
    useCase: { type: String, default: null },

    // True when the store sheet was dismissed by the user (always true today —
    // errors are deliberately never surveyed — but stored so the intent of the
    // row is explicit and a future non-cancel survey can't be confused with it).
    cancelled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

purchaseSurveySchema.index({ uid: 1, attemptId: 1 }, { unique: true });
purchaseSurveySchema.index({ createdAt: -1 });

export default mongoose.model("PurchaseSurvey", purchaseSurveySchema);
