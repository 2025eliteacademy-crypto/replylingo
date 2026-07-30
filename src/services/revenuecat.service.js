import axios from "axios";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v2";
const ENTITLEMENT_ID = "ReplyLingo Pro";

function isEntitlementActive(entitlement) {
  if (!entitlement) return false;

  const now = Date.now();

  if (entitlement.expires_date === null) return true;

  if (entitlement.grace_period_expires_date) {
    const graceExpires = new Date(entitlement.grace_period_expires_date).getTime();
    if (graceExpires > now) return true;
  }

  const expires = new Date(entitlement.expires_date).getTime();
  return expires > now;
}

export async function getSubscriberPremiumStatus(appUserId) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    const err = new Error("RevenueCat secret API key is not configured.");
    err.code = "REVENUECAT_NOT_CONFIGURED";
    throw err;
  }

  try {
    const response = await axios.get(
      `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const entitlements = response.data?.subscriber?.entitlements ?? {};
    const entitlement = entitlements[ENTITLEMENT_ID];
    return isEntitlementActive(entitlement);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return false;
    }

    console.error("[RevenueCat] API error:", error.response?.data ?? error.message);
    throw new Error("Failed to verify premium status with RevenueCat.");
  }
}
