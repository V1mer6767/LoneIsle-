/* LoneIsle — cozy layer: hand-drawn SVG buildings, living sky (day/night, clouds,
   birds), nature sounds (WebAudio, no files) and a quiet story told through
   letters in bottles. Everything works offline. */
(function () {
  "use strict";

  /* ================= SVG buildings ================= */
  const SH = '<ellipse cx="32" cy="55" rx="22" ry="5" fill="#000" opacity=".18"/>';

  function pine(x, y, s, shade) {
    const g1 = shade ? "#2f7d3a" : "#3b9a46";
    const g2 = shade ? "#256b30" : "#2f8a3c";
    return (
      `<g transform="translate(${x} ${y}) scale(${s})">` +
      `<rect x="-2" y="0" width="4" height="9" fill="#7a5233"/>` +
      `<polygon points="0,-30 -13,-6 13,-6" fill="${g2}"/>` +
      `<polygon points="0,-22 -11,-1 11,-1" fill="${g1}"/>` +
      `<polygon points="0,-30 0,-6 13,-6" fill="#000" opacity=".08"/>` +
      `</g>`
    );
  }

  const ART = {
    sawmill: () =>
      SH +
      `<g class="sway">${pine(20, 46, 0.9, true)}</g>` +
      `<g class="sway s2">${pine(44, 46, 1, false)}</g>` +
      `<g class="sway s3">${pine(32, 50, 1.1, false)}</g>` +
      `<rect x="10" y="50" width="9" height="5" rx="2" fill="#9c6a3f"/><rect x="10" y="50" width="9" height="2" fill="#c08a58"/>`,

    farm: () =>
      SH +
      `<polygon points="32,24 58,38 32,52 6,38" fill="#9a6a3a"/>` +
      `<polygon points="32,28 52,38 32,48 12,38" fill="#b5834a"/>` +
      `<g stroke="#e8c04a" stroke-width="2.4" stroke-linecap="round">` +
      `<line x1="20" y1="38" x2="34" y2="31"/><line x1="26" y1="42" x2="40" y2="35"/><line x1="32" y1="46" x2="46" y2="39"/>` +
      `</g>` +
      `<g fill="#79c04b"><circle cx="22" cy="36" r="2.3"/><circle cx="30" cy="32" r="2.3"/><circle cx="36" cy="40" r="2.3"/><circle cx="44" cy="36" r="2.3"/><circle cx="28" cy="44" r="2.3"/></g>` +
      `<rect x="40" y="12" width="16" height="13" fill="#c8483c"/><polygon points="38,13 48,5 58,13" fill="#8e2f27"/><rect x="45" y="17" width="6" height="8" fill="#6d211c"/>`,

    mine: () =>
      SH +
      `<polygon points="6,52 22,16 34,28 44,12 60,52" fill="#8b929c"/>` +
      `<polygon points="44,12 60,52 34,52 38,26" fill="#6f7681"/>` +
      `<polygon points="22,16 34,28 26,52 6,52" fill="#a3aab4"/>` +
      `<path d="M22 52 V38 a8 8 0 0 1 16 0 V52 Z" fill="#2a2f38"/>` +
      `<rect x="20" y="34" width="3" height="18" fill="#9c6a3f"/><rect x="37" y="34" width="3" height="18" fill="#9c6a3f"/><rect x="19" y="32" width="22" height="3" rx="1" fill="#b7814f"/>` +
      `<circle cx="14" cy="46" r="2" fill="#f4c542"/><circle cx="50" cy="40" r="2" fill="#7fd0f0"/>`,

    house: () =>
      SH +
      `<rect x="14" y="30" width="36" height="24" fill="#f3e3c3"/>` +
      `<rect x="38" y="30" width="12" height="24" fill="#000" opacity=".07"/>` +
      `<polygon points="10,32 32,12 54,32" fill="#d4533f"/><polygon points="32,12 54,32 40,32" fill="#b33f2f"/>` +
      `<rect x="40" y="12" width="6" height="12" fill="#8a5a3a"/>` +
      `<rect x="27" y="40" width="10" height="14" rx="1" fill="#7a4e2e"/><circle cx="35" cy="47" r="1" fill="#f4c542"/>` +
      `<rect x="17" y="37" width="7" height="7" fill="#9fd8ef"/><rect x="40" y="37" width="7" height="7" fill="#9fd8ef"/>` +
      `<g class="smoke"><circle cx="43" cy="9" r="3" fill="#fff" opacity=".7"><animate attributeName="cy" values="10;-2" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="4s" repeatCount="indefinite"/><animate attributeName="r" values="2;5" dur="4s" repeatCount="indefinite"/></circle>` +
      `<circle cx="44" cy="9" r="3" fill="#fff" opacity=".7"><animate attributeName="cy" values="10;-2" dur="4s" begin="2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="4s" begin="2s" repeatCount="indefinite"/><animate attributeName="r" values="2;5" dur="4s" begin="2s" repeatCount="indefinite"/></circle></g>`,

    dock: () =>
      `<ellipse cx="32" cy="56" rx="24" ry="4" fill="#0a4a6e" opacity=".25"/>` +
      `<polygon points="6,40 40,24 58,32 24,48" fill="#b0804f"/>` +
      `<polygon points="6,40 24,48 24,53 6,45" fill="#8a6038"/><polygon points="24,48 58,32 58,37 24,53" fill="#76502e"/>` +
      `<g stroke="#8a6038" stroke-width="1.4"><line x1="14" y1="37" x2="32" y2="45"/><line x1="24" y1="33" x2="42" y2="41"/><line x1="34" y1="29" x2="50" y2="36"/></g>` +
      `<rect x="9" y="40" width="4" height="14" fill="#5f3f23"/><rect x="48" y="30" width="4" height="14" fill="#5f3f23"/>` +
      `<circle cx="11" cy="39" r="2" fill="#e8d9b0"/>`,

    boat: () =>
      `<ellipse cx="32" cy="54" rx="20" ry="4" fill="#0a4a6e" opacity=".25"/>` +
      `<path d="M10 40 H54 L46 52 H18 Z" fill="#b5683c"/><path d="M10 40 H54 L52 43 H12 Z" fill="#d68a55"/>` +
      `<rect x="31" y="10" width="2.5" height="31" fill="#6d4a2d"/>` +
      `<polygon points="34,12 34,38 52,38" fill="#fffaf0"/><polygon points="30,16 30,38 16,38" fill="#f3d9d3"/>`,

    cow: () =>
      SH + pen("#a5d66a") +
      `<g><rect x="20" y="30" width="26" height="14" rx="5" fill="#fbfbf7"/>` +
      `<circle cx="29" cy="35" r="3.5" fill="#34383f"/><circle cx="40" cy="39" r="3" fill="#34383f"/>` +
      `<rect x="17" y="26" width="10" height="10" rx="3" fill="#fbfbf7"/><rect x="17" y="30" width="10" height="6" rx="2" fill="#f0b2a8"/>` +
      `<rect x="20" y="42" width="3" height="8" fill="#e6e6df"/><rect x="42" y="42" width="3" height="8" fill="#e6e6df"/>` +
      `<circle cx="22" cy="29" r="1.2" fill="#222"/><polygon points="18,26 17,22 21,25" fill="#e8d9b0"/></g>`,

    pig: () =>
      SH + pen("#a5d66a") +
      `<g><ellipse cx="33" cy="38" rx="14" ry="9" fill="#f6a5b4"/>` +
      `<circle cx="21" cy="35" r="6" fill="#f6a5b4"/><ellipse cx="17" cy="37" rx="3.5" ry="2.6" fill="#ee8ea1"/>` +
      `<polygon points="21,29 25,31 22,33" fill="#ee8ea1"/><circle cx="21" cy="34" r="1.1" fill="#222"/>` +
      `<rect x="25" y="44" width="3" height="6" fill="#ee8ea1"/><rect x="39" y="44" width="3" height="6" fill="#ee8ea1"/>` +
      `<path d="M47 36 q4 -3 2 -6" stroke="#ee8ea1" stroke-width="2" fill="none"/></g>`,

    bull: () =>
      SH + pen("#a5d66a") +
      `<g><rect x="19" y="29" width="28" height="15" rx="5" fill="#7a4b2f"/>` +
      `<rect x="14" y="26" width="11" height="11" rx="3" fill="#5f3a23"/>` +
      `<path d="M14 26 q-5 -6 -2 -10 M25 26 q5 -6 2 -10" stroke="#f1e6c7" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      `<circle cx="19" cy="30" r="1.2" fill="#fff"/><circle cx="19" cy="30" r=".6" fill="#222"/>` +
      `<rect x="21" y="42" width="3.4" height="9" fill="#5f3a23"/><rect x="42" y="42" width="3.4" height="9" fill="#5f3a23"/></g>`,

    townhouse: () =>
      SH +
      `<rect x="13" y="22" width="38" height="32" fill="#cfe1f2"/><rect x="37" y="22" width="14" height="32" fill="#000" opacity=".07"/>` +
      `<polygon points="9,24 32,8 55,24" fill="#4f6fa8"/><polygon points="32,8 55,24 42,24" fill="#3d5a8c"/>` +
      `<rect x="18" y="28" width="8" height="8" fill="#fff3b0"/><rect x="38" y="28" width="8" height="8" fill="#fff3b0"/>` +
      `<rect x="18" y="41" width="8" height="8" fill="#9fd8ef"/><rect x="28" y="41" width="9" height="13" rx="1" fill="#7a4e2e"/><rect x="40" y="41" width="8" height="8" fill="#9fd8ef"/>`,

    restaurant: () =>
      SH +
      `<rect x="10" y="26" width="44" height="28" fill="#f7e7d0"/>` +
      `<path d="M8 28 H56 L52 18 H12 Z" fill="#e24b4b"/>` +
      `<g fill="#fff"><rect x="14" y="18" width="5" height="10"/><rect x="24" y="18" width="5" height="10"/><rect x="34" y="18" width="5" height="10"/><rect x="44" y="18" width="5" height="10"/></g>` +
      `<rect x="14" y="34" width="14" height="12" fill="#9fd8ef"/><rect x="34" y="34" width="8" height="20" rx="1" fill="#7a4e2e"/>` +
      `<circle cx="49" cy="40" r="4" fill="#fff"/><circle cx="49" cy="40" r="2.2" fill="#f4c542"/>`,

    townshop: () =>
      SH +
      `<rect x="10" y="26" width="44" height="28" fill="#eadfc8"/>` +
      `<path d="M8 28 H56 L52 18 H12 Z" fill="#3f9d6a"/>` +
      `<g fill="#fff"><rect x="14" y="18" width="5" height="10"/><rect x="24" y="18" width="5" height="10"/><rect x="34" y="18" width="5" height="10"/><rect x="44" y="18" width="5" height="10"/></g>` +
      `<rect x="14" y="34" width="20" height="12" fill="#9fd8ef"/><rect x="38" y="36" width="10" height="18" rx="1" fill="#7a4e2e"/>` +
      `<rect x="14" y="48" width="8" height="6" fill="#b5834a"/><rect x="24" y="49" width="7" height="5" fill="#c99a62"/>`,
  };

  function pen(grass) {
    return (
      `<polygon points="32,28 58,41 32,54 6,41" fill="${grass}"/>` +
      `<g stroke="#a7794a" stroke-width="2" stroke-linecap="round"><line x1="8" y1="40" x2="32" y2="52"/><line x1="32" y1="52" x2="56" y2="40"/></g>` +
      `<g fill="#8a6038"><rect x="7" y="36" width="2.4" height="8"/><rect x="31" y="49" width="2.4" height="8"/><rect x="54" y="36" width="2.4" height="8"/></g>`
    );
  }

  const SPRITES = ["sawmill", "farm", "mine", "house", "dock", "cow", "pig", "bull", "townhouse", "restaurant", "townshop", "lantern", "flowers", "bench", "campfire", "fountain", "gazebo", "boat"];
  const TIERED = ["house", "sawmill", "farm", "mine", "dock", "cow", "pig", "bull", "townhouse", "restaurant", "townshop"];
  const GLOWS = { lantern: 1, campfire: 1, gazebo: 1, bench: 1, fountain: 1 };
  function spriteSrc(id) { return "sprites/" + (document.body && document.body.classList.contains("isNight") ? "night" : "day") + "/" + id + ".webp"; }
  window.cozyBuildingSVG = function (id, level) {
    if (SPRITES.indexOf(id) < 0) return null;
    level = level || 1;
    // upgrades change the building itself: level 2-3 = tidy yard with fence, level 4-5 = lamps, flags, path
    const tier = level >= 4 ? 3 : level >= 2 ? 2 : 1;
    const key = TIERED.indexOf(id) >= 0 && tier > 1 ? id + "_t" + tier : id;
    const glow = GLOWS[id] ? `<i class="glow g-${id}"></i>` : "";
    return `<img class="bimg" data-b="${key}" src="${spriteSrc(key)}" alt="" draggable="false">${glow}`;
  };
  window.cozyScatter = function (c, r) {
    const h = Math.abs((c * 73856093) ^ (r * 19349663)) % 7;
    if (h > 3) return null;
    return `<img class="bimg scat" src="sprites/scatter/s${h}.webp" alt="" draggable="false">`;
  };
  function swapSprites() {
    document.querySelectorAll("img.bimg[data-b]").forEach((im) => { im.src = spriteSrc(im.dataset.b); });
  }

  /* ================= living sky ================= */
  const STOPS = [
    // hour, sky1, sky2, sky3, tint rgba
    [0,    "#1b2a52", "#101c3d", "#0b1530", [14, 22, 70, 0.2]],
    [5,    "#26386a", "#1a2a54", "#121f45", [14, 22, 70, 0.18]],
    [6.5,  "#f6a98a", "#8a9bd6", "#5d78b8", [255, 170, 120, 0.12]],
    [8.5,  "#8fd9f7", "#4fb0e8", "#2f8fd0", [255, 255, 255, 0.0]],
    [16.5, "#8fd9f7", "#4fb0e8", "#2f8fd0", [255, 255, 255, 0.0]],
    [18.5, "#ffb47a", "#d9809a", "#6a74b8", [255, 130, 70, 0.14]],
    [20.5, "#3a3f7a", "#232a5c", "#161d44", [20, 26, 80, 0.16]],
    [24,   "#1b2a52", "#101c3d", "#0b1530", [14, 22, 70, 0.2]],
  ];
  function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
  function css(rgb) { return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; }

  function skyAt(h) {
    let a = STOPS[0], b = STOPS[1];
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i][0] && h <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
    }
    const t = (h - a[0]) / (b[0] - a[0] || 1);
    return {
      s1: mix(hex(a[1]), hex(b[1]), t),
      s2: mix(hex(a[2]), hex(b[2]), t),
      s3: mix(hex(a[3]), hex(b[3]), t),
      tint: a[4].map((v, i) => v + (b[4][i] - v) * t),
    };
  }
  function nightFactor(h) {
    // 1 = deep night, 0 = day
    if (h < 5 || h >= 21) return 1;
    if (h < 7) return 1 - (h - 5) / 2;
    if (h < 19) return 0;
    if (h < 21) return (h - 19) / 2;
    return 0;
  }

  let curNight = 0;
  function currentHour() {
    const q = new URLSearchParams(location.search).get("hour");
    if (q !== null && !isNaN(parseFloat(q))) return parseFloat(q);
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  window.cozyHour = currentHour;

  function applySky() {
    const h = currentHour();
    const s = skyAt(h);
    const root = document.documentElement;
    root.style.setProperty("--sky1", css(s.s1));
    root.style.setProperty("--sky2", css(s.s2));
    root.style.setProperty("--sky3", css(s.s3));
    const tint = document.getElementById("dayTint");
    if (tint) tint.style.background = `rgba(${Math.round(s.tint[0])},${Math.round(s.tint[1])},${Math.round(s.tint[2])},${s.tint[3].toFixed(3)})`;
    curNight = nightFactor(h);
    const stars = document.getElementById("stars");
    if (stars) stars.style.opacity = String(Math.min(1, curNight * 1.1));
    const moon = document.getElementById("moon");
    if (moon) moon.style.opacity = String(curNight > 0.5 ? 1 : 0);
    const wasNight = document.body.classList.contains("isNight");
    document.body.classList.toggle("isNight", curNight > 0.5);
    if (wasNight !== (curNight > 0.5)) swapSprites();
    const meta = document.querySelector('meta[name="theme-color"]');
    // browser / status-bar colour = the top edge of the picture (sky colour with the daylight tint on top)
    const topCol = css(mix(s.s1, [s.tint[0], s.tint[1], s.tint[2]], s.tint[3]));
    if (meta) meta.setAttribute("content", topCol);
    root.style.setProperty("--skyTop", topCol);
    updateNatureMix();
  }

  function buildSkyLayers() {
    const sky = document.querySelector(".sky");
    if (!sky) return;
    sky.innerHTML =
      `<div id="stars" class="stars"></div>` +
      `<div id="moon" class="moon"></div>` +
      `<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div><div class="cloud c4"></div>` +
      `<div id="birdLane" class="birdLane"></div>`;
    const stars = document.getElementById("stars");
    let sh = "";
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * 100, y = Math.random() * 62, d = 1 + Math.random() * 2;
      sh += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;animation-delay:${(Math.random() * 4).toFixed(1)}s"></i>`;
    }
    stars.innerHTML = sh;
    const tint = document.createElement("div");
    tint.id = "dayTint";
    tint.className = "dayTint";
    document.body.appendChild(tint);
  }

  function spawnBird() {
    if (document.hidden || curNight > 0.6) return;
    const lane = document.getElementById("birdLane");
    if (!lane) return;
    const b = document.createElement("div");
    b.className = "bird";
    b.style.top = 8 + Math.random() * 28 + "%";
    b.style.animationDuration = 22 + Math.random() * 14 + "s";
    b.innerHTML =
      `<svg viewBox="0 0 24 10" width="22" height="9"><path d="M1 8 Q6 0 12 6 Q18 0 23 8" fill="none" stroke="#2b3a4a" stroke-width="1.6" stroke-linecap="round"><animate attributeName="d" dur=".9s" repeatCount="indefinite" values="M1 8 Q6 0 12 6 Q18 0 23 8;M1 3 Q6 7 12 6 Q18 7 23 3;M1 8 Q6 0 12 6 Q18 0 23 8"/></path></svg>`;
    lane.appendChild(b);
    b.addEventListener("animationend", () => b.remove());
    if (Math.random() < 0.4) setTimeout(spawnBird, 1400);
  }

  /* ================= nature sounds (WebAudio) ================= */
  const NATURE_KEY = "loneisle_nature_on";
  let natureOn = localStorage.getItem(NATURE_KEY) !== "false";
  let nctx = null, nMaster = null, waveGain = null, windGain = null, cricketGain = null;
  let natureStarted = false, gullTimer = null;

  function brownNoiseBuffer(ctx) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }
  function noiseSource(ctx) {
    const s = ctx.createBufferSource();
    s.buffer = brownNoiseBuffer(ctx);
    s.loop = true;
    s.start();
    return s;
  }
  function lfo(ctx, freq, depth, target) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
  }

  function startNature() {
    if (natureStarted || !natureOn) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      nctx = new AC();
      nMaster = nctx.createGain();
      nMaster.gain.value = 0;
      nMaster.connect(nctx.destination);

      // waves: low noise swelling slowly
      const wn = noiseSource(nctx);
      const wf = nctx.createBiquadFilter();
      wf.type = "lowpass"; wf.frequency.value = 520;
      waveGain = nctx.createGain(); waveGain.gain.value = 0.34;
      wn.connect(wf); wf.connect(waveGain); waveGain.connect(nMaster);
      lfo(nctx, 0.085, 0.2, waveGain.gain);

      // wind: mid band, very slow
      const wnd = noiseSource(nctx);
      const bf = nctx.createBiquadFilter();
      bf.type = "bandpass"; bf.frequency.value = 520; bf.Q.value = 0.7;
      windGain = nctx.createGain(); windGain.gain.value = 0.1;
      wnd.connect(bf); bf.connect(windGain); windGain.connect(nMaster);
      lfo(nctx, 0.04, 0.07, windGain.gain);
      lfo(nctx, 0.03, 160, bf.frequency);

      // crickets: pulsed high sine, audible at night only
      const co = nctx.createOscillator();
      co.type = "sine"; co.frequency.value = 4300;
      cricketGain = nctx.createGain(); cricketGain.gain.value = 0;
      const pulse = nctx.createGain(); pulse.gain.value = 0;
      co.connect(pulse); pulse.connect(cricketGain); cricketGain.connect(nMaster);
      co.start();
      const po = nctx.createOscillator(); po.type = "square"; po.frequency.value = 9;
      const pg = nctx.createGain(); pg.gain.value = 0.5;
      const bias = nctx.createConstantSource ? nctx.createConstantSource() : null;
      po.connect(pg); pg.connect(pulse.gain);
      if (bias) { bias.offset.value = 0.5; bias.connect(pulse.gain); bias.start(); }
      po.start();

      nMaster.gain.setTargetAtTime(0.5, nctx.currentTime, 2.5);
      natureStarted = true;
      updateNatureMix();
      scheduleGull();
    } catch (e) { /* audio is optional */ }
  }

  function updateNatureMix() {
    if (!natureStarted || !nctx) return;
    const t = nctx.currentTime;
    if (cricketGain) cricketGain.gain.setTargetAtTime(curNight > 0.5 ? 0.012 : 0, t, 3);
    if (windGain) windGain.gain.setTargetAtTime(curNight > 0.5 ? 0.13 : 0.1, t, 3);
  }

  function gull() {
    if (!natureStarted || !natureOn || !nctx || document.hidden || curNight > 0.5) return;
    const t0 = nctx.currentTime;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
      const o = nctx.createOscillator();
      const g = nctx.createGain();
      o.type = "triangle";
      const st = t0 + k * 0.38;
      o.frequency.setValueAtTime(1500, st);
      o.frequency.exponentialRampToValueAtTime(950, st + 0.28);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.025, st + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.3);
      o.connect(g); g.connect(nMaster);
      o.start(st); o.stop(st + 0.34);
    }
  }
  function scheduleGull() {
    clearTimeout(gullTimer);
    gullTimer = setTimeout(() => { gull(); scheduleGull(); }, 35000 + Math.random() * 55000);
  }

  function setNature(on) {
    natureOn = on;
    localStorage.setItem(NATURE_KEY, on ? "true" : "false");
    if (on) {
      if (!natureStarted) startNature();
      else if (nctx) { nctx.resume(); nMaster.gain.setTargetAtTime(0.5, nctx.currentTime, 0.8); }
    } else if (nctx && nMaster) {
      nMaster.gain.setTargetAtTime(0, nctx.currentTime, 0.4);
    }
    refreshNatureMenu();
  }
  window.cozySetNature = setNature;

  function firstGesture() {
    if (natureOn) {
      startNature();
      if (nctx && nctx.state === "suspended") nctx.resume();
    }
  }
  document.addEventListener("pointerdown", firstGesture, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!nctx) return;
    if (document.hidden) nctx.suspend(); else if (natureOn) nctx.resume();
  });

  /* ================= story: letters in bottles ================= */
  const CHAPTERS = [
    {
      id: "arrive", title: "Прибуття",
      when: () => true,
      text: "Хвиля м'яко винесла тебе на пісок. Шторм закінчився, над водою тихо кричать чайки. Острів порожній — але він ніби чекав саме на тебе. Для початку збери трохи дерева.",
      reward: { wood: 10 },
    },
    {
      id: "bottle1", title: "Перша пляшка",
      when: () => state.level >= 2,
      text: "Біля води лежить пляшка із запискою: «Хто б ти не був — острів добрий до тих, хто не поспішає. Рубай дерево, вирощуй культури, слухай море. Решта прийде само. — О.»",
      reward: { wood: 25, food: 5 },
    },
    {
      id: "harvest", title: "Перший урожай",
      when: () => (state.lifetime && state.lifetime.food >= 12) || (typeof countBuildings === "function" && countBuildings("farm") >= 1 && state.level >= 3),
      text: "Пахне свіжим хлібом, хоча ти ще навіть не пік. На краю поля ти знаходиш старий кошик і маленький напис: «Тут завжди було що їсти. Просто хтось мусив почати».",
      reward: { food: 20 },
    },
    {
      id: "hearth", title: "Дим над дахом",
      when: () => typeof countBuildings === "function" && countBuildings("house") >= 1,
      text: "З першої хатини підіймається тонкий димок. Вперше за довгий час острів схожий на дім. Вечорами в вікні горітиме світло — і його видно аж із моря.",
      reward: { gold: 15 },
    },
    {
      id: "neighbors", title: "Нові сусіди",
      when: () => state.population >= 4,
      text: "Хтось постукав у двері. Подорожні побачили твій димок із води й вирішили лишитися. Вони не просять багато: тепло, тарілку їжі і тихі вечори.",
      reward: { food: 30, gold: 20 },
    },
    {
      id: "sea", title: "Море кличе",
      when: () => state.hasDock || (typeof countBuildings === "function" && countBuildings("dock") >= 1),
      text: "Дошки причалу ще пахнуть деревом. Хтось із сусідів каже: «За обрієм є й інші острови. Не треба поспішати — вони нікуди не діватимуться».",
      reward: { wood: 40, gold: 20 },
    },
    {
      id: "bottle2", title: "Друга пляшка",
      when: () => state.level >= 7,
      text: "«Я жив тут багато років, поки не пішов за вітром. Острів завжди повертає тому, хто про нього дбає. Тепер він твій. Бережи його світло. — Орест, колишній доглядач».",
      reward: { gold: 60, stone: 30 },
    },
    {
      id: "festival", title: "Свято на березі",
      when: () => state.population >= 12,
      text: "На заході сонця хтось дістав гітару, хтось — смажену рибу. Острів гомонить, сміється і пахне димком. Ти сидиш на піску й розумієш: саме так виглядає спокій.",
      reward: { gold: 100 },
    },
    {
      id: "firstkid", title: "Дитячий сміх",
      when: () => Array.isArray(state.villagers) && state.villagers.some((v) => v.kid),
      text: "Над островом вперше пролунав дитячий сміх. Чайки навіть притихли, щоб послухати. Діти ростуть швидко — не проґав моменту, коли вони вперше візьмуться за справжню роботу.",
      reward: { food: 20, gold: 20 },
    },
    {
      id: "campfire", title: "Вогнище на пляжі",
      when: () => typeof decorCount === "function" && decorCount() >= 3,
      text: "Вечори стали довшими й теплішими. Мешканці збираються біля вогнища, розповідають історії, діляться смаженою рибою. Поговори з кожним — у кожного є що сказати.",
      reward: { gold: 40 },
    },
    {
      id: "friends", title: "Книга історій",
      when: () => typeof window.cozyHelped === "function" && window.cozyHelped() >= 3,
      text: "Ти допоміг уже трьом сусідам, і про це заговорили. «Той, хто слухає, — найкращий господар», — сказав хтось із них. Острів більше не просто твій. Він спільний.",
      reward: { gold: 80, wood: 40 },
    },
    {
      id: "bottle3", title: "Третя пляшка",
      when: () => state.level >= 10,
      text: "«Я бачив здалеку твій димок, а вночі — світло в вікнах. Це було найкращим, що я бачив у цьому морі. Не зупиняйся. — Орест». На корку є ледь помітний малюнок маяка.",
      reward: { gold: 90, stone: 40 },
    },
    {
      id: "allhelped", title: "Дім для всіх",
      when: () => typeof window.cozyHelped === "function" && window.cozyHelped() >= 6,
      text: "Усі твої сусіди тепер мають свою історію на цьому острові. Хтось співає, хтось пече, хтось креслить мапи. Ти не просто будував, ти збирав людей. Це й є найкраща споруда.",
      reward: { gold: 200, wood: 80, stone: 40 },
    },
    {
      id: "lighthouse", title: "Світло для мандрівників",
      when: () => state.level >= 12,
      text: "Колись Орест мріяв запалити на скелі маяк, щоб кораблі знаходили дорогу. Тепер у тебе є і руки, і друзі, і час. Острів більше не самотній — він став домом.",
      reward: { gold: 200, wood: 100, stone: 60 },
    },
  ];

  function getStory() {
    if (!state.story || typeof state.story !== "object") state.story = { read: [] };
    if (!Array.isArray(state.story.read)) state.story.read = [];
    return state.story;
  }

  let letterOpen = false;
  const queue = [];

  function buildOverlays() {
    const ov = document.createElement("div");
    ov.id = "letterOverlay";
    ov.className = "letterOverlay";
    ov.style.display = "none";
    ov.innerHTML =
      `<div class="letterCard"><div class="letterSeal">✉️</div><div class="letterTitle" id="letterTitle"></div>` +
      `<div class="letterText" id="letterText"></div><div class="letterReward" id="letterReward"></div>` +
      `<button class="btn primary full" id="letterClose">Прочитано</button></div>`;
    document.body.appendChild(ov);
    document.getElementById("letterClose").addEventListener("click", closeLetter);

    const jo = document.createElement("div");
    jo.id = "journalOverlay";
    jo.className = "letterOverlay";
    jo.style.display = "none";
    jo.innerHTML =
      `<div class="letterCard journalCard"><div class="letterTitle">📖 Щоденник острова</div>` +
      `<div id="journalList" class="journalList"></div><button class="btn ghost full" id="journalClose">Закрити</button></div>`;
    document.body.appendChild(jo);
    document.getElementById("journalClose").addEventListener("click", () => { jo.style.display = "none"; });
  }

  function showLetter(ch) {
    letterOpen = true;
    document.getElementById("letterTitle").textContent = ch.title;
    document.getElementById("letterText").textContent = ch.text;
    const parts = Object.entries(ch.reward || {}).map(([r, n]) => `+${n} ${(typeof RES_ICON !== "undefined" && RES_ICON[r]) || r}`);
    document.getElementById("letterReward").textContent = parts.length ? "Подарунок острова: " + parts.join("  ") : "";
    document.getElementById("letterOverlay").style.display = "flex";
    ch._current = true;
  }

  function closeLetter() {
    document.getElementById("letterOverlay").style.display = "none";
    letterOpen = false;
    const story = getStory();
    const ch = CHAPTERS.find((c) => c._current);
    if (ch) {
      ch._current = false;
      if (!story.read.includes(ch.id)) {
        story.read.push(ch.id);
        Object.entries(ch.reward || {}).forEach(([r, n]) => addResource(r, n));
        updateHeader();
        saveGame();
      }
    }
    if (queue.length) setTimeout(() => showLetter(queue.shift()), 600);
  }

  function checkStory() {
    if (typeof state === "undefined" || !state || letterOpen) return;
    const story = getStory();
    for (const ch of CHAPTERS) {
      if (story.read.includes(ch.id) || queue.includes(ch)) continue;
      let ok = false;
      try { ok = ch.when(); } catch (e) {}
      if (ok) { queue.push(ch); }
    }
    if (queue.length && !letterOpen && !anyOverlayOpen()) showLetter(queue.shift());
  }

  function anyOverlayOpen() {
    return ["levelUpOverlay", "treasureOverlay", "welcomeOverlay", "wheelRewardOverlay", "rankUpOverlay", "obTicketOverlay"]
      .some((id) => { const e = document.getElementById(id); return e && e.style.display === "flex"; });
  }

  function openJournal() {
    const story = getStory();
    const list = document.getElementById("journalList");
    list.innerHTML = "";
    const read = CHAPTERS.filter((c) => story.read.includes(c.id));
    if (!read.length) list.innerHTML = `<div class="journalEmpty">Тут з'являтимуться знайдені записки.</div>`;
    read.forEach((c) => {
      const d = document.createElement("div");
      d.className = "journalEntry";
      d.innerHTML = `<div class="journalH"></div><div class="journalT"></div>`;
      d.querySelector(".journalH").textContent = c.title;
      d.querySelector(".journalT").textContent = c.text;
      list.appendChild(d);
    });
    const left = CHAPTERS.length - read.length;
    if (left > 0) {
      const d = document.createElement("div");
      d.className = "journalEmpty";
      d.textContent = `Ще не знайдено записок: ${left}`;
      list.appendChild(d);
    }
    document.getElementById("journalOverlay").style.display = "flex";
  }

  /* ================= menu hooks ================= */
  let natureRow = null;
  function refreshNatureMenu() {
    if (!natureRow) return;
    natureRow.querySelector(".buildOptName").textContent = natureOn ? "Природа: так" : "Природа: ні";
    natureRow.querySelector(".buildOptIcon").textContent = natureOn ? "🌊" : "🔇";
  }
  function addMenuItems() {
    const list = document.querySelector("#moreSheet .buildList");
    if (!list) return;
    const mk = (icon, name, fn) => {
      const row = document.createElement("div");
      row.className = "buildOption";
      row.innerHTML = `<div class="buildOptIcon">${icon}</div><div class="buildOptInfo"><div class="buildOptName">${name}</div></div>`;
      row.addEventListener("click", fn);
      return row;
    };
    list.insertBefore(mk("📖", "Щоденник острова", () => { if (typeof closeMoreSheet === "function") closeMoreSheet(); openJournal(); }), list.firstChild);
    natureRow = mk("🌊", "Звуки природи", () => setNature(!natureOn));
    list.insertBefore(natureRow, list.children[1]);
    refreshNatureMenu();
  }

  /* ================= boot ================= */

  /* ================= wheel of fortune on a vine ================= */
  function buildVineWheel() {
    if (document.getElementById("vineWheel")) return;
    const b = document.createElement("button");
    b.id = "vineWheel"; b.type = "button"; b.title = "Колесо фортуни";
    b.innerHTML =
      `<svg class="vwVine" viewBox="0 0 20 34"><path d="M10 0 C4 6 16 11 10 17 C5 22 15 27 10 34" fill="none" stroke="#3f8f35" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="5" cy="8" rx="4.5" ry="2.6" fill="#5fb84a" transform="rotate(-30 5 8)"/><ellipse cx="15" cy="20" rx="4.5" ry="2.6" fill="#4aa63c" transform="rotate(30 15 20)"/></svg>` +
      `<span class="vwDisc"></span><span class="vwDot">1</span>`;
    b.addEventListener("click", () => { if (typeof openWheelSheet === "function") openWheelSheet(); });
    document.body.appendChild(b);
    const upd = () => { try { const ok = typeof wheelAvailable === "function" && wheelAvailable(); b.classList.toggle("ready", ok); b.style.display = ok ? "" : "none"; } catch (e) {} };
    upd(); setInterval(upd, 1500);
  }

  window.addEventListener("load", () => {
    buildSkyLayers();
    buildVineWheel();
    buildOverlays();
    addMenuItems();
    applySky();
    setInterval(applySky, 60 * 1000);
    setTimeout(spawnBird, 6000);
    setInterval(spawnBird, 45000);
    setTimeout(checkStory, 1500);
    setInterval(checkStory, 4000);
    window.__cozy = { applySky, checkStory, CHAPTERS, openJournal };
  });
})();
