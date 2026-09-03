import { transcribeAudio } from "../services/whisper.service.js";
import {
  detectLanguage,
  translateText,
} from "../services/openai.service.js";
import { generateSpeech } from "../services/elevenlabs.service.js";
import { getBrandingOutroBuffer } from "../services/brandingOutro.service.js";
import User from "../models/User.js";
import { DEFAULT_VOICE_ID } from "../config/voices.js";
import { parseBuffer } from "music-metadata";

// const MAX_AUDIO_SECONDS = 180; // 3 minutes, same cap for free and premium
const MAX_AUDIO_SECONDS = 60; // 1 minutes, same cap for free and premium

// Directional per-call AI cost estimate (Whisper transcription + GPT
// translation + ElevenLabs TTS combined), from the earlier business
// audit's ~$0.04/call figure. This is NOT wired up to real OpenAI/
// ElevenLabs billing — it's a rough constant for relative free-vs-premium
// cost comparison until real per-provider usage-based pricing is plugged
// in here (e.g. actual token counts * model price, actual audio seconds *
// ElevenLabs per-character/second rate).
const ESTIMATED_COST_PER_CALL_USD = 0.04;

export const translateMessage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required.",
      });
    }

    // Reject oversized audio BEFORE calling Whisper/ElevenLabs (cost control)
    let durationSeconds = 0;
    try {
      const metadata = await parseBuffer(
        req.file.buffer,
        req.file.mimetype,
        { duration: true }
      );
      durationSeconds = metadata?.format?.duration ?? 0;

      console.log("Audio duration (s):", durationSeconds);

      if (durationSeconds > MAX_AUDIO_SECONDS) {
        return res.status(413).json({
          success: false,
          message: "Audio is too long. Please keep messages under 2 minutes.",
errorCode: "AUDIO_TOO_LONG",
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
    let transcript;
    try {
      transcript = await transcribeAudio(req.file.buffer);
    } catch (err) {
      err.errorCode = err.errorCode || "WHISPER_ERROR";
      throw err;
    }

    const targetLanguage = req.body.targetLanguage || "English";

    // 2. Detect Language, 3. Translate — tagged together since both are the
    // same logical "translation" stage for analytics purposes.
    let detectedLanguage, translatedText;
    try {
      detectedLanguage = await detectLanguage(transcript);
      translatedText = await translateText(
        transcript,
        detectedLanguage,
        targetLanguage,
        { concise: durationSeconds > 60 }
      );
    } catch (err) {
      err.errorCode = err.errorCode || "TRANSLATION_ERROR";
      throw err;
    }

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
    let audioBuffer;
    try {
      audioBuffer = await generateSpeech(translatedText, voiceId);
    } catch (err) {
      err.errorCode = err.errorCode || "ELEVENLABS_ERROR";
      throw err;
    }

    // Spoken branding tag: appended only to the audio that's actually
    // destined to be shared back out (the reply leg — the client marks
    // this with `isReply`), and only for free-tier users. The inbound,
    // listen-only translation is never shared, so it's never branded —
    // and Pro users' audio is never touched. The original `audioBuffer`
    // is left untouched either way; a *new* buffer is built when branding
    // applies, matching the "never modify in place" requirement.
    const isReply = req.body.isReply === "true" || req.body.isReply === true;
    let finalAudioBuffer = audioBuffer;
    let branded = false;

    if (isReply && !isPremium) {
      try {
        const outroBuffer = await getBrandingOutroBuffer(targetLanguage);
        finalAudioBuffer = Buffer.concat([audioBuffer, outroBuffer]);
        branded = true;
      } catch (brandingError) {
        // Branding is a nice-to-have on top of the core translation —
        // never let it block the user from getting their translated reply.
        console.error("Failed to append branding outro, sharing unbranded audio:", brandingError);
        finalAudioBuffer = audioBuffer;
      }
    }

    let remainingFreeTranslations = null;

    if (req.usage) {
      const usageCost = req.body.screen === "translate" ? 0.5 : 1;
      req.usage.usageCredits += usageCost;
      req.usage.estimatedCostUsd = (req.usage.estimatedCostUsd || 0) + ESTIMATED_COST_PER_CALL_USD;
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
      audio: finalAudioBuffer.toString("base64"),
      branded,
      remainingFreeTranslations,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Translation failed.",
      errorCode: error.errorCode || "SERVER_ERROR",
    });
  }
};