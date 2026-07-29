// Keep these ids in sync with frontend/utils/voices.js.
export const VOICE_MAP = {
  female: process.env.ELEVENLABS_VOICE_ID_FEMALE || '21m00Tcm4TlvDq8ikWAM',
  male: process.env.ELEVENLABS_VOICE_ID_MALE || 'pNInz6obpgDQGcFmaJgB',
};

export const DEFAULT_VOICE_ID = 'female';

export function resolveElevenLabsVoiceId(userVoiceId) {
  return VOICE_MAP[userVoiceId] || VOICE_MAP[DEFAULT_VOICE_ID];
}