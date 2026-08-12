import User from "../models/User.js";
import Usage from "../models/Usage.js";
import { getVoiceMap, DEFAULT_VOICE_ID } from "../config/voices.js";
import { getSubscriberPremiumStatus } from "../services/revenuecat.service.js";

const getMe = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
  { uid: req.user.uid },
  {
    $setOnInsert: {
      uid: req.user.uid,
      email: req.user.email ?? null,
      guest:
          req.user.firebase?.sign_in_provider === "anonymous" ||
          req.user.provider_id === "anonymous",
    },
  },
  {
  upsert: true,
  returnDocument: "after",
}
);

const usage = await Usage.findOne({ uid: req.user.uid });

console.log(user);


    res.status(200).json({
      success: true,
      user: {
        uid: req.user.uid,
        email: user?.email ?? req.user.email ?? null,
        provider: req.user.firebase?.sign_in_provider,
        guest: user?.guest ?? false,
        premium: user?.premium ?? false,
        voiceId: user?.voiceId ?? DEFAULT_VOICE_ID,

remainingFreeTranslations: usage
  ? Math.max(0, usage.freeLimit - usage.usageCredits)
  : 3,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /api/user/voice — body: { voiceId: "female" | "male" }
const updateVoice = async (req, res) => {
  try {
    const { voiceId } = req.body;
    console.log("VOICE ID RECEIVED:", voiceId);

    const VOICE_MAP = getVoiceMap();
    if (!voiceId || !Object.prototype.hasOwnProperty.call(VOICE_MAP, voiceId)) {
      return res.status(400).json({
        success: false,
        message: `voiceId must be one of: ${Object.keys(VOICE_MAP).join(", ")}`,
      });
    }

const user = await User.findOneAndUpdate(
  { uid: req.user.uid },
  { $set: { voiceId } },
  {
    upsert: true,
    returnDocument: "after",
  }
);

console.log("FULL USER:", user);
console.log("VOICE FIELD:", user?.voiceId);

    console.log("SAVED TO DB:", user.voiceId);
    res.status(200).json({
      success: true,
      voiceId: user.voiceId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// const syncPremium = async (req, res) => {
//   try {
//     const uid = req.user.uid;
//     const premium = await getSubscriberPremiumStatus(uid);

//     const user = await User.findOneAndUpdate(
//       { uid },
//       { $set: { premium } },
//       { upsert: true, returnDocument: "after" }
//     );

//     res.status(200).json({
//       success: true,
//       premium: user.premium,
//     });
//   } catch (error) {
//     console.error("[syncPremium] Error:", error);

//     if (error.code === "REVENUECAT_NOT_CONFIGURED") {
//       return res.status(503).json({
//         success: false,
//         message: "Premium sync is temporarily unavailable.",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to sync premium status.",
//     });
//   }
// };

const syncPremium = async (req, res) => {
  try {
    console.log("🔥🔥🔥 SYNC PREMIUM ENDPOINT HIT 🔥🔥🔥");
    console.log("UID:", req.user.uid);

    const uid = req.user.uid;
    const premium = await getSubscriberPremiumStatus(uid);

    const user = await User.findOneAndUpdate(
      { uid },
      { $set: { premium } },
      { upsert: true, returnDocument: "after" }
    );

    console.log("🔥 PREMIUM SAVED TO DB:", user.premium);

    res.status(200).json({
      success: true,
      premium: user.premium,
    });
  } catch (error) {
    console.error("[syncPremium] Error:", error);

    if (error.code === "REVENUECAT_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: "Premium sync is temporarily unavailable.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to sync premium status.",
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const uid = req.user.uid;

    console.log(`[deleteAccount] Starting deletion for user: ${uid}`);

    // Delete User document
    const userDeleteResult = await User.deleteOne({ uid });
    console.log(`[deleteAccount] User deletion result:`, userDeleteResult);

    // Delete Usage document
    const usageDeleteResult = await Usage.deleteOne({ uid });
    console.log(`[deleteAccount] Usage deletion result:`, usageDeleteResult);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("[deleteAccount] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete account",
    });
  }
};

export { getMe, updateVoice, syncPremium, deleteAccount };