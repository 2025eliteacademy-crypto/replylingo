// Google Cloud TTS voice/language mapping, keyed by the SAME 2-letter codes
// used by the mobile app's src/utils/languages.js (LANGUAGES[].code) — this
// is deliberately not a second/conflicting language list, just a voice
// lookup table over the existing language codes.
//
// Coverage was verified live against the real Google Cloud TTS API
// (client.listVoices({}) — 2066 voices across 63 language codes) rather than
// assumed. Three tiers:
//
//  1. "chirp3hd" (40 languages) — the 8 universal natural-sounding personas
//     below exist in every one of these locales under the exact same name
//     (e.g. de-DE-Chirp3-HD-Kore, hi-IN-Chirp3-HD-Kore, ja-JP-Chirp3-HD-Kore).
//  2. "override" (7 languages) — only Wavenet/Standard tier is available,
//     with fewer distinct voices per language than the 4 female + 4 male
//     persona slots. Some (af, ca, eu, is) have ONLY a single female voice
//     and NO male voice at all — a male request there gracefully falls back
//     to that same female voice rather than erroring.
//  3. "elevenlabs" (3 languages: fa, zu, ga) — Google Cloud TTS has NO voice
//     at all for these. Falls back to the existing ElevenLabs integration,
//     silently (no UI/analytics indication of provider). If ElevenLabs also
//     fails (it doesn't officially support these either), the caller
//     degrades to text-only — see services/tts.service.js.

// The 8 voice ids the mobile app exposes in src/utils/voices.js. Keep these
// two files in sync — same ids, same order.
export const VOICE_PERSONAS = {
  female_1: "Kore",
  female_2: "Aoede",
  female_3: "Leda",
  female_4: "Zephyr",
  male_1: "Charon",
  male_2: "Fenrir",
  male_3: "Orus",
  male_4: "Puck",
};

export const DEFAULT_VOICE_ID = "male_1";

// Legacy values already stored in Mongo from the ElevenLabs-only era
// (User.voiceId default was "male", config/voices.js default was "female").
// Mapped forward so existing users never need a migration script.
const LEGACY_VOICE_ID_MAP = {
  male: "male_1",
  female: "female_1",
};

export function normalizeVoiceId(voiceId) {
  if (voiceId && VOICE_PERSONAS[voiceId]) return voiceId;
  if (voiceId && LEGACY_VOICE_ID_MAP[voiceId]) return LEGACY_VOICE_ID_MAP[voiceId];
  return DEFAULT_VOICE_ID;
}

export function isValidVoiceId(voiceId) {
  return Boolean(voiceId && (VOICE_PERSONAS[voiceId] || LEGACY_VOICE_ID_MAP[voiceId]));
}

function chirp3hd(locale) {
  return { tier: "chirp3hd", locale };
}

// 40 languages with the full 8-persona Chirp3-HD tier.
const CHIRP3HD_LANGUAGES = {
  en: chirp3hd("en-US"),
  es: chirp3hd("es-ES"),
  fr: chirp3hd("fr-FR"),
  de: chirp3hd("de-DE"),
  it: chirp3hd("it-IT"),
  pt: chirp3hd("pt-BR"),
  ru: chirp3hd("ru-RU"),
  uk: chirp3hd("uk-UA"),
  nl: chirp3hd("nl-NL"),
  pl: chirp3hd("pl-PL"),
  sv: chirp3hd("sv-SE"),
  no: chirp3hd("nb-NO"),
  da: chirp3hd("da-DK"),
  fi: chirp3hd("fi-FI"),
  el: chirp3hd("el-GR"),
  tr: chirp3hd("tr-TR"),
  cs: chirp3hd("cs-CZ"),
  hu: chirp3hd("hu-HU"),
  ro: chirp3hd("ro-RO"),
  bg: chirp3hd("bg-BG"),
  ar: chirp3hd("ar-XA"),
  he: chirp3hd("he-IL"),
  hi: chirp3hd("hi-IN"),
  pa: chirp3hd("pa-IN"),
  bn: chirp3hd("bn-IN"),
  gu: chirp3hd("gu-IN"),
  mr: chirp3hd("mr-IN"),
  ta: chirp3hd("ta-IN"),
  te: chirp3hd("te-IN"),
  kn: chirp3hd("kn-IN"),
  ml: chirp3hd("ml-IN"),
  ur: chirp3hd("ur-IN"),
  zh: chirp3hd("cmn-CN"),
  ja: chirp3hd("ja-JP"),
  ko: chirp3hd("ko-KR"),
  vi: chirp3hd("vi-VN"),
  th: chirp3hd("th-TH"),
  id: chirp3hd("id-ID"),
  sw: chirp3hd("sw-KE"),
  sr: chirp3hd("sr-RS"),
};

