const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const PORT = process.env.PORT || 3333;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".zip": "application/zip"
};

const ttsAudioCache = new Map();

/**
 * Perfis de Voz Neural Realista em Português-BR
 * Prosódia natural e humana (sem distorção de pitch/formantes)
 */
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

/**
 * Prepara o texto com pontuação de respiração natural para leitura fluida e humana
 */
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
    console.warn("Tentando voz neural alternativa:", err.message);
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const cleanUrl = decodeURIComponent(parsedUrl.pathname);

  if (cleanUrl === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", app: "IMUTAVEL_STUDIO", version: "4.0.0" }));
    return;
  }

  if (cleanUrl === "/api/tts") {
    const text = (parsedUrl.searchParams.get("text") || "").trim();
    const voice = parsedUrl.searchParams.get("voice") || "philosopher_deep";

    if (!text) {
      res.writeHead(400);
      res.end("Missing text");
      return;
    }

    try {
      const mp3Buffer = await synthesizePhilosopherTTS(text, voice);
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": mp3Buffer.length,
        "Cache-Control": "public, max-age=86400"
      });
      res.end(mp3Buffer);
    } catch (e) {
      res.writeHead(500);
      res.end("TTS Error");
    }
    return;
  }

  // Bloqueio estrito: arquivos originais da base são exclusivos do Agente IA
  if (
    cleanUrl.startsWith("/private_agent_kb") ||
    cleanUrl.startsWith("/assets") ||
    cleanUrl.endsWith(".pdf") ||
    cleanUrl.endsWith(".m4a")
  ) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso restrito ao Agente IA interno.");
    return;
  }

  let filePath = path.join(PUBLIC_DIR, cleanUrl === "/" ? "index.html" : cleanUrl);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`⛰️  IMUTÁVEL STUDIO RODANDO EM: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
