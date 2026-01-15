/* global speechSynthesis */
(function () {
  const LEVELS = [
    {
      value: 10,
      unit: "",
      cn: "十",
      container: { label: "颗", emoji: "🍬" },
      theme: { bgA: "#ff7ab6", bgB: "#7ddcff" },
    },
    {
      value: 100,
      unit: "",
      cn: "一百",
      container: { label: "颗", emoji: "🍬" },
      theme: { bgA: "#ff6aa8", bgB: "#9be7ff" },
    },
    {
      value: 1_000,
      unit: "",
      cn: "一千",
      container: { label: "颗", emoji: "🍬" },
      theme: { bgA: "#ff5ea8", bgB: "#b1f0ff" },
    },
    {
      value: 10_000,
      unit: "万",
      cn: "一万",
      container: { label: "小袋", emoji: "🢋" },
      theme: { bgA: "#ff66b6", bgB: "#6fdcff" },
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
    {
      value: 10_000_000_000_000,
      unit: "万亿",
      cn: "十万亿",
      container: { label: "星河", emoji: "🌌" },
      theme: { bgA: "#7ddcff", bgB: "#b794ff" },
    },
    {
      value: 100_000_000_000_000,
      unit: "万亿",
      cn: "一百万亿",
      container: { label: "星系", emoji: "🪐" },
      theme: { bgA: "#ffd566", bgB: "#b794ff" },
    },
    {
      value: 1_000_000_000_000_000,
      unit: "万亿",
      cn: "一千万亿",
      container: { label: "宇宙", emoji: "🌠" },
      theme: { bgA: "#ff93c4", bgB: "#b794ff" },
    },
    {
      value: 10_000_000_000_000_000,
      unit: "亿亿",
      cn: "一亿亿",
      container: { label: "无限", emoji: "♾️" },
      theme: { bgA: "#b794ff", bgB: "#ff5ea8" },
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
  const micBtn = $("micBtn");
  const chat = $("chat");
  const userBubble = $("userBubble");
  const botBubble = $("botBubble");
  const eqLine = $("eqLine");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const wandBtn = $("wandBtn");
  const soundBtn = $("soundBtn");
  const soundIcon = $("soundIcon");

  let levelIndex = 0;
  let currentValue = LEVELS[0].value;
  let customMode = false;
  let customEquation = "";
  let selectedMult = 1;
  let muted = false;
  let zoom = 1;
  let audioEl = null;
  let audioObjectUrl = null;
  let ttsAbort = null;
  let busy = false;

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

  function renderContainers(label, emoji, { baseValue, activeMult } = {}) {
    containerRow.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const box = document.createElement("div");
      box.className = "unitContainer";
      box.dataset.mult = String(i + 1);
      if (Number.isFinite(baseValue)) box.dataset.base = String(baseValue);
      if (activeMult === i + 1) box.classList.add("active");
      box.setAttribute("role", "button");
      box.tabIndex = 0;

      const icon = document.createElement("div");
      icon.className = "unitIcon";
      icon.style.display = "grid";
      icon.style.placeItems = "center";
      icon.style.fontSize = "22px";
      icon.textContent = emoji;

      const lab = document.createElement("div");
      lab.className = "unitLabel";
      lab.textContent = `${i + 1}${label}`;

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

  function getUnitForValue(v) {
    if (v >= 10_000_000_000_000_000) return "亿亿";
    if (v >= 1_000_000_000_000) return "万亿";
    if (v >= 100_000_000) return "亿";
    if (v >= 10_000) return "万";
    return "";
  }

  function numberToChinese(n) {
    if (!Number.isFinite(n)) return "";
    if (n === 0) return "零";
    if (n < 0) return `负${numberToChinese(-n)}`;
    if (!Number.isInteger(n)) {
      // keep 2 decimals for simple divisions
      const s = n.toFixed(2).replace(/\.?0+$/, "");
      const [i, f] = s.split(".");
      if (!f) return numberToChinese(Number(i));
      const digit = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
      return `${numberToChinese(Number(i))}点${f.split("").map((c) => digit[Number(c)]).join("")}`;
    }

    const digit = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const smallUnit = ["", "十", "百", "千"];
    const bigUnit = ["", "万", "亿", "万亿", "亿亿"];

    const parts = [];
    let x = n;
    let big = 0;
    while (x > 0 && big < bigUnit.length) {
      const chunk = x % 10000;
      if (chunk !== 0) {
        let s = "";
        let zero = false;
        for (let i = 0; i < 4; i++) {
          const d = Math.floor(chunk / Math.pow(10, i)) % 10;
          if (d === 0) {
            if (s && !zero) zero = true;
          } else {
            const prefix = zero ? "零" : "";
            zero = false;
            s = `${digit[d]}${smallUnit[i]}${prefix}${s}`.replace(/零+$/, "");
          }
        }
        s = s.replace(/^一十/, "十");
        parts.unshift(`${s}${bigUnit[big]}`);
      } else if (parts.length > 0 && !parts[0].startsWith("零")) {
        parts.unshift("零");
      }
      x = Math.floor(x / 10000);
      big++;
    }
    return parts.join("").replace(/零+/g, "零").replace(/零$/, "");
  }

  function setEquation(text) {
    customEquation = text || "";
    if (!eqLine) return;
    eqLine.hidden = !customEquation;
    eqLine.textContent = customEquation;
  }

  function updateUI({ speakNow = false } = {}) {
    const base = customMode ? null : LEVELS[levelIndex];
    const value = customMode ? currentValue : base.value;
    const cn = customMode ? numberToChinese(value) : base.cn;
    const unit = customMode ? getUnitForValue(value) || base.unit : base.unit;
    arabicNumber.textContent = formatArabic(value);
    cnNumber.textContent = cn;
    unitText.textContent = unit;
    if (unitBadge) unitBadge.classList.toggle("long", unit.length > 1);
    if (base) {
      renderContainers(base.container.label, base.container.emoji, {
        baseValue: base.value,
        activeMult: selectedMult,
      });
      setTheme(base.theme);
    } else {
      renderContainers("礼盒", "🎁", { baseValue: LEVELS[levelIndex].value, activeMult: selectedMult });
      setTheme({ bgA: "#ff7ab6", bgB: "#7ddcff" });
    }
    renderCandyField(value);
    sparkle();
    if (speakNow) speak(`${cn}颗糖`);
  }

  function setLevelByValue(value) {
    let idx = LEVELS.findIndex((l) => l.value === value);
    if (idx === -1) {
      // pick nearest
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < LEVELS.length; i++) {
        const d = Math.abs(LEVELS[i].value - value);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      idx = best;
    }
    levelIndex = idx;
    currentValue = LEVELS[levelIndex].value;
    customMode = false;
    selectedMult = 1;
    setEquation("");
    updateUI({ speakNow: false });
    return true;
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
    customMode = false;
    selectedMult = 1;
    setEquation("");
    levelIndex = (levelIndex - 1 + LEVELS.length) % LEVELS.length;
    currentValue = LEVELS[levelIndex].value;
    updateUI({ speakNow: true });
  }

  function next() {
    hideHintOnce();
    customMode = false;
    selectedMult = 1;
    setEquation("");
    levelIndex = (levelIndex + 1) % LEVELS.length;
    currentValue = LEVELS[levelIndex].value;
    updateUI({ speakNow: true });
  }

  function toggleSound() {
    hideHintOnce();
    muted = !muted;
    soundIcon.textContent = muted ? "🔇" : "🔊";
    if (muted) stopSpeech();
    const cn = customMode ? numberToChinese(currentValue) : LEVELS[levelIndex].cn;
    if (!muted) speak(`${cn}颗糖`);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  soundBtn.addEventListener("click", toggleSound);

  wandBtn.addEventListener("click", () => {
    hideHintOnce();
    sparkle();
    const cn = customMode ? numberToChinese(currentValue) : LEVELS[levelIndex].cn;
    speak(`${cn}颗糖`);
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

  function showBubble(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    if (text) hideHintOnce();
  }

  function clearBubblesSoon() {
    setTimeout(() => {
      if (busy) return;
      if (userBubble) userBubble.hidden = true;
      if (botBubble) botBubble.hidden = true;
    }, 8000);
  }

  function parseChineseInt(s) {
    // Supports up to 万亿, and simple forms like 一万零一百/十亿/一千亿
    s = s.replaceAll("万亿", "兆").replaceAll("亿亿", "京");
    const digit = new Map([
      ["零", 0],
      ["一", 1],
      ["二", 2],
      ["两", 2],
      ["三", 3],
      ["四", 4],
      ["五", 5],
      ["六", 6],
      ["七", 7],
      ["八", 8],
      ["九", 9],
    ]);
    const unit = new Map([
      ["十", 10],
      ["百", 100],
      ["千", 1000],
      ["万", 10000],
      ["亿", 100000000],
      ["兆", 1000000000000],
      ["京", 10000000000000000],
    ]);

    let total = 0;
    let section = 0;
    let number = 0;
    for (const ch of s) {
      if (digit.has(ch)) {
        number = digit.get(ch);
        continue;
      }
      if (unit.has(ch)) {
        const u = unit.get(ch);
        if (u < 10000) {
          section += (number || 1) * u;
        } else {
          section += number;
          total += section * u;
          section = 0;
        }
        number = 0;
      }
    }
    return total + section + number;
  }

  function extractNumbers(text) {
    const nums = [];
    const re = /\d+(?:\.\d+)?/g;
    let m;
    while ((m = re.exec(text))) nums.push(Number(m[0]));

    if (nums.length) return nums;

    // Try simple chinese numerals if no arabic digits
    const chunkRe = /[零一二两三四五六七八九十百千万亿兆]+/g;
    while ((m = chunkRe.exec(text))) {
      const v = parseChineseInt(m[0]);
      if (Number.isFinite(v) && v !== 0) nums.push(v);
    }
    return nums;
  }

  function detectOp(text) {
    if (/[+＋]|加/.test(text)) return "+";
    if (/[-－]|减/.test(text)) return "-";
    if (/[x×*]|乘/.test(text)) return "*";
    if (/[\/÷]|除/.test(text)) return "/";
    return null;
  }

  function tryLocalMath(transcript) {
    const op = detectOp(transcript);
    if (!op) return null;
    const nums = extractNumbers(transcript);
    if (nums.length === 0) return null;
    let a;
    let b;
    if (nums.length >= 2) {
      [a, b] = nums;
    } else {
      a = currentValue;
      b = nums[0];
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    let result;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*") result = a * b;
    else if (op === "/") {
      if (b === 0) return { error: "不能除以零" };
      result = a / b;
    } else return null;

    const eq = `${formatArabic(a)} ${op} ${formatArabic(b)} = ${formatArabic(result)}`;
    return { a, b, op, result, eq };
  }

  async function callAsr(wavBase64) {
    const res = await fetch("./api/asr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wav_base64: wavBase64,
        model: "glm-asr-2512",
        hotwords: ["万", "亿", "万亿", "十万", "百万", "千万", "十亿", "一百亿", "一千亿"],
      }),
    });
    if (!res.ok) throw new Error(`ASR failed (${res.status})`);
    const data = await res.json();
    return typeof data.text === "string" ? data.text : "";
  }

  async function callBrain(transcript) {
    const res = await fetch("./api/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        state: {
          levelValue: LEVELS[levelIndex].value,
          cn: LEVELS[levelIndex].cn,
          unit: LEVELS[levelIndex].unit,
          zoom,
        },
      }),
    });
    if (!res.ok) throw new Error(`Brain failed (${res.status})`);
    return await res.json();
  }

  function applyActions(actions) {
    if (!Array.isArray(actions)) return;
    for (const a of actions) {
      if (!a || typeof a !== "object") continue;
      if (a.type === "sparkle") {
        sparkle();
        continue;
      }
      if (a.type === "setZoom") {
        const z = Number(a.value);
        if (Number.isFinite(z)) {
          zoom = clamp(z, 0.8, 1.35);
          applyZoom();
        }
        continue;
      }
      if (a.type === "showLevel") {
        const v = Number(a.value);
        if (Number.isFinite(v)) setLevelByValue(v);
        continue;
      }
    }
  }

  // --- Mic recording (WAV) ---
  function floatTo16BitPCM(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function encodeWav(int16, sampleRate) {
    const buffer = new ArrayBuffer(44 + int16.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    const writeStr = (s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
    };
    writeStr("RIFF");
    view.setUint32(offset, 36 + int16.length * 2, true);
    offset += 4;
    writeStr("WAVE");
    writeStr("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * 2, true);
    offset += 4;
    view.setUint16(offset, 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeStr("data");
    view.setUint32(offset, int16.length * 2, true);
    offset += 4;
    for (let i = 0; i < int16.length; i++, offset += 2) view.setInt16(offset, int16[i], true);
    return buffer;
  }

  function arrayBufferToBase64(buf) {
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  let rec = null;
  async function startRecording() {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mic not supported");
    stopSpeech();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    const chunks = [];
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };
    source.connect(processor);
    processor.connect(ctx.destination);

    rec = {
      stream,
      ctx,
      source,
      processor,
      chunks,
      sampleRate: ctx.sampleRate,
      startedAt: Date.now(),
    };
  }

  async function stopRecording() {
    if (!rec) return null;
    const r = rec;
    rec = null;
    try {
      r.processor.disconnect();
      r.source.disconnect();
    } catch {}
    try {
      r.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      await r.ctx.close();
    } catch {}

    // Merge float chunks
    const total = r.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of r.chunks) {
      merged.set(c, off);
      off += c.length;
    }

    // Trim leading/trailing silence (very small)
    let start = 0;
    let end = merged.length;
    const thr = 0.01;
    while (start < end && Math.abs(merged[start]) < thr) start++;
    while (end > start && Math.abs(merged[end - 1]) < thr) end--;
    const sliced = merged.slice(start, end);
    if (sliced.length < r.sampleRate * 0.2) return null; // too short

    // Clamp max length 12s
    const maxLen = Math.floor(r.sampleRate * 12);
    const final = sliced.length > maxLen ? sliced.slice(0, maxLen) : sliced;
    const pcm = floatTo16BitPCM(final);
    const wav = encodeWav(pcm, r.sampleRate);
    return arrayBufferToBase64(wav);
  }

  async function handleVoiceQuestion() {
    const wavBase64 = await stopRecording();
    if (!wavBase64) {
      showBubble(userBubble, "");
      showBubble(botBubble, "我没听清，再说一次～");
      speak("我没听清，再说一次～");
      clearBubblesSoon();
      return;
    }

    busy = true;
    try {
      showBubble(botBubble, "我在听…");
      const text = (await callAsr(wavBase64)).trim();
      showBubble(userBubble, text || "（没识别到）");

      if (!text) {
        showBubble(botBubble, "我没听清，再说一次～");
        await speak("我没听清，再说一次～");
        return;
      }

      const math = tryLocalMath(text);
      if (math?.error) {
        showBubble(botBubble, math.error);
        setEquation("");
        await speak(math.error);
        return;
      }
      if (math && Number.isFinite(math.result)) {
        customMode = true;
        currentValue = math.result;
        setEquation(math.eq);
        updateUI({ speakNow: false });
        showBubble(botBubble, `${formatArabic(math.result)}`);
        await speak(`${math.result}`);
        sparkle();
        return;
      }

      showBubble(botBubble, "让我想想…");
      const out = await callBrain(text);
      const sayText = typeof out?.sayText === "string" ? out.sayText : "好呀～";
      applyActions(out?.actions);
      showBubble(botBubble, sayText);
      await speak(sayText);
    } catch {
      showBubble(botBubble, "出错了～等一下再试试");
      await speak("出错了，等一下再试试");
    } finally {
      busy = false;
      clearBubblesSoon();
    }
  }

  if (micBtn) {
    const start = async () => {
      if (busy) return;
      try {
        showBubble(userBubble, "（在听…）");
        showBubble(botBubble, "");
        micBtn.classList.add("recording");
        await startRecording();
      } catch {
        micBtn.classList.remove("recording");
        showBubble(botBubble, "我需要麦克风权限～");
        speak("我需要麦克风权限");
        clearBubblesSoon();
      }
    };

    const stop = async () => {
      micBtn.classList.remove("recording");
      if (!rec) return;
      await handleVoiceQuestion();
    };

    micBtn.addEventListener("pointerdown", (e) => {
      micBtn.setPointerCapture?.(e.pointerId);
      start();
    });
    micBtn.addEventListener("pointerup", stop);
    micBtn.addEventListener("pointercancel", stop);
    micBtn.addEventListener("pointerleave", stop);
  }

  function handleContainerActivate(target) {
    const box = target?.closest?.(".unitContainer");
    if (!box) return;
    const mult = Number(box.dataset.mult);
    const baseValue = Number(box.dataset.base || LEVELS[levelIndex].value);
    if (!Number.isFinite(mult) || mult < 1 || mult > 10) return;
    if (!Number.isFinite(baseValue) || baseValue <= 0) return;

    hideHintOnce();
    selectedMult = mult;
    if (mult === 1) {
      customMode = false;
      currentValue = baseValue;
      setEquation("");
      updateUI({ speakNow: true });
      return;
    }

    customMode = true;
    currentValue = baseValue * mult;
    setEquation(`${mult} × ${formatArabic(baseValue)} = ${formatArabic(currentValue)}`);
    updateUI({ speakNow: false });
    sparkle();
    speak(`${numberToChinese(currentValue)}颗糖`);
  }

  if (containerRow) {
    containerRow.addEventListener("click", (e) => handleContainerActivate(e.target));
    containerRow.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      handleContainerActivate(e.target);
    });
  }

  // Keyboard (useful on desktop)
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === " " || e.key === "Enter") speak(`${LEVELS[levelIndex].cn}`);
  });

  // PWA offline cache
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    });
  }

  updateUI({ speakNow: false });
})();
