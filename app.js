/* global speechSynthesis */
(function () {
  const LEVELS = [
    {
      value: 10_000,
      unit: "万",
      cn: "一万",
      container: { label: "小袋", emoji: "🢋" },
      theme: { bgA: "#ff7ab6", bgB: "#7ddcff" },
    },
    {
      value: 100_000,
      unit: "万",
      cn: "十万",
      container: { label: "礼盒", emoji: "🎁" },
      theme: { bgA: "#ff6aa8", bgB: "#9be7ff" },
    },
    {
      value: 1_000_000,
      unit: "万",
      cn: "一百万",
      container: { label: "大箱", emoji: "📦" },
      theme: { bgA: "#ff5ea8", bgB: "#b1f0ff" },
    },
    {
      value: 10_000_000,
      unit: "万",
      cn: "一千万",
      container: { label: "小车", emoji: "🛒" },
      theme: { bgA: "#ff66b6", bgB: "#6fdcff" },
    },
    {
      value: 100_000_000,
      unit: "亿",
      cn: "一亿",
      container: { label: "货车", emoji: "🚚" },
      theme: { bgA: "#ffb25e", bgB: "#ff7ab6" },
    },
    {
      value: 1_000_000_000,
      unit: "亿",
      cn: "十亿",
      container: { label: "仓库", emoji: "🏬" },
      theme: { bgA: "#ffd566", bgB: "#7ddcff" },
    },
    {
      value: 10_000_000_000,
      unit: "亿",
      cn: "一百亿",
      container: { label: "城堡", emoji: "🏰" },
      theme: { bgA: "#ffe07a", bgB: "#ff5ea8" },
    },
    {
      value: 100_000_000_000,
      unit: "亿",
      cn: "一千亿",
      container: { label: "王国", emoji: "👑" },
      theme: { bgA: "#ff93c4", bgB: "#ffd566" },
    },
    {
      value: 1_000_000_000_000,
      unit: "万亿",
      cn: "一万亿",
      container: { label: "星海", emoji: "✨" },
      theme: { bgA: "#b794ff", bgB: "#7ddcff" },
    },
  ];

  const $ = (id) => document.getElementById(id);
  const arabicNumber = $("arabicNumber");
  const cnNumber = $("cnNumber");
  const unitText = $("unitText");
  const unitBadge = $("unitBadge");
  const world = $("world");
  const containerRow = $("containerRow");
  const candyField = $("candyField");
  const hint = $("hint");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const wandBtn = $("wandBtn");
  const soundBtn = $("soundBtn");
  const soundIcon = $("soundIcon");

  let levelIndex = 0;
  let muted = false;
  let zoom = 1;
  let audioEl = null;
  let audioObjectUrl = null;
  let ttsAbort = null;

  const pointers = new Map();
  let pinchStartDistance = null;
  let pinchStartZoom = 1;

  function formatArabic(n) {
    return n.toLocaleString("en-US");
  }

  function getTtsConfig() {
    const cfg = window.CANDY_PRINCESS_TTS;
    if (!cfg || typeof cfg !== "object") return { provider: "web-speech" };
    return {
      provider: typeof cfg.provider === "string" ? cfg.provider : "web-speech",
      apiKey: typeof cfg.apiKey === "string" ? cfg.apiKey : "",
      baseUrl: typeof cfg.baseUrl === "string" ? cfg.baseUrl : "https://open.bigmodel.cn",
      voice: typeof cfg.voice === "string" ? cfg.voice : "tongtong",
      speed: typeof cfg.speed === "number" ? cfg.speed : 1.0,
      volume: typeof cfg.volume === "number" ? cfg.volume : 1.0,
    };
  }

  function stopSpeech() {
    try {
      speechSynthesis.cancel();
    } catch {
      // ignore
    }
    if (ttsAbort) {
      ttsAbort.abort();
      ttsAbort = null;
    }
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = null;
    }
  }

  async function playAudioBlob(blob) {
    if (!audioEl) {
      audioEl = new Audio();
    }
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(blob);
    audioEl.src = audioObjectUrl;
    audioEl.volume = 1;
    await audioEl.play();
  }

  async function tryPlayBundledAudio(text) {
    const match = LEVELS.find((l) => `${l.cn}颗糖` === text);
    if (!match) return false;
    const url = `./audio/${match.value}.wav`;
    try {
      if (location.protocol === "file:") {
        if (!audioEl) audioEl = new Audio();
        if (audioObjectUrl) {
          URL.revokeObjectURL(audioObjectUrl);
          audioObjectUrl = null;
        }
        audioEl.src = url;
        audioEl.volume = 1;
        await audioEl.play();
        return true;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return false;
      const blob = await res.blob();
      await playAudioBlob(blob);
      return true;
    } catch {
      return false;
    }
  }

  async function tryPlayZhipuTts(text, cfg) {
    if (!cfg.apiKey) return false;
    const controller = new AbortController();
    ttsAbort = controller;
    const endpoint = `${cfg.baseUrl.replace(/\/$/, "")}/api/paas/v4/audio/speech`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-tts",
          input: text,
          voice: cfg.voice,
          response_format: "wav",
          speed: cfg.speed,
          volume: cfg.volume,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      await playAudioBlob(blob);
      return true;
    } catch {
      return false;
    } finally {
      if (ttsAbort === controller) ttsAbort = null;
    }
  }

  async function tryPlayServerTts(text) {
    try {
      const res = await fetch("./api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      await playAudioBlob(blob);
      return true;
    } catch {
      return false;
    }
  }

  async function speak(text) {
    if (muted) return;
    stopSpeech();

    if (await tryPlayBundledAudio(text)) return;

    const cfg = getTtsConfig();
    if (cfg.provider === "server-tts") {
      if (await tryPlayServerTts(text)) return;
    }
    if (cfg.provider === "zhipu-glm-tts") {
      if (await tryPlayZhipuTts(text, cfg)) return;
    }

    if (!("speechSynthesis" in window)) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "zh-CN";
      utter.rate = 0.92;
      utter.pitch = 1.05;
      utter.volume = 1;
      speechSynthesis.speak(utter);
    } catch {}
  }

  function sparkle() {
    const rect = world.getBoundingClientRect();
    const count = 18;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.style.position = "absolute";
      s.style.left = `${Math.random() * rect.width}px`;
      s.style.top = `${rect.height * (0.25 + Math.random() * 0.55)}px`;
      s.style.width = `${8 + Math.random() * 10}px`;
      s.style.height = s.style.width;
      s.style.borderRadius = "6px";
      s.style.background =
        "radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,0) 60%), linear-gradient(180deg, #fff2b0, #ffd566)";
      s.style.filter = "drop-shadow(0 10px 14px rgba(255,160,60,.25))";
      s.style.transform = `rotate(${Math.random() * 50 - 25}deg)`;
      s.style.opacity = "0";
      s.style.transition = "transform 800ms ease, opacity 500ms ease";
      s.style.zIndex = "3";
      world.appendChild(s);
      requestAnimationFrame(() => {
        s.style.opacity = "1";
        s.style.transform += ` translateY(${-20 - Math.random() * 30}px)`;
      });
      setTimeout(() => {
        s.style.opacity = "0";
      }, 550);
      setTimeout(() => {
        s.remove();
      }, 950);
    }
  }

  let hintHidden = false;
  function hideHintOnce() {
    if (hintHidden) return;
    hintHidden = true;
    hint?.classList.add("hide");
  }

  function renderCandyField(seed) {
    candyField.innerHTML = "";
    let rect = world.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      rect = { width: Math.max(320, window.innerWidth), height: Math.max(420, window.innerHeight * 0.55) };
    }
    const base = 52;
    const extra = Math.min(92, Math.floor(Math.log10(seed) * 16));
    const count = base + extra;

    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "candy";
      const x = Math.random() * rect.width;
      const y = 70 + Math.random() * (rect.height - 90);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      const t = 1400 + Math.random() * 1200;
      c.style.setProperty("--t", `${t}ms`);

      const palette = [
        ["#ff6aa8", "#ff93c4"],
        ["#7ddcff", "#b1f0ff"],
        ["#ffd566", "#ffb84a"],
        ["#b794ff", "#ff7ab6"],
        ["#7ef3c9", "#6fdcff"],
      ];
      const [c1, c2] = palette[(i + seed) % palette.length];
      c.style.setProperty("--c1", c1);
      c.style.setProperty("--c2", c2);
      candyField.appendChild(c);
    }

    applyZoom();
  }

  function renderContainers(label, emoji) {
    containerRow.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const box = document.createElement("div");
      box.className = "unitContainer";

      const icon = document.createElement("div");
      icon.className = "unitIcon";
      icon.style.display = "grid";
      icon.style.placeItems = "center";
      icon.style.fontSize = "22px";
      icon.textContent = emoji;

      const lab = document.createElement("div");
      lab.className = "unitLabel";
      lab.textContent = label;

      box.appendChild(icon);
      box.appendChild(lab);
      containerRow.appendChild(box);
    }
  }

  function setTheme(theme) {
    const glow = world.querySelector(".bgGlow");
    if (!glow) return;
    glow.style.background = `
      radial-gradient(circle at 30% 30%, ${hexToRgba(theme.bgA, 0.42)}, transparent 55%),
      radial-gradient(circle at 70% 50%, ${hexToRgba(theme.bgB, 0.32)}, transparent 60%),
      radial-gradient(circle at 60% 85%, rgba(255,214,102,.32), transparent 60%)
    `;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function updateUI({ speakNow = false } = {}) {
    const L = LEVELS[levelIndex];
    arabicNumber.textContent = formatArabic(L.value);
    cnNumber.textContent = L.cn;
    unitText.textContent = L.unit;
    if (unitBadge) unitBadge.classList.toggle("long", L.unit.length > 1);
    renderContainers(L.container.label, L.container.emoji);
    renderCandyField(L.value);
    setTheme(L.theme);
    sparkle();
    if (speakNow) speak(`${L.cn}颗糖`);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function applyZoom() {
    candyField.style.transform = `scale(${zoom})`;
    containerRow.style.transform = `scale(${clamp(zoom * 0.96, 0.85, 1.18)})`;
  }

  function prev() {
    hideHintOnce();
    levelIndex = (levelIndex - 1 + LEVELS.length) % LEVELS.length;
    updateUI({ speakNow: true });
  }

  function next() {
    hideHintOnce();
    levelIndex = (levelIndex + 1) % LEVELS.length;
    updateUI({ speakNow: true });
  }

  function toggleSound() {
    hideHintOnce();
    muted = !muted;
    soundIcon.textContent = muted ? "🔇" : "🔊";
    if (muted) stopSpeech();
    if (!muted) speak(`${LEVELS[levelIndex].cn}颗糖`);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  soundBtn.addEventListener("click", toggleSound);

  wandBtn.addEventListener("click", () => {
    hideHintOnce();
    sparkle();
    speak(`${LEVELS[levelIndex].cn}颗糖`);
  });

  let holdTimer = null;
  let holdInterval = null;

  function startHoldAdvance() {
    if (holdTimer || holdInterval) return;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      let i = 0;
      holdInterval = setInterval(() => {
        i++;
        next();
        sparkle();
        if (i >= 20) stopHoldAdvance();
      }, 900);
    }, 450);
  }

  function stopHoldAdvance() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  }

  wandBtn.addEventListener("pointerdown", (e) => {
    wandBtn.setPointerCapture?.(e.pointerId);
    startHoldAdvance();
  });
  wandBtn.addEventListener("pointerup", stopHoldAdvance);
  wandBtn.addEventListener("pointercancel", stopHoldAdvance);
  wandBtn.addEventListener("pointerleave", stopHoldAdvance);

  // Swipe + pinch on the world area
  let swipeStartX = null;
  let swipeStartY = null;
  let swipeStartTime = null;

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function onPointerDown(e) {
    hideHintOnce();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
      swipeStartTime = performance.now();
    }
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStartDistance = distance(pts[0], pts[1]);
      pinchStartZoom = zoom;
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStartDistance) {
      const pts = Array.from(pointers.values());
      const d = distance(pts[0], pts[1]);
      const ratio = d / pinchStartDistance;
      zoom = clamp(pinchStartZoom * ratio, 0.8, 1.35);
      applyZoom();
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchStartDistance = null;
    }

    if (pointers.size === 0 && swipeStartX != null && swipeStartY != null && swipeStartTime != null) {
      const dt = performance.now() - swipeStartTime;
      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      swipeStartX = swipeStartY = swipeStartTime = null;

      // quick, mostly-horizontal swipe
      if (dt < 420 && absX > 40 && absX > absY * 1.4) {
        if (dx < 0) next();
        else prev();
      }
    }
  }

  world.addEventListener("pointerdown", onPointerDown);
  world.addEventListener("pointermove", onPointerMove);
  world.addEventListener("pointerup", onPointerUp);
  world.addEventListener("pointercancel", onPointerUp);

  // Keyboard (useful on desktop)
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === " " || e.key === "Enter") speak(`${LEVELS[levelIndex].cn}`);
  });

  // PWA offline cache
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  updateUI({ speakNow: false });
})();
