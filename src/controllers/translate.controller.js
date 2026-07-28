
import { transcribeAudio } from "../services/whisper.service.js";
import {
  detectLanguage,
  translateText,
} from "../services/openai.service.js";
import { generateSpeech } from "../services/elevenlabs.service.js";

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

    const { targetLanguage } = req.body;

    // 3. Translate
    const translatedText = await translateText(
      transcript,
      detectedLanguage,
      targetLanguage
    );

    // 4. Generate Speech
    const audioBuffer = await generateSpeech(translatedText);

    // 5. Increase usage count
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