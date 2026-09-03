import mongoose from "mongoose";

// Append-only funnel/analytics event log — the single source of truth for
// first-party funnel reporting (see admin.controller.js). Deliberately flat
// and schema-loose (params is Mixed) so new event params never require a
// migration; see src/config/analyticsEvents.js for the canonical event
// names and error-type vocabulary in use.
//
// distinctId is a client-generated anonymous id persisted on-device from
// first launch — it is present on every event, before and after sign-in,
// which is what lets a funnel report stitch pre-auth activity (app_open,
// onboarding) to the same install's post-auth activity (uid is only known
// once Firebase auth completes, including for guest/anonymous sign-in).
const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
    },
    distinctId: {
      type: String,
      required: true,
    },
    uid: {
      type: String,
      default: null,
    },
    isGuest: {
      type: Boolean,
      default: null,
    },
    platform: {
      type: String,
      default: null,
    },
    appVersion: {
      type: String,
      default: null,
    },
    // Safe categorical metadata only — never transcript/audio/email content.
    // Enforced client-side (see mobile events.js); not re-validated here.
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // When the client says the event happened — informational only, reports
    // use createdAt (server-received time) as the source of truth so clock
    // skew on a device can't distort funnel ordering.
    clientTimestamp: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ eventName: 1, createdAt: 1 });
eventSchema.index({ distinctId: 1, createdAt: 1 });
eventSchema.index({ uid: 1, createdAt: 1 });

export default mongoose.model("Event", eventSchema);
