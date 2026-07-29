import { transcribeAudio } from "../services/whisper.service.js";
import {
  detectLanguage,
  translateText,
} from "../services/openai.service.js";
import { generateSpeech } from "../services/elevenlabs.service.js";
import User from "../models/User.js";
import { DEFAULT_VOICE_ID } from "../config/voices.js";

export const translateMessage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required.",
      });
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
    try {
      const user = await User.findOne({ uid: req.user.uid }).select("voiceId");
      if (user?.voiceId) voiceId = user.voiceId;
    } catch (voiceLookupError) {
      console.error("Voice preference lookup failed, using default:", voiceLookupError);
    }

    // 5. Generate Speech
    const audioBuffer = await generateSpeech(translatedText, voiceId);

    // 6. Increase usage count
    req.usage.translationsUsed += 1;
    await req.usage.save();

    return res.json({
      success: true,
      transcript,
      detectedLanguage,
      translatedText,
      audio: audioBuffer.toString("base64"),
      remainingFreeTranslations:
        req.usage.freeLimit - req.usage.translationsUsed,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Translation failed.",
    });
  }
};