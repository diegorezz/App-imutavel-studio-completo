/**
 * CONTROLADOR PRINCIPAL DA PLATAFORMA — IMUTÁVEL STUDIO (V3)
 * Implementa:
 *  1. Personagem sem movimento de boca (narração filosófica em off).
 *  2. Legenda da Narração em Português-BR 100% visível no Canvas e no Painel Sincronizado.
 *  3. Voz Neural Realista de Filósofo/Sábio em Português-BR via WebAudio + /api/tts.
 *  4. Cenas altamente dinâmicas (caminhada na trilha, elevação do cajado, câmera dinâmica e mudança de cenários por ato).
 *  5. Gerador de vídeos exclusivo por Temas e Leis conhecidos pela Base de Dados (30s, 45s ou 1 Minuto completo).
 */

class ImutavelStudioApp {
  constructor() {
    this.currentUser = null;
    this.projects = [];
    this.currentProject = null;
    this.activeSceneIndex = 0;

    this.isPlaying = false;
    this.isRecording = false;
    this.sceneElapsed = 0;
    this.lastFrameTime = performance.now();
    this.voiceProfile = "philosopher_deep";

    this.canvasEngine = null;
    this.audioEngine = new window.ImutavelAudioEngine();

    this.init();
  }

  init() {
    this.loadStoredProjects();
    this.checkAuthSession();
    this.bindAuthEvents();
    this.bindStudioEvents();
    this.populateKnownTopicsSelectors();
  }

