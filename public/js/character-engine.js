/**
 * MOTOR CINEMATOGRÁFICO 2.5D E ÁUDIO ORGÂNICO — IMUTÁVEL STUDIO (V4)
 * Aperfeiçoamentos baseados na análise do Projeto Teste e referência Reel:
 *  1. Voz 100% humana e natural (sem delay metálico, sem pitch-shift artificial) + medição automática da duração exata da fala.
 *  2. Fim do zumbido contínuo de oscilador: substituído por Vento Realista da Serra, Estalar Orgânico de Fogueira e Notas Acústicas Espaçadas com envelope ADSR suave.
 *  3. Cenários com realismo natural: Montanhas rochosas facetadas em 3D (faces de luz e sombra), Via Láctea, nuvens volumétricas, pinheiros de altitude, capim dourado ao vento e fogueira realista com brasas e iluminação de contorno (rim-light).
 *  4. Personagem com proporções anatômicas reais e enquadramentos cinematográficos (contemplação em 3/4 diante do abismo, caminhada lateral com parallax real do terreno e vigília iluminada pelo fogo).
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
    this.isPlaying = false;
    this.currentPreset = "mountain_wind_432";
    this.voiceProfile = "philosopher_deep";
    this.ttsCache = new Map();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.dest = this.ctx.createMediaStreamDestination();

      // Canal de ambiência da natureza (suave e orgânico)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.14;
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.dest);

      // Canal de Voz Neural Pura (SEM delay metálico e SEM alteração de pitch/velocidade)
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;

      // Apenas um leve filtro de calor acústico natural (2dB em 150Hz)
      this.warmthFilter = this.ctx.createBiquadFilter();
      this.warmthFilter.type = "lowshelf";
      this.warmthFilter.frequency.value = 150;
      this.warmthFilter.gain.value = 2.0;

      this.warmthFilter.connect(this.voiceGain);
      this.voiceGain.connect(this.ctx.destination);
      this.voiceGain.connect(this.dest);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
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
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Pré-carrega e decodifica o áudio neural da cena, retornando o AudioBuffer
   * e sua duração exata em segundos para que o Agente IA ajuste o tempo da cena automaticamente!
   */
  async prepareSceneAudio(text, voiceProfile = "philosopher_deep") {
    this.init();
    const cleanText = (text || "").replace(/[""]/g, "").trim();
    if (!cleanText) return { buffer: null, duration: 5.0 };

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
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuf);
      this.ttsCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, duration: audioBuffer.duration };
    } catch (e) {
      // Estimativa caso offline (~13 caracteres por segundo em leitura pausada)
      const estimated = Math.max(4.5, cleanText.length / 13.5);
      return { buffer: null, duration: estimated };
    }
  }

  /**
   * Reproduz a voz neural em velocidade 1.0 nativa (100% humana, sem robotização)
   */
  async speakPhilosopher(text, voiceProfile = "philosopher_deep", onComplete = null) {
    this.stopVoice();
    this.init();
    this.voiceProfile = voiceProfile;

    const { buffer } = await this.prepareSceneAudio(text, voiceProfile);

    if (buffer) {
      this.stopVoice();
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1.0; // Velocidade nativa 1.0 = zero distorção robótica!
      source.connect(this.warmthFilter);
      this.currentVoiceSource = source;
      source.onended = () => {
        if (this.currentVoiceSource === source) {
          this.currentVoiceSource = null;
          if (onComplete) onComplete();
        }
      };
      source.start(0);
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.rate = 0.94;
      utter.pitch = 0.95;
      utter.onend = () => {
        if (onComplete) onComplete();
      };
      window.speechSynthesis.speak(utter);
    }
  }

  /**
   * Paisagem Sonora Orgânica da Natureza (Vento Suave, Fogueira Realista e Notas Acústicas Espaçadas)
   */
  startAmbient(preset = "mountain_wind_432") {
    this.stopAmbient();
    this.init();
    this.currentPreset = preset;
    this.isPlaying = true;

    if (preset === "none") return;

    const now = this.ctx.currentTime;

    // 1. Gerador de Ruído Rosa (Pink Noise) para Vento Natural nas Árvores/Montanha
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
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const pinkNoise = this.ctx.createBufferSource();
    pinkNoise.buffer = noiseBuffer;
    pinkNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.setValueAtTime(220, now);

    // LFO lento para simular brisa suave soprando e acalmando
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14; // Ciclo de 7 segundos
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.35, now);

    pinkNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);

    pinkNoise.start();
    lfo.start();
    this.activeNodes.push(pinkNoise, lfo);

    // 2. Estalar Orgânico de Fogueira (se campfire_night)
    if (preset === "campfire_night") {
      this.crackleInterval = setInterval(() => {
        if (!this.isPlaying || !this.ctx) return;
        if (Math.random() > 0.45) {
          this.triggerFireCrackle();
        }
      }, 280);
    }

    // 3. Notas Acústicas / Harpa Meditativa Espaçada (com envelope ADSR suave, sem zumbido contínuo!)
    const scales = {
      mountain_wind_432: [220, 261.63, 293.66, 329.63, 392.00, 440], // Lá menor natural suave
      campfire_night: [196.00, 220, 261.63, 293.66, 329.63],
      harmonic_528: [261.63, 293.66, 329.63, 392.00, 528.00],
      deep_theta_396: [174.61, 196.00, 220.00, 261.63, 293.66]
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

      // Envelope de nota dedilhada / pad suave que desaparece naturalmente
      noteGain.gain.setValueAtTime(0.001, t);
      noteGain.gain.linearRampToValueAtTime(0.09, t + 0.8);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, t + 4.2);

      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(480, t);

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
    this.chordInterval = setInterval(playGentleNote, 4200);
  }

  triggerFireCrackle() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800 + Math.random() * 1400, t);
    g.gain.setValueAtTime(0.04 * Math.random(), t);
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
    // Estrelas realistas com tamanhos e temperaturas de cor variadas
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      const colors = ["#ffffff", "#ffe9d2", "#d4e6ff", "#fff4c2"];
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.56,
        r: Math.random() * 2.1 + 0.4,
        color: colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.5
      });
    }

    // Fagulhas da fogueira / pólen dourado da montanha
    this.embers = [];
    for (let i = 0; i < 65; i++) {
      this.embers.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 3.2 + 0.8,
        vx: (Math.random() - 0.35) * 0.0009,
        vy: -Math.random() * 0.0018 - 0.0005,
        alpha: Math.random() * 0.75 + 0.25,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Águias / falcões planando nos ventos térmicos do cânion
    this.birds = [];
    for (let i = 0; i < 6; i++) {
      this.birds.push({
        x: Math.random(),
        y: 0.14 + Math.random() * 0.22,
        speed: 0.015 + Math.random() * 0.014,
        wingPhase: Math.random() * Math.PI * 2,
        scale: 0.55 + Math.random() * 0.65
      });
    }

    // Nuvens volumétricas e neblina de vale
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: (i / 8) * 1.4 - 0.2,
        y: 0.36 + (i % 4) * 0.065,
        w: 0.38 + (i % 3) * 0.14,
        h: 0.045 + (i % 2) * 0.025,
        speed: (i % 2 === 0 ? 1 : -1) * (0.004 + (i % 3) * 0.002)
      });
    }

    // Tufo de capim dourado de altitude / vegetação rupestre da Chapada
    this.grassTufts = [];
    for (let i = 0; i < 28; i++) {
      this.grassTufts.push({
        x: (i / 28) * 1.3 - 0.15,
        h: 18 + (i % 5) * 7,
        blades: 4 + (i % 4),
        phase: i * 0.7
      });
    }

    // Geometria das Cordilheiras Rochosas Facetadas (pré-calculada para relevo 3D realista)
    this.mountainRidges = [
      this.generateFacetedRidge(22, 0.41, 0.095, 11),
      this.generateFacetedRidge(18, 0.49, 0.078, 27),
      this.generateFacetedRidge(15, 0.56, 0.058, 43)
    ];
  }

  generateFacetedRidge(segments, baseYRatio, ampRatio, seed) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const n1 = Math.sin(t * Math.PI * 3.5 + seed);
      const n2 = Math.cos(t * Math.PI * 7.2 - seed * 1.7) * 0.5;
      const n3 = Math.sin(t * Math.PI * 13.0 + seed * 0.4) * 0.22;
      const elevation = (n1 + n2 + n3) * ampRatio;
      pts.push({
        t,
        yRatio: baseYRatio - Math.abs(elevation),
        ridgeDrop: 0.04 + Math.abs(n2) * 0.06
      });
    }
    return pts;
  }

  setFormat(formatKey) {
    const spec = this.formats[formatKey] || this.formats.reels;
    this.currentFormat = formatKey;
    this.canvas.width = spec.width;
    this.canvas.height = spec.height;
  }

  updateConfig(cfg) {
    if (cfg.format && cfg.format !== this.currentFormat) this.setFormat(cfg.format);
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
        this.transitionAlpha = 0.65;
        this.lastSceneIndex = cfg.sceneIndex;
      }
      this.sceneIndex = cfg.sceneIndex;
    }
    if (cfg.totalScenes !== undefined) this.totalScenes = cfg.totalScenes;
  }

  getDynamicCameraTransform() {
    const p = this.sceneProgress;
    let zoom = 1.04;
    let panX = 0;
    let panY = 0;

    switch (this.cameraMotion) {
      case "pan_right_zoom_in":
        zoom = 1.02 + p * 0.09;
        panX = -28 + p * 56;
        panY = 8 - p * 16;
        break;
      case "pan_left_wide":
        zoom = 1.04 + Math.sin(p * Math.PI) * 0.04;
        panX = 34 - p * 68;
        break;
      case "dramatic_rise":
        zoom = 1.04 + p * 0.10;
        panY = 30 - p * 60;
        break;
      case "orbit_center":
        zoom = 1.06 + Math.sin(this.time * 0.6) * 0.03;
        panX = Math.sin(p * Math.PI * 2) * 24;
        panY = Math.cos(p * Math.PI * 2) * 12;
        break;
      case "close_contemplation":
        zoom = 1.12 + p * 0.08;
        panY = -22 - p * 18;
        break;
      case "slow_pull_out":
        zoom = 1.14 - p * 0.10;
        panY = -14 + p * 14;
        break;
      case "slow_push_in":
      default:
        zoom = 1.02 + p * 0.09;
        panY = 10 - p * 20;
        break;
    }
    return { zoom, panX, panY };
  }

  render(dt) {
    this.time += dt;
    if (this.transitionAlpha > 0) {
      this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 1.2);
    }

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    const cam = this.getDynamicCameraTransform();
    ctx.save();
    ctx.translate(W / 2 + cam.panX, H * 0.42 + cam.panY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2, -H * 0.42);

    // 1. Paisagem Natural Realista (Céu, Sol/Via Láctea, Cordilheiras 3D Facetadas, Pinheiros, Penhasco e Fogueira)
    this.drawRealisticNatureEnvironment(ctx, W, H);

    // 2. Halo Sagrado Atmosférico Sutil (Integrado à Natureza)
    this.drawAtmosphericSacredHalo(ctx, W, H);

    // 3. Personagem Ilustrado Cinematográfico (Proporções humanas reais e movimento fluido)
    this.drawCinematicMountainSage(ctx, W, H);

    // 4. Vegetação em primeiro plano, brasas da fogueira e neblina frontal
    this.drawForegroundNatureAndEmbers(ctx, W, H);

    ctx.restore();

    // Transição cinematográfica suave entre cenas
    if (this.transitionAlpha > 0.01) {
      ctx.fillStyle = `rgba(12, 18, 28, ${this.transitionAlpha * 0.65})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 5. HUD e Legenda em Português-BR
    this.drawVideoHUDAndCaptions(ctx, W, H);

    ctx.restore();
  }

  /**
   * CENÁRIOS NATURAIS REALISTAS:
   * Céu atmosférico, Via Láctea / Sol com dispersão de luz, Montanhas Facetadas 3D com faces de luz e sombra,
   * Pinheiros e árvores da serra, Mar de Nuvens e Fogueira Realista no acampamento.
   */
  drawRealisticNatureEnvironment(ctx, W, H) {
    const env = this.environment;
    const isWalking = this.pose === "walking_trail";
    const worldScroll = isWalking ? this.time * 42 : Math.sin(this.time * 0.25) * 14;

    // 1. CÉU ATMOSFÉRICO MULTICAMADAS
    const skyGrad = ctx.createLinearGradient(0, -80, 0, H * 0.72);
    if (env === "mountain_dawn") {
      skyGrad.addColorStop(0, "#091326");
      skyGrad.addColorStop(0.28, "#1e375a");
      skyGrad.addColorStop(0.55, "#785c69");
      skyGrad.addColorStop(0.78, "#e3985b");
      skyGrad.addColorStop(1, "#ffdfa8");
    } else if (env === "summit_sunset") {
      skyGrad.addColorStop(0, "#0f091d");
      skyGrad.addColorStop(0.28, "#3b1d4a");
      skyGrad.addColorStop(0.56, "#9c3b49");
      skyGrad.addColorStop(0.80, "#f0783c");
      skyGrad.addColorStop(1, "#ffd180");
    } else if (env === "night_campfire") {
      skyGrad.addColorStop(0, "#02040a");
      skyGrad.addColorStop(0.38, "#071124");
      skyGrad.addColorStop(0.75, "#111e36");
      skyGrad.addColorStop(1, "#1e202c");
    } else if (env === "misty_stones") {
      skyGrad.addColorStop(0, "#14202b");
      skyGrad.addColorStop(0.42, "#32495c");
      skyGrad.addColorStop(0.75, "#6c8596");
      skyGrad.addColorStop(1, "#b8cad4");
    } else {
      // sacred_temple (Crepúsculo Místico da Chapada)
      skyGrad.addColorStop(0, "#060a17");
      skyGrad.addColorStop(0.42, "#162345");
      skyGrad.addColorStop(0.75, "#3a355c");
      skyGrad.addColorStop(1, "#8c6968");
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-120, -120, W + 240, H + 240);

    // 2. VIA LÁCTEA, ESTRELAS E LUA CRESCENTE (Cenas Noturnas / Crepusculares)
    if (env === "night_campfire" || env === "sacred_temple") {
      // Faixa diagonal da Via Láctea
      ctx.save();
      ctx.translate(W * 0.5, H * 0.22);
      ctx.rotate(-0.42);
      const milkyGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, W * 0.65);
      milkyGrad.addColorStop(0, "rgba(175, 200, 255, 0.16)");
      milkyGrad.addColorStop(0.45, "rgba(135, 155, 220, 0.07)");
      milkyGrad.addColorStop(1, "rgba(10, 15, 30, 0)");
      ctx.fillStyle = milkyGrad;
      ctx.scale(1.8, 0.38);
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Estrelas cintilantes naturais
      this.stars.forEach((s) => {
        const twinkle = 0.35 + 0.65 * Math.sin(this.time * s.speed + s.phase);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Lua Crescente Iluminada
      const moonX = W * 0.78;
      const moonY = H * 0.16;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 130);
      moonGlow.addColorStop(0, "rgba(255, 250, 230, 0.35)");
      moonGlow.addColorStop(1, "rgba(255, 250, 230, 0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 130, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff9e6";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = env === "night_campfire" ? "#060e1f" : "#111b36";
      ctx.beginPath();
      ctx.arc(moonX - 10, moonY - 6, 25, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. SOL REALISTA E RAIOS CREPUSCULARES (Alvorada e Pôr do Sol)
    if (env === "mountain_dawn" || env === "summit_sunset" || env === "misty_stones") {
      const sunX = W * 0.52;
      const sunY = env === "summit_sunset" ? H * 0.43 : H * 0.39;

      const sunHalo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, W * 0.55);
      sunHalo.addColorStop(0, "rgba(255, 250, 225, 0.95)");
      sunHalo.addColorStop(0.15, "rgba(255, 210, 135, 0.60)");
      sunHalo.addColorStop(0.45, "rgba(240, 140, 75, 0.22)");
      sunHalo.addColorStop(1, "rgba(240, 140, 75, 0)");
      ctx.fillStyle = sunHalo;
      ctx.fillRect(-100, -100, W + 200, H + 200);

      // Disco solar brilhante
      ctx.fillStyle = "#fffdf5";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. ÁGUIAS PLANANDO NO VALE DISTANTE
    if (env !== "night_campfire") {
      this.drawMountainBirds(ctx, W, H);
    }

    // 5. CORDILHEIRAS ROCHOSAS 3D FACETADAS (Com faces iluminadas e faces em sombra)
    const palettes = {
      mountain_dawn: [
        { base: "#24354f", lit: "#526885", shadow: "#182438" },
        { base: "#1b283d", lit: "#3f536e", shadow: "#111b2b" },
        { base: "#121c2b", lit: "#2c3d54", shadow: "#0b121c" }
      ],
      summit_sunset: [
        { base: "#38223d", lit: "#7a4458", shadow: "#231429" },
        { base: "#28182e", lit: "#593045", shadow: "#180d1c" },
        { base: "#1a1021", lit: "#3d2235", shadow: "#0f0814" }
      ],
      night_campfire: [
        { base: "#0d1626", lit: "#1e2f4a", shadow: "#070c17" },
        { base: "#09101c", lit: "#162438", shadow: "#050911" },
        { base: "#060b14", lit: "#101a29", shadow: "#03060b" }
      ],
      misty_stones: [
        { base: "#364a59", lit: "#5a7587", shadow: "#253440" },
        { base: "#283845", lit: "#455d6e", shadow: "#1a2630" },
        { base: "#1b2730", lit: "#324554", shadow: "#111920" }
      ],
      sacred_temple: [
        { base: "#1a213d", lit: "#3b436e", shadow: "#101529" },
        { base: "#12182e", lit: "#293154", shadow: "#0b0f1f" },
        { base: "#0c1021", lit: "#1d233d", shadow: "#070914" }
      ]
    };

    const pal = palettes[env] || palettes.mountain_dawn;

    this.mountainRidges.forEach((ridge, idx) => {
      const layerShift = (worldScroll * (0.15 + idx * 0.22)) % (W * 0.4);
      this.drawFacetedMountainLayer(ctx, W, H, ridge, pal[idx], layerShift);

      // Camada de neblina volumétrica entre cada cadeia de montanhas (Cloud Inversion)
      this.drawValleyMistLayer(ctx, W, H, (0.45 + idx * 0.08) * H, idx);
    });

    // 6. FLORESTA DE ALTITUDE / PINHEIROS DA SERRA EM SILHUETA
    this.drawMountainPineForest(
      ctx,
      W,
      H,
      H * 0.61,
      env === "night_campfire" ? "#05080f" : "#0e1622",
      worldScroll * 0.65
    );

    // 7. PENHASCO ROCHOSO REALISTA EM PRIMEIRO PLANO (Laje de Quartzito da Chapada)
    this.drawRealisticCliffLedge(ctx, W, H, env, worldScroll);

    // 8. FOGUEIRA REALISTA (Se ambiente noturno ou pose de vigília no fogo)
    if (env === "night_campfire" || this.pose === "campfire_circle") {
      this.drawRealisticCampfire(ctx, W * 0.27, H * 0.685, W);
    }
  }

  drawFacetedMountainLayer(ctx, W, H, ridge, colors, shiftX) {
    const spanW = W + 360;
    const startX = -180 - shiftX;

    // Silhueta principal da cordilheira
    ctx.fillStyle = colors.base;
    ctx.beginPath();
    ctx.moveTo(startX, H);
    ridge.forEach((pt) => {
      ctx.lineTo(startX + pt.t * spanW, pt.yRatio * H);
    });
    ctx.lineTo(startX + spanW, H);
    ctx.closePath();
    ctx.fill();

    // Facetas 3D de Rocha (Lado esquerdo iluminado pelo sol/lua, lado direito em sombra)
    for (let i = 1; i < ridge.length - 1; i++) {
      const prev = ridge[i - 1];
      const curr = ridge[i];
      const next = ridge[i + 1];

      // Se é um pico local
      if (curr.yRatio < prev.yRatio && curr.yRatio < next.yRatio) {
        const px = startX + curr.t * spanW;
        const py = curr.yRatio * H;
        const leftX = startX + prev.t * spanW;
        const leftY = prev.yRatio * H;
        const rightX = startX + next.t * spanW;
        const rightY = next.yRatio * H;
        const ridgeMidX = px + (rightX - leftX) * 0.08;
        const ridgeBottomY = Math.max(leftY, rightY) + curr.ridgeDrop * H * 2.2;

        // Face iluminada
        ctx.fillStyle = colors.lit;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(ridgeMidX, ridgeBottomY);
        ctx.closePath();
        ctx.fill();

        // Face em sombra
        ctx.fillStyle = colors.shadow;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(rightX, rightY);
        ctx.lineTo(ridgeMidX, ridgeBottomY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawValleyMistLayer(ctx, W, H, yPos, layerIdx) {
    const mistGrad = ctx.createLinearGradient(0, yPos - 45, 0, yPos + 55);
    mistGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    mistGrad.addColorStop(
      0.5,
      this.environment === "misty_stones"
        ? "rgba(215, 228, 238, 0.32)"
        : this.environment === "night_campfire"
        ? "rgba(35, 50, 75, 0.22)"
        : "rgba(255, 235, 205, 0.16)"
    );
    mistGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = mistGrad;
    ctx.fillRect(-120, yPos - 45, W + 240, 100);

    // Nuvens volumétricas deslizando pelo vale
    this.clouds.forEach((c, idx) => {
      if (idx % 3 !== layerIdx) return;
      c.x += c.speed * 0.016;
      if (c.x > 1.35) c.x = -0.35;
      if (c.x < -0.35) c.x = 1.35;

      const cx = c.x * W;
      const cy = yPos + (idx % 2 === 0 ? -12 : 12);
      const cw = c.w * W;
      const ch = c.h * H;

      const cg = ctx.createRadialGradient(cx, cy, 5, cx, cy, cw * 0.55);
      cg.addColorStop(0, "rgba(255, 248, 238, 0.18)");
      cg.addColorStop(1, "rgba(255, 248, 238, 0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.55, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawMountainPineForest(ctx, W, H, baseY, treeColor, scrollX) {
    ctx.fillStyle = treeColor;
    const totalTrees = 38;
    const span = W + 300;
    for (let i = 0; i < totalTrees; i++) {
      let tx = ((i * 47 - scrollX) % span);
      if (tx < 0) tx += span;
      tx -= 150;

      const treeH = 28 + (i % 5) * 11;
      const ty = baseY + Math.sin(i * 1.3) * 14;

      // 3 níveis de copa de pinheiro/árvore de altitude
      for (let tier = 0; tier < 3; tier++) {
        const tierY = ty - treeH + tier * (treeH * 0.32);
        const tierW = 10 + tier * 6;
        ctx.beginPath();
        ctx.moveTo(tx, tierY - 12);
        ctx.lineTo(tx - tierW, tierY + 8);
        ctx.lineTo(tx + tierW, tierY + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawRealisticCliffLedge(ctx, W, H, env, scrollX) {
    const floorY = H * 0.665;
    const isNight = env === "night_campfire";

    // Massa rochosa principal do penhasco
    const rockGrad = ctx.createLinearGradient(0, floorY - 30, 0, H);
    rockGrad.addColorStop(0, isNight ? "#221e21" : "#3a4452");
    rockGrad.addColorStop(0.25, isNight ? "#161417" : "#252d38");
    rockGrad.addColorStop(1, "#090c12");

    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(-120, floorY + 28);
    ctx.lineTo(W * 0.18, floorY - 8);
    ctx.lineTo(W * 0.45, floorY - 22);
    ctx.lineTo(W * 0.76, floorY - 14);
    ctx.lineTo(W + 120, floorY + 18);
    ctx.lineTo(W + 120, H + 120);
    ctx.lineTo(-120, H + 120);
    ctx.closePath();
    ctx.fill();

    // Lajes facetadas de pedra sobre o mirante (com borda iluminada pelo sol ou fogueira)
    ctx.fillStyle = isNight ? "#2e2624" : "#4b5869";
    ctx.beginPath();
    ctx.moveTo(W * 0.28, floorY + 6);
    ctx.lineTo(W * 0.40, floorY - 46);
    ctx.lineTo(W * 0.65, floorY - 40);
    ctx.lineTo(W * 0.74, floorY + 12);
    ctx.closePath();
    ctx.fill();

    // Borda superior iluminada da rocha (Rim-Light natural)
    ctx.strokeStyle = isNight ? "rgba(255, 150, 65, 0.38)" : "rgba(255, 232, 185, 0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.18, floorY - 8);
    ctx.lineTo(W * 0.40, floorY - 46);
    ctx.lineTo(W * 0.65, floorY - 40);
    ctx.lineTo(W * 0.76, floorY - 14);
    ctx.stroke();

    // Fissuras geológicas na rocha
    ctx.strokeStyle = "rgba(10, 14, 20, 0.55)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(W * 0.40, floorY - 46);
    ctx.lineTo(W * 0.48, floorY + 14);
    ctx.moveTo(W * 0.60, floorY - 41);
    ctx.lineTo(W * 0.55, floorY + 8);
    ctx.stroke();
  }

  /**
   * FOGUEIRA REALISTA NA MONTANHA (Toras em brasa, pedras, múltiplas chamas orgânicas e fumaça)
   */
  drawRealisticCampfire(ctx, x, y, W) {
    // 1. Reflexo quente alaranjado no chão de pedra ao redor da fogueira
    const groundGlow = ctx.createRadialGradient(x, y - 10, 8, x, y - 10, W * 0.44);
    groundGlow.addColorStop(0, "rgba(255, 130, 30, 0.55)");
    groundGlow.addColorStop(0.45, "rgba(255, 80, 15, 0.18)");
    groundGlow.addColorStop(1, "rgba(255, 60, 0, 0)");
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.arc(x, y - 10, W * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // 2. Fumaça suave subindo na noite
    for (let s = 0; s < 4; s++) {
      const smokeProgress = (this.time * 0.4 + s * 0.25) % 1;
      const sx = x + Math.sin(this.time * 1.5 + s) * 22 * smokeProgress;
      const sy = y - 85 - smokeProgress * 140;
      const sr = 18 + smokeProgress * 38;
      const sAlpha = (1 - smokeProgress) * 0.12;
      ctx.fillStyle = `rgba(180, 190, 210, ${sAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Toras de madeira cruzadas com brasas incandescentes
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#2b1810";
    ctx.strokeStyle = "#ff6d00";
    ctx.lineWidth = 1.5;

    ctx.rotate(-0.22);
    this.roundRect(ctx, -56, -9, 112, 18, 6, true, true);
    ctx.rotate(0.44);
    this.roundRect(ctx, -56, -9, 112, 18, 6, true, true);
    ctx.restore();

    // 4. Línguas de Fogo Orgânicas (Camadas Vermelha, Laranja, Amarela e Núcleo Branco)
    const flameLayers = [
      { w: 44, h: 105, color: "rgba(230, 55, 15, 0.85)", speed: 6.5 },
      { w: 34, h: 86, color: "rgba(255, 125, 20, 0.90)", speed: 8.2 },
      { w: 24, h: 64, color: "rgba(255, 205, 45, 0.92)", speed: 10.4 },
      { w: 13, h: 38, color: "rgba(255, 250, 210, 0.95)", speed: 12.0 }
    ];

    flameLayers.forEach((fl, idx) => {
      const sway1 = Math.sin(this.time * fl.speed + idx) * 14;
      const sway2 = Math.cos(this.time * (fl.speed * 0.8) - idx) * 10;
      const dynamicH = fl.h + Math.sin(this.time * 11 + idx) * 12;

      ctx.fillStyle = fl.color;
      ctx.beginPath();
      ctx.moveTo(x - fl.w, y + 2);
      ctx.bezierCurveTo(
        x - fl.w * 0.8 + sway1,
        y - dynamicH * 0.45,
        x - fl.w * 0.2 + sway2,
        y - dynamicH * 0.85,
        x + sway1 * 0.6,
        y - dynamicH
      );
      ctx.bezierCurveTo(
        x + fl.w * 0.2 + sway2,
        y - dynamicH * 0.85,
        x + fl.w * 0.8 + sway1,
        y - dynamicH * 0.45,
        x + fl.w,
        y + 2
      );
      ctx.closePath();
      ctx.fill();
    });

    // 5. Círculo de pedras do acampamento ao redor da base da fogueira
    const stonePositions = [-52, -32, -10, 14, 36, 54];
    stonePositions.forEach((sx, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#3d3532" : "#2b2523";
      ctx.beginPath();
      ctx.ellipse(x + sx, y + 8 + (i % 2) * 3, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Brilho alaranjado do fogo no topo da pedra
      ctx.strokeStyle = "rgba(255, 140, 40, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + sx, y + 6, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
  }

  /**
   * Halo Sagrado Sutil integrado como fenômeno óptico/atmosférico natural no céu
   */
  drawAtmosphericSacredHalo(ctx, W, H) {
    if (this.sacredOverlay === "none") return;

    const centerX = W * 0.52;
    const centerY = H * 0.34;
    const radius = Math.min(W, H) * 0.17;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.globalAlpha = 0.22; // Sutil como constelação / halo solar para não parecer artificial

    ctx.strokeStyle = "#ffe6a3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    const triR = radius * 0.86;
    ctx.beginPath();
    ctx.moveTo(0, -triR);
    ctx.lineTo(triR * 0.866, triR * 0.5);
    ctx.lineTo(-triR * 0.866, triR * 0.5);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * PERSONAGEM ILUSTRADO CINEMATOGRÁFICO ("O SÁBIO DA MONTANHA")
   * Proporções anatômicas reais, sombreamento volumétrico, dobras de jaqueta corta-vento branca,
   * iluminação de contorno (rim-light) do sol/fogueira e movimentos orgânicos suaves.
   */
  drawCinematicMountainSage(ctx, W, H) {
    const isWalking = this.pose === "walking_trail";
    const walkPhase = this.time * 3.1; // Cadência calma e natural de caminhada na trilha
    const walkBobY = isWalking ? Math.abs(Math.sin(walkPhase)) * 5.5 : 0;

    const cx = W * 0.54;
    const groundY = H * 0.645 - walkBobY;
    const scale = (Math.min(W, H) / 1080) * 0.96;

    // Respiração orgânica suave
    const breath = Math.sin(this.time * 1.6);
    const breathY = breath * 3.2;

    this.blinkTimer += 0.016;
    const isBlinking = this.blinkTimer % 4.5 > 4.34;

    const isNightFire =
      this.environment === "night_campfire" || this.pose === "campfire_circle";
    const rimLightColor = isNightFire
      ? "rgba(255, 155, 60, 0.85)"
      : "rgba(255, 238, 185, 0.85)";

    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(scale, scale);

    // Sombra projetada realista sobre a laje de pedra
    ctx.fillStyle = "rgba(5, 8, 14, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 78, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const isSeated =
      this.pose === "seated_thinker" ||
      this.pose === "seated_staff" ||
      this.pose === "campfire_circle";

    const hipY = isSeated ? -142 : -255;
    const shoulderY = hipY - 178 + breathY;

    // 1. MOCHILA DE EXPEDIÇÃO PRETA + ISOLANTE TÉRMICO AZUL (Com volume e iluminação)
    ctx.save();
    ctx.translate(-34, shoulderY + 6);
    const packGrad = ctx.createLinearGradient(-52, 0, 18, 155);
    packGrad.addColorStop(0, "#272c35");
    packGrad.addColorStop(1, "#12151a");
    ctx.fillStyle = packGrad;
    ctx.strokeStyle = "#38404d";
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, -48, 0, 68, 158, 18, true, true);

    // Isolante térmico azul enrolado no topo da mochila
    const matGrad = ctx.createLinearGradient(-52, -30, 18, 0);
    matGrad.addColorStop(0, "#3488c4");
    matGrad.addColorStop(1, "#1b5580");
    ctx.fillStyle = matGrad;
    ctx.strokeStyle = "#143e5e";
    this.roundRect(ctx, -52, -28, 70, 32, 14, true, true);

    ctx.fillStyle = "#123a57";
    ctx.beginPath();
    ctx.arc(-38, -12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. CALÇA DE TRILHA BRANCA COM ARTICULAÇÃO ANATÔMICA DE JOELHO E BOTAS DE MONTANHA
    if (isWalking) {
      // Ciclo biomecânico de caminhada em 3/4 perfil
      const legA = Math.sin(walkPhase);
      const legB = Math.sin(walkPhase + Math.PI);

      // Perna de trás (esquerda)
      const kneeAX = -10 + legA * 22;
      const kneeAY = hipY + 115 - Math.max(0, legA) * 12;
      const footAX = -12 + legA * 38;
      const footAY = -16 - Math.max(0, -legA) * 14;
      this.drawAnatomicalLeg(ctx, -14, hipY, kneeAX, kneeAY, footAX, footAY, "#dde3ec", "#b8c2d1");
      this.drawTrekkingBoot(ctx, footAX, footAY);

      // Perna da frente (direita)
      const kneeBX = 12 + legB * 22;
      const kneeBY = hipY + 115 - Math.max(0, legB) * 12;
      const footBX = 14 + legB * 38;
      const footBY = -16 - Math.max(0, -legB) * 14;
      this.drawAnatomicalLeg(ctx, 14, hipY, kneeBX, kneeBY, footBX, footBY, "#f5f7fa", "#ccd4e0");
      this.drawTrekkingBoot(ctx, footBX, footBY);
    } else if (!isSeated) {
      // Postura firme no mirante da montanha
      this.drawAnatomicalLeg(ctx, -22, hipY, -30, hipY + 120, -34, -16, "#e4e9f0", "#bcc6d4");
      this.drawTrekkingBoot(ctx, -34, -16);

      this.drawAnatomicalLeg(ctx, 22, hipY, 28, hipY + 120, 32, -16, "#f8fafc", "#cfd7e3");
      this.drawTrekkingBoot(ctx, 32, -16);
    } else {
      // Sentado naturalmente sobre a rocha do mirante
      this.drawAnatomicalLeg(ctx, -18, hipY, -70, hipY + 32, -52, -18, "#e2e7f0", "#bcc6d4");
      this.drawTrekkingBoot(ctx, -52, -18);

      this.drawAnatomicalLeg(ctx, 18, hipY, 72, hipY + 26, 58, -18, "#f8fafc", "#cfd7e3");
      this.drawTrekkingBoot(ctx, 58, -18);
    }

    // 3. TORSO ESTRUTURADO — JAQUETA CORTA-VENTO BRANCA COM SOMBREAMENTO VOLUMÉTRICO E RIM-LIGHT
    const windBreeze = Math.sin(this.time * 2.4) * 4.5;
    const jacketGrad = ctx.createLinearGradient(-55, shoulderY, 55, hipY);
    jacketGrad.addColorStop(0, "#ffffff");
    jacketGrad.addColorStop(0.65, "#f0f4f8");
    jacketGrad.addColorStop(1, "#d5dde8");

    ctx.fillStyle = jacketGrad;
    ctx.strokeStyle = "#c2ccd9";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-52, shoulderY + 14);
    ctx.quadraticCurveTo(0, shoulderY - 6, 52, shoulderY + 14);
    ctx.lineTo(46 + windBreeze, hipY + 16);
    ctx.quadraticCurveTo(0, hipY + 26, -44 + windBreeze * 0.6, hipY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Luz de contorno (Rim-light) dourada/fogueira na lateral da jaqueta branca
    ctx.strokeStyle = rimLightColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    if (isNightFire) {
      ctx.moveTo(-51, shoulderY + 14);
      ctx.lineTo(-43 + windBreeze * 0.6, hipY + 15);
    } else {
      ctx.moveTo(51, shoulderY + 14);
      ctx.lineTo(45 + windBreeze, hipY + 15);
    }
    ctx.stroke();

    // Dobras anatômicas sutis do tecido e zíper frontal
    ctx.strokeStyle = "rgba(160, 175, 195, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, shoulderY + 6);
    ctx.lineTo(2, hipY + 18);
    ctx.moveTo(-26, shoulderY + 55);
    ctx.quadraticCurveTo(-12, shoulderY + 75, -28, shoulderY + 110);
    ctx.moveTo(26, shoulderY + 60);
    ctx.quadraticCurveTo(14, shoulderY + 80, 28, shoulderY + 115);
    ctx.stroke();

    // Alças anatômicas da mochila nos ombros
    ctx.strokeStyle = "#1c2026";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-40, shoulderY + 10);
    ctx.quadraticCurveTo(-30, shoulderY + 70, -42, shoulderY + 125);
    ctx.moveTo(38, shoulderY + 10);
    ctx.quadraticCurveTo(28, shoulderY + 70, 40, shoulderY + 125);
    ctx.stroke();

    // Gola alta corta-vento e capuz branco estruturado
    ctx.fillStyle = "#f2f5f9";
    ctx.strokeStyle = "#c5cfdc";
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, -35, shoulderY - 14, 70, 26, 11, true, true);

    // 4. CABEÇA ILUSTRADA COM EXPRESSÃO FILOSÓFICA SERENA (Sem movimento de boca)
    const headSwayX = Math.sin(this.time * 0.9) * 2.5;
    const headY = shoulderY - 56 + breathY * 0.5;
    this.drawRealisticHead(ctx, headSwayX, headY, isBlinking, rimLightColor);

    // 5. BRAÇOS ARTICULADOS (OMBRO-COTOVELO-PUNHO) E CAJADO DE MADEIRA NATURAL
    if (isWalking) {
      const armSwing = -Math.sin(walkPhase) * 20;
      this.drawAnatomicalArm(
        ctx,
        -48,
        shoulderY + 18,
        -60 + armSwing * 0.4,
        shoulderY + 88,
        -48 + armSwing,
        shoulderY + 158,
        "#e6ebf2",
        "#bec8d6"
      );

      const staffHandX = 80 - armSwing * 0.5;
      const staffHandY = shoulderY + 74;
      this.drawNaturalWoodStaff(
        ctx,
        staffHandX,
        staffHandY - 145,
        staffHandX + 14 - armSwing * 0.3,
        -6,
        false
      );
      this.drawAnatomicalArm(
        ctx,
        48,
        shoulderY + 18,
        66,
        shoulderY + 86,
        staffHandX,
        staffHandY,
        "#ffffff",
        "#cad2de"
      );
    } else if (this.pose === "raising_staff") {
      const floatY = Math.sin(this.time * 1.8) * 6;
      this.drawAnatomicalArm(
        ctx,
        -48,
        shoulderY + 18,
        -76,
        shoulderY + 68,
        -92,
        shoulderY + 42 + floatY,
        "#edf1f7",
        "#c2ccd9"
      );

      const staffHandX = 90;
      const staffHandY = shoulderY + 18 + floatY;
      this.drawNaturalWoodStaff(
        ctx,
        staffHandX + 6,
        staffHandY - 145,
        staffHandX - 4,
        -8,
        true
      );
      this.drawAnatomicalArm(
        ctx,
        48,
        shoulderY + 18,
        72,
        shoulderY + 45,
        staffHandX,
        staffHandY,
        "#ffffff",
        "#cad2de"
      );
    } else if (this.pose === "seated_thinker") {
      this.drawNaturalWoodStaff(ctx, -92, shoulderY - 35, -66, -12, false);
      this.drawAnatomicalArm(
        ctx,
        -46,
        shoulderY + 18,
        -68,
        shoulderY + 82,
        -48,
        shoulderY + 128,
        "#e8edf5",
        "#c2ccd9"
      );
      this.drawAnatomicalArm(
        ctx,
        46,
        shoulderY + 18,
        56,
        shoulderY + 88,
        10,
        headY + 28,
        "#ffffff",
        "#cad2de"
      );
    } else if (this.pose === "teaching_gesture") {
      const gY = shoulderY + 58 + Math.sin(this.time * 2.2) * 8;
      this.drawAnatomicalArm(
        ctx,
        -48,
        shoulderY + 18,
        -82,
        shoulderY + 76,
        -104,
        gY,
        "#f2f5fa",
        "#c2ccd9"
      );

      const staffHandX = 84;
      const staffHandY = shoulderY + 78;
      this.drawNaturalWoodStaff(ctx, staffHandX, staffHandY - 140, staffHandX + 12, -8, false);
      this.drawAnatomicalArm(
        ctx,
        48,
        shoulderY + 18,
        68,
        shoulderY + 92,
        staffHandX,
        staffHandY,
        "#ffffff",
        "#cad2de"
      );
    } else {
      // standing_staff, seated_staff, campfire_circle
      this.drawAnatomicalArm(
        ctx,
        -48,
        shoulderY + 18,
        -64,
        shoulderY + 90,
        -50 + windBreeze * 0.5,
        shoulderY + 150,
        "#eaf0f7",
        "#c2ccd9"
      );

      const staffHandX = 82;
      const staffHandY = shoulderY + 72;
      this.drawNaturalWoodStaff(ctx, staffHandX - 6, staffHandY - 140, staffHandX + 18, -8, false);
      this.drawAnatomicalArm(
        ctx,
        48,
        shoulderY + 18,
        68,
        shoulderY + 88,
        staffHandX,
        staffHandY,
        "#ffffff",
        "#cad2de"
      );
    }

    ctx.restore();
  }

  drawAnatomicalLeg(ctx, hipX, hipY, kneeX, kneeY, footX, footY, color, strokeColor) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Coxa
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 35;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    // Panturrilha / Canela da calça
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 29;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.restore();
  }

  drawAnatomicalArm(ctx, shX, shY, elbX, elbY, handX, handY, color, strokeColor) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 29;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elbX, elbY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elbX, elbY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Luva clara de proteção na montanha
    ctx.fillStyle = "#e8ecf2";
    ctx.strokeStyle = "#b5c0cf";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handX, handY, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawTrekkingBoot(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#22262e";
    ctx.strokeStyle = "#111318";
    ctx.lineWidth = 2.2;
    this.roundRect(ctx, -18, -10, 42, 22, 8, true, true);
    // Solado tratorado de trilha
    ctx.fillStyle = "#111317";
    ctx.fillRect(-16, 8, 38, 5);
    ctx.restore();
  }

  drawRealisticHead(ctx, x, y, isBlinking, rimLightColor) {
    ctx.save();
    ctx.translate(x, y);

    if (this.headgear === "hat") {
      const flapSway = Math.sin(this.time * 2.5) * 5;
      ctx.fillStyle = "#e6ebf2";
      ctx.strokeStyle = "#c2cbd6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-36, -12);
      ctx.lineTo(36, -12);
      ctx.lineTo(43 + flapSway, 46);
      ctx.quadraticCurveTo(0, 54, -43 + flapSway, 46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Pescoço sombreado
    ctx.fillStyle = "#cc9470";
    this.roundRect(ctx, -13, 20, 26, 24, 8, true, false);

    // Rosto com sombreamento tridimensional suave
    const faceGrad = ctx.createRadialGradient(-6, -6, 6, 0, 2, 38);
    faceGrad.addColorStop(0, "#ecc09d");
    faceGrad.addColorStop(1, "#cfa07c");
    ctx.fillStyle = faceGrad;
    ctx.strokeStyle = "#b58360";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 37, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sobrancelhas expressivas e serenas
    ctx.strokeStyle = "#362a24";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.quadraticCurveTo(-12, -13, -5, -10);
    ctx.moveTo(5, -10);
    ctx.quadraticCurveTo(12, -13, 20, -10);
    ctx.stroke();

    // Olhos contemplativos
    ctx.fillStyle = "#1f1916";
    if (isBlinking) {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-17, -3);
      ctx.lineTo(-7, -3);
      ctx.moveTo(7, -3);
      ctx.lineTo(17, -3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-12, -3, 3.2, 0, Math.PI * 2);
      ctx.arc(12, -3, 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Brilho de vida na pupila
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-11, -4, 1.1, 0, Math.PI * 2);
      ctx.arc(13, -4, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Óculos de grau de armação fina escura com reflexo da montanha
    ctx.strokeStyle = "#1c2128";
    ctx.lineWidth = 2.3;
    ctx.fillStyle = "rgba(200, 230, 255, 0.14)";
    this.roundRect(ctx, -23, -10, 19, 14, 4, true, true);
    this.roundRect(ctx, 4, -10, 19, 14, 4, true, true);
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.moveTo(-23, -5);
    ctx.lineTo(-30, -3);
    ctx.moveTo(23, -5);
    ctx.lineTo(30, -3);
    ctx.stroke();

    // Nariz anatômico
    ctx.strokeStyle = "#ad7856";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-2, 9);
    ctx.lineTo(3, 10);
    ctx.stroke();

    // Semblante fechado e sereno (Zero movimento de boca)
    ctx.strokeStyle = "#875038";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, 21);
    ctx.quadraticCurveTo(0, 22.5, 8, 21);
    ctx.stroke();

    // Chapéu branco de trilha ou Gorro branco de montanha
    if (this.headgear === "hat") {
      ctx.fillStyle = "#f7f9fc";
      ctx.strokeStyle = "#c4cdd9";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-33, -18);
      ctx.quadraticCurveTo(-29, -47, 0, -47);
      ctx.quadraticCurveTo(29, -47, 33, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -18, 56, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = "#f4f6fa";
      ctx.strokeStyle = "#c4cdd9";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -16, 34, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.roundRect(ctx, -35, -24, 70, 14, 6, true, true);
    }

    ctx.restore();
  }

  drawNaturalWoodStaff(ctx, topX, topY, bottomX, bottomY, hasSunBurst = false) {
    ctx.save();
    ctx.lineCap = "round";

    // Cajado orgânico de madeira esculpida pela natureza
    ctx.strokeStyle = "#3d2412";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.bezierCurveTo(
      topX - 6,
      topY + (bottomY - topY) * 0.35,
      bottomX + 5,
      topY + (bottomY - topY) * 0.7,
      bottomX,
      bottomY
    );
    ctx.stroke();

    ctx.strokeStyle = "#7a4c28";
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.bezierCurveTo(
      topX - 6,
      topY + (bottomY - topY) * 0.35,
      bottomX + 5,
      topY + (bottomY - topY) * 0.7,
      bottomX,
      bottomY
    );
    ctx.stroke();

    if (hasSunBurst) {
      const glow = ctx.createRadialGradient(topX, topY, 2, topX, topY, 45);
      glow.addColorStop(0, "rgba(255, 238, 175, 0.75)");
      glow.addColorStop(1, "rgba(255, 238, 175, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(topX, topY, 45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Vegetação rupestre de altitude balançando ao vento e fagulhas/brasas orgânicas
   */
  drawForegroundNatureAndEmbers(ctx, W, H) {
    const floorY = H * 0.665;
    const isNight =
      this.environment === "night_campfire" || this.pose === "campfire_circle";

    // Capim dourado da Chapada balançando na brisa da montanha
    ctx.save();
    ctx.strokeStyle = isNight ? "rgba(180, 130, 80, 0.45)" : "rgba(225, 195, 130, 0.55)";
    ctx.lineWidth = 2.2;
    this.grassTufts.forEach((g) => {
      const gx = g.x * W;
      const gy = floorY + 12 + Math.sin(g.phase) * 16;
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

    // Fagulhas da fogueira ou pólen iluminado pelo sol
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

  drawVideoHUDAndCaptions(ctx, W, H) {
    const isStories = this.currentFormat === "stories";
    const isSquare = this.currentFormat === "feed_square";

    const barY = 28;
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

    const topY = 52;
    ctx.save();
    ctx.fillStyle = "rgba(10, 15, 26, 0.78)";
    ctx.strokeStyle = "rgba(234, 197, 118, 0.65)";
    ctx.lineWidth = 2.2;
    const badgeW = Math.min(W - 80, 620);
    this.roundRect(ctx, (W - badgeW) / 2, topY, badgeW, 52, 26, true, true);

    ctx.fillStyle = "#ffe08a";
    ctx.font = "700 22px 'Cinzel', Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `⛰️ ${this.sceneTag.toUpperCase()} (${this.sceneIndex + 1}/${this.totalScenes})`,
      W / 2,
      topY + 27
    );
    ctx.restore();

    const bottomMargin = isStories ? 90 : isSquare ? 40 : 68;
    const boxW = W - 80;
    const boxX = 40;

    ctx.save();
    const fontSize = isSquare ? 34 : 38;
    const lineHeight = isSquare ? 46 : 51;
    ctx.font = `700 ${fontSize}px 'Inter', sans-serif`;

    const lines = this.wrapText(ctx, this.subtitleText, boxW - 70);
    const boxH = lines.length * lineHeight + 105;
    const boxY = H - bottomMargin - boxH;

    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(8, 12, 21, 0.90)";
    ctx.strokeStyle = "#eac576";
    ctx.lineWidth = 2.8;
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 22, true, true);
    ctx.shadowBlur = 0;

    const pillW = 310;
    ctx.fillStyle = "#eac576";
    this.roundRect(ctx, (W - pillW) / 2, boxY - 17, pillW, 34, 17, true, false);
    ctx.fillStyle = "#090d16";
    ctx.font = "800 17px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🗣️ LEGENDA • PORTUGUÊS (BR)", W / 2, boxY);

    const progW = (boxW - 60) * Math.min(1, Math.max(0.05, this.sceneProgress));
    ctx.fillStyle = "rgba(234, 197, 118, 0.22)";
    this.roundRect(ctx, boxX + 30, boxY + boxH - 22, boxW - 60, 6, 3, true, false);
    ctx.fillStyle = "#ffe08a";
    this.roundRect(ctx, boxX + 30, boxY + boxH - 22, progW, 6, 3, true, false);

    ctx.font = `700 ${fontSize}px 'Inter', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const activeLineIndex = Math.min(
      lines.length - 1,
      Math.floor(this.sceneProgress * lines.length)
    );

    lines.forEach((line, idx) => {
      const ly = boxY + 30 + idx * lineHeight;

      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 5;
      ctx.strokeText(line, W / 2, ly);

      if (idx < activeLineIndex) {
        ctx.fillStyle = "#f1f5f9";
      } else if (idx === activeLineIndex) {
        ctx.fillStyle = "#ffe08a";
      } else {
        ctx.fillStyle = "#ffffff";
      }
      ctx.fillText(line, W / 2, ly);
    });

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 20px 'Inter', sans-serif";
    ctx.fillText(`✨ ${this.themeBadge}`, W / 2, boxY + boxH - 50);

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
