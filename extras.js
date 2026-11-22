/* LoneIsle — journal: daily quests, achievements, statistics; random island events; seasonal decor. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const icon = (r) => (typeof RES_ICON !== "undefined" && RES_ICON[r]) || "";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lvl = () => state.level || 1;
  const life = (r) => (state.lifetime && state.lifetime[r]) || 0;
  const cb = (id) => (typeof countBuildings === "function" ? countBuildings(id) : 0);
  const fishF = () => state.fishing || {};
  const toast = (t) => { try { showToast(t); } catch (e) {} };
  const save = () => { try { saveGame(); } catch (e) {} };
  const rwText = (rw) => Object.entries(rw).map(([k, n]) => `+${n} ${icon(k)}`).join("  ");
  const give = (rw) => { for (const [k, n] of Object.entries(rw)) addResource(k, n); try { updateHeader(); } catch (e) {} };
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* ================= ACHIEVEMENTS ================= */
  const ACH = [
    { id: "a_wood", t: "Лісоруб", d: "Здобути 500 дерева", g: () => [life("wood"), 500], r: { gold: 30 } },
    { id: "a_stone", t: "Каменяр", d: "Здобути 300 каменю", g: () => [life("stone"), 300], r: { gold: 30 } },
    { id: "a_food", t: "Хлібороб", d: "Зібрати 400 їжі", g: () => [life("food"), 400], r: { gold: 40 } },
    { id: "a_gold", t: "Багатій", d: "Заробити 2000 золота", g: () => [life("gold"), 2000], r: { wood: 100, stone: 50 } },
    { id: "a_lvl5", t: "Дослідник", d: "Досягти 5 рівня", g: () => [lvl(), 5], r: { gold: 40 } },
    { id: "a_lvl10", t: "Господар острова", d: "Досягти 10 рівня", g: () => [lvl(), 10], r: { gold: 120 } },
    { id: "a_lvl15", t: "Легенда архіпелагу", d: "Досягти 15 рівня", g: () => [lvl(), 15], r: { gold: 300 } },
    { id: "a_build10", t: "Будівельник", d: "Мати 10 будівель", g: () => [totalBuildings(), 10], r: { gold: 60 } },
    { id: "a_build25", t: "Архітектор", d: "Мати 25 будівель", g: () => [totalBuildings(), 25], r: { gold: 200 } },
    { id: "a_wh", t: "Запасливий", d: "Збудувати склад", g: () => [cb("warehouse"), 1], r: { gold: 40 } },
    { id: "a_pop8", t: "Дружна громада", d: "8 мешканців на острові", g: () => [state.population | 0, 8], r: { food: 60, gold: 50 } },
    { id: "a_work3", t: "Власна команда", d: "Найняти 3 працівників", g: () => [Object.keys(state.workers || {}).length, 3], r: { gold: 60 } },
    { id: "a_fish1", t: "Перша рибка", d: "Спіймати рибу в міні-грі", g: () => [fishF().catches | 0, 1], r: { gold: 15 } },
    { id: "a_fish25", t: "Майстер вудки", d: "Спіймати 25 риб у міні-грі", g: () => [fishF().catches | 0, 25], r: { gold: 100 } },
    { id: "a_col", t: "Іхтіолог", d: "Відкрити 8 видів риб", g: () => [Object.keys(fishF().col || {}).length, 8], r: { gold: 150 } },
    { id: "a_rare", t: "Щасливий улов", d: "Спіймати рідкісну (і вище) рибу", g: () => [rareCaught(), 1], r: { gold: 80 } },
    { id: "a_isl", t: "Мандрівник", d: "Відкрити 2-й острів", g: () => [state.islandsBought | 0, 1], r: { gold: 100 } },
    { id: "a_daily7", t: "Щодня на острові", d: "Виконати 7 щоденних завдань", g: () => [(state.daily && state.daily.done) | 0, 7], r: { gold: 120 } },
  ];
  function totalBuildings() { return Object.values(state.tiles || {}).filter((t) => t.building).length; }
  function rareCaught() { const c = fishF().col || {}; const rare = (window.__fishing && window.__fishing.FISH.filter((f) => f.r !== "common" && f.r !== "uncommon").map((f) => f.id)) || []; return rare.some((id) => c[id]) ? 1 : 0; }
  function achState() { if (!state.ach || typeof state.ach !== "object") state.ach = {}; return state.ach; }
  function checkAch() {
    let any = false;
    for (const a of ACH) {
      if (achState()[a.id]) continue;
      let c = 0, t = 1; try { [c, t] = a.g(); } catch (e) {}
      if (c >= t) { achState()[a.id] = Date.now(); give(a.r); toast("🏅 Досягнення: " + a.t + "  " + rwText(a.r)); any = true; }
    }
    if (any) save();
  }

  /* ================= DAILY QUESTS ================= */
  const DAILY = [
    { id: "d_wood", t: "Дров на день", get: () => life("wood"), n: (l) => 20 + l * 6 },
    { id: "d_stone", t: "Каменярня", get: () => life("stone"), n: (l) => 12 + l * 4 },
    { id: "d_food", t: "Смачний день", get: () => life("food"), n: (l) => 20 + l * 6 },
    { id: "d_gold", t: "Торговий день", get: () => life("gold"), n: (l) => 30 + l * 10 },
    { id: "d_fish", t: "Рибальський день", get: () => fishF().catches | 0, n: () => 3, unit: "риб у міні-грі" },
    { id: "d_fishlife", t: "Улов дня", get: () => life("fish"), n: (l) => 15 + l * 4 },
  ];
  function daily() {
    const k = todayKey();
    if (!state.daily || typeof state.daily !== "object") state.daily = { date: "", streak: 0, done: 0, lastDone: "" };
    const d = state.daily;
    if (d.date !== k) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yk = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
      if (d.lastDone && d.lastDone !== yk && d.lastDone !== k) d.streak = 0;
      const order = DAILY.map((q) => ({ q, h: hash(k + q.id) })).sort((a, b) => a.h - b.h).slice(0, 3).map((x) => x.q);
      d.date = k; d.ids = order.map((q) => q.id); d.base = {}; d.claimed = [];
      order.forEach((q) => { d.base[q.id] = q.get(); });
      save();
    }
    return d;
  }
  const dReward = () => ({ gold: 30 + lvl() * 6 });
  function dProg(q) { const d = daily(); const need = q.n(lvl()); const cur = Math.max(0, q.get() - (d.base[q.id] || 0)); return { c: Math.min(cur, need), t: need, done: cur >= need }; }
  function claimDaily(id) {
    const d = daily(); const q = DAILY.find((x) => x.id === id);
    if (!q || d.claimed.includes(id) || !dProg(q).done) return;
    d.claimed.push(id); d.done = (d.done | 0) + 1;
    if (d.claimed.length >= 3 && d.lastDone !== todayKey()) { d.lastDone = todayKey(); d.streak = (d.streak | 0) + 1; give({ gold: 20 * Math.min(d.streak, 7) }); toast("🔥 Серія " + d.streak + " дн.! Бонус +" + 20 * Math.min(d.streak, 7) + " 💰"); }
    give(dReward()); save(); checkAch(); render(); badge();
  }
  const dClaimable = () => { const d = daily(); return DAILY.filter((q) => d.ids.includes(q.id) && !d.claimed.includes(q.id) && dProg(q).done).length; };

  /* ================= SEASON ================= */
  function season() {
    const p = new URLSearchParams(location.search).get("season");
    if (p && ["winter", "spring", "summer", "autumn"].includes(p)) return p;
    const m = new Date().getMonth();
    return m === 11 || m < 2 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  }
  const SEASON_UA = { winter: "❄️ Зима", spring: "🌸 Весна", summer: "☀️ Літо", autumn: "🍂 Осінь" };
  function seasonLayer() {
    const s = season(); document.body.classList.add("season-" + s);
    if (reduce || s === "summer" || s === "autumn") return;
    const L = document.createElement("div"); L.id = "seasonLayer"; L.setAttribute("aria-hidden", "true");
    const sym = s === "winter" ? ["❄", "❅", "❆"] : ["🌸"];
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("i"); p.textContent = sym[i % sym.length];
      p.style.left = Math.round(rnd(0, 100)) + "%"; p.style.fontSize = Math.round(rnd(10, 20)) + "px";
      p.style.animationDuration = rnd(9, 18).toFixed(1) + "s"; p.style.animationDelay = (-rnd(0, 18)).toFixed(1) + "s";
      L.appendChild(p);
    }
    document.body.appendChild(L);
  }

  /* ================= RANDOM EVENTS ================= */
  const EVENTS = [
    { e: "📦", t: "Хвилі викинули ящик на берег!", rw: (l) => ({ wood: 12 + l * 3, stone: 6 + l * 2 }) },
    { e: "⛵", t: "Проплив торговець і купив запаси", rw: (l) => ({ gold: 20 + l * 5 }) },
    { e: "🐟", t: "Зграя риби підійшла до берега!", rw: (l) => ({ fish: 8 + l * 2 }) },
    { e: "🌧️", t: "Дощ полив поля — урожай кращий!", rw: (l) => ({ food: 15 + l * 3 }) },
    { e: "💎", t: "На березі блищить дивний камінь", rw: (l) => ({ stone: 15 + l * 3, gold: 10 }) },
    { e: "🎉", t: "Мешканці влаштували свято на острові", rw: (l) => ({ gold: 15 + l * 3, food: 10 }) },
  ];
  let evTimer = 0, evHide = 0;
  function scheduleEvent(ms) { clearTimeout(evTimer); evTimer = setTimeout(fireEvent, ms); }
  function fireEvent() {
    if (document.hidden || !state || (state.level || 1) < 2) { scheduleEvent(60000); return; }
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)]; const rw = ev.rw(lvl());
    let b = $("evBanner"); if (!b) { b = document.createElement("div"); b.id = "evBanner"; document.body.appendChild(b); }
    b.innerHTML = `<span class="evE">${ev.e}</span><span class="evT"></span><button>Забрати ${rwText(rw)}</button>`;
    b.querySelector(".evT").textContent = ev.t;
    b.querySelector("button").addEventListener("click", () => {
      give(rw); if (!state.events) state.events = { n: 0 }; state.events.n = (state.events.n | 0) + 1; save();
      b.classList.remove("show"); clearTimeout(evHide); checkAch();
    });
    b.classList.add("show"); clearTimeout(evHide); evHide = setTimeout(() => b.classList.remove("show"), 30000);
    scheduleEvent(rnd(240000, 480000));
  }

  /* ================= UI ================= */
  let tab = "daily";
  function build() {
    const o = document.createElement("div"); o.id = "logOverlay"; o.className = "letterOverlay"; o.style.display = "none";
    o.innerHTML = `<div class="letterCard journalCard"><div class="letterTitle">📋 Журнал</div>
      <div class="jTabs"><button data-tab="daily">Щоденні</button><button data-tab="ach">Досягнення</button><button data-tab="stats">Статистика</button></div>
      <div id="logBody" class="journalList"></div><button class="btn full" data-close>Закрити</button></div>`;
    document.body.appendChild(o);
    o.querySelector("[data-close]").addEventListener("click", () => { o.style.display = "none"; });
    o.addEventListener("click", (e) => { if (e.target === o) o.style.display = "none"; });
    o.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
    const ref = $("menuBackup");
    if (ref) {
      const row = document.createElement("div"); row.className = "buildOption"; row.id = "menuLog";
      row.innerHTML = `<div class="buildOptIcon">📋</div><div class="buildOptInfo"><div class="buildOptName">Журнал</div><div class="buildOptDesc">Щоденні завдання, досягнення, статистика</div></div><span id="logBadge" class="rowBadge" style="display:none"></span>`;
      ref.parentNode.insertBefore(row, ref);
      row.addEventListener("click", () => { try { closeMoreSheet(); } catch (e) {} open(); });
    }
  }
  function open() { try { markSheetOpened(); } catch (e) {} tab = "daily"; render(); $("logOverlay").style.display = "flex"; }
  function card(h, d, c, t, r, btn) {
    const pct = Math.round((Math.min(c, t) / t) * 100);
    return `<div class="questCard${c >= t ? " done" : ""}"><div class="questH">${h}</div><div class="questD">${d}</div><div class="questBar"><i style="width:${pct}%"></i><span>${Math.floor(Math.min(c, t))} / ${t}</span></div><div class="questR">${r}</div>${btn || ""}</div>`;
  }
  function render() {
    const body = $("logBody"); if (!body) return;
    document.querySelectorAll("#logOverlay [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    let h = "";
    if (tab === "daily") {
      const d = daily();
      h += `<div class="jNote">🔥 Серія: ${d.streak | 0} дн. · Виконано всього: ${d.done | 0}. Нові завдання щодня.</div>`;
      DAILY.filter((q) => d.ids.includes(q.id)).forEach((q) => {
        const p = dProg(q), cl = d.claimed.includes(q.id);
        const btn = cl ? `<div class="jDone">✅ Отримано</div>` : p.done ? `<button class="btn primary full" data-claim="${q.id}">Забрати нагороду</button>` : "";
        h += card(q.t, `Зроби ${p.t} ${q.unit || "ресурсів"}`.replace("ресурсів", { d_wood: "дерева", d_stone: "каменю", d_food: "їжі", d_gold: "золота", d_fishlife: "риби" }[q.id] || "ресурсів"), p.c, p.t, "Нагорода: " + rwText(dReward()), btn);
      });
    } else if (tab === "ach") {
      const done = ACH.filter((a) => achState()[a.id]).length;
      h += `<div class="jNote">Відкрито: ${done} з ${ACH.length}</div>`;
      ACH.forEach((a) => { const [c, t] = a.g(); const ok = !!achState()[a.id]; h += card((ok ? "🏅 " : "🔒 ") + a.t, a.d, ok ? t : c, t, ok ? "✅ Нагороду отримано" : "Нагорода: " + rwText(a.r)); });
    } else {
      const f = fishF(); const rows = [
        ["🏝️ Рівень", lvl()], ["🏠 Будівель", totalBuildings()], ["👥 Мешканців", state.population | 0], ["🧑‍🔧 Працівників", Object.keys(state.workers || {}).length],
        ["🏝️ Островів", 1 + (state.islandsBought | 0)], ["🌲 Дерева здобуто", Math.floor(life("wood"))], ["🪨 Каменю здобуто", Math.floor(life("stone"))],
        ["🌾 Їжі зібрано", Math.floor(life("food"))], ["🐟 Риби здобуто", Math.floor(life("fish"))], ["🥩 М'яса здобуто", Math.floor(life("meat"))], ["💰 Золота зароблено", Math.floor(life("gold"))],
        ["🎣 Спійманo у міні-грі", f.catches | 0], ["📖 Видів риб", Object.keys(f.col || {}).length + " з 13"], ["🎁 Подій на острові", (state.events && state.events.n) | 0],
        ["🏅 Досягнень", ACH.filter((a) => achState()[a.id]).length + " з " + ACH.length], ["🗓️ Сезон", SEASON_UA[season()]],
      ];
      h = `<div class="statGrid">` + rows.map(([k, v]) => `<div class="statRow"><span>${k}</span><b>${v}</b></div>`).join("") + `</div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => claimDaily(b.dataset.claim)));
  }
  function badge() {
    const b = $("logBadge"); if (!b) return; const n = dClaimable();
    b.style.display = n ? "" : "none"; b.textContent = n;
  }

  window.addEventListener("load", () => {
    if (typeof state === "undefined") return;
    build(); daily(); seasonLayer();
    setInterval(() => { try { checkAch(); badge(); const o = $("logOverlay"); if (o && o.style.display === "flex") render(); } catch (e) {} }, 3000);
    setTimeout(() => { checkAch(); badge(); }, 1500);
    scheduleEvent(120000);
    window.__extras = { ACH, DAILY, daily, checkAch, claimDaily, fireEvent, open, season };
  });
})();
