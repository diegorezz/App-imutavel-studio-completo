const https = require("https");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const ttsAudioCache = new Map();

const VOICE_PROFILES = {
  philosopher_deep: {
    voiceName: "pt-BR-AntonioNeural",
    rate: "-4%",
    pitch: "-2Hz"
  },
  sage_serene: {
    voiceName: "pt-BR-DonatoNeural",
    rate: "-3%",
    pitch: "-1Hz"
  },
  master_solemn: {
    voiceName: "pt-BR-NicolauNeural",
    rate: "-5%",
    pitch: "-2Hz"
  }
};

function formatPhilosophicalProsody(rawText) {
  return (rawText || "")
    .replace(/[""]/g, "")
    .replace(/\s*;\s*/g, "... ")
    .replace(/\s*:\s*/g, "... ")
    .replace(/\s*—\s*/g, ", ")
    .trim();
}

async function synthesizePhilosopherTTS(text, profileKey = "philosopher_deep") {
  const naturalText = formatPhilosophicalProsody(text);
  const cacheKey = `${profileKey}:${naturalText}`;
  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey);
  }

  const profile = VOICE_PROFILES[profileKey] || VOICE_PROFILES.philosopher_deep;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      profile.voiceName,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(naturalText, {
      rate: profile.rate,
      pitch: profile.pitch
    });

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      audioStream.on("data", (c) => chunks.push(c));
      audioStream.on("end", () => resolve(Buffer.concat(chunks)));
      audioStream.on("error", reject);
    });

    if (buffer && buffer.length > 200) {
      ttsAudioCache.set(cacheKey, buffer);
      return buffer;
    }
  } catch (err) {
    try {
      const fallbackTts = new MsEdgeTTS();
      await fallbackTts.setMetadata(
        "pt-BR-AntonioNeural",
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
      );
      const { audioStream } = fallbackTts.toStream(naturalText);
      const buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        audioStream.on("data", (c) => chunks.push(c));
        audioStream.on("end", () => resolve(Buffer.concat(chunks)));
        audioStream.on("error", reject);
      });
      if (buffer && buffer.length > 200) {
        ttsAudioCache.set(cacheKey, buffer);
        return buffer;
      }
    } catch (e2) {}
  }

  return new Promise((resolve, reject) => {
    const gUrl =
      "https://translate.googleapis.com/translate_tts?ie=UTF-8&q=" +
      encodeURIComponent(naturalText.substring(0, 200)) +
      "&tl=pt-BR&client=tw-ob";
    https
      .get(gUrl, (gRes) => {
        const chunks = [];
        gRes.on("data", (d) => chunks.push(d));
        gRes.on("end", () => {
          const buf = Buffer.concat(chunks);
          ttsAudioCache.set(cacheKey, buf);
          resolve(buf);
        });
      })
      .on("error", reject);
  });
}

module.exports = async (req, res) => {
  const text = ((req.query && req.query.text) || "").trim();
  const voice = (req.query && req.query.voice) || "philosopher_deep";

  if (!text) {
    res.statusCode = 400;
    res.end("Missing text");
    return;
  }

  try {
    const mp3Buffer = await synthesizePhilosopherTTS(text, voice);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", mp3Buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.statusCode = 200;
    res.end(mp3Buffer);
  } catch (err) {
    res.statusCode = 500;
    res.end("TTS Error");
  }
};
