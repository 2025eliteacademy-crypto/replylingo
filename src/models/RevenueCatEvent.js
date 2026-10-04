import mongoose from "mongoose";

// Ledger of RevenueCat webhook events already received. The unique eventId is
// what makes webhook processing idempotent — RevenueCat retries deliveries
// (non-2xx / timeout) and can occasionally send the same event twice.
const revenueCatEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, default: null },
    appUserId: { type: String, default: null },
    environment: { type: String, default: null },
    store: { type: String, default: null },
    productId: { type: String, default: null },
    eventTimestampMs: { type: Number, default: null },
    // "applied" | "ignored_stale" | "ignored_irrelevant" | "user_not_found"
    outcome: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("RevenueCatEvent", revenueCatEventSchema);
