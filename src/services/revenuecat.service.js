// import axios from "axios";

// const REVENUECAT_API_BASE = "https://api.revenuecat.com/v2";
// const ENTITLEMENT_ID = "entl5916853415";

// function isEntitlementActive(entitlement) {
//   if (!entitlement) return false;

//   const now = Date.now();

//   if (entitlement.expires_date === null) return true;

//   if (entitlement.grace_period_expires_date) {
//     const graceExpires = new Date(entitlement.grace_period_expires_date).getTime();
//     if (graceExpires > now) return true;
//   }

//   const expires = new Date(entitlement.expires_date).getTime();
//   return expires > now;
// }

// // export async function getSubscriberPremiumStatus(appUserId) {
// //   const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
// //   if (!apiKey) {
// //     const err = new Error("RevenueCat secret API key is not configured.");
// //     err.code = "REVENUECAT_NOT_CONFIGURED";
// //     throw err;
// //   }

// //   try {
// //     const response = await axios.get(
// //       `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
// //       {
// //         headers: {
// //           Authorization: `Bearer ${apiKey}`,
// //           "Content-Type": "application/json",
// //         },
// //       }
// //     );

// //     const entitlements = response.data?.subscriber?.entitlements ?? {};
// //     const entitlement = entitlements[ENTITLEMENT_ID];
// //     return isEntitlementActive(entitlement);
// //   } catch (error) {
// //     if (axios.isAxiosError(error) && error.response?.status === 404) {
// //       return false;
// //     }

// //     console.error("[RevenueCat] API error:", error.response?.data ?? error.message);
// //     throw new Error("Failed to verify premium status with RevenueCat.");
// //   }
// // }


// const REVENUECAT_PROJECT_ID = "proj387d4870";
// // const ENTITLEMENT_ID = "entl5916853415";

// export async function getSubscriberPremiumStatus(appUserId) {
//   const apiKey = process.env.REVENUECAT_SECRET_API_KEY;

//   console.log("========== REVENUECAT PREMIUM CHECK ==========");
//   console.log("[RevenueCat] App User ID:", appUserId);
//   console.log("[RevenueCat] Secret key exists:", !!apiKey);

//   if (!apiKey) {
//     const err = new Error("RevenueCat secret API key is not configured.");
//     err.code = "REVENUECAT_NOT_CONFIGURED";
//     throw err;
//   }

//   try {
//     const response = await axios.get(
//       `${REVENUECAT_API_BASE}/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(appUserId)}/active_entitlements`,
//       {
//         headers: {
//           Authorization: `Bearer ${apiKey}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log(
//       "[RevenueCat] Active entitlements:",
//       JSON.stringify(response.data, null, 2)
//     );

//     const activeEntitlements =
//       response.data?.items ?? [];

//     const entitlement = activeEntitlements.find(
//       (item) => item.entitlement_id === ENTITLEMENT_ID
//     );

//     const premium = !!entitlement;

//     console.log(
//       "[RevenueCat] Matching entitlement:",
//       JSON.stringify(entitlement, null, 2)
//     );

//     console.log("[RevenueCat] PREMIUM RESULT:", premium);
//     console.log("==============================================");

//     return premium;

//   } catch (error) {
//     console.error(
//       "[RevenueCat] API error:",
//       error.response?.data ?? error.message
//     );

//     throw new Error("Failed to verify premium status with RevenueCat.");
//   }
// }



import axios from "axios";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v2";
const REVENUECAT_PROJECT_ID = "proj387d4870";
const ENTITLEMENT_ID = "entl5916853415";

export async function getSubscriberPremiumStatus(appUserId) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;

  console.log("========== REVENUECAT PREMIUM CHECK ==========");
  console.log("[RevenueCat] App User ID:", appUserId);
  console.log("[RevenueCat] Secret key exists:", !!apiKey);

  if (!apiKey) {
    const err = new Error("RevenueCat secret API key is not configured.");
    err.code = "REVENUECAT_NOT_CONFIGURED";
    throw err;
  }

  try {
    const response = await axios.get(
      `${REVENUECAT_API_BASE}/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(
        appUserId
      )}/active_entitlements`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "[RevenueCat] Active entitlements:",
      JSON.stringify(response.data, null, 2)
    );

    const activeEntitlements = response.data?.items ?? [];
      
    console.log("[RevenueCat] Parsed activeEntitlements array:", activeEntitlements);
    console.log("[RevenueCat] Entitlement IDs returned:", activeEntitlements.map(i => i.entitlement_id));
    console.log("[RevenueCat] ENTITLEMENT_ID being matched against:", ENTITLEMENT_ID);


    const entitlement = activeEntitlements.find(
      (item) => item.entitlement_id === ENTITLEMENT_ID
    );

    console.log(
      "[RevenueCat] Matching entitlement:",
      JSON.stringify(entitlement, null, 2)
    );

    const premium = !!entitlement;

    console.log("[RevenueCat] PREMIUM RESULT:", premium);
    console.log("==============================================");

    return premium;
  } catch (error) {
    console.error(
      "[RevenueCat] API error:",
      error.response?.data ?? error.message
    );

    throw new Error("Failed to verify premium status with RevenueCat.");
  }
}