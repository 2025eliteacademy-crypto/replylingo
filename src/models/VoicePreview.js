import mongoose from "mongoose";

// Permanent cache of generated Settings voice previews — one document per
// (language, voice). The sample sentence is fixed, so the audio never
// changes; generating it once (Google TTS, plus a GPT translation for
// non-English) and storing it here means no user ever triggers another
// paid call for the same preview, regardless of which serverless instance
// handles the request. To force regeneration (e.g. after changing the voice
// catalog), delete the affected documents.
const voicePreviewSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true, // `${languageCode}_${voiceId}`
    },
    audio: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("VoicePreview", voicePreviewSchema);
