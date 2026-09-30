import mongoose from "mongoose";

// One row per outbound AI provider call (Whisper, OpenAI chat, Google TTS,
// ElevenLabs). Written fire-and-forget from the service layer, read only by
// the admin AI-usage report. Never affects the translate pipeline.
const aiCallLogSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["whisper", "openai", "google_tts", "elevenlabs"],
      required: true,
    },
    operation: { type: String, default: null }, // transcribe | detect_language | translate | speech
    success: { type: Boolean, default: true },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiCallLogSchema.index({ createdAt: 1, provider: 1 });

export default mongoose.model("AiCallLog", aiCallLogSchema);
