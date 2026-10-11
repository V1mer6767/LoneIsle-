/* LoneIsle — living sea and weather.
   Sea: drifting waves, foam on the shore, sailing boats and jumping fish.
   Weather: gentle rain + rainbow, morning fog, falling leaves, night fireflies. */
(function () {
  "use strict";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hour = () => (typeof window.cozyHour === "function" ? window.cozyHour() : new Date().getHours());
  const isNight = () => document.body.classList.contains("isNight");

  /* ================= SEA ================= */
  let layer = null;
  const boats = [];
  let nextFish = 0;

  function waterCells() {
    const out = [];
    if (typeof state === "undefined" || !state) return out;
    for (const [k, t] of Object.entries(state.tiles)) {
      if (t.type !== "water" || (t.building && t.building.id === "dock")) continue;
      const [c, r] = k.split(",").map(Number); out.push({ c, r });
    }
    return out;
  }
  const isWaterAt = (c, r) => {
    const t = state.tiles[c + "," + r];
    return !!(t && t.type === "water" && !(t.building));
  };
  const isLandAt = (c, r) => { const t = state.tiles[c + "," + r]; return !!(t && t.type === "land"); };

  function decorateWater() {
    if (typeof state === "undefined" || !state) return;
    document.querySelectorAll(".tile.water").forEach((el) => {
      el.style.setProperty("--wd", "-" + (Math.random() * 6).toFixed(2) + "s");
      const c = +el.dataset.c, r = +el.dataset.r;
      if (el.querySelector(".foam")) return;
      const near = isLandAt(c + 1, r) || isLandAt(c - 1, r) || isLandAt(c, r + 1) || isLandAt(c, r - 1) ||
        isLandAt(c + 1, r + 1) || isLandAt(c - 1, r - 1) || isLandAt(c + 1, r - 1) || isLandAt(c - 1, r + 1);
      if (near) {
        const f = document.createElement("i");
        f.className = "foam";
        f.style.animationDelay = "-" + (Math.random() * 4).toFixed(2) + "s";
        f.innerHTML = `<svg viewBox="0 0 74 40" preserveAspectRatio="none"><polygon points="37,2 72,20 37,38 2,20"/></svg>`;
        el.appendChild(f);
      }
    });
  }

  function ensureLayer() {
    const world = document.getElementById("world");
    if (!world) return null;
    if (!layer) { layer = document.createElement("div"); layer.id = "seaLayer"; }
    if (layer.parentNode !== world) world.appendChild(layer);
    return layer;
  }

  const BOAT_SVG = `<svg viewBox="0 0 40 36" width="30" height="27"><path d="M20 3 L20 24" stroke="#5a3a1e" stroke-width="1.6"/><path d="M21 4 L34 21 L21 21 Z" fill="#fffaf0"/><path d="M19 7 L8 21 L19 21 Z" fill="#f4d9a8"/><path d="M4 24 L36 24 L31 32 L9 32 Z" fill="#b5532e"/><path d="M4 24 L36 24 L35 26 L5 26 Z" fill="#8e3b1d"/><path d="M20 3 l5 2 -5 2z" fill="#e0523f"/></svg>`;

  function makeBoat() {
    const el = document.createElement("div");
    el.className = "seaBoat";
    el.innerHTML = `<div class="bob">${BOAT_SVG}</div>`;
    return { el, c: 0, r: 0, to: null, t: 0, wait: 0, dirx: 1 };
  }
  function boatTarget(b) {
    // neighbouring open-water cell (4 directions), stays on water
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => isWaterAt(b.c + dc, b.r + dr));
    if (!opts.length) return null;
    // keep heading if possible
    if (b.last && Math.random() < 0.7) {
      const keep = opts.find((o) => o[0] === b.last[0] && o[1] === b.last[1]);
      if (keep) return keep;
    }
    return pick(opts);
  }
  function placeBoat(b) {
    const cells = waterCells().filter((w) => isWaterAt(w.c + 1, w.r) || isWaterAt(w.c - 1, w.r) || isWaterAt(w.c, w.r + 1) || isWaterAt(w.c, w.r - 1));
    if (!cells.length) return false;
    const w = pick(cells); b.c = w.c; b.r = w.r; b.to = null; b.t = 0; b.last = null; b.wait = 0;
    return true;
  }
  function syncBoats() {
    const n = Math.min(2, Math.floor(waterCells().length / 6));
    while (boats.length > n) { boats.pop().el.remove(); }
    while (boats.length < n) {
      const b = makeBoat();
      if (!placeBoat(b)) break;
      boats.push(b);
    }
    const L = ensureLayer();
    if (L) for (const b of boats) if (b.el.parentNode !== L) L.appendChild(b.el);
  }

  function splash(x, y) {
    const L = ensureLayer(); if (!L) return;
    const s = document.createElement("i");
    s.className = "splash";
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.zIndex = String(Math.round(y) + 5001);
    L.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
  function jumpFish() {
    const cells = waterCells(); if (!cells.length) return;
    const w = pick(cells);
    const p = window.isoPos(w.c, w.r);
    const x = p.x + rnd(-8, 8), y = p.y + rnd(-3, 3);
    const L = ensureLayer(); if (!L) return;
    splash(x, y);
    const f = document.createElement("i");
    f.className = "fishJump";
    f.style.left = x + "px"; f.style.top = y + "px";
    f.style.zIndex = String(Math.round(y) + 5002);
    f.style.setProperty("--dx", rnd(-14, 14).toFixed(0) + "px");
    f.innerHTML = `<svg viewBox="0 0 22 12" width="16" height="9"><path d="M1 6 Q8 -1 15 6 Q8 13 1 6Z" fill="#ff9a4d"/><path d="M14 6 L21 1 L21 11Z" fill="#f27a2b"/><circle cx="5" cy="5" r="1" fill="#222"/></svg>`;
    L.appendChild(f);
    setTimeout(() => { splash(x + parseFloat(f.style.getPropertyValue("--dx")), y); }, 850);
    setTimeout(() => f.remove(), 1000);
  }

  let last = performance.now();
  function seaFrame(ts) {
    requestAnimationFrame(seaFrame);
    const dt = Math.min(0.06, (ts - last) / 1000); last = ts;
    if (document.hidden || typeof state === "undefined" || !state || !window.isoPos) return;
    for (const b of boats) {
      if (b.wait > 0) { b.wait -= dt; }
      else if (!b.to) {
        const o = boatTarget(b);
        if (!o) { b.wait = 4; if (!isWaterAt(b.c, b.r)) placeBoat(b); }
        else { b.to = { c: b.c + o[0], r: b.r + o[1] }; b.last = o; b.t = 0; }
      } else {
        b.t += dt * 0.35;
        if (b.t >= 1) { b.c = b.to.c; b.r = b.to.r; b.to = null; b.t = 0; if (Math.random() < 0.2) b.wait = rnd(2, 6); }
      }
      const a = window.isoPos(b.c, b.r);
      let x = a.x, y = a.y;
      if (b.to) {
        const q = window.isoPos(b.to.c, b.to.r);
        x = a.x + (q.x - a.x) * b.t; y = a.y + (q.y - a.y) * b.t;
        if (Math.abs(q.x - a.x) > 1) b.dirx = q.x > a.x ? 1 : -1;
      }
      b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -78%) scaleX(${b.dirx})`;
      b.el.style.zIndex = String(Math.round(y) + 5001);
    }
    if (!reduce && ts > nextFish) { nextFish = ts + rnd(5000, 11000); if (!isNight() || Math.random() < 0.5) jumpFish(); }
  }

  /* ================= WEATHER ================= */
  let cv = null, ctx = null, W = 0, H = 0;
  let mode = "clear", modeSince = 0, modeUntil = 0;
  let parts = [];
  let rainAmt = 0, fogEl = null, rainbowEl = null, wxTint = null, rainbowUntil = 0;

  function buildWeather() {
    cv = document.createElement("canvas"); cv.id = "wxCanvas"; document.body.appendChild(cv);
    ctx = cv.getContext("2d");
    wxTint = document.createElement("div"); wxTint.id = "wxTint"; document.body.appendChild(wxTint);
    fogEl = document.createElement("div"); fogEl.id = "wxFog";
    fogEl.innerHTML = `<i class="f1"></i><i class="f2"></i><i class="f3"></i>`;
    document.body.appendChild(fogEl);
    rainbowEl = document.createElement("div"); rainbowEl.id = "wxRainbow"; document.body.appendChild(rainbowEl);
    resize(); window.addEventListener("resize", resize);
  }
  function resize() {
    if (!cv) return;
    W = cv.width = Math.round(window.innerWidth * 0.75); H = cv.height = Math.round(window.innerHeight * 0.75);
  }

  function choose() {
    const h = hour(), m = new Date().getMonth();
    const opts = [["clear", 3]];
    if (h >= 5 && h <= 10) opts.push(["fog", 3]);
    opts.push(["rain", h >= 6 && h <= 22 ? 2 : 1]);
    opts.push(["leaves", (m >= 8 && m <= 10) ? 4 : 1]);
    const sum = opts.reduce((s, o) => s + o[1], 0);
    let x = Math.random() * sum;
    for (const [k, w] of opts) { x -= w; if (x <= 0) return k; }
    return "clear";
  }
  function setMode(m, mins) {
    const prev = mode;
    mode = m; modeSince = Date.now();
    modeUntil = Date.now() + (mins || rnd(5, 10)) * 60000;
    parts = [];
    if (prev === "rain" && m !== "rain" && hour() >= 7 && hour() <= 19) rainbowUntil = Date.now() + 100000;
    document.body.dataset.weather = m;
  }

  function spawn(kind) {
    if (kind === "drop") return { k: "drop", x: rnd(-40, W + 40), y: rnd(-30, 0), v: rnd(520, 760), l: rnd(9, 16) };
    if (kind === "leaf") return { k: "leaf", x: rnd(-20, W + 20), y: -12, vy: rnd(24, 48), ph: rnd(0, 6.28), sw: rnd(18, 38), s: rnd(3, 5.5), rot: rnd(0, 6.28), vr: rnd(-2, 2), col: pick(["#d9822b", "#c2451f", "#e9b53a", "#a85a1c", "#8fa83a"]) };
    return { k: "fly", x: rnd(0, W), y: rnd(H * 0.35, H * 0.95), ph: rnd(0, 6.28), sp: rnd(0.3, 0.9), r: rnd(1.3, 2.4) };
  }

  let wlast = performance.now(), flyT = 0;
  function wxFrame(ts) {
    requestAnimationFrame(wxFrame);
    const dt = Math.min(0.06, (ts - wlast) / 1000); wlast = ts;
    if (document.hidden || !ctx) return;
    const now = Date.now();
    if (now > modeUntil) setMode(mode === "clear" ? choose() : "clear", mode === "clear" ? null : rnd(6, 14));

    // smooth intensities
    const tRain = mode === "rain" ? 1 : 0;
    rainAmt += (tRain - rainAmt) * Math.min(1, dt * 0.6);
    const night = isNight();
    const fogOn = mode === "fog";
    fogEl.style.opacity = fogOn ? (night ? "0.55" : "0.9") : "0";
    wxTint.style.opacity = String(Math.min(1, rainAmt * 0.9 + (fogOn ? 0.25 : 0)));
    const rb = now < rainbowUntil && mode !== "rain";
    rainbowEl.style.opacity = rb ? "0.55" : "0";

    ctx.clearRect(0, 0, W, H);
    if (reduce) return;
    // spawn
    if (rainAmt > 0.05) for (let i = 0; i < 4 * rainAmt; i++) if (parts.length < 320) parts.push(spawn("drop"));
    if (mode === "leaves" && Math.random() < dt * 5 && parts.length < 60) parts.push(spawn("leaf"));
    if (night && mode !== "rain" && (parts.filter((p) => p.k === "fly").length < 18) && Math.random() < dt * 4) parts.push(spawn("fly"));
    flyT += dt;
    const nl = [];
    for (const p of parts) {
      if (p.k === "drop") {
        p.y += p.v * dt; p.x -= 90 * dt;
        ctx.strokeStyle = "rgba(205,225,245,.55)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2.2, p.y - p.l); ctx.stroke();
        if (p.y < H + 20) nl.push(p);
      } else if (p.k === "leaf") {
        p.y += p.vy * dt; p.ph += dt * 1.6; p.rot += p.vr * dt;
        const x = p.x + Math.sin(p.ph) * p.sw;
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283); ctx.fill(); ctx.restore();
        if (p.y < H + 20) nl.push(p);
      } else {
        p.ph += dt * p.sp * 2; p.x += Math.cos(p.ph * 0.9) * 10 * dt; p.y += Math.sin(p.ph * 1.3) * 9 * dt;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.ph * 2.4));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(235,255,150,${a})`); g.addColorStop(1, "rgba(235,255,150,0)");
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10);
        if (night && mode !== "rain") nl.push(p); else if (Math.random() < 0.97) nl.push(p);
      }
    }
    parts = nl;
  }

  /* ================= wiring ================= */
  window.addEventListener("load", () => {
    if (typeof state === "undefined") return;
    buildWeather();
    const q = new URLSearchParams(location.search).get("weather");
    if (q === "rainbow") { setMode("clear", 30); rainbowUntil = Date.now() + 3600000; }
    else if (q) setMode(q, 60);
    else setMode(Math.random() < 0.55 ? "clear" : choose(), rnd(3, 6));

    decorateWater(); syncBoats();
    const origRender = window.renderWorld;
    window.renderWorld = function () { origRender.apply(this, arguments); decorateWater(); syncBoats(); };
    setInterval(syncBoats, 8000);
    requestAnimationFrame(seaFrame);
    requestAnimationFrame(wxFrame);
    window.__wx = { setMode, jumpFish, boats, get mode() { return mode; } };
  });
})();