// 7 languages with only Wavenet/Standard voices — explicit per-voice-id
// overrides, reusing real voices across slots where Google offers fewer
// than 4 per gender, and falling back to the sole female voice for the
// 4 languages with no male voice at all.
const OVERRIDE_LANGUAGES = {
  ms: {
    tier: "override",
    locale: "ms-MY",
    voices: {
      female_1: "ms-MY-Wavenet-A",
      female_2: "ms-MY-Wavenet-C",
      female_3: "ms-MY-Wavenet-A",
      female_4: "ms-MY-Wavenet-C",
      male_1: "ms-MY-Wavenet-B",
      male_2: "ms-MY-Wavenet-D",
      male_3: "ms-MY-Wavenet-B",
      male_4: "ms-MY-Wavenet-D",
    },
  },
  am: {
    tier: "override",
    locale: "am-ET",
    voices: {
      female_1: "am-ET-Wavenet-A",
      female_2: "am-ET-Wavenet-A",
      female_3: "am-ET-Wavenet-A",
      female_4: "am-ET-Wavenet-A",
      male_1: "am-ET-Wavenet-B",
      male_2: "am-ET-Wavenet-B",
      male_3: "am-ET-Wavenet-B",
      male_4: "am-ET-Wavenet-B",
    },
  },
  tl: {
    tier: "override",
    locale: "fil-PH",
    voices: {
      female_1: "fil-PH-Wavenet-A",
      female_2: "fil-PH-Wavenet-B",
      female_3: "fil-PH-Wavenet-A",
      female_4: "fil-PH-Wavenet-B",
      male_1: "fil-PH-Wavenet-C",
      male_2: "fil-PH-Wavenet-D",
      male_3: "fil-PH-Wavenet-C",
      male_4: "fil-PH-Wavenet-D",
    },
  },
  // No male voice exists at all for these 4 — every slot resolves to the
  // single available female voice.
  af: {
    tier: "override",
    locale: "af-ZA",
    voices: {
      female_1: "af-ZA-Standard-A",
      female_2: "af-ZA-Standard-A",
      female_3: "af-ZA-Standard-A",
      female_4: "af-ZA-Standard-A",
      male_1: "af-ZA-Standard-A",
      male_2: "af-ZA-Standard-A",
      male_3: "af-ZA-Standard-A",
      male_4: "af-ZA-Standard-A",
    },
  },
  ca: {
    tier: "override",
    locale: "ca-ES",
    voices: {
      female_1: "ca-ES-Standard-B",
      female_2: "ca-ES-Standard-B",
      female_3: "ca-ES-Standard-B",
      female_4: "ca-ES-Standard-B",
      male_1: "ca-ES-Standard-B",
      male_2: "ca-ES-Standard-B",
      male_3: "ca-ES-Standard-B",
      male_4: "ca-ES-Standard-B",
    },
  },
  eu: {
    tier: "override",
    locale: "eu-ES",
    voices: {
      female_1: "eu-ES-Standard-B",
      female_2: "eu-ES-Standard-B",
      female_3: "eu-ES-Standard-B",
      female_4: "eu-ES-Standard-B",
      male_1: "eu-ES-Standard-B",
      male_2: "eu-ES-Standard-B",
      male_3: "eu-ES-Standard-B",
      male_4: "eu-ES-Standard-B",
    },
  },
  is: {
    tier: "override",
    locale: "is-IS",
    voices: {
      female_1: "is-IS-Standard-B",
      female_2: "is-IS-Standard-B",
      female_3: "is-IS-Standard-B",
      female_4: "is-IS-Standard-B",
      male_1: "is-IS-Standard-B",
      male_2: "is-IS-Standard-B",
      male_3: "is-IS-Standard-B",
      male_4: "is-IS-Standard-B",
    },
  },
};

