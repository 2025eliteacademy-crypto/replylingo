import { generateTranslatedSpeech } from "./tts.service.js";
import { translateText } from "./openai.service.js";
import { DEFAULT_VOICE_ID } from "../config/voiceCatalog.js";

// The spoken branding tag appended to free-tier outbound replies (see
// translate.controller.js). It must be spoken in the reply's target
// language — the recipient hears it, not the sender — so it's translated
// via the same GPT pipeline used for the message itself, then cached per
// language (keyed by the normalized target language name) so each
// language only ever pays for one GPT translation + one ElevenLabs TTS
// call, no matter how many shares happen afterwards.
//
// A leading "..." was tried to induce a pause but caused ElevenLabs to
// mis-articulate "Sent" as "Assent"/"Ascent" in ~50% of generations
// (confirmed via repeated Whisper-transcription testing, English only).
// A leading "." gives the same pause without the artifact — 3/3 clean in
// testing. Carried over to every language; re-verify by ear for languages
// where this turns out to read oddly.
const OUTRO_SOURCE_TEXT = "Sent with ReplyLingo.";
const OUTRO_SOURCE_LANGUAGE = "English";

const cachedOutroBuffers = new Map();
const pendingOutroPromises = new Map();

export async function getBrandingOutroBuffer(targetLanguage, targetLanguageCode) {
  const language = (targetLanguage || OUTRO_SOURCE_LANGUAGE).trim();
  const cacheKey = language.toLowerCase();

  if (cachedOutroBuffers.has(cacheKey)) {
    return cachedOutroBuffers.get(cacheKey);
  }

  if (!pendingOutroPromises.has(cacheKey)) {
    const promise = (async () => {
      const outroText =
        cacheKey === OUTRO_SOURCE_LANGUAGE.toLowerCase()
          ? `. ${OUTRO_SOURCE_TEXT}`
          : `. ${await translateText(OUTRO_SOURCE_TEXT, OUTRO_SOURCE_LANGUAGE, language)}`;

      return generateTranslatedSpeech(outroText, targetLanguageCode, language, DEFAULT_VOICE_ID);
    })()
      .then((buffer) => {
        cachedOutroBuffers.set(cacheKey, buffer);
        return buffer;
      })
      .catch((err) => {
        // Don't poison the cache on a transient failure — the next call
        // (e.g. the next free-tier share in this language) gets to retry
        // from scratch.
        pendingOutroPromises.delete(cacheKey);
        throw err;
      });

    pendingOutroPromises.set(cacheKey, promise);
  }

  return pendingOutroPromises.get(cacheKey);
}
