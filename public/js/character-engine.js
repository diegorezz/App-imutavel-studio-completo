/**
 * MOTOR CINEMATOGRÁFICO 2.5D E ÁUDIO ORGÂNICO — IMUTÁVEL STUDIO (V5)
 *
 * Melhorias V5:
 *  1. Voz Neural Masculina de Filósofo (PT-BR) com desbloqueio imediato de áudio para iOS/Android
 *     e garantia de timbre masculino (nunca cai em voz robótica feminina no celular).
 *  2. Correção definitiva do alinhamento de textos no Canvas em iOS Safari / Android (zero emojis
 *     dentro de fillText e centralização matemática por measureText).
 *  3. Remodelagem completa do Personagem e da Animação baseada fielmente nas fotos reais da Serra
 *     (traje branco com dobras de tecido, chapéu com pano branco de nuca esvoaçando ao vento,
 *     mochila preta com isolante térmico azul no topo, luvas longas de proteção, cajado longo de
 *     madeira avermelhada, poses contemplativas em perfil 3/4 e caminhada orgânica na trilha).
 */

class ImutavelAudioEngine {
  constructor() {
    this.ctx = null;
    this.dest = null;
    this.masterGain = null;
    this.voiceGain = null;
    this.activeNodes = [];
    this.chordInterval = null;
    this.crackleInterval = null;
    this.currentVoiceSource = null;
    this.htmlAudioEl = null;
    this.isPlaying = false;
    this.currentPreset = "mountain_wind_432";
    this.voiceProfile = "philosopher_deep";
    this.ttsCache = new Map();
    this.ttsBlobCache = new Map();
    this.unlocked = false;

    this.bindMobileAudioUnlock();
  }

  bindMobileAudioUnlock() {
    const unlock = () => {
      this.unlockMobileAudio();
    };
    window.addEventListener("touchstart", unlock, { passive: true, once: true });
    window.addEventListener("click", unlock, { passive: true, once: true });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.dest = this.ctx.createMediaStreamDestination();

      // Canal de ambiência da natureza
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.13;
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.dest);

      // Canal de Voz Neural Pura
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;

      this.warmthFilter = this.ctx.createBiquadFilter();
      this.warmthFilter.type = "lowshelf";
      this.warmthFilter.frequency.value = 150;
      this.warmthFilter.gain.value = 2.0;

      this.warmthFilter.connect(this.voiceGain);
      this.voiceGain.connect(this.ctx.destination);
      this.voiceGain.connect(this.dest);
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Desbloqueia o AudioContext sincronamente no toque do usuário em celulares (iOS Safari / Android)
   */
  unlockMobileAudio() {
    try {
      this.init();
      if (this.ctx && !this.unlocked) {
        const silentBuf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.ctx.destination);
        src.start(0);
        this.unlocked = true;
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  getAudioStream() {
    this.init();
    return this.dest.stream;
  }

  stopVoice() {
    if (this.currentVoiceSource) {
      try {
        this.currentVoiceSource.onended = null;
        this.currentVoiceSource.stop();
        this.currentVoiceSource.disconnect();
      } catch (e) {}
      this.currentVoiceSource = null;
    }
    if (this.htmlAudioEl) {
      try {
        this.htmlAudioEl.pause();
        this.htmlAudioEl.currentTime = 0;
      } catch (e) {}
      this.htmlAudioEl = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  async prepareSceneAudio(text, voiceProfile = "philosopher_deep") {
    this.init();
    const cleanText = (text || "").replace(/[""]/g, "").trim();
    if (!cleanText) return { buffer: null, duration: 5.5 };

    const cacheKey = `${voiceProfile}:${cleanText}`;
    if (this.ttsCache.has(cacheKey)) {
      const buf = this.ttsCache.get(cacheKey);
      return { buffer: buf, duration: buf.duration };
    }

    try {
      const resp = await fetch(
        `/api/tts?voice=${encodeURIComponent(voiceProfile)}&text=${encodeURIComponent(cleanText)}`
      );
      if (!resp.ok) throw new Error("TTS HTTP " + resp.status);
      const arrayBuf = await resp.arrayBuffer();
      if (arrayBuf.byteLength < 200) throw new Error("Empty audio");

      // Salva também um Blob URL para reprodução mobile direta se necessário
      const blob = new Blob([arrayBuf], { type: "audio/mpeg" });
      this.ttsBlobCache.set(cacheKey, URL.createObjectURL(blob));

      const audioBuffer = await new Promise((resolve, reject) => {
        this.ctx.decodeAudioData(
          arrayBuf.slice(0),
          (decoded) => resolve(decoded),
          (err) => reject(err)
        );
      });

      this.ttsCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, duration: audioBuffer.duration };
    } catch (e) {
      const estimated = Math.max(4.8, cleanText.length / 13.5);
      return { buffer: null, duration: estimated };
    }
  }

  async speakPhilosopher(text, voiceProfile = "philosopher_deep", onComplete = null) {
    this.stopVoice();
    this.unlockMobileAudio();
    this.voiceProfile = voiceProfile;

    const cleanText = (text || "").replace(/[""]/g, "").trim();
    const cacheKey = `${voiceProfile}:${cleanText}`;
    const { buffer, duration } = await this.prepareSceneAudio(cleanText, voiceProfile);

    if (buffer && this.ctx) {
      this.stopVoice();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume().catch(() => {});
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1.0;
      source.connect(this.warmthFilter);
      this.currentVoiceSource = source;
      source.onended = () => {
        if (this.currentVoiceSource === source) {
          this.currentVoiceSource = null;
          if (onComplete) onComplete();
        }
      };
      source.start(0);
      return { duration: buffer.duration };
    }

    // Fallback secundário com Blob MP3 da API Neural (caso decodeAudioData falhe em algum WebKit antigo)
    if (this.ttsBlobCache.has(cacheKey)) {
      const audio = new Audio(this.ttsBlobCache.get(cacheKey));
      this.htmlAudioEl = audio;
      audio.onended = () => {
        if (onComplete) onComplete();
      };
      audio.play().catch(() => {});
      return { duration };
    }

    return { duration };
  }

  startAmbient(preset = "mountain_wind_432") {
    this.stopAmbient();
    this.unlockMobileAudio();
    this.currentPreset = preset;
    this.isPlaying = true;

    if (preset === "none" || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Ruído Rosa de Brisa da Serra
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.038;
      b6 = white * 0.115926;
    }

    const pinkNoise = this.ctx.createBufferSource();
    pinkNoise.buffer = noiseBuffer;
    pinkNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.setValueAtTime(210, now);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 85;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.32, now);

    pinkNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);

    pinkNoise.start();
    lfo.start();
    this.activeNodes.push(pinkNoise, lfo);

    // 2. Estalar Orgânico de Fogueira
    if (preset === "campfire_night") {
      this.crackleInterval = setInterval(() => {
        if (!this.isPlaying || !this.ctx) return;
        if (Math.random() > 0.45) {
          this.triggerFireCrackle();
        }
      }, 280);
    }

    // 3. Notas Acústicas Meditativas Espaçadas
    const scales = {
      mountain_wind_432: [220, 261.63, 293.66, 329.63, 392.0, 440],
      campfire_night: [196.0, 220, 261.63, 293.66, 329.63],
      harmonic_528: [261.63, 293.66, 329.63, 392.0, 528.0],
      deep_theta_396: [174.61, 196.0, 220.0, 261.63, 293.66]
    };
    const notes = scales[preset] || scales.mountain_wind_432;
    let noteIdx = 0;

    const playGentleNote = () => {
      if (!this.isPlaying || !this.ctx) return;
      const t = this.ctx.currentTime;
      const freq = notes[noteIdx % notes.length];
      noteIdx++;

      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(freq * 0.5, t);

      noteGain.gain.setValueAtTime(0.001, t);
      noteGain.gain.linearRampToValueAtTime(0.085, t + 0.8);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, t + 4.2);

      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(460, t);

      osc.connect(lp);
      subOsc.connect(lp);
      lp.connect(noteGain);
      noteGain.connect(this.masterGain);

      osc.start(t);
      subOsc.start(t);
      osc.stop(t + 4.3);
      subOsc.stop(t + 4.3);
    };

    playGentleNote();
    this.chordInterval = setInterval(playGentleNote, 4300);
  }

