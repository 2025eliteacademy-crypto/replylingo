import User from "../models/User.js";
import { getVoiceMap, DEFAULT_VOICE_ID } from "../config/voices.js";

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

export { getMe, updateVoice };