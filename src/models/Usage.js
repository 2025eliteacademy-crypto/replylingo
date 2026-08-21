import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },

usageCredits: {
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