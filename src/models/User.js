import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      default: null,
    },

    guest: {
      type: Boolean,
      default: false,
    },

    premium: {
      type: Boolean,
      default: false,
    },
    // Subscription details mirrored from RevenueCat webhooks (see
    // revenuecat.webhook.controller.js). `premium` above stays the single flag
    // the rest of the backend reads.
    premiumProductId: { type: String, default: null },
    premiumStore: { type: String, default: null },
    premiumExpiresAt: { type: Date, default: null },
    premiumWillRenew: { type: Boolean, default: null },
    // RevenueCat period_type of the latest event: "TRIAL" | "NORMAL" | "INTRO" | "PREPAID".
    premiumPeriodType: { type: String, default: null },
    // event_timestamp_ms of the newest webhook applied, so a late/out-of-order
    // retry of an older event can never overwrite newer state.
    revenueCatLastEventMs: { type: Number, default: null },

    voiceId: {
  type: String,
  default: "male",
},

    // An Expo push token (see pushNotification.service.js — sent via
    // Expo's push service, which resolves iOS/Android delivery itself).
    pushToken: {
      type: String,
      default: null,
    },

    // "ios" | "android" | null. Informational only — not used to route
    // delivery, Expo's push service does that from the token itself.
    pushPlatform: {
      type: String,
      enum: ["ios", "android", null],
      default: null,
    },

    lastActiveAt: {
      type: Date,
      default: Date.now,
    },

    // Last time a re-engagement push was sent, so the reminder job doesn't
    // nudge the same inactive user every single day it runs.
    lastReengagementSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);