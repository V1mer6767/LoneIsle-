/* LoneIsle — photo mode: take pictures of your island in-game, keep them in an album. */
(function () {
  "use strict";
  const DB = "loneisle_photos_v1", STORE = "p", MAX = 60;
  const root = () => getComputedStyle(document.documentElement);
  const cv = (n, d) => (root().getPropertyValue(n).trim() || d);

  /* ---------- storage (IndexedDB, Blob per photo) ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE), q = fn(s);
    t.oncomplete = () => res(q && q.result);
    t.onerror = () => rej(t.error);
  }));
  const listPhotos = () => tx("readonly", (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.ts - x.ts)).catch(() => []);
  const addPhoto = (blob) => tx("readwrite", (s) => s.add({ ts: Date.now(), blob }));
  const delPhoto = (id) => tx("readwrite", (s) => s.delete(id));
  async function trim() { const l = await listPhotos(); for (const p of l.slice(MAX)) await delPhoto(p.id); }

  /* ---------- scene renderer (draws the game view onto a canvas) ---------- */
  const imgCache = {};
  const loadImg = (u) => imgCache[u] || (imgCache[u] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; }));
  const BOAT = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 36" width="40" height="36"><path d="M20 3 L20 24" stroke="#5a3a1e" stroke-width="1.6"/><path d="M21 4 L34 21 L21 21 Z" fill="#fffaf0"/><path d="M19 7 L8 21 L19 21 Z" fill="#f4d9a8"/><path d="M4 24 L36 24 L31 32 L9 32 Z" fill="#b5532e"/><path d="M4 24 L36 24 L35 26 L5 26 Z" fill="#8e3b1d"/><path d="M20 3 l5 2 -5 2z" fill="#e0523f"/></svg>`);

  function diamond(x, rect, grow) {
    const g = grow || 0, cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, w = rect.width / 2 + g, h = rect.height / 2 + g * 0.54;
    x.beginPath(); x.moveTo(cx, cy - h); x.lineTo(cx + w, cy); x.lineTo(cx, cy + h); x.lineTo(cx - w, cy); x.closePath();
  }

  async function render() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    const c = document.createElement("canvas");
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const x = c.getContext("2d");
    x.scale(dpr, dpr);
    const night = document.body.classList.contains("isNight");

    // sky
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cv("--sky1", "#8fd9f7")); g.addColorStop(0.55, cv("--sky2", "#4fb0e8")); g.addColorStop(1, cv("--sky3", "#2f8fd0"));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const stars = document.getElementById("stars");
    if (stars) {
      const op = parseFloat(stars.style.opacity || "0");
      if (op > 0.05) stars.querySelectorAll("i").forEach((s) => {
        const r = s.getBoundingClientRect(); x.fillStyle = `rgba(255,255,255,${(0.35 + 0.65 * ((r.left * 7 + r.top * 3) % 10) / 10) * op})`; x.fillRect(r.left, r.top, Math.max(1.4, r.width), Math.max(1.4, r.height));
      });
    }
    const moon = document.getElementById("moon");
    if (moon && parseFloat(moon.style.opacity || "0") > 0.5) {
      const r = moon.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
      x.fillStyle = "rgba(255,250,220,.18)"; x.beginPath(); x.arc(mx, my, r.width * 0.85, 0, 7); x.fill();
      x.fillStyle = "#fff6d8"; x.beginPath(); x.arc(mx, my, r.width / 2, 0, 7); x.fill();
    }
    document.querySelectorAll(".sky .cloud").forEach((el) => {
      const r = el.getBoundingClientRect(); if (r.right < 0 || r.left > W) return;
      const op = parseFloat(getComputedStyle(el).opacity || "1") * (night ? 0.25 : 0.85);
      x.fillStyle = `rgba(255,255,255,${op})`;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.7;
      x.beginPath(); x.ellipse(cx, cy, r.width / 2, r.height * 0.5, 0, 0, 7); x.fill();
      x.beginPath(); x.arc(cx - r.width * 0.12, cy - r.height * 0.35, r.height * 0.75, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + r.width * 0.2, cy - r.height * 0.2, r.height * 0.55, 0, 7); x.fill();
    });

    // world items sorted by z-index (painter order, same as the game)
    const items = [];
    const col = { grass: cv("--grass", "#7fce6b"), grassD: cv("--grass-dark", "#5cb04a"), sand: cv("--sand", "#f3d9a0"), sandD: cv("--sand-dark", "#e0be76"), water: cv("--water", "#5fc2e8"), waterD: cv("--water-dark", "#3fa0cf") };
    document.querySelectorAll("#world .tile").forEach((el) => {
      if (el.classList.contains("lockedLand") || el.classList.contains("lockedWater")) return;
      items.push({ z: parseInt(el.style.zIndex || "0", 10), kind: "tile", el });
    });
    document.querySelectorAll("#world .vil").forEach((el) => { if (el.style.display !== "none") items.push({ z: parseInt(el.style.zIndex || "0", 10), kind: "vil", el }); });
    document.querySelectorAll("#world .seaBoat").forEach((el) => items.push({ z: parseInt(el.style.zIndex || "0", 10), kind: "boat", el }));
    document.querySelectorAll("#world .beachFind").forEach((el) => items.push({ z: parseInt(el.style.zIndex || "0", 10), kind: "find", el }));
    items.sort((a, b) => a.z - b.z);
    const boatImg = await loadImg(BOAT);

    for (const it of items) {
      const el = it.el, r = el.getBoundingClientRect();
      if (r.right < -200 || r.left > W + 200 || r.bottom < -300 || r.top > H + 300) continue;
      if (it.kind === "tile") {
        const cl = el.classList;
        let c1, c2;
        if (cl.contains("water")) { c1 = "#7bd6f5"; c2 = col.waterD; }
        else if (cl.contains("dockTile")) { c1 = "#aeb4bd"; c2 = "#5e6570"; }
        else if (cl.contains("zone-forest")) { c1 = "#6fc25f"; c2 = "#2c6b24"; }
        else if (cl.contains("zone-farm")) { c1 = "#e8bc70"; c2 = "#a97c2e"; }
        else if (cl.contains("zone-animals")) { c1 = "#fbe9b8"; c2 = col.sandD; }
        else { c1 = "#93de7d"; c2 = col.grassD; }
        const edge = cl.contains("water") ? col.waterD : (cl.contains("dockTile") ? "#4a4f58" : (cl.contains("zone-forest") ? "#265c1f" : col.grassD));
        x.save();
        if (!cl.contains("noEdge")) { x.globalAlpha = 0.45; x.fillStyle = edge; diamond(x, { left: r.left, top: r.top + r.height * 0.12, width: r.width * 0.92, height: r.height }, 0); x.translate(r.width * 0.04, 0); x.fill(); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = 1; }
        const gr = x.createLinearGradient(r.left, r.top, r.left + r.width * 0.5, r.bottom);
        gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        x.fillStyle = gr; diamond(x, r, 0.5); x.fill();
        if (cl.contains("water")) {
          x.save(); diamond(x, r, 0); x.clip();
          x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = Math.max(1.2, r.width / 36); x.lineCap = "round";
          const seed = (parseInt(el.dataset.c || "0", 10) * 7 + parseInt(el.dataset.r || "0", 10) * 13) % 5;
          for (let k = 0; k < 3; k++) {
            const yy = r.top + r.height * (0.28 + k * 0.22), x0 = r.left + r.width * (0.1 + ((k + seed) % 3) * 0.08), len = r.width * 0.3;
            x.beginPath(); x.moveTo(x0, yy); x.quadraticCurveTo(x0 + len * 0.25, yy - r.height * 0.08, x0 + len * 0.5, yy); x.quadraticCurveTo(x0 + len * 0.75, yy + r.height * 0.08, x0 + len, yy); x.stroke();
          }
          x.restore();
          if (el.querySelector(".foam")) { x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = Math.max(1.4, r.width / 30); x.setLineDash([r.width / 8, r.width / 10]); diamond(x, r, -r.width * 0.02); x.stroke(); x.setLineDash([]); }
        } else {
          x.save(); x.globalAlpha = 0.18; x.fillStyle = "#fff"; diamond(x, { left: r.left + r.width * 0.2, top: r.top + r.height * 0.08, width: r.width * 0.6, height: r.height * 0.45 }, 0); x.fill(); x.restore();
        }
        x.restore();
        // sprites inside the tile
        for (const im of el.querySelectorAll("img.bimg")) {
          if (!im.complete || !im.naturalWidth) continue;
          const ir = im.getBoundingClientRect();
          x.drawImage(im, ir.left, ir.top, ir.width, ir.height);
        }
        if (night) el.querySelectorAll(".glow").forEach((gl) => {
          const gr2 = gl.getBoundingClientRect(), gx = gr2.left + gr2.width / 2, gy = gr2.top + gr2.height / 2, rad = Math.max(gr2.width, 26) * 1.1;
          const rg = x.createRadialGradient(gx, gy, 0, gx, gy, rad); rg.addColorStop(0, "rgba(255,210,120,.65)"); rg.addColorStop(1, "rgba(255,190,90,0)");
          x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = rg; x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2); x.restore();
        });
      } else if (it.kind === "vil") {
        const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage || "");
        if (!m) continue;
        const sheet = await loadImg(m[1]); if (!sheet) continue;
        const pos = (el.style.backgroundPosition || "0px 0px").split(" ").map((v) => -parseFloat(v) || 0);
        x.save(); if (night) x.filter = "brightness(.66) saturate(.85)";
        x.drawImage(sheet, pos[0] * (sheet.naturalWidth / 144), pos[1] * (sheet.naturalHeight / 256), 24 * (sheet.naturalWidth / 144), 32 * (sheet.naturalHeight / 256), r.left, r.top, r.width, r.height);
        x.restore();
      } else if (it.kind === "boat") {
        if (boatImg) {
          const flip = /scaleX\(-1\)/.test(el.style.transform);
          x.save(); if (night) x.filter = "brightness(.65)";
          if (flip) { x.translate(r.left + r.width, 0); x.scale(-1, 1); x.drawImage(boatImg, 0, r.top, r.width, r.height); }
          else x.drawImage(boatImg, r.left, r.top, r.width, r.height);
          x.restore();
        }
      } else if (it.kind === "find") {
        x.font = `${Math.max(16, r.height)}px sans-serif`; x.textBaseline = "middle"; x.textAlign = "center";
        x.fillText(el.firstChild ? el.firstChild.textContent : "", r.left + r.width / 2, r.top + r.height / 2);
      }
    }

    // weather
    const tint = document.getElementById("wxTint");
    if (tint && parseFloat(tint.style.opacity || "0") > 0.02) { x.save(); x.globalAlpha = parseFloat(tint.style.opacity); x.fillStyle = "rgba(60,78,100,.35)"; x.fillRect(0, 0, W, H); x.restore(); }
    const wx = document.getElementById("wxCanvas");
    if (wx && wx.width) x.drawImage(wx, 0, 0, W, H);
    const fog = document.getElementById("wxFog");
    if (fog && parseFloat(fog.style.opacity || "0") > 0.1) {
      const fg = x.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, "rgba(235,242,248,.0)"); fg.addColorStop(0.35, "rgba(235,242,248,.55)"); fg.addColorStop(0.7, "rgba(235,242,248,.45)"); fg.addColorStop(1, "rgba(235,242,248,.1)");
      x.fillStyle = fg; x.fillRect(0, 0, W, H);
    }
    // day tint
    const dt = document.getElementById("dayTint");
    if (dt && dt.style.background) { x.fillStyle = dt.style.background; x.fillRect(0, 0, W, H); }
    // caption
    const now = new Date();
    const cap = `LoneIsle · ${now.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}`;
    x.font = "600 12px sans-serif"; x.textAlign = "left"; x.textBaseline = "alphabetic";
    x.fillStyle = "rgba(0,0,0,.28)"; x.fillText(cap, 13, H - 13);
    x.fillStyle = "rgba(255,255,255,.9)"; x.fillText(cap, 12, H - 14);
    return new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
  }

  /* ---------- UI ---------- */
  let thumbUrl = null;
  const toast = (t) => { try { spawnFloatTextAt(0, 0, t); } catch (e) {} };

  function build() {
    const bar = document.createElement("div");
    bar.id = "photoBar";
    bar.innerHTML = `<button id="pbAlbum" type="button" aria-label="Фотоальбом"><span>🖼️</span></button><button id="pbShutter" type="button" aria-label="Зробити фото"><i></i></button><button id="pbExit" type="button" aria-label="Вийти">✕</button>`;
    document.body.appendChild(bar);
    const flash = document.createElement("div"); flash.id = "photoFlash"; document.body.appendChild(flash);

    const mk = (id, inner) => {
      const o = document.createElement("div"); o.id = id; o.className = "letterOverlay"; o.style.display = "none"; o.innerHTML = inner;
      document.body.appendChild(o); return o;
    };
    const ao = mk("photoAlbumOverlay", `<div class="letterCard journalCard"><div class="letterTitle">🖼️ Фотоальбом</div><div class="questSub" id="photoSub"></div><div id="photoGrid" class="photoGrid"></div><button class="btn ghost full" data-close>Закрити</button></div>`);
    ao.querySelector("[data-close]").addEventListener("click", () => { ao.style.display = "none"; });
    ao.addEventListener("click", (e) => { if (e.target === ao) ao.style.display = "none"; });
    const vo = mk("photoViewOverlay", `<div class="photoViewBox"><img id="photoViewImg" alt=""><div class="photoViewBtns"><button class="btn primary" id="pvSave" type="button">Зберегти</button><button class="btn ghost" id="pvShare" type="button">Поділитись</button><button class="btn ghost" id="pvDel" type="button">Видалити</button><button class="btn ghost" id="pvClose" type="button">Закрити</button></div></div>`);
    vo.addEventListener("click", (e) => { if (e.target === vo) closeView(); });
    document.getElementById("pvClose").addEventListener("click", closeView);

    document.getElementById("pbShutter").addEventListener("click", shoot);
    document.getElementById("pbExit").addEventListener("click", photoOff);
    document.getElementById("pbAlbum").addEventListener("click", openAlbum);

    const list = document.querySelector("#moreSheet .buildList");
    if (list) {
      const mkRow = (ic, name, fn) => {
        const row = document.createElement("div"); row.className = "buildOption";
        row.innerHTML = `<div class="buildOptIcon">${ic}</div><div class="buildOptInfo"><div class="buildOptName">${name}</div></div>`;
        row.addEventListener("click", () => { if (typeof closeMoreSheet === "function") closeMoreSheet(); fn(); });
        return row;
      };
      list.insertBefore(mkRow("📷", "Фото-режим", photoOn), list.children[4]);
      list.insertBefore(mkRow("🖼️", "Фотоальбом", openAlbum), list.children[5]);
    }
  }

  function photoOn() { document.body.classList.add("photoMode"); refreshThumb(); }
  function photoOff() { document.body.classList.remove("photoMode"); }

  async function refreshThumb() {
    const l = await listPhotos();
    const b = document.getElementById("pbAlbum"); if (!b) return;
    if (thumbUrl) { URL.revokeObjectURL(thumbUrl); thumbUrl = null; }
    if (l.length) { thumbUrl = URL.createObjectURL(l[0].blob); b.style.backgroundImage = `url(${thumbUrl})`; b.classList.add("hasThumb"); }
    else { b.style.backgroundImage = ""; b.classList.remove("hasThumb"); }
  }

  let shooting = false;
  async function shoot() {
    if (shooting) return; shooting = true;
    const bar = document.getElementById("photoBar"), fl = document.getElementById("photoFlash");
    try {
      const blob = await render();
      fl.classList.add("on"); setTimeout(() => fl.classList.remove("on"), 220);
      await addPhoto(blob); await trim(); await refreshThumb();
      toast("📸 Збережено в фотоальбом");
    } catch (e) { toast("Не вдалося зробити фото"); }
    shooting = false;
  }

  let urls = [];
  async function openAlbum() {
    const l = await listPhotos();
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    const g = document.getElementById("photoGrid"); g.innerHTML = "";
    document.getElementById("photoSub").textContent = l.length ? `Фото: ${l.length}` : "";
    if (!l.length) g.innerHTML = `<div class="journalEmpty" style="grid-column:1/-1">Фото ще немає. Відкрий «Фото-режим» і натисни на кнопку затвора.</div>`;
    l.forEach((p) => {
      const u = URL.createObjectURL(p.blob); urls.push(u);
      const d = document.createElement("button"); d.type = "button"; d.className = "photoThumb"; d.style.backgroundImage = `url(${u})`;
      d.addEventListener("click", () => openView(p, u));
      g.appendChild(d);
    });
    document.getElementById("photoAlbumOverlay").style.display = "flex";
  }

  function closeView() { document.getElementById("photoViewOverlay").style.display = "none"; }
  function openView(p, u) {
    const vo = document.getElementById("photoViewOverlay");
    document.getElementById("photoViewImg").src = u;
    const name = `loneisle-${new Date(p.ts).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.jpg`;
    document.getElementById("pvSave").onclick = () => { const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    const sh = document.getElementById("pvShare");
    const file = (() => { try { return new File([p.blob], name, { type: "image/jpeg" }); } catch (e) { return null; } })();
    const can = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    sh.style.display = can ? "" : "none";
    sh.onclick = () => { navigator.share({ files: [file], title: "LoneIsle" }).catch(() => {}); };
    document.getElementById("pvDel").onclick = async () => { await delPhoto(p.id); closeView(); await refreshThumb(); openAlbum(); };
    vo.style.display = "flex";
  }

  window.addEventListener("load", () => {
    if (typeof state === "undefined") return;
    build();
    window.__photo = { render, shoot, listPhotos, openAlbum, photoOn, photoOff };
  });
})();
