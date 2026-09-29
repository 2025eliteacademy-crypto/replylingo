import { generateSpeech as generateSpeechGoogle } from "./googleTts.service.js";
import { generateSpeech as generateSpeechElevenLabs } from "./elevenlabs.service.js";
import { resolveVoice } from "../config/voiceCatalog.js";

/**
 * Single entry point the rest of the backend calls for TTS. Routes to Google
 * Cloud TTS for every language it covers, and silently falls back to
 * ElevenLabs for the 3 languages (fa/zu/ga) Google has no voice for at all —
 * no UI/analytics indication of which provider actually generated the audio.
 *
 * Returns a Buffer, or null if audio genuinely can't be produced (only
 * reachable via the ElevenLabs fallback failing too, since it doesn't
 * officially support fa/zu/ga either) — callers treat null as "text-only,
 * no audio", never as an error to surface.
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

  // Real Google TTS errors are left to throw — these are the well-supported
  // languages, so a failure here is a genuine error worth surfacing.
  return generateSpeechGoogle(text, targetLanguageCode, targetLanguageName, voiceId);
};
