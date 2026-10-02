import { generateTranslatedSpeech } from "./tts.service.js";
import { translateText } from "./openai.service.js";
import { normalizeVoiceId } from "../config/voiceCatalog.js";
import VoicePreview from "../models/VoicePreview.js";

// The spoken branding tag appended to free-tier outbound replies (see
// translate.controller.js). It must be spoken in the reply's target
// language — the recipient hears it, not the sender — so it's translated
// via the same GPT pipeline used for the message itself, then cached per
// language (keyed by the normalized target language name) so each
// language only ever pays for one GPT translation + one ElevenLabs TTS
// call, no matter how many shares happen afterwards.
//
// The outro is spoken in the SAME voice the user picked for the reply (so a
// female-voice reply doesn't end with a male "Sent with ReplyLingo"), which
// means one clip per (language, voice). Clips are persisted in Mongo (the
// VoicePreview collection, key "outro:<language>:<voiceId>") so each
// combination is generated once ever, not once per serverless cold start.
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

export async function getBrandingOutroBuffer(targetLanguage, targetLanguageCode, voiceId) {
  const language = (targetLanguage || OUTRO_SOURCE_LANGUAGE).trim();
  const languageKey = language.toLowerCase();
  const voice = normalizeVoiceId(voiceId);
  const cacheKey = `${languageKey}:${voice}`;

  if (cachedOutroBuffers.has(cacheKey)) {
    return cachedOutroBuffers.get(cacheKey);
  }

  if (!pendingOutroPromises.has(cacheKey)) {
    const promise = (async () => {
      const dbKey = `outro:${cacheKey}`;
      const stored = await VoicePreview.findOne({ key: dbKey }).select("audio");
      if (stored?.audio) return stored.audio;

      const outroText =
        languageKey === OUTRO_SOURCE_LANGUAGE.toLowerCase()
          ? `. ${OUTRO_SOURCE_TEXT}`
          : `. ${await translateText(OUTRO_SOURCE_TEXT, OUTRO_SOURCE_LANGUAGE, language)}`;

      const generated = await generateTranslatedSpeech(outroText, targetLanguageCode, language, voice);

      if (generated) {
        await VoicePreview.updateOne(
          { key: dbKey },
          { $set: { audio: generated } },
          { upsert: true }
        ).catch((err) => console.error("[brandingOutro] Failed to persist outro:", err.message));
      }
      return generated;
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
