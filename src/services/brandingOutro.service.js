import { generateSpeech } from "./elevenlabs.service.js";
import { DEFAULT_VOICE_ID } from "../config/voices.js";

// The spoken branding tag appended to free-tier outbound replies (see
// translate.controller.js). The phrase never changes, so it's generated
// once via ElevenLabs and cached in memory for the life of the process —
// no reason to pay for/wait on a fresh TTS call per share. A fixed voice
// (rather than the sender's chosen voice) keeps it a consistent, recognizable
// "brand voice" independent of whichever voice the user picked.
//
// A leading "..." was tried to induce a pause but caused ElevenLabs to
// mis-articulate "Sent" as "Assent"/"Ascent" in ~50% of generations
// (confirmed via repeated Whisper-transcription testing). A leading "."
// gives the same pause without the artifact — 3/3 clean in testing.
const OUTRO_TEXT = ". Sent with ReplyLingo.";

let cachedOutroBuffer = null;
let pendingOutroPromise = null;

export async function getBrandingOutroBuffer() {
  if (cachedOutroBuffer) return cachedOutroBuffer;

  if (!pendingOutroPromise) {
    pendingOutroPromise = generateSpeech(OUTRO_TEXT, DEFAULT_VOICE_ID)
      .then((buffer) => {
        cachedOutroBuffer = buffer;
        return buffer;
      })
      .catch((err) => {
        // Don't poison the cache on a transient failure — the next call
        // (e.g. the next free-tier share) gets to retry from scratch.
        pendingOutroPromise = null;
        throw err;
      });
  }

  return pendingOutroPromise;
}
