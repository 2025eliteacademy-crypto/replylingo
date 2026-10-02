// One-off: generates the 8 Settings voice-preview MP3s that ship inside the
// mobile app (ReplyLingo-Mobile/assets/voice-previews), so previewing a voice
// never touches the server again.
//
// Run from ReplyLingo_Backend:  node scripts/generate-voice-previews.js
// Needs GOOGLE_TTS_* in .env. Re-run only if a voice persona or the sample
// sentence changes (and then ship a new app build).
import fs from "node:fs/promises";
import path from "node:path";
import { VOICE_PERSONAS } from "../src/config/voiceCatalog.js";
import { generateTranslatedSpeech } from "../src/services/tts.service.js";

// Must match PREVIEW_SOURCE_TEXT in src/services/voicePreview.service.js.
const PREVIEW_TEXT = "Hello! This is a preview of my voice.";
const OUT_DIR = process.env.PREVIEW_OUT_DIR || "C:/rn/ReplyLingo-Mobile/assets/voice-previews";

await fs.mkdir(OUT_DIR, { recursive: true });

for (const voiceId of Object.keys(VOICE_PERSONAS)) {
  const audio = await generateTranslatedSpeech(PREVIEW_TEXT, "en", "English", voiceId);
  if (!audio || audio.length === 0) {
    console.error(`✗ ${voiceId}: no audio returned`);
    process.exitCode = 1;
    continue;
  }
  const file = path.join(OUT_DIR, `voice-preview-${voiceId}.mp3`);
  await fs.writeFile(file, audio);
  console.log(`✓ ${voiceId} (${VOICE_PERSONAS[voiceId]}) -> ${file} (${audio.length} bytes)`);
}

// AiCallLog writes are fire-and-forget; don't wait on a Mongo connection.
process.exit(process.exitCode ?? 0);
