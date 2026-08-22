import http2 from "node:http2";
import crypto from "node:crypto";
import "dotenv/config";

const BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.johnnykhore.replylingo";
const TEAM_ID = process.env.APNS_TEAM_ID;

const ENVIRONMENTS = {
  development: {
    host: "https://api.sandbox.push.apple.com",
    keyId: process.env.APNS_KEY_ID_DEV,
    key: process.env.APNS_KEY_DEV?.replace(/\\n/g, "\n"),
  },
  production: {
    host: "https://api.push.apple.com",
    keyId: process.env.APNS_KEY_ID_PROD,
    key: process.env.APNS_KEY_PROD?.replace(/\\n/g, "\n"),
  },
};

// Provider JWTs are valid up to 1 hour and Apple asks that you not mint a
// new one more than once every ~20 minutes per (team, key) pair. Cache well
// inside both bounds, one token per environment since dev/prod use
// different keys.
const TOKEN_TTL_MS = 50 * 60 * 1000;
const tokenCache = new Map(); // environment -> { token, issuedAt }

function getProviderToken(environment) {
  const cached = tokenCache.get(environment);
  if (cached && Date.now() - cached.issuedAt < TOKEN_TTL_MS) {
    return cached.token;
  }

  const { keyId, key } = ENVIRONMENTS[environment];
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("SHA256")
    .update(signingInput)
    .sign({ key, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  const token = `${signingInput}.${signature}`;
  tokenCache.set(environment, { token, issuedAt: Date.now() });
  return token;
}

// One long-lived HTTP/2 session per environment (Apple's recommended
// pattern), reopened lazily if it drops.
const sessions = new Map();

function getSession(environment) {
  const existing = sessions.get(environment);
  if (existing && !existing.closed && !existing.destroyed) return existing;

  const session = http2.connect(ENVIRONMENTS[environment].host);
  session.on("error", (err) => console.error(`[apns] session error (${environment}):`, err.message));
  session.on("close", () => sessions.delete(environment));
  sessions.set(environment, session);
  return session;
}

/**
 * Sends one notification directly to Apple's APNs HTTP/2 provider API —
 * no Firebase involved. `environment` must be "development" (sandbox, for
 * EAS development/preview/verification builds) or "production" (TestFlight/
 * App Store); the caller must know which, since a raw APNs device token
 * doesn't self-describe it.
 */
export async function sendApnsNotification({ token, title, body, environment = "development" }) {
  const config = ENVIRONMENTS[environment];
  if (!config?.keyId || !config?.key) {
    return {
      ok: false,
      code: "apns/not-configured",
      message: `No APNs key configured for the "${environment}" environment.`,
    };
  }

  const session = getSession(environment);
  const providerToken = getProviderToken(environment);
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default" } });

  return new Promise((resolve) => {
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status;
    let responseBody = "";

    req.on("response", (headers) => {
      status = headers[":status"];
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      if (status === 200) {
        resolve({ ok: true });
        return;
      }
      let reason = "Unknown";
      try {
        reason = JSON.parse(responseBody).reason || reason;
      } catch {
        // non-JSON body — fall through with reason "Unknown"
      }
      resolve({ ok: false, code: `apns/${reason}`, message: `APNs responded ${status}: ${reason}` });
    });
    req.on("error", (err) => {
      resolve({ ok: false, code: "apns/request-error", message: err.message });
    });

    req.end(payload);
  });
}