  /* =========================================================================
   * 1. AUTENTICAÇÃO (CADASTRO / LOGIN + LOGIN COM GOOGLE)
   * ========================================================================= */
  checkAuthSession() {
    const saved = localStorage.getItem("imutavel_active_user");
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.enterPlatform();
        return;
      } catch (e) {}
    }
    this.showAuthScreen();
  }

  showAuthScreen() {
    document.getElementById("auth-view").classList.remove("hidden");
    document.getElementById("studio-view").classList.add("hidden");
  }

  enterPlatform() {
    document.getElementById("auth-view").classList.add("hidden");
    document.getElementById("studio-view").classList.remove("hidden");

    const nameEl = document.getElementById("user-display-name");
    const emailEl = document.getElementById("user-display-email");
    const avatarEl = document.getElementById("user-avatar-initials");

    if (this.currentUser) {
      nameEl.textContent = this.currentUser.name;
      emailEl.textContent =
        this.currentUser.provider === "google"
          ? `Google • ${this.currentUser.email}`
          : this.currentUser.email;
      const initials = this.currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
      avatarEl.textContent = initials || "IM";
    }

    if (!this.canvasEngine) {
      const canvas = document.getElementById("video-canvas");
      this.canvasEngine = new window.ImutavelCanvasEngine(canvas);
      this.selectProject(this.projects[0].id);
      requestAnimationFrame((t) => this.animationLoop(t));
    }
  }

  bindAuthEvents() {
    const tabLogin = document.getElementById("tab-btn-login");
    const tabRegister = document.getElementById("tab-btn-register");
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");

    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      formLogin.classList.remove("hidden");
      formRegister.classList.add("hidden");
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      formRegister.classList.remove("hidden");
      formLogin.classList.add("hidden");
    });

    formLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      const users = JSON.parse(localStorage.getItem("imutavel_users") || "[]");
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      const userObj = found || {
        id: "usr_" + Date.now(),
        name: email.split("@")[0].replace(/[._]/g, " "),
        email: email,
        provider: "email"
      };

      this.loginWithUser(userObj);
    });

    formRegister.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;

      const users = JSON.parse(localStorage.getItem("imutavel_users") || "[]");
      const newUser = {
        id: "usr_" + Date.now(),
        name: name || "Buscador da Montanha",
        email,
        password,
        provider: "email"
      };
      users.push(newUser);
      localStorage.setItem("imutavel_users", JSON.stringify(users));
      this.loginWithUser(newUser);
    });

    document.getElementById("btn-google-login").addEventListener("click", () => {
      document.getElementById("google-oauth-modal").classList.remove("hidden");
    });

    document.getElementById("close-google-modal").addEventListener("click", () => {
      document.getElementById("google-oauth-modal").classList.add("hidden");
    });

    document.querySelectorAll(".google-account-item").forEach((item) => {
      item.addEventListener("click", () => {
        const name = item.getAttribute("data-name");
        const email = item.getAttribute("data-email");
        document.getElementById("google-oauth-modal").classList.add("hidden");
        this.loginWithUser({
          id: "google_" + Date.now(),
          name,
          email,
          provider: "google"
        });
      });
    });

    document.getElementById("form-custom-google").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("google-custom-name").value.trim();
      const email = document.getElementById("google-custom-email").value.trim();
      if (!email) return;
      document.getElementById("google-oauth-modal").classList.add("hidden");
      this.loginWithUser({
        id: "google_" + Date.now(),
        name,
        email,
        provider: "google"
      });
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
      this.stopPlayback();
      localStorage.removeItem("imutavel_active_user");
      this.currentUser = null;
      this.showAuthScreen();
    });
  }

  loginWithUser(user) {
    this.currentUser = user;
    localStorage.setItem("imutavel_active_user", JSON.stringify(user));
    this.showToast(`Bem-vindo à jornada, ${user.name}!`);
    this.enterPlatform();
  }

  /* =========================================================================
   * 2. CATÁLOGO FECHADO DE TEMAS E CONSTRUÇÃO DE VÍDEOS PELO AGENTE IA
   * ========================================================================= */
  populateKnownTopicsSelectors() {
    const selectors = [
      document.getElementById("quick-select-topic"),
      document.getElementById("gen-select-pillar")
    ];

    selectors.forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = "";

      // Agrupa por categoria para facilitar a escolha do assunto conhecido pela base
      const categories = {};
      window.IMUTAVEL_AI_BRAIN.knowledgeNodes.forEach((node) => {
        const cat = node.category || "Leis Universais";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(node);
      });

      Object.keys(categories).forEach((catName) => {
        const group = document.createElement("optgroup");
        group.label = catName;
        categories[catName].forEach((node) => {
          const opt = document.createElement("option");
          opt.value = node.id;
          opt.textContent = node.title;
          group.appendChild(opt);
        });
        sel.appendChild(group);
      });
    });
  }

  loadStoredProjects() {
    const saved = localStorage.getItem("imutavel_projects_v4");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.projects = parsed;
          return;
        }
      } catch (e) {}
    }
    this.projects = JSON.parse(JSON.stringify(window.IMUTAVEL_AI_BRAIN.presetProjects));
    this.saveProjectsToStorage();
  }

  saveProjectsToStorage() {
    localStorage.setItem("imutavel_projects_v4", JSON.stringify(this.projects));
    this.renderProjectsList();
  }

  getProjectTotalDuration(proj) {
    if (!proj || !Array.isArray(proj.scenes)) return 60;
    const sum = proj.scenes.reduce(
      (acc, sc) => acc + Number(sc.autoDuration || proj.durationPerScene || 7.5),
      0
    );
    return Math.round(sum);
  }

  getSceneDuration(sc, proj = this.currentProject) {
    if (sc && sc.autoDuration && sc.autoDuration >= 3) {
      return Number(sc.autoDuration);
    }
    return Number((proj && proj.durationPerScene) || 7.5);
  }

  updateAutoTimingBadge() {
    const labelEl = document.getElementById("ai-total-duration-label");
    if (!labelEl || !this.currentProject) return;
    const totalSec = this.getProjectTotalDuration(this.currentProject);
    const targetSec = this.currentProject.totalDurationSec || totalSec;
    labelEl.textContent = `${totalSec}s (${this.currentProject.scenes.length} atos)`;
    const badgeEl = document.getElementById("ai-auto-timing-badge");
    if (badgeEl) {
      badgeEl.title = `Meta solicitada: ${targetSec}s • Tempo real sincronizado pelo Agente IA com a voz do filósofo: ${totalSec}s`;
    }
  }

  /**
   * Calibra automaticamente o tempo de cada cena medindo a duração exata da fala neural
   * do Filósofo e ajustando as pausas respiratórias para atingir o tempo do vídeo sem vazios.
   */
  async autoCalibrateProjectTiming(proj = this.currentProject) {
    if (!proj || !Array.isArray(proj.scenes) || proj.scenes.length === 0) return;

    const voiceProfile = this.voiceProfile || "philosopher_deep";
    const measuredDurations = [];

    for (let i = 0; i < proj.scenes.length; i++) {
      const sc = proj.scenes[i];
      const res = await this.audioEngine.prepareSceneAudio(sc.subtitle, voiceProfile);
      const voiceDur = res && res.duration ? Number(res.duration) : 6.5;
      sc.voiceDuration = Number(voiceDur.toFixed(2));
      measuredDurations.push(voiceDur);
    }

    const totalVoiceSec = measuredDurations.reduce((a, b) => a + b, 0);
    const targetTotalSec = Number(proj.totalDurationSec || 60);
    const sceneCount = proj.scenes.length;

    // Distribui a pausa contemplativa entre as cenas (mínimo 0.55s, máximo 1.25s para nunca ficar vazio)
    const rawPausePerScene = (targetTotalSec - totalVoiceSec) / Math.max(1, sceneCount);
    const pausePerScene = Math.max(0.55, Math.min(1.25, rawPausePerScene));

    proj.scenes.forEach((sc, idx) => {
      const vDur = measuredDurations[idx] || 6.5;
      // Última cena ganha +0.25s de fechamento suave
      const extraEnd = idx === sceneCount - 1 ? 0.25 : 0;
      sc.autoDuration = Number(Math.max(3.5, vDur + pausePerScene + extraEnd).toFixed(2));
    });

    proj.calculatedTotalSec = this.getProjectTotalDuration(proj);
    this.updateAutoTimingBadge();
    this.renderProjectsList();
    this.renderScenesTimeline();
  }

  renderProjectsList() {
    const container = document.getElementById("projects-list");
    if (!container) return;
    container.innerHTML = "";

    const formatBadges = {
      reels: "Reels 9:16",
      stories: "Stories 9:16",
      feed_portrait: "Feed 4:5",
      feed_square: "Feed 1:1"
    };

    this.projects.forEach((proj) => {
      const totalSec = this.getProjectTotalDuration(proj);
      const card = document.createElement("div");
      card.className = `project-item ${
        this.currentProject && this.currentProject.id === proj.id ? "active" : ""
      }`;
      card.innerHTML = `
        <div class="project-item-header">
          <span class="format-pill">${formatBadges[proj.format] || "Reels 9:16"}</span>
          <span class="scene-count">⏱️ ${totalSec}s • ${proj.scenes.length} cenas</span>
        </div>
        <div class="project-item-title">${proj.title}</div>
        <div class="project-item-source">✨ ${proj.themeBadge || "Sabedoria das Leis Universais"}</div>
      `;
      card.addEventListener("click", () => this.selectProject(proj.id));
      container.appendChild(card);
    });
  }

  selectProject(projectId) {
    this.stopPlayback();
    const found = this.projects.find((p) => p.id === projectId) || this.projects[0];
    this.currentProject = found;
    this.activeSceneIndex = 0;
    this.sceneElapsed = 0;

    document.getElementById("input-project-title").value = found.title;
    document.getElementById("select-video-format").value = found.format;
    document.getElementById("select-environment").value = found.environment;
    document.getElementById("select-headgear").value = found.characterHeadgear || "hat";
    document.getElementById("select-sacred-overlay").value =
      found.sacredOverlay || "ocidemnte_seal";
    document.getElementById("select-ambient-sound").value =
      found.ambientSound || "mountain_wind_432";

    this.updateCanvasPreviewAspect(found.format);
    this.updateAutoTimingBadge();
    this.renderProjectsList();
    this.renderScenesTimeline();
    this.loadSceneIntoEditor(0);

    // O Agente IA calibra automaticamente o tempo exato de todas as cenas em background
    this.autoCalibrateProjectTiming(found);
  }

  prewarmSceneVoice(text) {
    if (!text) return;
    this.audioEngine.prepareSceneAudio(text, this.voiceProfile).catch(() => {});
  }

  updateCanvasPreviewAspect(formatKey) {
    const wrapper = document.getElementById("canvas-stage-wrapper");
    wrapper.setAttribute("data-format", formatKey);

    document.querySelectorAll(".format-quick-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-format") === formatKey);
    });
  }

  renderScenesTimeline() {
    const list = document.getElementById("scenes-timeline");
    if (!list || !this.currentProject) return;
    list.innerHTML = "";

    const poseNames = {
      walking_trail: "🚶 Caminhando na Trilha",
      raising_staff: "⚡ Erguendo o Cajado",
      standing_staff: "⛰️ Em Pé no Mirante",
      seated_thinker: "🤔 Sentado em Reflexão",
      seated_staff: "🧘 Sentado c/ Cajado",
      teaching_gesture: "✋ Gesto de Ensinamento",
      campfire_circle: "🔥 Vigília na Fogueira"
    };

    this.currentProject.scenes.forEach((sc, idx) => {
      const scDur = this.getSceneDuration(sc, this.currentProject).toFixed(1);
      const el = document.createElement("div");
      el.className = `scene-card ${idx === this.activeSceneIndex ? "active" : ""}`;
      el.innerHTML = `
        <div class="scene-card-top">
          <span class="scene-num">Cena ${idx + 1} • ${sc.tag}</span>
          <span class="scene-pose-badge">${poseNames[sc.pose] || sc.pose} • ${scDur}s</span>
        </div>
        <p class="scene-card-text">"${sc.subtitle}"</p>
      `;
      el.addEventListener("click", () => {
        this.activeSceneIndex = idx;
        this.sceneElapsed = 0;
        this.renderScenesTimeline();
        this.loadSceneIntoEditor(idx);
        if (this.isPlaying) {
          this.speakCurrentScene();
        }
      });
      list.appendChild(el);
    });
  }

  loadSceneIntoEditor(idx) {
    if (!this.currentProject) return;
    const sc = this.currentProject.scenes[idx];
    if (!sc) return;

    document.getElementById("scene-editor-tag").value = sc.tag;
    document.getElementById("scene-editor-pose").value = sc.pose;
    document.getElementById("scene-editor-subtitle").value = sc.subtitle;
    const motionSel = document.getElementById("scene-editor-motion");
    if (motionSel) {
      motionSel.value = sc.cameraMotion || "slow_push_in";
    }
    const envSel = document.getElementById("select-environment");
    if (envSel && sc.environment) {
      envSel.value = sc.environment;
    }

    this.syncCanvasWithCurrentState();
  }

  syncCanvasWithCurrentState() {
    if (!this.canvasEngine || !this.currentProject) return;
    const sc =
      this.currentProject.scenes[this.activeSceneIndex] || this.currentProject.scenes[0];
    const dur = this.getSceneDuration(sc, this.currentProject);
    const sceneProg = Math.min(1, this.sceneElapsed / Math.max(1, dur));
    const totalProg =
      (this.activeSceneIndex + sceneProg) / Math.max(1, this.currentProject.scenes.length);

    const activeEnv = sc.environment || this.currentProject.environment;

    this.canvasEngine.updateConfig({
      format: this.currentProject.format,
      environment: activeEnv,
      pose: sc.pose,
      headgear: this.currentProject.characterHeadgear,
      sacredOverlay: this.currentProject.sacredOverlay,
      cameraMotion: sc.cameraMotion || "slow_push_in",
      cameraZoom: Number(sc.cameraZoom || 1.06),
      sceneTag: sc.tag,
      subtitleText: sc.subtitle,
      themeBadge: this.currentProject.themeBadge || "Sabedoria das Leis Universais",
      sceneProgress: sceneProg,
      totalProgress: totalProg,
      sceneIndex: this.activeSceneIndex,
      totalScenes: this.currentProject.scenes.length
    });

    // Atualiza também o Painel de Legenda em Português-BR abaixo do vídeo
    const liveSubEl = document.getElementById("live-ptbr-subtitle-text");
    const liveSceneBadge = document.getElementById("live-ptbr-scene-badge");
    if (liveSubEl) {
      liveSubEl.textContent = `"${sc.subtitle}"`;
    }
    if (liveSceneBadge) {
      liveSceneBadge.textContent = `CENA ${this.activeSceneIndex + 1}/${this.currentProject.scenes.length} • ${sc.tag}`;
    }
  }

  /**
   * Arquitetura de novo vídeo pelo Agente IA usando exclusivamente temas conhecidos da base
   */
  architectProjectFromKnownTopic(topicId, formatKey, durationSec) {
    const newProj = window.IMUTAVEL_AI_BRAIN.buildVideoFromKnownTopic(
      topicId,
      formatKey,
      Number(durationSec) || 60
    );
    this.projects.unshift(newProj);
    this.saveProjectsToStorage();
    this.selectProject(newProj.id);
    this.showToast(
      `✨ Vídeo de ${durationSec}s sobre "${newProj.themeBadge}" arquitetado e sincronizado pelo Agente IA!`
    );
  }

  /* =========================================================================
   * 3. REPRODUÇÃO, VOZ DE FILÓSOFO E LOOP DE ANIMAÇÃO 60FPS
   * ========================================================================= */
  startPlayback() {
    if (!this.currentProject) return;
    this.isPlaying = true;
    this.sceneElapsed = 0;

    document.getElementById("btn-play-toggle").innerHTML = `⏸ Pausar Vídeo`;
    this.audioEngine.startAmbient(this.currentProject.ambientSound);
    this.speakCurrentScene();

    // Pré-carrega e calibra o áudio das próximas cenas do projeto para transição perfeita
    this.autoCalibrateProjectTiming(this.currentProject);
  }

  stopPlayback() {
    this.isPlaying = false;
    this.audioEngine.stopAmbient();
    this.audioEngine.stopVoice();
    const playBtn = document.getElementById("btn-play-toggle");
    if (playBtn) playBtn.innerHTML = `▶ Reproduzir Vídeo`;
  }

  speakCurrentScene() {
    if (!this.currentProject) return;
    const sc = this.currentProject.scenes[this.activeSceneIndex];
    if (!sc) return;

    const useVoice = document.getElementById("toggle-voice-narration").checked;
    if (!useVoice) {
      this.audioEngine.stopVoice();
      return;
    }

    this.audioEngine.speakPhilosopher(sc.subtitle, this.voiceProfile).then((res) => {
      if (res && res.duration && res.duration > 1.5) {
        sc.voiceDuration = Number(res.duration.toFixed(2));
        // Garante que a cena sempre dura exatamente o tempo da fala + breve pausa contemplativa
        if (!sc.autoDuration || sc.autoDuration < res.duration + 0.55) {
          sc.autoDuration = Number((res.duration + 0.68).toFixed(2));
          this.updateAutoTimingBadge();
          this.renderScenesTimeline();
        }
      }
    });
  }

  animationLoop(now) {
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.isPlaying && this.currentProject) {
      const sc = this.currentProject.scenes[this.activeSceneIndex];
      const dur = this.getSceneDuration(sc, this.currentProject);
      this.sceneElapsed += dt;

      if (this.sceneElapsed >= dur) {
        this.sceneElapsed = 0;
        if (this.activeSceneIndex < this.currentProject.scenes.length - 1) {
          this.activeSceneIndex++;
          this.renderScenesTimeline();
          this.loadSceneIntoEditor(this.activeSceneIndex);
          this.speakCurrentScene();

          if (this.isRecording) {
            const exportBtn = document.getElementById("btn-export-video");
            if (exportBtn) {
              exportBtn.innerHTML = `🔴 Gravando Cenas (${this.activeSceneIndex + 1}/${this.currentProject.scenes.length})...`;
            }
          }
        } else {
          if (this.isRecording) {
            this.finishVideoExport();
          } else {
            this.activeSceneIndex = 0;
            this.renderScenesTimeline();
            this.loadSceneIntoEditor(0);
            this.stopPlayback();
          }
        }
      }
      this.syncCanvasWithCurrentState();
    }

    if (this.canvasEngine) {
      this.canvasEngine.render(dt);
    }

    requestAnimationFrame((t) => this.animationLoop(t));
  }

  /* =========================================================================
   * 4. EXPORTAÇÃO DE VÍDEO (REELS, STORIES, FEED) COM VOZ NEURAL + LEGENDA PT-BR
   * ========================================================================= */
  async startVideoExport() {
    if (this.isRecording || !this.currentProject) return;

    this.stopPlayback();
    const exportBtn = document.getElementById("btn-export-video");
    exportBtn.disabled = true;
    exportBtn.innerHTML = `⏳ Sincronizando Voz & Tempo com IA...`;

    // Calibra e pré-carrega 100% dos áudios antes de iniciar a gravação para zero atraso
    await this.autoCalibrateProjectTiming(this.currentProject);

    this.activeSceneIndex = 0;
    this.sceneElapsed = 0;
    this.renderScenesTimeline();
    this.loadSceneIntoEditor(0);

    const canvas = document.getElementById("video-canvas");
    const canvasStream = canvas.captureStream
      ? canvas.captureStream(30)
      : canvas.mozCaptureStream(30);

    const audioStream = this.audioEngine.getAudioStream();
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ];
    const combinedStream = new MediaStream(combinedTracks);

    let mimeType = "video/webm;codecs=vp9,opus";
    let fileExt = "webm";
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        mimeType = "video/webm;codecs=vp9,opus";
        fileExt = "webm";
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
        mimeType = "video/webm;codecs=vp8,opus";
        fileExt = "webm";
      } else if (MediaRecorder.isTypeSupported("video/webm")) {
        mimeType = "video/webm";
        fileExt = "webm";
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
        fileExt = "mp4";
      }
    }

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(canvasStream);
    }

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.recordedChunks.push(ev.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, {
        type: fileExt === "mp4" ? "video/mp4" : "video/webm"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = this.currentProject.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .substring(0, 35);
      a.href = url;
      a.download = `imutavel_${this.currentProject.format}_${safeName}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      this.showToast("Vídeo exportado com Voz de Filósofo, Tempo Sincronizado e Legenda PT-BR!");
      exportBtn.disabled = false;
      exportBtn.innerHTML = `🎬 Exportar Vídeo (${this.currentProject.format.toUpperCase()})`;
    };

    this.isRecording = true;
    exportBtn.innerHTML = `🔴 Gravando Cenas (1/${this.currentProject.scenes.length})...`;

    this.mediaRecorder.start(200);
    this.startPlayback();
  }

  finishVideoExport() {
    this.isRecording = false;
    this.stopPlayback();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  exportProjectJSON() {
    if (!this.currentProject) return;
    const payload = {
      app: "IMUTAVEL_STUDIO",
      version: "3.0.0",
      exportedAt: new Date().toISOString(),
      project: this.currentProject
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentProject.id}.imutavel.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.showToast("Projeto (.imutavel.json) exportado com sucesso!");
  }

  importProjectJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const proj = data.project || data;
        if (!proj.title || !Array.isArray(proj.scenes)) {
          throw new Error("Formato de projeto inválido");
        }
        proj.id = "proj_imp_" + Date.now();
        this.projects.unshift(proj);
        this.saveProjectsToStorage();
        this.selectProject(proj.id);
        this.showToast(`Projeto "${proj.title}" importado com sucesso!`);
      } catch (err) {
        this.showToast("Erro ao importar arquivo de projeto.");
      }
    };
    reader.readAsText(file);
  }

  /* =========================================================================
   * 5. EVENTOS DO ESTÚDIO E DO CONSTRUTOR DE TEMAS CONHECIDOS
   * ========================================================================= */
  bindStudioEvents() {
    document.querySelectorAll(".format-quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fmt = btn.getAttribute("data-format");
        if (this.currentProject) {
          this.currentProject.format = fmt;
          document.getElementById("select-video-format").value = fmt;
          this.updateCanvasPreviewAspect(fmt);
          this.syncCanvasWithCurrentState();
          this.saveProjectsToStorage();
        }
      });
    });

    // Construtor rápido de Vídeo na Barra Lateral (Apenas temas conhecidos da Base + Duração)
    const quickAiForm = document.getElementById("form-quick-ai-agent");
    if (quickAiForm) {
      quickAiForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const topicId = document.getElementById("quick-select-topic").value;
        const durationSec = document.getElementById("quick-select-duration").value;
        const fmt = this.currentProject ? this.currentProject.format : "reels";
        this.architectProjectFromKnownTopic(topicId, fmt, durationSec);
      });
    }

    // Seletor de Timbre da Voz do Filósofo
    const voiceSel = document.getElementById("select-voice-profile");
    if (voiceSel) {
      voiceSel.addEventListener("change", (e) => {
        this.voiceProfile = e.target.value;
        if (this.currentProject) {
          this.autoCalibrateProjectTiming(this.currentProject);
        }
        if (this.isPlaying) {
          this.speakCurrentScene();
        }
      });
    }

    // Botão Testar Voz do Filósofo na Cena Atual
    const btnTestVoice = document.getElementById("btn-test-philosopher-voice");
    if (btnTestVoice) {
      btnTestVoice.addEventListener("click", () => {
        if (!this.currentProject) return;
        const sc =
          this.currentProject.scenes[this.activeSceneIndex] ||
          this.currentProject.scenes[0];
        this.audioEngine.speakPhilosopher(sc.subtitle, this.voiceProfile);
        this.showToast("🎙️ Reproduzindo Voz Neural Pura do Filósofo em Português-BR...");
      });
    }

    document.getElementById("input-project-title").addEventListener("input", (e) => {
      if (!this.currentProject) return;
      this.currentProject.title = e.target.value;
      this.saveProjectsToStorage();
    });

    document.getElementById("select-video-format").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.format = e.target.value;
      this.updateCanvasPreviewAspect(e.target.value);
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    document.getElementById("select-environment").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.environment = e.target.value;
      if (this.currentProject.scenes[this.activeSceneIndex]) {
        this.currentProject.scenes[this.activeSceneIndex].environment = e.target.value;
      }
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    document.getElementById("select-headgear").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.characterHeadgear = e.target.value;
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    document.getElementById("select-sacred-overlay").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.sacredOverlay = e.target.value;
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    document.getElementById("select-ambient-sound").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.ambientSound = e.target.value;
      if (this.isPlaying) {
        this.audioEngine.startAmbient(e.target.value);
      }
      this.saveProjectsToStorage();
    });

    document.getElementById("scene-editor-tag").addEventListener("input", (e) => {
      if (!this.currentProject) return;
      this.currentProject.scenes[this.activeSceneIndex].tag = e.target.value;
      this.renderScenesTimeline();
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    document.getElementById("scene-editor-pose").addEventListener("change", (e) => {
      if (!this.currentProject) return;
      this.currentProject.scenes[this.activeSceneIndex].pose = e.target.value;
      this.renderScenesTimeline();
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
    });

    const motionSel = document.getElementById("scene-editor-motion");
    if (motionSel) {
      motionSel.addEventListener("change", (e) => {
        if (!this.currentProject) return;
        this.currentProject.scenes[this.activeSceneIndex].cameraMotion = e.target.value;
        this.syncCanvasWithCurrentState();
        this.saveProjectsToStorage();
      });
    }

    document.getElementById("scene-editor-subtitle").addEventListener("input", (e) => {
      if (!this.currentProject) return;
      const sc = this.currentProject.scenes[this.activeSceneIndex];
      sc.subtitle = e.target.value;
      delete sc.autoDuration;
      this.renderScenesTimeline();
      this.syncCanvasWithCurrentState();
      this.saveProjectsToStorage();
      clearTimeout(this.recalibrateTimer);
      this.recalibrateTimer = setTimeout(() => {
        this.autoCalibrateProjectTiming(this.currentProject);
      }, 650);
    });

    document.getElementById("btn-add-scene").addEventListener("click", () => {
      if (!this.currentProject) return;
      const node =
        window.IMUTAVEL_AI_BRAIN.knowledgeNodes.find(
          (n) => n.id === this.currentProject.pillarId
        ) || window.IMUTAVEL_AI_BRAIN.knowledgeNodes[0];
      const randomAct = node.acts[Math.floor(Math.random() * node.acts.length)];
      this.currentProject.scenes.push({
        id: "sc_" + Date.now(),
        tag: randomAct.tag,
        pose: randomAct.pose,
        environment: randomAct.env,
        cameraMotion: randomAct.cameraMotion,
        cameraZoom: 1.08,
        subtitle: randomAct.subtitle,
        narration: randomAct.subtitle
      });
      this.activeSceneIndex = this.currentProject.scenes.length - 1;
      this.renderScenesTimeline();
      this.loadSceneIntoEditor(this.activeSceneIndex);
      this.saveProjectsToStorage();
      this.autoCalibrateProjectTiming(this.currentProject);
      this.showToast("Ato adicional inserido e sincronizado automaticamente pelo Agente IA!");
    });

    document.getElementById("btn-remove-scene").addEventListener("click", () => {
      if (!this.currentProject || this.currentProject.scenes.length <= 1) {
        this.showToast("O vídeo deve ter pelo menos 1 cena.");
        return;
      }
      this.currentProject.scenes.splice(this.activeSceneIndex, 1);
      this.activeSceneIndex = Math.max(0, this.activeSceneIndex - 1);
      this.renderScenesTimeline();
      this.loadSceneIntoEditor(this.activeSceneIndex);
      this.saveProjectsToStorage();
      this.autoCalibrateProjectTiming(this.currentProject);
    });

    document.getElementById("btn-play-toggle").addEventListener("click", () => {
      if (this.isPlaying) this.stopPlayback();
      else this.startPlayback();
    });

    document.getElementById("btn-export-video").addEventListener("click", () => {
      this.startVideoExport();
    });

    document.getElementById("btn-export-project").addEventListener("click", () => {
      this.exportProjectJSON();
    });

    document.getElementById("btn-import-project").addEventListener("click", () => {
      document.getElementById("input-import-file").click();
    });

    document.getElementById("input-import-file").addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        this.importProjectJSON(e.target.files[0]);
      }
    });

    document.getElementById("btn-open-generator").addEventListener("click", () => {
      document.getElementById("generator-modal").classList.remove("hidden");
    });

    document.getElementById("close-generator-modal").addEventListener("click", () => {
      document.getElementById("generator-modal").classList.add("hidden");
    });

    document.getElementById("form-generate-script").addEventListener("submit", (e) => {
      e.preventDefault();
      const pillarId = document.getElementById("gen-select-pillar").value;
      const durationSec = document.getElementById("gen-select-duration").value;
      const fmt = document.getElementById("gen-select-format").value;
      document.getElementById("generator-modal").classList.add("hidden");
      this.architectProjectFromKnownTopic(pillarId, fmt, durationSec);
    });
  }

  showToast(msg) {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3800);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.imutavelApp = new ImutavelStudioApp();
});
