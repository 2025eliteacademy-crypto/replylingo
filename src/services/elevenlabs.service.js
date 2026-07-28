import axios from "axios";
import "dotenv/config";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
// const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
// console.log("VOICE_ID:", VOICE_ID);

export const generateSpeech = async (text) => {
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
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
    );

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