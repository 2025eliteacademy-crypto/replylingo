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

    pushToken: {
      type: String,
      default: null,
    },

    // "ios" | "android" | null. Determines whether pushToken is an APNs
    // device token (sent directly to Apple) or an FCM registration token
    // (sent through Firebase Admin). Null for tokens saved before this
    // field existed — treated as "android" at send time, see
    // pushNotification.service.js.
    pushPlatform: {
      type: String,
      enum: ["ios", "android", null],
      default: null,
    },

    // Only meaningful when pushPlatform === "ios": which APNs host the
    // token is valid against ("development" = sandbox, for EAS
    // development/preview/verification builds; "production" = TestFlight/
    // App Store). A raw APNs device token doesn't self-describe this, so
    // the app reports it at registration time.
    pushEnvironment: {
      type: String,
      enum: ["development", "production", null],
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