// 3 languages with no Google Cloud TTS voice at all.
const ELEVENLABS_ONLY_LANGUAGES = new Set(["fa", "zu", "ga"]);

export const LANGUAGE_CONFIG = { ...CHIRP3HD_LANGUAGES, ...OVERRIDE_LANGUAGES };

// Defensive fallback for older app builds that only send the language NAME
// (e.g. "Chinese") instead of the new targetLanguageCode. Mirrors the labels
// in the mobile app's src/utils/languages.js LANGUAGES array.
const NAME_TO_CODE = {
  english: "en", spanish: "es", french: "fr", german: "de", italian: "it",
  portuguese: "pt", russian: "ru", ukrainian: "uk", dutch: "nl", polish: "pl",
  swedish: "sv", norwegian: "no", danish: "da", finnish: "fi", greek: "el",
  turkish: "tr", czech: "cs", hungarian: "hu", romanian: "ro", bulgarian: "bg",
  arabic: "ar", hebrew: "he", persian: "fa", hindi: "hi", punjabi: "pa",
  bengali: "bn", gujarati: "gu", marathi: "mr", tamil: "ta", telugu: "te",
  kannada: "kn", malayalam: "ml", urdu: "ur", chinese: "zh", japanese: "ja",
  korean: "ko", vietnamese: "vi", thai: "th", indonesian: "id", malay: "ms",
  filipino: "tl", swahili: "sw", amharic: "am", zulu: "zu", afrikaans: "af",
  catalan: "ca", basque: "eu", irish: "ga", icelandic: "is", serbian: "sr",
};

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Inverse of NAME_TO_CODE — used by the voice-preview endpoint, which only
// receives a language CODE from the mobile app and needs a language NAME to
// pass to the GPT translation prompt.
export const CODE_TO_NAME = Object.fromEntries(
  Object.entries(NAME_TO_CODE).map(([name, code]) => [code, capitalize(name)])
);

export function resolveLanguageCode(targetLanguageCode, targetLanguageName) {
  if (targetLanguageCode && (LANGUAGE_CONFIG[targetLanguageCode] || ELEVENLABS_ONLY_LANGUAGES.has(targetLanguageCode))) {
    return targetLanguageCode;
  }
  const normalizedName = (targetLanguageName || "").trim().toLowerCase();
  return NAME_TO_CODE[normalizedName] || "en";
}

/**
 * Resolves a (languageCode, voiceId) pair to either a Google Cloud TTS
 * locale+voice name, or a signal to use the ElevenLabs fallback.
 */
export function resolveVoice(targetLanguageCode, targetLanguageName, voiceId) {
  const code = resolveLanguageCode(targetLanguageCode, targetLanguageName);
  const normalizedVoiceId = normalizeVoiceId(voiceId);

  if (ELEVENLABS_ONLY_LANGUAGES.has(code)) {
    // ElevenLabs (the fallback provider here) only knows "female"/"male" —
    // translate our 8-value id down to its gender, so a user's male/female
    // preference still carries over even on this narrow fallback path.
    const elevenLabsVoiceId = normalizedVoiceId.startsWith("female") ? "female" : "male";
    return { provider: "elevenlabs", languageCode: code, voiceId: elevenLabsVoiceId };
  }

  const config = LANGUAGE_CONFIG[code] || LANGUAGE_CONFIG.en;

  if (config.tier === "chirp3hd") {
    const persona = VOICE_PERSONAS[normalizedVoiceId];
    return {
      provider: "google",
      locale: config.locale,
      voiceName: `${config.locale}-Chirp3-HD-${persona}`,
    };
  }

  // "override" tier
  return {
    provider: "google",
    locale: config.locale,
    voiceName: config.voices[normalizedVoiceId],
  };
}
