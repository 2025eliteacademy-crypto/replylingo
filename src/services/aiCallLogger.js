import AiCallLog from "../models/AiCallLog.js";

/**
 * Runs `fn` (a provider call) and records one AiCallLog row for it, success
 * or failure. Logging is fire-and-forget and swallows its own errors, so it
 * can never slow down or break the wrapped call. The original result/error
 * is passed through untouched.
 */
export async function withAiLog(provider, operation, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    record(provider, operation, true, startedAt);
    return result;
  } catch (error) {
    record(provider, operation, false, startedAt);
    throw error;
  }
}

function record(provider, operation, success, startedAt) {
  AiCallLog.create({
    provider,
    operation,
    success,
    durationMs: Date.now() - startedAt,
  }).catch((err) => console.error("AiCallLog write failed:", err.message));
}
