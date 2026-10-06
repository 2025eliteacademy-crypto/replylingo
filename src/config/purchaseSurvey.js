// Fixed answer vocabularies for the post-purchase-abandonment survey. These
// codes must stay in sync with the mobile app's
// src/components/PurchaseAbandonSurveyModal.js — the app sends the code, never
// the (localized) label, so answers from every language aggregate together.

export const SURVEY_REASONS = [
  "too_expensive",
  "not_often",
  "want_trial",
  "quality",
  "unsure",
  "payment_issue",
  "other",
];

export const SURVEY_USE_CASES = [
  "understand_message",
  "translate_to_reply",
  "voice_reply",
  "communicate",
  "just_trying",
  "other",
];

export const SURVEY_PLATFORMS = ["ios", "android"];

export const MAX_FEEDBACK_LENGTH = 500;
