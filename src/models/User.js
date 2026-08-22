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