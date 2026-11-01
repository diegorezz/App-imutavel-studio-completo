const http = require("http");
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
 * Perfis de Voz Neural Masculina Realista em Português-BR
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

const MALE_FALLBACK_VOICES = [
  "pt-BR-AntonioNeural",
  "pt-BR-DonatoNeural",
  "pt-BR-NicolauNeural",
  "pt-BR-FabioNeural",
  "pt-BR-HumbertoNeural",
  "pt-BR-ValerioNeural"
];

function formatPhilosophicalProsody(rawText) {
  return (rawText || "")
    .replace(/[""]/g, "")
    .replace(/\s*;\s*/g, "... ")
    .replace(/\s*:\s*/g, "... ")
    .replace(/\s*—\s*/g, ", ")
    .trim();
}

async function tryEdgeVoice(voiceName, text, rate = "-4%", pitch = "-2Hz") {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    voiceName,
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );
  const { audioStream } = tts.toStream(text, { rate, pitch });
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => reject(new Error("TTS Timeout")), 9000);
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function synthesizePhilosopherTTS(text, profileKey = "philosopher_deep") {
  const naturalText = formatPhilosophicalProsody(text);
  const cacheKey = `${profileKey}:${naturalText}`;
  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey);
  }

  const profile = VOICE_PROFILES[profileKey] || VOICE_PROFILES.philosopher_deep;

  // 1. Tenta a voz neural masculina principal escolhida
  try {
    const buffer = await tryEdgeVoice(
      profile.voiceName,
      naturalText,
      profile.rate,
      profile.pitch
    );
    if (buffer && buffer.length > 200) {
      ttsAudioCache.set(cacheKey, buffer);
      return buffer;
    }
  } catch (err) {
    console.warn("Tentando voz neural masculina reserva:", err.message);
  }

  // 2. Tenta as demais vozes neurais masculinas PT-BR (nunca cai em voz feminina)
  for (const fallbackVoice of MALE_FALLBACK_VOICES) {
    try {
      const buffer = await tryEdgeVoice(
        fallbackVoice,
        naturalText,
        "-4%",
        "-2Hz"
      );
      if (buffer && buffer.length > 200) {
        ttsAudioCache.set(cacheKey, buffer);
        return buffer;
      }
    } catch (e2) {}
  }

  throw new Error("Serviço de voz neural temporariamente indisponível");
}

async function requestHandler(req, res) {
  const host = req.headers.host || `localhost:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${host}`);
  const rawPathname = decodeURIComponent(parsedUrl.pathname);
  const cleanUrl = rawPathname.replace(/^\/public/, "") || "/";

  // Cabeçalhos CORS para garantir funcionamento em qualquer domínio mobile/Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (cleanUrl === "/api/health" || cleanUrl.endsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", app: "IMUTAVEL_STUDIO", version: "5.0.0" }));
    return;
  }

  if (
    cleanUrl === "/api/tts" ||
    cleanUrl === "/api/tts.js" ||
    cleanUrl.endsWith("/api/tts") ||
    cleanUrl.endsWith("/api/tts.js")
  ) {
    const text = (parsedUrl.searchParams.get("text") || "").trim();
    const voice = parsedUrl.searchParams.get("voice") || "philosopher_deep";

    if (!text) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
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
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("TTS Error: " + e.message);
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
}

// Exporta para Vercel Serverless (@vercel/node) e também escuta localmente se executado diretamente
module.exports = requestHandler;

if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`====================================================`);
    console.log(`⛰️  IMUTÁVEL STUDIO V5 RODANDO EM: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}
