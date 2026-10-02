import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },

// Free users' LIFETIME credits used — never reset. A free account gets
// freeLimit translations in total, then must subscribe.
usageCredits: {
  type: Number,
  default: 0,
},

// Premium users' credits used today — only feeds the silent daily abuse
// cap, and resets with lastReset. Kept separate from usageCredits so
// premium usage never eats into the free lifetime allowance if a
// subscription lapses.
premiumDailyCredits: {
  type: Number,
  default: 0,
},

freeLimit: {
  type: Number,
  default: 3,
},

// Directional AI cost bookkeeping (Whisper + GPT + ElevenLabs per call),
// not a real-time provider billing reconciliation — see
// ESTIMATED_COST_PER_CALL_USD in translate.controller.js for the constant
// and how to replace it with real per-provider pricing.
estimatedCostUsd: {
  type: Number,
  default: 0,
},

    // Last reset of premiumDailyCredits (free credits don't reset).
    lastReset: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Usage", usageSchema);