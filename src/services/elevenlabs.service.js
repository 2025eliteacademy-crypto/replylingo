import axios from "axios";
import "dotenv/config";
import { resolveElevenLabsVoiceId } from "../config/voices.js";
import { withAiLog } from "./aiCallLogger.js";

/**
 * @param {string} text
 * @param {string} [voiceId] - the app-level voice id ("female" | "male"),
 *   NOT a raw ElevenLabs id. Falls back to the default voice if omitted
 *   or unrecognized.
 */
export const generateSpeech = async (text, voiceId) => {
  const elevenLabsVoiceId = resolveElevenLabsVoiceId(voiceId);

  try {
    const response = await withAiLog("elevenlabs", "speech", () => axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        text,
        model_id: "eleven_multilingual_v2",
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
      }
    ));

    return Buffer.from(response.data);
  } catch (error) {
    if (error.response?.data) {
      console.error(
        "ElevenLabs Error:",
        Buffer.from(error.response.data).toString("utf8")
      );
    } else {
      console.error("ElevenLabs Error:", error.message);
    }

    throw new Error("Failed to generate speech.");
  }
};