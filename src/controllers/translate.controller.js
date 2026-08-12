import { transcribeAudio } from "../services/whisper.service.js";
import {
  detectLanguage,
  translateText,
} from "../services/openai.service.js";
import { generateSpeech } from "../services/elevenlabs.service.js";
import User from "../models/User.js";
import { DEFAULT_VOICE_ID } from "../config/voices.js";
import { parseBuffer } from "music-metadata";

// const MAX_AUDIO_SECONDS = 180; // 3 minutes, same cap for free and premium
const MAX_AUDIO_SECONDS = 10; // 3 minutes, same cap for free and premium

export const translateMessage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required.",
      });
    }

    // Reject oversized audio BEFORE calling Whisper/ElevenLabs (cost control)
    try {
      const metadata = await parseBuffer(
        req.file.buffer,
        req.file.mimetype,
        { duration: true }
      );
      const durationSeconds = metadata?.format?.duration ?? 0;

      console.log("Audio duration (s):", durationSeconds);

      if (durationSeconds > MAX_AUDIO_SECONDS) {
        return res.status(413).json({
          success: false,
          message: "Audio is too long. Please keep messages under 3 minutes.",
        });
      }
    } catch (durationError) {
      // If we genuinely can't read duration, log it but don't hard-fail the
      // request — fall back to a file-size sanity check instead.
      console.error("Could not read audio duration:", durationError.message);

      const MAX_BYTES = 8 * 1024 * 1024; // ~8MB safety net
      if (req.file.buffer.length > MAX_BYTES) {
        return res.status(413).json({
          success: false,
          message: "Audio file is too large.",
        });
      }
    }

    // 1. Speech -> Text
    const transcript = await transcribeAudio(req.file.buffer);

    // 2. Detect Language
    const detectedLanguage = await detectLanguage(transcript);

    const targetLanguage = req.body.targetLanguage || "English";

    // 3. Translate
    const translatedText = await translateText(
      transcript,
      detectedLanguage,
      targetLanguage
    );

    // 4. Look up the user's saved voice preference (falls back to default
    // if they haven't picked one, or if the doc lookup fails for any reason)
    let voiceId = DEFAULT_VOICE_ID;
    let isPremium = false;
    try {
      const user = await User.findOne({ uid: req.user.uid }).select("voiceId premium");
      if (user?.voiceId) voiceId = user.voiceId;
      isPremium = user?.premium ?? false;
    } catch (voiceLookupError) {
      console.error("Voice preference lookup failed, using default:", voiceLookupError);
    }

    console.log("VOICE USED:", voiceId);
    const audioBuffer = await generateSpeech(translatedText, voiceId);

    let remainingFreeTranslations = null;

    if (req.usage) {
      const usageCost = req.body.screen === "translate" ? 0.5 : 1;
      req.usage.usageCredits += usageCost;
      await req.usage.save();

      if (!isPremium) {
        remainingFreeTranslations = Math.max(
          0,
          req.usage.freeLimit - req.usage.usageCredits
        );
      }
    }

    return res.json({
      success: true,
      transcript,
      detectedLanguage,
      translatedText,
      audio: audioBuffer.toString("base64"),
      remainingFreeTranslations,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Translation failed.",
    });
  }
};