import { generateTranslatedSpeech } from "./tts.service.js";
import { translateText } from "./openai.service.js";
import { CODE_TO_NAME } from "../config/voiceCatalog.js";
import VoicePreview from "../models/VoicePreview.js";

// Lightweight sample line for Settings -> voice preview. Deliberately does
// NOT go through the real translate pipeline (no Whisper, no usage credit,
// no branding) — just text -> speech in the requested voice/language.
const PREVIEW_SOURCE_TEXT = "Hello! This is a preview of my voice.";
const PREVIEW_SOURCE_LANGUAGE_CODE = "en";

// In-memory cache, same pattern as brandingOutro.service.js — best-effort
// across warm serverless invocations, not a durable store.
const cachedPreviewBuffers = new Map();
const pendingPreviewPromises = new Map();

export async function getVoicePreviewBuffer(languageCode, voiceId) {
  const code = languageCode && CODE_TO_NAME[languageCode] ? languageCode : PREVIEW_SOURCE_LANGUAGE_CODE;
  const cacheKey = `${code}_${voiceId}`;

  if (cachedPreviewBuffers.has(cacheKey)) {
    return cachedPreviewBuffers.get(cacheKey);
  }

  if (!pendingPreviewPromises.has(cacheKey)) {
    const promise = (async () => {
      // Persistent cache first: survives cold starts and is shared by every
      // serverless instance, so each (language, voice) is generated once ever.
      const stored = await VoicePreview.findOne({ key: cacheKey }).select("audio");
      if (stored?.audio) {
        return stored.audio;
      }

      const languageName = CODE_TO_NAME[code] || "English";
      const previewText =
        code === PREVIEW_SOURCE_LANGUAGE_CODE
          ? PREVIEW_SOURCE_TEXT
          : await translateText(PREVIEW_SOURCE_TEXT, "English", languageName);

      const generated = await generateTranslatedSpeech(previewText, code, languageName, voiceId);

      if (generated) {
        // A failed save only costs a regeneration next time — never fail the
        // user's preview over it.
        await VoicePreview.updateOne(
          { key: cacheKey },
          { $set: { audio: generated } },
          { upsert: true }
        ).catch((err) => console.error("[voicePreview] Failed to persist preview:", err.message));
      }

      return generated;
    })()
      .then((buffer) => {
        cachedPreviewBuffers.set(cacheKey, buffer);
        return buffer;
      })
      .catch((err) => {
        pendingPreviewPromises.delete(cacheKey);
        throw err;
      });

    pendingPreviewPromises.set(cacheKey, promise);
  }

  return pendingPreviewPromises.get(cacheKey);
}
