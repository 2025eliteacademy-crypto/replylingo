import { googleTtsClient } from "../config/googleTts.js";
import { resolveVoice } from "../config/voiceCatalog.js";
import { maximizeLoudnessToMp3 } from "./audioLoudness.js";
import { withAiLog } from "./aiCallLogger.js";

/**
 * @param {string} text
 * @param {string} targetLanguageCode - e.g. "es", "hi" (src/utils/languages.js code)
 * @param {string} targetLanguageName - e.g. "Spanish" — fallback if code is missing/unrecognized
 * @param {string} [voiceId] - app-level voice id ("female_1".."female_4" | "male_1".."male_4"),
 *   NOT a raw Google voice name.
 */
export const generateSpeech = async (text, targetLanguageCode, targetLanguageName, voiceId) => {
  const resolved = resolveVoice(targetLanguageCode, targetLanguageName, voiceId);

  if (resolved.provider !== "google") {
    throw new Error("generateSpeech called for a non-Google-TTS language.");
  }

  try {
    // Request raw LINEAR16 (WAV) rather than MP3 so we can run our own
    // loudness-maximizing compressor/limiter on the samples — Google's own
    // volumeGainDb tops out at +16dB and still clips hard at that ceiling
    // (verified: peaks already hit full scale there), so a flat gain alone
    // can't get any louder. See audioLoudness.js for the actual boost.
    const [response] = await withAiLog("google_tts", "speech", () => googleTtsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: resolved.locale, name: resolved.voiceName },
      audioConfig: {
        audioEncoding: "LINEAR16",
        effectsProfileId: ["handset-class-device"],
      },
    }));

    const wavBuffer = Buffer.from(response.audioContent);
    return maximizeLoudnessToMp3(wavBuffer);
  } catch (error) {
    console.error("Google TTS Error:", error.message);
    throw new Error("Failed to generate speech.");
  }
};
