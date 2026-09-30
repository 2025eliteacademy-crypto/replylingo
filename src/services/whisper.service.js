import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { withAiLog } from "./aiCallLogger.js";

// Initialize lazily or ensure process.env.OPENAI_API_KEY is present
const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export const transcribeAudio = async (audioBuffer) => {
  try {
    const openai = getOpenAIClient();
    const file = await toFile(audioBuffer, "audio.m4a");

    const transcription = await withAiLog("whisper", "transcribe", () =>
      openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      })
    );

    return transcription.text;
  } catch (error) {
    console.error("Whisper Error:", error);
    throw new Error("Failed to transcribe audio.");
  }
};