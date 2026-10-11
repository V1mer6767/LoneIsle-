/* LoneIsle — quests, beach finds + album, photo mode. */
(function () {
  "use strict";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const RES_UA = { wood: "дерево", stone: "камінь", food: "їжа", fish: "риба", meat: "м'ясо", gold: "золото" };
  const icon = (r) => (typeof RES_ICON !== "undefined" && RES_ICON[r]) || "";
  const cb = (id) => (typeof countBuildings === "function" ? countBuildings(id) : 0);
  const life = (r) => (state.lifetime && state.lifetime[r]) || 0;
  const album = () => { if (!state.album || typeof state.album !== "object") state.album = { found: {} }; if (!state.album.found) state.album.found = {}; return state.album; };
  const foundCount = () => Object.keys(album().found).length;
  const helped = () => (typeof window.cozyHelped === "function" ? window.cozyHelped() : 0);
  const decor = () => (typeof decorCount === "function" ? decorCount() : 0);
  const save = () => { try { saveGame(); } catch (e) {} };

  /* ================= QUESTS ================= */
  const QUESTS = [
    { id: "q_house", title: "Свій дім", desc: "Збудуй хатину", goal: () => [cb("house"), 1], reward: { wood: 20 } },
    { id: "q_wood", title: "Запас дощок", desc: "Здобудь дерево", goal: () => [life("wood"), 60], reward: { gold: 15 } },
    { id: "q_light", title: "Світло в сутінках", desc: "Постав декор (ліхтар, лавка, вогнище...)", goal: () => [decor(), 2], reward: { gold: 25 } },
    { id: "q_fish", title: "Юшка на вечерю", desc: "Налов риби", goal: () => [life("fish"), 20], reward: { gold: 30, food: 10 } },
    { id: "q_album", title: "Пляжний збирач", desc: "Знайди речі на березі (альбом)", goal: () => [foundCount(), 3], reward: { gold: 30 } },
    { id: "q_pop", title: "Тепло на острові", desc: "Нехай на острові живуть", goal: () => [state.population | 0, 5], reward: { food: 30, gold: 20 } },
    { id: "q_food", title: "Щедрий урожай", desc: "Збери їжу", goal: () => [life("food"), 150], reward: { gold: 40 } },
    { id: "q_help", title: "Добрий сусід", desc: "Допоможи жителям із проханнями", goal: () => [helped(), 2], reward: { gold: 50 } },
    { id: "q_decor", title: "Куточок спокою", desc: "Постав декор", goal: () => [decor(), 6], reward: { gold: 60, stone: 20 } },
    { id: "q_album2", title: "Колекціонер", desc: "Знайди речі на березі", goal: () => [foundCount(), 8], reward: { gold: 80 } },
    { id: "q_town", title: "Маленьке місто", desc: "Збудуй міський будинок", goal: () => [cb("townhouse"), 1], reward: { gold: 80, wood: 40 } },
    { id: "q_gold", title: "Скарбничка", desc: "Зароби золото", goal: () => [life("gold"), 500], reward: { wood: 60, stone: 30 } },
    { id: "q_help2", title: "Серце острова", desc: "Допоможи жителям", goal: () => [helped(), 5], reward: { gold: 120 } },
    { id: "q_album3", title: "Повна колекція", desc: "Знайди всі речі на березі", goal: () => [foundCount(), ITEMS.length], reward: { gold: 250 } },
  ];
  function qState() {
    if (!state.quests || typeof state.quests !== "object") state.quests = { claimed: [] };
    if (!Array.isArray(state.quests.claimed)) state.quests.claimed = [];
    return state.quests;
  }
  const claimed = (q) => qState().claimed.includes(q.id);
  const progress = (q) => { const [c, t] = q.goal(); return { c: Math.min(c, t), t, done: c >= t }; };
  function activeQuests() { return QUESTS.filter((q) => !claimed(q)).slice(0, 3); }
  function claimable() { return activeQuests().filter((q) => progress(q).done).length; }

  function giveReward(rw) {
    for (const [k, n] of Object.entries(rw)) addResource(k, n);
    try { updateHeader(); } catch (e) {}
  }
  const rwText = (rw) => Object.entries(rw).map(([k, n]) => `+${n} ${icon(k)}`).join("  ");

  function claim(q) {
    if (claimed(q) || !progress(q).done) return;
    qState().claimed.push(q.id);
    giveReward(q.reward);
    save(); renderQuests(); refreshBadges();
    try { spawnFloatTextAt(0, 0, "✅ " + q.title); } catch (e) {}
  }
  function renderQuests() {
    const list = document.getElementById("questList"); if (!list) return;
    list.innerHTML = "";
    const act = activeQuests();
    if (!act.length) list.innerHTML = `<div class="journalEmpty">Усі завдання виконано. Чудова робота!</div>`;
    act.forEach((q) => {
      const p = progress(q);
      const d = document.createElement("div");
      d.className = "questCard" + (p.done ? " done" : "");
      d.innerHTML = `<div class="questH"></div><div class="questD"></div><div class="questBar"><i></i><span></span></div><div class="questR"></div>`;
      d.querySelector(".questH").textContent = q.title;
      d.querySelector(".questD").textContent = q.desc;
      d.querySelector(".questBar i").style.width = Math.round((p.c / p.t) * 100) + "%";
      d.querySelector(".questBar span").textContent = `${Math.floor(p.c)} / ${p.t}`;
      const r = d.querySelector(".questR");
      r.textContent = "Нагорода: " + rwText(q.reward);
      if (p.done) {
        const b = document.createElement("button");
        b.className = "btn primary full"; b.textContent = "Забрати нагороду";
        b.addEventListener("click", () => claim(q));
        d.appendChild(b);
      }
      list.appendChild(d);
    });
    const total = QUESTS.length, n = qState().claimed.length;
    document.getElementById("questSub").textContent = `Виконано: ${n} з ${total}`;
  }
  function openQuests() { renderQuests(); document.getElementById("questOverlay").style.display = "flex"; }

  /* ================= BEACH FINDS + ALBUM ================= */
  const ITEMS = [
    { id: "shell", e: "🐚", n: "Мушля-віяло", r: 0, t: "Шепоче море, якщо прикласти до вуха." },
    { id: "crab", e: "🦀", n: "Крабик", r: 0, t: "Боком, але завжди до мети." },
    { id: "coral", e: "🪸", n: "Корал", r: 0, t: "Рожевий і дуже крихкий." },
    { id: "fish", e: "🐠", n: "Тропічна рибка", r: 0, t: "Заплуталась у водоростях, але вже вільна." },
    { id: "oyster", e: "🦪", n: "Устриця", r: 0, t: "Тримає свій маленький секрет." },
    { id: "turtle", e: "🐢", n: "Черепашка", r: 0, t: "Нікуди не поспішає. Як і ти." },
    { id: "bottle", e: "🍾", n: "Пляшка з запискою", r: 1, t: "Папір розмився, але видно слова: «Тримайся берега»." },
    { id: "compass", e: "🧭", n: "Старий компас", r: 1, t: "Стрілка завжди вказує на острів." },
    { id: "coin", e: "🪙", n: "Давня монета", r: 1, t: "На ній чужий король і незнайомий напис." },
    { id: "octo", e: "🐙", n: "Малий восьминіг", r: 1, t: "Втік від чайки. Тепер у безпеці." },
    { id: "lobster", e: "🦞", n: "Лобстер", r: 1, t: "Суворий, але справедливий." },
    { id: "anchor", e: "⚓", n: "Іржавий якір", r: 2, t: "Хтось колись дуже хотів лишитись тут." },
    { id: "trident", e: "🔱", n: "Тризуб", r: 2, t: "Мабуть, належав морському королю." },
    { id: "gem", e: "💎", n: "Морський самоцвіт", r: 2, t: "Світиться навіть у темряві." },
  ];
  const RARITY = ["Звичайна", "Незвичайна", "Рідкісна"];
  const GOLD = [3, 8, 20];
  const WEIGHT = [10, 4, 1];
  const MILESTONES = { 5: { gold: 40 }, 10: { gold: 100, wood: 40 }, 14: { gold: 250, stone: 60 } };

  let finds = [];            // { c, r, item, el }
  let findLayer = null, nextFind = 0;

  function shoreCells() {
    const out = [];
    for (const [k, t] of Object.entries(state.tiles)) {
      if (t.type !== "land" || t.building) continue;
      const [c, r] = k.split(",").map(Number);
      const w = (cc, rr) => { const x = state.tiles[cc + "," + rr]; return x && x.type === "water"; };
      if (w(c + 1, r) || w(c - 1, r) || w(c, r + 1) || w(c, r - 1)) out.push({ c, r });
    }
    return out;
  }
  function pickItem() {
    const have = album().found;
    const pool = ITEMS.map((it) => ({ it, w: WEIGHT[it.r] * (have[it.id] ? 0.45 : 1.6) }));
    let x = Math.random() * pool.reduce((s, p) => s + p.w, 0);
    for (const p of pool) { x -= p.w; if (x <= 0) return p.it; }
    return ITEMS[0];
  }
  function ensureFindLayer() {
    const world = document.getElementById("world"); if (!world) return null;
    if (!findLayer) { findLayer = document.createElement("div"); findLayer.id = "findLayer"; }
    if (findLayer.parentNode !== world) world.appendChild(findLayer);
    for (const f of finds) if (f.el.parentNode !== findLayer) findLayer.appendChild(f.el);
    return findLayer;
  }
  function spawnFind() {
    if (finds.length >= 2) return;
    const cells = shoreCells().filter((s) => !finds.some((f) => f.c === s.c && f.r === s.r));
    if (!cells.length) return;
    const s = pick(cells), item = pickItem();
    const el = document.createElement("div");
    el.className = "beachFind"; el.textContent = item.e;
    finds.push({ c: s.c, r: s.r, item, el, born: Date.now() });
    ensureFindLayer();
  }
  function placeFinds() {
    if (!window.isoPos) return;
    const now = Date.now();
    for (let i = finds.length - 1; i >= 0; i--) {
      const f = finds[i];
      if (now - f.born > 6 * 60 * 1000) { f.el.remove(); finds.splice(i, 1); continue; }
      const t = state.tiles[f.c + "," + f.r];
      if (!t || t.type !== "land" || t.building) { f.el.remove(); finds.splice(i, 1); continue; }
      const p = window.isoPos(f.c, f.r);
      f.el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + 3).toFixed(1)}px) translate(-50%, -70%)`;
      f.el.style.zIndex = String(Math.round(p.y) + 5003);
    }
  }
  function tick() {
    requestAnimationFrame(tick);
    if (typeof state === "undefined" || !state || document.hidden) return;
    const now = Date.now();
    if (now > nextFind) { nextFind = now + rnd(50, 100) * 1000; spawnFind(); }
    placeFinds();
  }

  function collect(f) {
    const it = f.item;
    f.el.remove(); finds.splice(finds.indexOf(f), 1);
    const a = album();
    const isNew = !a.found[it.id];
    a.found[it.id] = (a.found[it.id] || 0) + 1;
    addResource("gold", GOLD[it.r] + (isNew ? 5 : 0));
    try { updateHeader(); } catch (e) {}
    const p = window.isoPos(f.c, f.r);
    try { spawnFloatTextAt(p.x, p.y - 14, `${it.e} ${isNew ? "Нове! " : ""}+${GOLD[it.r] + (isNew ? 5 : 0)} 💰`); } catch (e) {}
    const n = foundCount();
    if (isNew && MILESTONES[n]) {
      giveReward(MILESTONES[n]);
      setTimeout(() => { try { spawnFloatTextAt(p.x, p.y - 36, `🎉 Колекція ${n}/${ITEMS.length}: ${rwText(MILESTONES[n])}`); } catch (e) {} }, 700);
    }
    save(); refreshBadges();
  }
  function hitFind(cx, cy) {
    let best = null, bd = 34;
    for (const f of finds) {
      const r = f.el.getBoundingClientRect();
      const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  function openAlbum() {
    const g = document.getElementById("albumGrid"); g.innerHTML = "";
    const a = album().found;
    ITEMS.forEach((it) => {
      const have = a[it.id];
      const d = document.createElement("div");
      d.className = "albumItem r" + it.r + (have ? " have" : "");
      d.innerHTML = `<div class="aE"></div><div class="aN"></div>`;
      d.querySelector(".aE").textContent = it.e;
      d.querySelector(".aN").textContent = have ? it.n : "???";
      if (have) d.addEventListener("click", () => {
        document.getElementById("albumNote").textContent = `${it.e} ${it.n} · ${RARITY[it.r]}${have > 1 ? " · ×" + have : ""}. ${it.t}`;
      });
      g.appendChild(d);
    });
    document.getElementById("albumNote").textContent = "Торкнись знайденої речі, щоб дізнатись більше.";
    document.getElementById("albumSub").textContent = `Знайдено: ${foundCount()} з ${ITEMS.length}`;
    document.getElementById("albumOverlay").style.display = "flex";
  }

  /* ================= PHOTO MODE ================= */
  function photoOn() {
    if (typeof closeMoreSheet === "function") closeMoreSheet();
    document.body.classList.add("photoMode");
    try { spawnFloatTextAt(0, 0, "📷 Зроби скріншот"); } catch (e) {}
  }
  function photoOff() { document.body.classList.remove("photoMode"); }

  /* ================= UI wiring ================= */
  function badge() {
    const n = claimable();
    const mb = document.getElementById("btnMore");
    if (mb) mb.classList.toggle("hasNew", n > 0);
    const row = document.getElementById("questRowBadge");
    if (row) { row.textContent = n ? String(n) : ""; row.style.display = n ? "" : "none"; }
  }
  function refreshBadges() { try { badge(); } catch (e) {} }

  let notified = new Set();
  function watchQuests() {
    if (typeof state === "undefined" || !state) return;
    for (const q of activeQuests()) {
      if (progress(q).done && !notified.has(q.id)) {
        notified.add(q.id);
        try { spawnFloatTextAt(0, 0, "🎯 Завдання виконано: " + q.title); } catch (e) {}
      }
    }
    badge();
    const qo = document.getElementById("questOverlay");
    if (qo && qo.style.display === "flex") renderQuests();
  }

  function build() {
    const mk = (id, title, sub, body) => {
      const o = document.createElement("div");
      o.id = id; o.className = "letterOverlay"; o.style.display = "none";
      o.innerHTML = `<div class="letterCard journalCard"><div class="letterTitle">${title}</div><div class="questSub" id="${id.replace("Overlay", "Sub")}"></div>${body}<button class="btn ghost full" data-close>Закрити</button></div>`;
      o.querySelector("[data-close]").addEventListener("click", () => { o.style.display = "none"; });
      o.addEventListener("click", (e) => { if (e.target === o) o.style.display = "none"; });
      document.body.appendChild(o);
    };
    mk("questOverlay", "🎯 Завдання", "", `<div id="questList" class="journalList"></div>`);
    mk("albumOverlay", "🐚 Альбом знахідок", "", `<div id="albumGrid" class="albumGrid"></div><div id="albumNote" class="albumNote"></div>`);
    const x = document.createElement("button");
    x.id = "photoExit"; x.type = "button"; x.textContent = "✕"; x.addEventListener("click", photoOff);
    document.body.appendChild(x);

    const list = document.querySelector("#moreSheet .buildList");
    if (list) {
      const mkRow = (ic, name, fn, extra) => {
        const row = document.createElement("div");
        row.className = "buildOption";
        row.innerHTML = `<div class="buildOptIcon">${ic}</div><div class="buildOptInfo"><div class="buildOptName">${name}</div></div>${extra || ""}`;
        row.addEventListener("click", fn);
        return row;
      };
      const close = () => { if (typeof closeMoreSheet === "function") closeMoreSheet(); };
      const rows = [
        mkRow("🎯", "Завдання", () => { close(); openQuests(); }, `<span id="questRowBadge" class="rowBadge" style="display:none"></span>`),
        mkRow("🐚", "Альбом знахідок", () => { close(); openAlbum(); }),
        mkRow("📷", "Фото-режим", photoOn),
      ];
      rows.forEach((r, i) => list.insertBefore(r, list.children[2 + i]));
    }
  }

  window.addEventListener("load", () => {
    if (typeof state === "undefined") return;
    build();
    qState(); album();
    const orig = window.renderWorld;
    window.renderWorld = function () { orig.apply(this, arguments); ensureFindLayer(); };
    const prevPick = window.pickTileAt;
    let lastFind = 0;
    window.pickTileAt = function (x, y) { if (Date.now() - lastFind < 250) return null; return prevPick(x, y); };
    const vp = document.getElementById("viewport");
    let dx0 = 0, dy0 = 0;
    vp.addEventListener("pointerdown", (e) => { dx0 = e.clientX; dy0 = e.clientY; }, true);
    vp.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - dx0, e.clientY - dy0) > 8) return;
      const f = hitFind(e.clientX, e.clientY);
      if (f) { lastFind = Date.now(); collect(f); e.stopPropagation(); }
    }, true);
    nextFind = Date.now() + 9000;
    setInterval(watchQuests, 2500);
    setTimeout(watchQuests, 800);
    requestAnimationFrame(tick);
    window.__quests = { QUESTS, ITEMS, spawnFind, finds, openAlbum, openQuests, collect, claim, album };
  });
})();
