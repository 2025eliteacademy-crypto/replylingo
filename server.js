import axios from "axios";
import "dotenv/config";

const res = await axios.get("https://api.elevenlabs.io/v1/voices", {
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
  },
});

console.log(
  res.data.voices.map(v => ({
    name: v.name,
    id: v.voice_id,
    category: v.category,
  }))
);