  triggerFireCrackle() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800 + Math.random() * 1400, t);
    g.gain.setValueAtTime(0.038 * Math.random(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  stopAmbient() {
    this.isPlaying = false;
    if (this.chordInterval) {
      clearInterval(this.chordInterval);
      this.chordInterval = null;
    }
    if (this.crackleInterval) {
      clearInterval(this.crackleInterval);
      this.crackleInterval = null;
    }
    this.activeNodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }
}

class ImutavelCanvasEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.formats = {
      reels: { width: 1080, height: 1920, label: "Instagram Reels (9:16)" },
      stories: { width: 1080, height: 1920, label: "Instagram Stories (9:16)" },
      feed_portrait: { width: 1080, height: 1350, label: "Instagram Feed (4:5)" },
      feed_square: { width: 1080, height: 1080, label: "Instagram Feed (1:1)" }
    };

    this.currentFormat = "reels";
    this.environment = "mountain_dawn";
    this.pose = "standing_staff";
    this.headgear = "hat";
    this.sacredOverlay = "ocidemnte_seal";
    this.cameraMotion = "pan_right_zoom_in";
    this.cameraZoom = 1.05;

    this.sceneTag = "I • O MISTÉRIO DA VIDA";
    this.subtitleText =
      "Por que descemos à matéria e caminhamos pelas provas deste mundo? A Lei de Encarnação revela o propósito sagrado da nossa existência.";
    this.themeBadge = "Lei de Encarnação • Sabedoria das Leis Universais";
    this.sceneProgress = 0;
    this.totalProgress = 0;
    this.sceneIndex = 0;
    this.totalScenes = 8;

    this.blinkTimer = 0;
    this.time = 0;
    this.transitionAlpha = 0;
    this.lastSceneIndex = 0;

    this.initNaturalWorld();
    this.setFormat("reels");
  }

  initNaturalWorld() {
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      const colors = ["#ffffff", "#ffe9d2", "#d4e6ff", "#fff4c2"];
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.54,
        r: Math.random() * 2.0 + 0.4,
        color: colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 2.2
      });
    }

    this.embers = [];
    for (let i = 0; i < 60; i++) {
      this.embers.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 3.0 + 0.8,
        vx: (Math.random() - 0.35) * 0.0008,
        vy: -Math.random() * 0.0017 - 0.0005,
        alpha: Math.random() * 0.75 + 0.25,
        phase: Math.random() * Math.PI * 2
      });
    }

    this.birds = [];
    for (let i = 0; i < 5; i++) {
      this.birds.push({
        x: Math.random(),
        y: 0.14 + Math.random() * 0.20,
        speed: 0.014 + Math.random() * 0.012,
        wingPhase: Math.random() * Math.PI * 2,
        scale: 0.55 + Math.random() * 0.6
      });
    }

    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: (i / 8) * 1.4 - 0.2,
        y: 0.36 + (i % 4) * 0.065,
        w: 0.35 + (i % 3) * 0.14,
        h: 0.045 + (i % 2) * 0.025,
        speed: 0.004 + (i % 3) * 0.0025,
        alpha: 0.16 + (i % 3) * 0.08
      });
    }

    // Pedrinhas brancas de quartzo da serra (fiéis às fotos ref_montanha_1 e ref_montanha_4)
    this.quartzPebbles = [];
    for (let i = 0; i < 95; i++) {
      this.quartzPebbles.push({
        x: (i / 95) * 1.2 - 0.1 + (Math.random() - 0.5) * 0.02,
        yOffset: Math.random() * 145 + 6,
        rx: 4 + Math.random() * 9,
        ry: 2.5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        shade: 0.75 + Math.random() * 0.25
      });
    }

    // Tufos de vegetação rupestre e capim dourado da serra
    this.grassTufts = [];
    for (let i = 0; i < 36; i++) {
      this.grassTufts.push({
        x: (i / 36) * 1.16 - 0.08,
        h: 18 + (i % 5) * 8,
        blades: 4 + (i % 4),
        phase: i * 0.7
      });
    }

    // Cordilheiras rochosas estratificadas da Chapada/Serra
    this.mountainRidges = [
      this.generateFacetedRidge(14, 0.39, 0.12, 11),
      this.generateFacetedRidge(16, 0.48, 0.11, 29),
      this.generateFacetedRidge(18, 0.57, 0.09, 47)
    ];
  }

  generateFacetedRidge(segments, baseY, amp, seed) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const n1 = Math.sin(t * Math.PI * 3.2 + seed) * amp * 0.55;
      const n2 = Math.cos(t * Math.PI * 6.5 + seed * 1.7) * amp * 0.30;
      const n3 = Math.sin(t * Math.PI * 11.0 + seed * 2.3) * amp * 0.15;
      const y = baseY - Math.abs(n1 + n2) + n3;
      pts.push({
        x: t,
        y,
        ridgeXOffset: (Math.sin(i * 4.1 + seed) * 0.03)
      });
    }
    return pts;
  }

  setFormat(formatKey) {
    if (!this.formats[formatKey]) formatKey = "reels";
    this.currentFormat = formatKey;
    const spec = this.formats[formatKey];
    this.canvas.width = spec.width;
    this.canvas.height = spec.height;
  }

  updateConfig(cfg = {}) {
    if (cfg.format && cfg.format !== this.currentFormat) {
      this.setFormat(cfg.format);
    }
    if (cfg.environment) this.environment = cfg.environment;
    if (cfg.pose) this.pose = cfg.pose;
    if (cfg.headgear) this.headgear = cfg.headgear;
    if (cfg.sacredOverlay !== undefined) this.sacredOverlay = cfg.sacredOverlay;
    if (cfg.cameraMotion) this.cameraMotion = cfg.cameraMotion;
    if (cfg.cameraZoom) this.cameraZoom = cfg.cameraZoom;
    if (cfg.sceneTag !== undefined) this.sceneTag = cfg.sceneTag;
    if (cfg.subtitleText !== undefined) this.subtitleText = cfg.subtitleText;
    if (cfg.themeBadge !== undefined) this.themeBadge = cfg.themeBadge;
    if (cfg.sceneProgress !== undefined) this.sceneProgress = cfg.sceneProgress;
    if (cfg.totalProgress !== undefined) this.totalProgress = cfg.totalProgress;
    if (cfg.sceneIndex !== undefined) {
      if (cfg.sceneIndex !== this.lastSceneIndex) {
        this.transitionAlpha = 0.42;
        this.lastSceneIndex = cfg.sceneIndex;
      }
      this.sceneIndex = cfg.sceneIndex;
    }
    if (cfg.totalScenes !== undefined) this.totalScenes = cfg.totalScenes;
  }

  getCameraTransform(W, H) {
    const p = this.sceneProgress || 0;
    const smoothP = p * p * (3 - 2 * p);
    let scale = this.cameraZoom || 1.05;
    let tx = 0;
    let ty = 0;

    switch (this.cameraMotion) {
      case "pan_right_zoom_in":
        scale = 1.02 + smoothP * 0.08;
        tx = -W * 0.02 + smoothP * (W * 0.04);
        break;
      case "pan_left_wide":
        scale = 1.05 - smoothP * 0.03;
        tx = W * 0.025 - smoothP * (W * 0.05);
        break;
      case "slow_push_in":
        scale = 1.0 + smoothP * 0.10;
        ty = -H * 0.015 * smoothP;
        break;
      case "slow_pull_out":
        scale = 1.11 - smoothP * 0.09;
        ty = -H * 0.015 * (1 - smoothP);
        break;
      case "dramatic_rise":
        scale = 1.04 + smoothP * 0.06;
        ty = H * 0.025 - smoothP * (H * 0.05);
        break;
      case "close_contemplation":
        scale = 1.10 + Math.sin(smoothP * Math.PI) * 0.05;
        ty = -H * 0.025;
        break;
      case "orbit_center":
        scale = 1.04 + Math.sin(smoothP * Math.PI) * 0.04;
        tx = Math.cos(smoothP * Math.PI) * (W * 0.02);
        break;
      default:
        scale = 1.03 + smoothP * 0.04;
    }

    return { scale, tx, ty };
  }

  render(dt = 0.016) {
    this.time += dt;
    this.blinkTimer += dt;
    if (this.transitionAlpha > 0) {
      this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 1.4);
    }

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 1. Transformação Cinematográfica de Câmera
    const cam = this.getCameraTransform(W, H);
    ctx.save();
    ctx.translate(W / 2 + cam.tx, H / 2 + cam.ty);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-W / 2, -H / 2);

    // 2. Céu Atmosférico, Astros e Cordilheiras Rochosas
    this.drawEnvironment(ctx, W, H);

    // 3. Geometria Sagrada Sutil no Horizonte
    if (this.sacredOverlay && this.sacredOverlay !== "none") {
      this.drawSacredGeometry(ctx, W, H);
    }

    // 4. Pássaros na Serra
    this.drawMountainBirds(ctx, W, H);

    // 5. Fogueira Viva (quando aplicável)
    const hasCampfire =
      this.environment === "night_campfire" || this.pose === "campfire_circle";
    if (hasCampfire) {
      this.drawCampfire(ctx, W * 0.30, H * 0.675, W, H);
    }

    // 6. Personagem Remodelado (Ilustração Cinematográfica 3/4 & Perfil Fiel à Referência)
    this.drawCharacterV5(ctx, W, H, hasCampfire);

    // 7. Vegetação Rupestre e Fagulhas no Primeiro Plano
    this.drawForegroundNatureAndEmbers(ctx, W, H);

    ctx.restore();

    // 8. Vinheta Cinematográfica Suave
    this.drawCinematicVignette(ctx, W, H);

    // 9. Crossfade entre cenas
    if (this.transitionAlpha > 0.01) {
      ctx.fillStyle = `rgba(8, 12, 22, ${this.transitionAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 10. HUD e Legendas em Português-BR (100% Centralizadas em Mobile iOS/Android)
    this.drawVideoHUDAndCaptions(ctx, W, H);

    ctx.restore();
  }

  drawCinematicVignette(ctx, W, H) {
    const vig = ctx.createRadialGradient(
      W / 2,
      H * 0.45,
      W * 0.32,
      W / 2,
      H * 0.5,
      H * 0.78
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(4, 7, 14, 0.52)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawEnvironment(ctx, W, H) {
    const palettes = {
      mountain_dawn: {
        skyTop: "#0b1528",
        skyUpperMid: "#1e3557",
        skyLowerMid: "#4d5e78",
        skyHorizon: "#e8a568",
        sunColor: "rgba(255, 225, 155, 0.95)",
        sunGlow: "rgba(255, 175, 95, 0.36)",
        sunY: 0.41,
        m1Dark: "#1a283d",
        m1Light: "#384d69",
        m2Dark: "#142030",
        m2Light: "#293c54",
        m3Dark: "#0e1724",
        m3Light: "#1d2c40",
        groundTop: "#272320",
        groundBot: "#0d0c0b",
        mistColor: "rgba(245, 200, 155, 0.16)",
        starsAlpha: 0.25,
        isNight: false
      },
      summit_sunset: {
        skyTop: "#120c24",
        skyUpperMid: "#361942",
        skyLowerMid: "#80324a",
        skyHorizon: "#f59042",
        sunColor: "rgba(255, 205, 120, 0.95)",
        sunGlow: "rgba(255, 115, 55, 0.42)",
        sunY: 0.44,
        m1Dark: "#24132e",
        m1Light: "#4f274a",
        m2Dark: "#1a0e24",
        m2Light: "#381c38",
        m3Dark: "#11091a",
        m3Light: "#241329",
        groundTop: "#24181b",
        groundBot: "#0a0708",
        mistColor: "rgba(250, 150, 105, 0.16)",
        starsAlpha: 0.35,
        isNight: false
      },
      night_campfire: {
        skyTop: "#03060c",
        skyUpperMid: "#07101f",
        skyLowerMid: "#0e1e36",
        skyHorizon: "#182c47",
        sunColor: "rgba(220, 235, 255, 0.9)",
        sunGlow: "rgba(140, 185, 255, 0.16)",
        sunY: 0.20,
        m1Dark: "#09111f",
        m1Light: "#14243d",
        m2Dark: "#070d18",
        m2Light: "#101c30",
        m3Dark: "#050911",
        m3Light: "#0b1424",
        groundTop: "#1a1715",
        groundBot: "#070606",
        mistColor: "rgba(120, 165, 230, 0.09)",
        starsAlpha: 0.95,
        isNight: true
      },
      misty_stones: {
        skyTop: "#16222f",
        skyUpperMid: "#293d4f",
        skyLowerMid: "#496478",
        skyHorizon: "#93a8b8",
        sunColor: "rgba(240, 248, 255, 0.75)",
        sunGlow: "rgba(200, 225, 245, 0.28)",
        sunY: 0.35,
        m1Dark: "#22313f",
        m1Light: "#3b5266",
        m2Dark: "#192633",
        m2Light: "#2e4254",
        m3Dark: "#121c26",
        m3Light: "#213140",
        groundTop: "#24292e",
        groundBot: "#0d1013",
        mistColor: "rgba(220, 235, 248, 0.28)",
        starsAlpha: 0.08,
        isNight: false
      },
      sacred_temple: {
        skyTop: "#070b17",
        skyUpperMid: "#131d38",
        skyLowerMid: "#23345c",
        skyHorizon: "#876c52",
        sunColor: "rgba(255, 225, 155, 0.85)",
        sunGlow: "rgba(234, 197, 118, 0.30)",
        sunY: 0.37,
        m1Dark: "#121b30",
        m1Light: "#28395c",
        m2Dark: "#0c1324",
        m2Light: "#1d2b47",
        m3Dark: "#080d1a",
        m3Light: "#141f36",
        groundTop: "#1f1c24",
        groundBot: "#09080c",
        mistColor: "rgba(234, 197, 118, 0.14)",
        starsAlpha: 0.80,
        isNight: true
      }
    };

    const pal = palettes[this.environment] || palettes.mountain_dawn;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.68);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(0.35, pal.skyUpperMid);
    skyGrad.addColorStop(0.7, pal.skyLowerMid);
    skyGrad.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (pal.starsAlpha > 0.3) {
      ctx.save();
      ctx.translate(W * 0.5, H * 0.22);
      ctx.rotate(-0.35);
      const mwGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, W * 0.55);
      mwGrad.addColorStop(0, `rgba(190, 210, 255, ${0.12 * pal.starsAlpha})`);
      mwGrad.addColorStop(0.5, `rgba(140, 170, 235, ${0.05 * pal.starsAlpha})`);
      mwGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = mwGrad;
      ctx.scale(1.8, 0.42);
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (pal.starsAlpha > 0) {
      this.stars.forEach((st) => {
        const twinkle =
          0.35 + 0.65 * Math.sin(this.time * st.speed + st.phase);
        ctx.fillStyle = st.color;
        ctx.globalAlpha = pal.starsAlpha * twinkle;
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
    }

    const sunX = pal.isNight ? W * 0.78 : W * 0.50;
    const sunY = H * pal.sunY;

    if (pal.isNight) {
      const moonGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, W * 0.22);
      moonGlow.addColorStop(0, "rgba(210, 230, 255, 0.32)");
      moonGlow.addColorStop(1, "rgba(210, 230, 255, 0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, W * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#eef6ff";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.skyUpperMid;
      ctx.beginPath();
      ctx.arc(sunX - 13, sunY - 8, 31, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const halo = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, W * 0.52);
      halo.addColorStop(0, pal.sunColor);
      halo.addColorStop(0.25, pal.sunGlow);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, W * 0.52, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(sunX, sunY);
      for (let r = 0; r < 10; r++) {
        const angle = (r / 10) * Math.PI * 2 + this.time * 0.025;
        ctx.save();
        ctx.rotate(angle);
        const rayG = ctx.createLinearGradient(0, 0, W * 0.55, 0);
        rayG.addColorStop(0, "rgba(255, 235, 185, 0.11)");
        rayG.addColorStop(1, "rgba(255, 235, 185, 0)");
        ctx.fillStyle = rayG;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(W * 0.55, -55);
        ctx.lineTo(W * 0.55, 55);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    const walkShift = this.pose === "walking_trail" ? this.time * 0.015 : 0;

    this.drawRealisticMountainRange(
      ctx,
      W,
      H,
      this.mountainRidges[0],
      pal.m1Dark,
      pal.m1Light,
      sunX,
      walkShift * 0.2
    );
    this.drawValleyMistLayer(ctx, W, H, 0.44, pal.mistColor, 1.0);

    this.drawRealisticMountainRange(
      ctx,
      W,
      H,
      this.mountainRidges[1],
      pal.m2Dark,
      pal.m2Light,
      sunX,
      walkShift * 0.45
    );
    this.drawValleyMistLayer(ctx, W, H, 0.53, pal.mistColor, 1.3);

    this.drawRealisticMountainRange(
      ctx,
      W,
      H,
      this.mountainRidges[2],
      pal.m3Dark,
      pal.m3Light,
      sunX,
      walkShift * 0.8
    );

    this.drawDistantPineForest(ctx, W, H, H * 0.64, pal.m3Dark, walkShift);
    this.drawRockyMountainPlateau(ctx, W, H, pal, walkShift);
  }

  drawRealisticMountainRange(ctx, W, H, pts, darkColor, lightColor, lightX, scrollOffset) {
    const baseY = H * 0.70;

    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < pts.length; i++) {
      const px = i * (W / (pts.length - 1));
      const py = pts[i].y * H;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * (W / (pts.length - 1));
      const y1 = pts[i].y * H;
      const x2 = (i + 1) * (W / (pts.length - 1));
      const y2 = pts[i + 1].y * H;

      const isPeak = y1 < y2;
      const ridgeBottomX = (x1 + x2) * 0.5 + pts[i].ridgeXOffset * W;

      ctx.fillStyle = isPeak ? darkColor : lightColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(ridgeBottomX, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawValleyMistLayer(ctx, W, H, yFactor, mistColor, speedMult) {
    ctx.save();
    this.clouds.forEach((c, idx) => {
      const cx = ((c.x + this.time * c.speed * speedMult) % 1.5) - 0.25;
      const cy = (yFactor + (idx % 3) * 0.025) * H;
      const cw = c.w * W;
      const ch = c.h * H;

      const grad = ctx.createRadialGradient(cx * W, cy, ch * 0.1, cx * W, cy, cw * 0.6);
      grad.addColorStop(0, mistColor);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx * W, cy, cw * 0.6, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawDistantPineForest(ctx, W, H, horizonY, treeColor, walkShift) {
    ctx.save();
    ctx.fillStyle = treeColor;
    const treeCount = 34;
    for (let i = 0; i < treeCount; i++) {
      const rawX = ((i / treeCount) - (walkShift * 0.5) % 1 + 1) % 1;
      const tx = rawX * W;
      const th = 22 + ((i * 17) % 24);
      const tw = th * 0.42;
      const ty = horizonY + ((i * 13) % 16);

      for (let layer = 0; layer < 3; layer++) {
        const ly = ty - layer * (th * 0.28);
        const lw = tw * (1 - layer * 0.22);
        ctx.beginPath();
        ctx.moveTo(tx, ly - th * 0.45);
        ctx.lineTo(tx - lw, ly);
        ctx.lineTo(tx + lw, ly);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Platô rochoso da Serra com mureta de pedras e cascalho de quartzo branco (fiel a ref_montanha_1 e ref_montanha_4)
   */
  drawRockyMountainPlateau(ctx, W, H, pal, walkShift) {
    const floorY = H * 0.665;

    const gGrad = ctx.createLinearGradient(0, floorY, 0, H);
    gGrad.addColorStop(0, pal.groundTop);
    gGrad.addColorStop(1, pal.groundBot);

    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, floorY + 14);
    ctx.quadraticCurveTo(W * 0.30, floorY - 12, W * 0.62, floorY + 4);
    ctx.quadraticCurveTo(W * 0.85, floorY + 14, W, floorY - 4);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Grande afloramento rochoso de quartzito da Chapada/Serra ao fundo do platô (como em ref_montanha_4.jpg)
    ctx.save();
    const scrollPx = this.pose === "walking_trail" ? (walkShift * W * 1.6) % W : 0;
    const boulderGrad = ctx.createLinearGradient(0, floorY - 95, 0, floorY + 25);
    boulderGrad.addColorStop(0, pal.isNight ? "#1c2430" : "#4a433f");
    boulderGrad.addColorStop(1, pal.isNight ? "#0d1118" : "#262220");
    ctx.fillStyle = boulderGrad;
    ctx.beginPath();
    ctx.moveTo(W * 0.36 - scrollPx * 0.25, floorY + 12);
    ctx.lineTo(W * 0.41 - scrollPx * 0.25, floorY - 62);
    ctx.lineTo(W * 0.55 - scrollPx * 0.25, floorY - 78);
    ctx.lineTo(W * 0.72 - scrollPx * 0.25, floorY - 64);
    ctx.lineTo(W * 0.81 - scrollPx * 0.25, floorY + 14);
    ctx.closePath();
    ctx.fill();

    // Mureta rústica de pedras empilhadas da montanha
    const wallStones = 11;
    for (let s = 0; s < wallStones; s++) {
      const sx = W * 0.22 + s * (W * 0.058) - (scrollPx * 0.35 % 60);
      const sy = floorY + 8 + (s % 2) * 5;
      ctx.fillStyle = s % 2 === 0
        ? (pal.isNight ? "#1a202c" : "#524b46")
        : (pal.isNight ? "#141923" : "#3d3733");
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.8;
      this.roundRect(ctx, sx, sy - 18, 56, 24, 8, true, true);
    }

    // Pedrinhas brancas de quartzo espalhadas no solo da serra (marca registrada das fotos de referência!)
    const isFire = this.environment === "night_campfire" || this.pose === "campfire_circle";
    this.quartzPebbles.forEach((p) => {
      let px = p.x * W - (this.pose === "walking_trail" ? (this.time * 95) % W : 0);
      if (px < -20) px += W + 40;
      const py = floorY + 16 + p.yOffset;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      if (isFire && px < W * 0.58 && py < floorY + 120) {
        // Reflexo alaranjado da fogueira nas pedras de quartzo branco
        ctx.fillStyle = `rgba(235, 185, 145, ${0.42 * p.shade})`;
      } else if (pal.isNight) {
        ctx.fillStyle = `rgba(165, 180, 205, ${0.32 * p.shade})`;
      } else {
        ctx.fillStyle = `rgba(225, 222, 215, ${0.48 * p.shade})`;
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  drawSacredGeometry(ctx, W, H) {
    const cx = W * 0.5;
    const cy = H * 0.26;
    const r = Math.min(W, H) * 0.14;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.time * 0.05);
    ctx.strokeStyle = "rgba(234, 197, 118, 0.16)";
    ctx.lineWidth = 1.6;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    if (this.sacredOverlay === "ocidemnte_seal") {
      for (let t = 0; t < 2; t++) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const ang = (i * 2 * Math.PI) / 3 - Math.PI / 2 + t * Math.PI;
          const x = Math.cos(ang) * r * 0.82;
          const y = Math.sin(ang) * r * 0.82;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (this.sacredOverlay === "tatwas_5") {
      for (let i = 0; i < 5; i++) {
        const ang = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * r * 0.48, Math.sin(ang) * r * 0.48, r * 0.16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawCampfire(ctx, x, y, W, H) {
    ctx.save();

    const groundGlow = ctx.createRadialGradient(x, y + 10, 8, x, y + 10, 290);
    groundGlow.addColorStop(0, "rgba(255, 130, 30, 0.52)");
    groundGlow.addColorStop(0.45, "rgba(255, 80, 15, 0.20)");
    groundGlow.addColorStop(1, "rgba(255, 50, 0, 0)");
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 290, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fumaça azulada subindo na noite da montanha (fiel a ref_montanha_1.jpg)
    for (let s = 0; s < 5; s++) {
      const smokeProgress = ((this.time * 0.32 + s * 0.2) % 1);
      const sy = y - 65 - smokeProgress * 220;
      const sx = x + Math.sin(this.time * 1.4 + s) * (16 + smokeProgress * 32);
      const sr = 20 + smokeProgress * 55;
      const sa = (1 - smokeProgress) * 0.14;
      const sGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
      sGrad.addColorStop(0, `rgba(145, 175, 220, ${sa})`);
      sGrad.addColorStop(1, "rgba(145, 175, 220, 0)");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Toras de lenha e brasas vivas
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#29160c";
    ctx.lineCap = "round";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-55, 12);
    ctx.lineTo(48, -8);
    ctx.moveTo(52, 14);
    ctx.lineTo(-46, -8);
    ctx.stroke();

    const emberPulse = 0.7 + 0.3 * Math.sin(this.time * 7.5);
    ctx.fillStyle = `rgba(255, 95, 15, ${emberPulse})`;
    ctx.beginPath();
    ctx.ellipse(0, 6, 40, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const flameLayers = [
      { color: "rgba(255, 65, 10, 0.85)", w: 46, h: 108, speed: 6.5, phase: 0 },
      { color: "rgba(255, 135, 20, 0.90)", w: 35, h: 88, speed: 8.2, phase: 1.4 },
      { color: "rgba(255, 205, 55, 0.92)", w: 23, h: 66, speed: 10.4, phase: 2.7 },
      { color: "rgba(255, 248, 200, 0.95)", w: 12, h: 42, speed: 12.0, phase: 4.1 }
    ];

    flameLayers.forEach((fl) => {
      const sway1 = Math.sin(this.time * fl.speed + fl.phase) * 14;
      const sway2 = Math.cos(this.time * (fl.speed * 0.8) + fl.phase) * 9;
      const fh = fl.h + Math.sin(this.time * fl.speed * 1.3) * 12;

      ctx.fillStyle = fl.color;
      ctx.beginPath();
      ctx.moveTo(-fl.w, 6);
      ctx.bezierCurveTo(
        -fl.w * 0.8 + sway2,
        -fh * 0.4,
        sway1 - fl.w * 0.2,
        -fh * 0.75,
        sway1 * 0.7,
        -fh
      );
      ctx.bezierCurveTo(
        sway1 + fl.w * 0.2,
        -fh * 0.75,
        fl.w * 0.8 + sway2,
        -fh * 0.4,
        fl.w,
        6
      );
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // Círculo de pedras da fogueira (fiel a ref_montanha_4.jpg)
    const stones = [
      { dx: -64, dy: 12, rx: 19, ry: 12 },
      { dx: -40, dy: 20, rx: 21, ry: 13 },
      { dx: -12, dy: 24, rx: 23, ry: 14 },
      { dx: 18, dy: 23, rx: 22, ry: 13 },
      { dx: 46, dy: 19, rx: 20, ry: 12 },
      { dx: 66, dy: 11, rx: 18, ry: 11 }
    ];
    stones.forEach((st) => {
      const sGrad = ctx.createRadialGradient(
        x + st.dx * 0.7,
        y + st.dy - 6,
        2,
        x + st.dx,
        y + st.dy,
        st.rx
      );
      sGrad.addColorStop(0, "#75462d");
      sGrad.addColorStop(1, "#211815");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.ellipse(x + st.dx, y + st.dy, st.rx, st.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /* =========================================================================
   * 6. PERSONAGEM REMODELADO V5 (ILUSTRAÇÃO CINEMATOGRÁFICA FIEL ÀS FOTOS REAIS)
   * ========================================================================= */
  drawCharacterV5(ctx, W, H, hasCampfire) {
    const isSquare = this.currentFormat === "feed_square";
    const scale = isSquare ? 0.88 : 1.05;

    let charX = W * 0.52;
    if (hasCampfire) {
      charX = W * 0.64;
    } else if (this.pose === "walking_trail") {
      charX = W * 0.48 + Math.sin(this.time * 0.8) * 14;
    }

    const groundY = H * 0.678;
    const isSitting =
      this.pose === "seated_thinker" ||
      this.pose === "seated_staff" ||
      this.pose === "campfire_circle";

    const breathe = Math.sin(this.time * 2.1) * 2.5;
    const wind = Math.sin(this.time * 2.8) * 6 + Math.cos(this.time * 4.3) * 2.5;
    const isBlinking = this.blinkTimer % 4.6 > 4.44;
    if (this.blinkTimer > 4.6) this.blinkTimer = 0;

    // Direção do olhar: nas cenas de fogueira ou seated_thinker olha para a esquerda (-1), nas demais olha para a esquerda/horizonte (-1) ou direita (1)
    const facing = hasCampfire ? -1 : this.pose === "walking_trail" ? -1 : -1;

    ctx.save();
    ctx.translate(charX, groundY);
    ctx.scale(scale, scale);

    // Sombra projetada realista no solo de pedras
    ctx.fillStyle = "rgba(4, 7, 12, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 8, isSitting ? 95 : 75, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pedra de assento da montanha nas poses sentadas (fiel a ref_whatsapp_2 e ref_whatsapp_3)
    if (isSitting) {
      const rockGrad = ctx.createLinearGradient(-85, -95, 85, 12);
      rockGrad.addColorStop(0, hasCampfire ? "#4d3629" : "#4b4946");
      rockGrad.addColorStop(0.5, "#33312e");
      rockGrad.addColorStop(1, "#1a1918");
      ctx.fillStyle = rockGrad;
      ctx.strokeStyle = "#141312";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-88, 8);
      ctx.lineTo(-76, -68);
      ctx.quadraticCurveTo(-20, -84, 52, -72);
      ctx.lineTo(84, -36);
      ctx.lineTo(92, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Textura de líquen/musgo da serra na pedra
      ctx.fillStyle = "rgba(120, 145, 115, 0.25)";
      ctx.beginPath();
      ctx.ellipse(-25, -55, 24, 8, -0.2, 0, Math.PI * 2);
      ctx.ellipse(35, -42, 18, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.scale(facing, 1);

    // Neste sistema de coordenadas (facing = -1 espelha horizontalmente):
    // +X aponta para a FRENTE do personagem (direção do olhar)!
    // -X aponta para as COSTAS do personagem (onde fica a mochila)!

    const hipY = isSitting ? -82 : -158;
    const walkCycle = this.pose === "walking_trail" ? this.time * 4.4 : 0;
    const walkBob = this.pose === "walking_trail" ? Math.abs(Math.sin(walkCycle)) * 7 : 0;
    const torsoY = hipY - 122 - walkBob + breathe;

    // 1. MOCHILA DE EXPEDIÇÃO PRETA COM ISOLANTE TÉRMICO AZUL NO TOPO (Fiel a ref_whatsapp_1.jpeg)
    this.drawExpeditionBackpack(ctx, -28, torsoY + 8, isSitting);

    // 2. PERNAS COM CALÇA BRANCA FOLGADA DE MONTANHA E BOTAS DE TRILHA
    if (isSitting) {
      this.drawSeatedLegsV5(ctx, hipY, hasCampfire);
    } else if (this.pose === "walking_trail") {
      this.drawWalkingLegsV5(ctx, hipY - walkBob, walkCycle, hasCampfire);
    } else {
      this.drawStandingLegsV5(ctx, hipY, hasCampfire);
    }

    // 3. BRAÇO TRASEIRO (Esquerdo na perspectiva 3/4)
    if (this.pose === "seated_thinker") {
      // Mão apoiada no joelho (como em ref_whatsapp_2.jpeg)
      this.drawSculptedArm(ctx, 18, torsoY + 26, 48, torsoY + 82, 68, hipY + 12, false, hasCampfire);
    } else if (this.pose === "raising_staff") {
      this.drawSculptedArm(ctx, 16, torsoY + 24, 58, torsoY - 15, 86, torsoY - 58, true, hasCampfire);
      this.drawNaturalWoodStaff(ctx, 88, torsoY - 185, 82, 8, true);
    } else if (this.pose === "teaching_gesture") {
      const gestureWave = Math.sin(this.time * 2.4) * 6;
      this.drawSculptedArm(ctx, 18, torsoY + 24, 56, torsoY + 42, 88, torsoY + 10 + gestureWave, true, hasCampfire);
    } else {
      // Braço da frente segurando o longo cajado de madeira avermelhada (fiel a ref_whatsapp_1.jpeg)
      const staffSwing = this.pose === "walking_trail" ? Math.sin(walkCycle) * 16 : 0;
      const handX = 76 + staffSwing * 0.6;
      const handY = torsoY + 62 + Math.abs(staffSwing) * 0.2;
      this.drawNaturalWoodStaff(
        ctx,
        handX + 4,
        torsoY - 115,
        handX - 6 + staffSwing * 0.5,
        8,
        false
      );
      this.drawSculptedArm(ctx, 16, torsoY + 24, 46, torsoY + 66, handX, handY, true, hasCampfire);
    }

    // 4. TRONCO: JAQUETA BRANCA DE MONTANHA COM DOBRAS E ALÇAS PRETAS DA MOCHILA (Fiel a ref_whatsapp_1.jpeg)
    this.drawSculptedTorsoV5(ctx, torsoY, hipY - walkBob, isSitting, hasCampfire);

    // 5. CABEÇA EM PERFIL 3/4 CONTEMPLATIVO + ÓCULOS + CHAPÉU COM PANO DE NUCA OU GORRO BRANCO
    const headTilt = this.pose === "seated_thinker" || this.pose === "seated_staff" ? 0.08 : -0.04;
    this.drawSculptedHeadV5(ctx, 6, torsoY - 26, headTilt, isBlinking, wind, hasCampfire);

    // 6. BRAÇO DO PRIMEIRO PLANO (Sobreposto ao tronco)
    if (this.pose === "seated_thinker") {
      // Pose clássica de ref_whatsapp_2.jpeg: cotovelo apoiado na perna e mão no queixo em reflexão!
      this.drawThinkingArmV5(ctx, -6, torsoY + 28, 38, torsoY + 96, 30, torsoY - 4, hasCampfire);
    } else if (this.pose === "seated_staff") {
      // Pose clássica de ref_whatsapp_3.jpeg: cajado longo inclinado na diagonal e mão próxima ao queixo
      this.drawNaturalWoodStaff(ctx, 56, torsoY - 110, 92, 8, false);
      this.drawThinkingArmV5(ctx, -8, torsoY + 28, 28, torsoY + 86, 44, torsoY + 8, hasCampfire);
    } else if (this.pose === "walking_trail") {
      const backSwing = -Math.sin(walkCycle) * 20;
      this.drawSculptedArm(
        ctx,
        -12,
        torsoY + 28,
        -18 + backSwing * 0.5,
        torsoY + 82,
        -4 + backSwing,
        torsoY + 132,
        true,
        hasCampfire
      );
    } else {
      // Braço relaxado com a luva longa de raspa (como em ref_whatsapp_1.jpeg)
      this.drawSculptedArm(
        ctx,
        -12,
        torsoY + 28,
        -16,
        torsoY + 84,
        -6,
        torsoY + 138,
        true,
        hasCampfire
      );
    }

    ctx.restore();
  }

  /**
   * Mochila de expedição preta com isolante térmico azul enrolado no topo e garrafa lateral (fiel a ref_whatsapp_1.jpeg)
   */
  drawExpeditionBackpack(ctx, x, y, isSitting) {
    ctx.save();
    ctx.translate(x, y);
    if (isSitting) ctx.rotate(-0.06);

    // Corpo principal da mochila preta
    const packGrad = ctx.createLinearGradient(-48, 0, 0, 115);
    packGrad.addColorStop(0, "#222730");
    packGrad.addColorStop(1, "#0f1217");
    ctx.fillStyle = packGrad;
    ctx.strokeStyle = "#090b0e";
    ctx.lineWidth = 2;
    this.roundRect(ctx, -46, 4, 48, 108, 14, true, true);

    // Bolso lateral com garrafa de água transparente
    ctx.fillStyle = "rgba(210, 235, 255, 0.35)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.4;
    this.roundRect(ctx, -38, 36, 16, 42, 6, true, true);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-33, 30, 6, 5);

    // Isolante térmico azul enrolado no topo da mochila (detalhe idêntico à foto ref_whatsapp_1.jpeg!)
    const matGrad = ctx.createLinearGradient(-50, -14, -10, 12);
    matGrad.addColorStop(0, "#60a5fa");
    matGrad.addColorStop(1, "#2563eb");
    ctx.fillStyle = matGrad;
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 1.8;
    this.roundRect(ctx, -48, -10, 42, 20, 9, true, true);

    // Espiral lateral do rolo azul
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(-12, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.arc(-12, 0, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Fita preta prendendo o isolante azul
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-32, -11, 6, 22);

    ctx.restore();
  }

  /**
   * Calça branca folgada de montanha com dobras anatômicas e botas de trekking
   */
  drawStandingLegsV5(ctx, hipY, hasCampfire) {
    // Perna de trás (direita na vista)
    this.drawBaggyPantLeg(ctx, 10, hipY, 22, hipY + 76, 20, -14, "#dce3ed", "#b0bccb", hasCampfire);
    this.drawTrekkingBootV5(ctx, 22, -6);

    // Perna da frente (esquerda na vista)
    this.drawBaggyPantLeg(ctx, -8, hipY, -4, hipY + 78, -8, -12, "#f5f8fc", "#c2cddb", hasCampfire);
    this.drawTrekkingBootV5(ctx, -6, -4);
  }

  drawWalkingLegsV5(ctx, hipY, cycle, hasCampfire) {
    const s1 = Math.sin(cycle);
    const c1 = Math.cos(cycle);

    const s2 = Math.sin(cycle + Math.PI);
    const c2 = Math.cos(cycle + Math.PI);

    // Perna 1 (Traseira)
    const k1x = 6 + s2 * 24;
    const k1y = hipY + 74 - Math.max(0, c2) * 12;
    const f1x = 4 + s2 * 36;
    const f1y = -12 - Math.max(0, c2) * 18;
    this.drawBaggyPantLeg(ctx, 4, hipY, k1x, k1y, f1x, f1y, "#dce3ed", "#b0bccb", hasCampfire);
    this.drawTrekkingBootV5(ctx, f1x + 2, f1y + 8);

    // Perna 2 (Dianteira)
    const k2x = 4 + s1 * 24;
    const k2y = hipY + 74 - Math.max(0, c1) * 12;
    const f2x = 2 + s1 * 36;
    const f2y = -12 - Math.max(0, c1) * 18;
    this.drawBaggyPantLeg(ctx, -4, hipY, k2x, k2y, f2x, f2y, "#f7f9fc", "#c2cddb", hasCampfire);
    this.drawTrekkingBootV5(ctx, f2x + 2, f2y + 8);
  }

  drawSeatedLegsV5(ctx, hipY, hasCampfire) {
    // Perna de trás dobrada sobre a rocha
    this.drawBaggyPantLeg(ctx, 8, hipY, 64, hipY + 10, 56, -16, "#dce3ed", "#b0bccb", hasCampfire);
    this.drawTrekkingBootV5(ctx, 58, -8);

    // Perna da frente dobrada naturalmente (fiel a ref_whatsapp_2.jpeg)
    this.drawBaggyPantLeg(ctx, -8, hipY + 4, 52, hipY + 16, 40, -12, "#f7f9fc", "#c2cddb", hasCampfire);
    this.drawTrekkingBootV5(ctx, 42, -4);
  }

  /**
   * Desenha uma perna de calça branca folgada de montanha com volume de tecido real e punho elástico no tornozelo
   */
  drawBaggyPantLeg(ctx, hx, hy, kx, ky, fx, fy, mainColor, shadowColor, hasCampfire) {
    ctx.save();
    const pantGrad = ctx.createLinearGradient(hx - 24, hy, fx + 28, fy);
    pantGrad.addColorStop(0, shadowColor);
    pantGrad.addColorStop(0.55, mainColor);
    pantGrad.addColorStop(1, hasCampfire ? "#ffe4c4" : "#ffffff");

    ctx.fillStyle = pantGrad;
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 1.8;

    // Polígono orgânico com curvas Bézier simulando o tecido folgado da calça branca
    ctx.beginPath();
    ctx.moveTo(hx - 20, hy);
    ctx.quadraticCurveTo(kx - 26, (hy + ky) * 0.5, kx - 20, ky);
    ctx.quadraticCurveTo(kx - 22, (ky + fy) * 0.55, fx - 13, fy);
    ctx.lineTo(fx + 14, fy);
    ctx.quadraticCurveTo(kx + 24, (ky + fy) * 0.55, kx + 20, ky);
    ctx.quadraticCurveTo(kx + 22, (hy + ky) * 0.5, hx + 20, hy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dobras sutis do tecido no joelho e tornozelo (fiel a ref_whatsapp_3.jpeg)
    ctx.strokeStyle = "rgba(145, 160, 180, 0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(kx - 10, ky - 4);
    ctx.quadraticCurveTo(kx, ky + 3, kx + 12, ky - 2);
    ctx.moveTo(fx - 11, fy - 5);
    ctx.quadraticCurveTo(fx, fy - 2, fx + 11, fy - 5);
    ctx.stroke();

    ctx.restore();
  }

  drawTrekkingBootV5(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#2b231d";
    ctx.strokeStyle = "#120e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(10, -12);
    ctx.quadraticCurveTo(26, -4, 28, 6);
    ctx.lineTo(28, 12);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solado tratorado escuro
    ctx.fillStyle = "#0f0d0c";
    ctx.fillRect(-16, 9, 44, 5);
    ctx.restore();
  }

  /**
   * Tronco esculpido com jaqueta branca de montanha, zíper frontal, dobras e fitas pretas da mochila (fiel a ref_whatsapp_1.jpeg)
   */
  drawSculptedTorsoV5(ctx, torsoY, hipY, isSitting, hasCampfire) {
    ctx.save();
    const h = hipY - torsoY;

    const jGrad = ctx.createLinearGradient(-34, torsoY, 38, hipY);
    jGrad.addColorStop(0, "#d5deeb");
    jGrad.addColorStop(0.5, "#f5f8fc");
    jGrad.addColorStop(1, hasCampfire ? "#ffdfb8" : "#ffffff");

    ctx.fillStyle = jGrad;
    ctx.strokeStyle = "#b8c4d4";
    ctx.lineWidth = 2;

    // Silhueta anatômica do anorak branco (com leve volume frontal do blusão preso pelo cinto da mochila, igual a ref_whatsapp_1.jpeg!)
    ctx.beginPath();
    ctx.moveTo(-24, torsoY + 6);
    ctx.quadraticCurveTo(0, torsoY - 4, 24, torsoY + 8);
    ctx.bezierCurveTo(36, torsoY + h * 0.35, 42, torsoY + h * 0.68, 28, hipY + 6);
    ctx.quadraticCurveTo(0, hipY + 14, -26, hipY + 6);
    ctx.bezierCurveTo(-32, torsoY + h * 0.65, -30, torsoY + h * 0.3, -24, torsoY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Capuz branco dobrado na gola / nuca (fiel a ref_whatsapp_2.jpeg)
    ctx.fillStyle = "#edf2f8";
    ctx.strokeStyle = "#b8c4d4";
    ctx.beginPath();
    ctx.moveTo(-28, torsoY + 12);
    ctx.quadraticCurveTo(-40, torsoY - 8, -14, torsoY - 8);
    ctx.lineTo(18, torsoY + 4);
    ctx.quadraticCurveTo(0, torsoY + 18, -28, torsoY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Alça preta de ombro, fita peitoral e cinto abdominal da mochila (idêntico a ref_whatsapp_1.jpeg!)
    ctx.strokeStyle = "#161920";
    ctx.lineWidth = 6.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Alça que desce do ombro até a cintura
    ctx.moveTo(-10, torsoY + 6);
    ctx.quadraticCurveTo(10, torsoY + h * 0.45, 4, hipY - 12);
    ctx.stroke();

    // Fita peitoral horizontal com fivela
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(4, torsoY + h * 0.36);
    ctx.lineTo(33, torsoY + h * 0.36);
    ctx.stroke();

    // Cinto abdominal preto na cintura
    ctx.fillStyle = "#14171d";
    this.roundRect(ctx, -27, hipY - 18, 56, 11, 4, true, false);

    // Dobras naturais do tecido branco
    ctx.strokeStyle = "rgba(155, 170, 190, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, torsoY + 12);
    ctx.lineTo(18, hipY - 18);
    ctx.moveTo(-6, torsoY + h * 0.52);
    ctx.quadraticCurveTo(12, torsoY + h * 0.62, 26, torsoY + h * 0.56);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Braço esculpido com manga de jaqueta branca e Luva Longa de Raspa com borda azul (fiel a ref_whatsapp_1.jpeg)
   */
  drawSculptedArm(ctx, sx, sy, ex, ey, hx, hy, hasLongGlove, hasCampfire) {
    ctx.save();

    // Manga superior e cotovelo com volume de tecido
    ctx.strokeStyle = "#b8c4d4";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.strokeStyle = "#f5f8fc";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    if (hasLongGlove) {
      // Luva longa de proteção até o meio do antebraço com Vivo Azul na borda (idêntico a ref_whatsapp_1.jpeg!)
      const mx = ex + (hx - ex) * 0.32;
      const my = ey + (hy - ey) * 0.32;

      ctx.strokeStyle = "#c4bfb4";
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      ctx.strokeStyle = "#e3dfd5";
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Borda azul da luva longa de raspa
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Mão enluvada segurando o cajado
      ctx.fillStyle = "#dcd7cc";
      ctx.strokeStyle = "#a8a296";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(hx, hy, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = "#d9a784";
      ctx.beginPath();
      ctx.arc(hx, hy, 9.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Braço de reflexão com a mão no queixo (fiel a ref_whatsapp_2.jpeg e ref_whatsapp_3.jpeg)
   */
  drawThinkingArmV5(ctx, sx, sy, ex, ey, hx, hy, hasCampfire) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#b8c4d4";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.strokeStyle = "#f7f9fc";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Mão pensativa tocando o queixo
    ctx.fillStyle = "#dfa985";
    ctx.strokeStyle = "#b58160";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Cabeça esculpida em Perfil 3/4 Contemplativo (fiel a ref_whatsapp_1.jpeg e ref_whatsapp_2.jpeg)
   */
  drawSculptedHeadV5(ctx, x, y, tilt, isBlinking, wind, hasCampfire) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Pescoço anatômico
    ctx.fillStyle = "#c9926e";
    this.roundRect(ctx, -10, 14, 20, 24, 6, true, false);

    // Rosto esculpido em 3/4 (com linha de nariz, maçã do rosto e queixo sereno)
    const faceGrad = ctx.createRadialGradient(8, -4, 4, 0, 0, 34);
    faceGrad.addColorStop(0, hasCampfire ? "#f7c297" : "#ecc09d");
    faceGrad.addColorStop(1, "#c48d68");
    ctx.fillStyle = faceGrad;
    ctx.strokeStyle = "#a67250";
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(-18, -22);
    ctx.quadraticCurveTo(14, -26, 22, -8);
    // Curva do nariz em perfil 3/4
    ctx.lineTo(27, 2);
    ctx.quadraticCurveTo(26, 6, 21, 7);
    // Lábios serenos e queixo firme
    ctx.lineTo(20, 18);
    ctx.quadraticCurveTo(16, 27, 2, 26);
    ctx.quadraticCurveTo(-16, 24, -20, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sobrancelha serena
    ctx.strokeStyle = "#2d221c";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(4, -9);
    ctx.quadraticCurveTo(12, -12, 19, -9);
    ctx.stroke();

    // Olho contemplativo voltado para o horizonte
    if (isBlinking) {
      ctx.strokeStyle = "#241b16";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, -3);
      ctx.lineTo(16, -3);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#1c1512";
      ctx.beginPath();
      ctx.ellipse(12, -3, 2.8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(13, -4, 1.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Semblante sereno (boca fechada, sem movimento labial)
    ctx.strokeStyle = "#8a543b";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.quadraticCurveTo(16, 15.5, 20, 14.5);
    ctx.stroke();

    // Óculos de armação escura em perspectiva 3/4 com reflexo azulado da montanha (fiel a ref_whatsapp_1.jpeg!)
    ctx.fillStyle = "rgba(185, 225, 255, 0.28)";
    ctx.strokeStyle = "#1a1e26";
    ctx.lineWidth = 2.2;
    this.roundRect(ctx, 4, -10, 16, 13, 3.5, true, true);
    this.roundRect(ctx, 21, -9, 7, 11, 2.5, true, true);
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(-10, -2);
    ctx.stroke();

    if (this.headgear === "hat") {
      // Pano branco protetor de nuca e pescoço caindo sob o chapéu e ondulando ao vento (idêntico a ref_whatsapp_1.jpeg!)
      const sway = wind * 0.9;
      ctx.fillStyle = "#f0f4fa";
      ctx.strokeStyle = "#bdcadb";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-24, -12);
      ctx.lineTo(8, -10);
      ctx.quadraticCurveTo(12 + sway * 0.4, 24, 4 + sway * 0.8, 54);
      ctx.quadraticCurveTo(-14 + sway, 62, -32 + sway, 46);
      ctx.quadraticCurveTo(-34 + sway * 0.5, 16, -24, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cordão preto do chapéu preso sob o queixo (fiel a ref_whatsapp_1.jpeg)
      ctx.strokeStyle = "#181b22";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-2, -8);
      ctx.quadraticCurveTo(2, 26, 12, 24);
      ctx.stroke();

      // Copa do chapéu branco de trilha
      ctx.fillStyle = "#f7f9fc";
      ctx.strokeStyle = "#c0ccd9";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-28, -14);
      ctx.quadraticCurveTo(-24, -42, 2, -40);
      ctx.quadraticCurveTo(24, -38, 26, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Aba orgânica curvada do chapéu branco de trilha
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-46, -10);
      ctx.quadraticCurveTo(-10, -22, 44, -8);
      ctx.quadraticCurveTo(12, -2, -46, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Gorro branco canelado de montanha (fiel a ref_whatsapp_2.jpeg!)
      ctx.fillStyle = "#f5f8fc";
      ctx.strokeStyle = "#c0ccd9";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-26, -6);
      ctx.quadraticCurveTo(-28, -42, 2, -40);
      ctx.quadraticCurveTo(26, -38, 25, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dobra canelada do gorro branco
      ctx.fillStyle = "#ffffff";
      this.roundRect(ctx, -28, -17, 54, 13, 6, true, true);
    }

    ctx.restore();
  }

  drawNaturalWoodStaff(ctx, topX, topY, bottomX, bottomY, hasSunBurst = false) {
    ctx.save();
    ctx.lineCap = "round";

    // Cajado longo de madeira avermelhada (fiel a ref_whatsapp_1.jpeg e ref_whatsapp_3.jpeg)
    ctx.strokeStyle = "#4a2512";
    ctx.lineWidth = 11.5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(bottomX, bottomY);
    ctx.stroke();

    ctx.strokeStyle = "#8c4a27";
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(bottomX, bottomY);
    ctx.stroke();

    if (hasSunBurst) {
      const glow = ctx.createRadialGradient(topX, topY, 2, topX, topY, 48);
      glow.addColorStop(0, "rgba(255, 238, 175, 0.80)");
      glow.addColorStop(1, "rgba(255, 238, 175, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(topX, topY, 48, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawForegroundNatureAndEmbers(ctx, W, H) {
    const floorY = H * 0.665;
    const isNight =
      this.environment === "night_campfire" || this.pose === "campfire_circle";

    ctx.save();
    ctx.strokeStyle = isNight ? "rgba(180, 130, 80, 0.45)" : "rgba(225, 195, 130, 0.55)";
    ctx.lineWidth = 2.2;
    this.grassTufts.forEach((g) => {
      let gx = g.x * W - (this.pose === "walking_trail" ? (this.time * 95) % W : 0);
      if (gx < -30) gx += W + 60;
      const gy = floorY + 14 + Math.sin(g.phase) * 16;
      const sway = Math.sin(this.time * 2.6 + g.phase) * 9;

      for (let b = 0; b < g.blades; b++) {
        const angleSpread = (b - g.blades / 2) * 5;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(
          gx + angleSpread + sway * 0.5,
          gy - g.h * 0.5,
          gx + angleSpread * 1.4 + sway,
          gy - g.h
        );
        ctx.stroke();
      }
    });
    ctx.restore();

    this.embers.forEach((p) => {
      p.x += p.vx + Math.sin(this.time * 1.2 + p.phase) * 0.0003;
      p.y += p.vy;
      if (p.y < 0.05) {
        p.y = isNight ? 0.68 : 0.92;
        p.x = isNight ? 0.20 + Math.random() * 0.25 : Math.random();
      }
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;

      ctx.fillStyle = isNight
        ? `rgba(255, 160, 55, ${p.alpha})`
        : `rgba(255, 242, 195, ${p.alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawMountainBirds(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = "rgba(18, 26, 38, 0.65)";
    ctx.lineWidth = 2.4;
    this.birds.forEach((b) => {
      b.x += b.speed * 0.0035;
      if (b.x > 1.1) b.x = -0.1;

      const bx = b.x * W;
      const by = b.y * H + Math.sin(this.time * 1.4 + b.wingPhase) * 10;
      const wingY = Math.sin(this.time * 5.8 + b.wingPhase) * 7 * b.scale;
      const span = 15 * b.scale;

      ctx.beginPath();
      ctx.moveTo(bx - span, by - wingY);
      ctx.quadraticCurveTo(bx - span * 0.4, by - 4, bx, by);
      ctx.quadraticCurveTo(bx + span * 0.4, by - 4, bx + span, by - wingY);
      ctx.stroke();
    });
    ctx.restore();
  }

  /**
   * Centraliza texto de forma 100% determinística em iOS Safari, Android e Desktop
   * (evitando o bug de WebKit onde emojis + textAlign="center" deslocam o texto para a direita!)
   */
  drawCenteredText(ctx, text, centerX, y, stroke = false) {
    const clean = (text || "").trim();
    ctx.textAlign = "left";
    const metrics = ctx.measureText(clean);
    const drawX = centerX - metrics.width / 2;
    if (stroke) {
      ctx.strokeText(clean, drawX, y);
    }
    ctx.fillText(clean, drawX, y);
  }

  drawVideoHUDAndCaptions(ctx, W, H) {
    const isStories = this.currentFormat === "stories";
    const isSquare = this.currentFormat === "feed_square";

    const barY = 26;
    const gap = 8;
    const totalBars = Math.max(1, this.totalScenes);
    const barW = (W - 90 - gap * (totalBars - 1)) / totalBars;

    for (let i = 0; i < totalBars; i++) {
      const bx = 45 + i * (barW + gap);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      this.roundRect(ctx, bx, barY, barW, 6, 3, true, false);

      let fillRatio = 0;
      if (i < this.sceneIndex) fillRatio = 1;
      else if (i === this.sceneIndex) fillRatio = this.sceneProgress;

      if (fillRatio > 0) {
        ctx.fillStyle = "#eac576";
        this.roundRect(ctx, bx, barY, barW * fillRatio, 6, 3, true, false);
      }
    }

    // Pílula Superior de Ato (Sem emoji para 100% de precisão no iOS Safari!)
    const topY = 50;
    ctx.save();
    ctx.fillStyle = "rgba(10, 15, 26, 0.82)";
    ctx.strokeStyle = "rgba(234, 197, 118, 0.72)";
    ctx.lineWidth = 2.2;
    const badgeW = Math.min(W - 70, 680);
    this.roundRect(ctx, (W - badgeW) / 2, topY, badgeW, 52, 26, true, true);

    ctx.fillStyle = "#ffe08a";
    ctx.font = "700 21px 'Cinzel', Georgia, serif";
    ctx.textBaseline = "middle";
    const cleanTag = (this.sceneTag || "").replace(/[^\w\sÀ-ÿ•\-IVX0-9]/g, "").trim();
    this.drawCenteredText(
      ctx,
      `◆ ${cleanTag.toUpperCase()} (${this.sceneIndex + 1}/${this.totalScenes}) ◆`,
      W / 2,
      topY + 27,
      false
    );
    ctx.restore();

    // Caixa Inferior de Legenda em Português-BR
    const bottomMargin = isStories ? 80 : isSquare ? 36 : 56;
    const boxW = W - 76;
    const boxX = 38;

    ctx.save();
    const fontSize = isSquare ? 33 : 37;
    const lineHeight = isSquare ? 45 : 50;
    ctx.font = `700 ${fontSize}px 'Inter', sans-serif`;

    const lines = this.wrapText(ctx, this.subtitleText, boxW - 68);
    const boxH = lines.length * lineHeight + 104;
    const boxY = H - bottomMargin - boxH;

    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(8, 12, 21, 0.92)";
    ctx.strokeStyle = "#eac576";
    ctx.lineWidth = 2.8;
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 22, true, true);
    ctx.shadowBlur = 0;

    // Pílula Dourada Superior da Legenda
    const pillW = 340;
    ctx.fillStyle = "#eac576";
    this.roundRect(ctx, (W - pillW) / 2, boxY - 17, pillW, 34, 17, true, false);
    ctx.fillStyle = "#090d16";
    ctx.font = "800 16px 'Inter', sans-serif";
    ctx.textBaseline = "middle";
    this.drawCenteredText(ctx, "◆ LEGENDA • PORTUGUÊS-BR ◆", W / 2, boxY, false);

    // Barra de progresso interna da fala
    const progW = (boxW - 60) * Math.min(1, Math.max(0.05, this.sceneProgress));
    ctx.fillStyle = "rgba(234, 197, 118, 0.22)";
    this.roundRect(ctx, boxX + 30, boxY + boxH - 22, boxW - 60, 6, 3, true, false);
    ctx.fillStyle = "#ffe08a";
    this.roundRect(ctx, boxX + 30, boxY + boxH - 22, progW, 6, 3, true, false);

    // Texto da Narração Centralizado
    ctx.font = `700 ${fontSize}px 'Inter', sans-serif`;
    ctx.textBaseline = "top";

    const activeLineIndex = Math.min(
      lines.length - 1,
      Math.floor(this.sceneProgress * lines.length)
    );

    lines.forEach((line, idx) => {
      const ly = boxY + 28 + idx * lineHeight;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 5;

      if (idx < activeLineIndex) {
        ctx.fillStyle = "#f1f5f9";
      } else if (idx === activeLineIndex) {
        ctx.fillStyle = "#ffe08a";
      } else {
        ctx.fillStyle = "#ffffff";
      }
      this.drawCenteredText(ctx, line, W / 2, ly, true);
    });

    // Rodapé do Tema dentro da caixa de legenda
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 19px 'Inter', sans-serif";
    const cleanTheme = (this.themeBadge || "").replace(/[^\w\sÀ-ÿ•\-(),:]/g, "").trim();
    this.drawCenteredText(ctx, `◆ ${cleanTheme}`, W / 2, boxY + boxH - 48, false);

    ctx.restore();
  }

  wrapText(ctx, text, maxWidth) {
    const words = (text || "").split(" ");
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? currentLine + " " + words[i] : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

window.ImutavelAudioEngine = ImutavelAudioEngine;
window.ImutavelCanvasEngine = ImutavelCanvasEngine;
