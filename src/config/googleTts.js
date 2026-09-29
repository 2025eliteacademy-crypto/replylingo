import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import "dotenv/config";

// Mirrors src/config/firebase.js's pattern: individual env vars reconstructed
// into a credentials object at runtime, never a JSON file on disk. Required
// on Vercel serverless, where there's no reliable place to keep a credential
// file, and matches how this repo already handles the Firebase service account.
const projectId = process.env.GOOGLE_TTS_PROJECT_ID;
const clientEmail = process.env.GOOGLE_TTS_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_TTS_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "[GoogleTTS] Missing GOOGLE_TTS_PROJECT_ID / GOOGLE_TTS_CLIENT_EMAIL / GOOGLE_TTS_PRIVATE_KEY env vars."
  );
}

export const googleTtsClient = new TextToSpeechClient({
  projectId,
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
});
