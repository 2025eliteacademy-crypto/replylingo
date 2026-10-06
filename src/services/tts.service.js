import { generateSpeech as generateSpeechGoogle } from "./googleTts.service.js";
import { generateSpeech as generateSpeechElevenLabs } from "./elevenlabs.service.js";
import { resolveVoice } from "../config/voiceCatalog.js";

/**
 * Single entry point the rest of the backend calls for TTS. Routes to Google
 * Cloud TTS for every language it covers, and silently falls back to
 * ElevenLabs for the 3 languages (fa/zu/ga) Google has no voice for at all —
 * no UI/analytics indication of which provider actually generated the audio.
 *
 * Returns a Buffer, or null if audio can't be produced (ElevenLabs fallback
 * failing, or Google TTS still failing after one retry) — callers treat null
 * as "text-only, no audio", never as an error to surface.
 */
export const generateTranslatedSpeech = async (
  text,
  targetLanguageCode,
  targetLanguageName,
  voiceId
) => {
  const resolved = resolveVoice(targetLanguageCode, targetLanguageName, voiceId);

  if (resolved.provider === "elevenlabs") {
    try {
      return await generateSpeechElevenLabs(text, resolved.voiceId);
    } catch (error) {
      console.error(
        `TTS fallback (ElevenLabs) failed for language "${resolved.languageCode}", degrading to text-only:`,
        error.message
      );
      return null;
    }
  }

  // Google TTS: retry once (most failures are transient), then degrade to
  // text-only rather than failing the whole request — by this point Whisper
  // and the translation already succeeded and the user can still read them.
  // Each attempt is logged separately in AiCallLog, so failures stay visible.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await generateSpeechGoogle(text, targetLanguageCode, targetLanguageName, voiceId);
    } catch (error) {
      console.error(`Google TTS attempt ${attempt}/2 failed:`, error.message);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  console.error(
    `TTS (Google) failed for locale "${resolved.locale}", degrading to text-only.`
  );
  return null;
};
