// Keep these ids in sync with frontend/utils/voices.js.
import dotenv from "dotenv";
dotenv.config();



export function getVoiceMap() {
  console.log("FEMALE ENV:", process.env.ELEVENLABS_VOICE_ID_FEMALE);
  console.log("MALE ENV:", process.env.ELEVENLABS_VOICE_ID_MALE);

  return {
    female:
      process.env.ELEVENLABS_VOICE_ID_FEMALE || "21m00Tcm4TlvDq8ikWAM",
    male:
      process.env.ELEVENLABS_VOICE_ID_MALE || "pNInz6obpgDQGcFmaJgB",
  };
}

export const DEFAULT_VOICE_ID = 'female';

export function resolveElevenLabsVoiceId(userVoiceId) {
  const VOICE_MAP = getVoiceMap();
  return VOICE_MAP[userVoiceId] || VOICE_MAP[DEFAULT_VOICE_ID];
}