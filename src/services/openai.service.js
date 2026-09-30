import OpenAI from "openai";
import { withAiLog } from "./aiCallLogger.js";

const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export const detectLanguage = async (text) => {
  const openai = getOpenAIClient();

  try {
    const response = await withAiLog("openai", "detect_language", () => openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Detect the language of the user's text. Return ONLY the ISO-639-1 language code (for example: en, hi, pa, es, fr, de, ja). No explanation.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0,
    }));

    return response.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error("Language Detection Error:", error);

    throw new Error("Failed to detect language.");
  }
};

export const translateText = async (
  text,
  sourceLanguage,
  targetLanguage,
  options = {}
) => {
  const openai = getOpenAIClient();

  try {
    const conciseInstruction = options.concise
      ? " Keep the translation brief and natural — trim filler, don't pad it out."
      : "";

    const response = await withAiLog("openai", "translate", () => openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Translate from ${sourceLanguage} to ${targetLanguage}. Return ONLY the translated text. Do not explain anything.${conciseInstruction}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.2,
    }));

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Translation Error:", error);

    throw new Error("Failed to translate text.");
  }
};