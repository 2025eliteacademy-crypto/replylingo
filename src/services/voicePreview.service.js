import { generateTranslatedSpeech } from "./tts.service.js";
import { translateText } from "./openai.service.js";
import { CODE_TO_NAME } from "../config/voiceCatalog.js";

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
      const languageName = CODE_TO_NAME[code] || "English";
      const previewText =
        code === PREVIEW_SOURCE_LANGUAGE_CODE
          ? PREVIEW_SOURCE_TEXT
          : await translateText(PREVIEW_SOURCE_TEXT, "English", languageName);

      return generateTranslatedSpeech(previewText, code, languageName, voiceId);
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
