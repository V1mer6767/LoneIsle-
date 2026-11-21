/* LoneIsle — fishing mini-game: timing catch, species + rarity, collection, rod upgrades. */
(function () {
  "use strict";
  const UNLOCK_LEVEL = 5;
  const RARITY = {
    common: { name: "Звичайна", color: "#7a8a99", w: 60, pen: 0, xp: 1 },
    uncommon: { name: "Незвичайна", color: "#3fae5a", w: 25, pen: 3, xp: 2 },
    rare: { name: "Рідкісна", color: "#3a7bd5", w: 10, pen: 6, xp: 4 },
    epic: { name: "Епічна", color: "#9b4dd0", w: 4, pen: 9, xp: 8 },
    legendary: { name: "Легендарна", color: "#e8a317", w: 1, pen: 12, xp: 15 },
  };
  const FISH = [
    { id: "sprat", name: "Хамса", e: "🐟", r: "common", p: 3, s: [6, 12] },
    { id: "perch", name: "Окунь", e: "🐠", r: "common", p: 4, s: [15, 35] },
    { id: "mackerel", name: "Скумбрія", e: "🐟", r: "common", p: 5, s: [25, 45] },
    { id: "shrimp", name: "Креветка", e: "🦐", r: "common", p: 4, s: [8, 16] },
    { id: "tuna", name: "Тунець", e: "🐟", r: "uncommon", p: 12, s: [50, 120] },
    { id: "crab", name: "Краб", e: "🦀", r: "uncommon", p: 10, s: [12, 25] },
    { id: "squid", name: "Кальмар", e: "🦑", r: "uncommon", p: 14, s: [20, 60] },
    { id: "puffer", name: "Риба-куля", e: "🐡", r: "rare", p: 25, s: [20, 40] },
    { id: "octopus", name: "Восьминіг", e: "🐙", r: "rare", p: 30, s: [40, 90] },
    { id: "turtle", name: "Морська черепаха", e: "🐢", r: "rare", p: 28, s: [50, 100] },
    { id: "shark", name: "Акула", e: "🦈", r: "epic", p: 70, s: [150, 300] },
    { id: "whale", name: "Малий кит", e: "🐋", r: "legendary", p: 200, s: [400, 700] },
    { id: "goldfish", name: "Золота рибка", e: "✨", r: "legendary", p: 150, s: [10, 20] },
  ];
  const RODS = [
    null,
    { name: "Бамбукова вудка", cost: null },
    { name: "Міцна вудка", cost: { wood: 60, gold: 30 } },
    { name: "Карбонова вудка", cost: { wood: 120, stone: 40, gold: 90 } },
    { name: "Золота вудка", cost: { wood: 200, stone: 100, gold: 250 } },
  ];
  const BAIT = { food: 1 };
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const byId = (id) => FISH.find((f) => f.id === id);
  const resIcon = (r) => (typeof RES_ICON !== "undefined" && RES_ICON[r]) || r;

  function F() {
    if (!state.fishing || typeof state.fishing !== "object") state.fishing = {};
    const f = state.fishing;
    if (!f.rod || f.rod < 1) f.rod = 1;
    if (!f.stock || typeof f.stock !== "object") f.stock = {};
    if (!f.col || typeof f.col !== "object") f.col = {};
    f.casts = f.casts | 0; f.catches = f.catches | 0;
    return f;
  }
  const stockValue = () => Object.entries(F().stock).reduce((s, [id, n]) => s + (byId(id) ? byId(id).p * n : 0), 0);
  const stockCount = () => Object.values(F().stock).reduce((s, n) => s + n, 0);
  const stockFood = () => Object.entries(F().stock).reduce((s, [id, n]) => s + (byId(id) ? Math.ceil(byId(id).p / 2) * n : 0), 0);
  const costHTML = (cost) => (typeof costChips === "function" ? costChips(cost, canAfford(cost)) : "");

  function pickFish() {
    const luck = 1 + 0.35 * (F().rod - 1);
    const weights = FISH.map((f) => { const rr = RARITY[f.r]; return rr.w * (f.r === "common" ? 1 : luck); });
    let t = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < FISH.length; i++) { t -= weights[i]; if (t <= 0) return FISH[i]; }
    return FISH[0];
  }

  /* ---------- UI ---------- */
  let built = false, phase = "idle", rafId = 0, biteTimer = 0, escapeTimer = 0, current = null, t0 = 0, msg = "";
  function build() {
    if (built) return; built = true;
    const bd = document.createElement("div"); bd.id = "fishSheetBackdrop"; bd.className = "sheetBackdrop"; bd.style.display = "none";
    const sh = document.createElement("div"); sh.id = "fishSheet"; sh.className = "sheet"; sh.style.display = "none";
    sh.innerHTML = `<div class="sheetHandle"></div><div class="sheetTitle">🎣 Рибалка</div><div id="fishBody"></div><button class="btnSecondary" id="fishClose" style="width:100%;margin-top:10px;">Закрити</button>`;
    document.body.appendChild(bd); document.body.appendChild(sh);
    bd.addEventListener("click", close); sh.querySelector("#fishClose").addEventListener("click", close);
    const menu = document.createElement("div"); menu.className = "buildOption"; menu.id = "menuFishGame";
    menu.innerHTML = `<div class="buildOptIcon">🎣</div><div class="buildOptInfo"><div class="buildOptName">Рибалка (міні-гра)</div><div class="buildOptDesc">Лови рідкісну рибу, збирай колекцію</div></div>`;
    const ref = $("menuBackup"); ref.parentNode.insertBefore(menu, ref);
    menu.addEventListener("click", () => {
      try { closeMoreSheet(); } catch (e) {}
      if (state.level < UNLOCK_LEVEL) { try { showToast("🎣 Рибалка відкривається з рівня " + UNLOCK_LEVEL); } catch (e) {} return; }
      open();
    });
  }
  function open() {
    build(); try { markSheetOpened(); } catch (e) {}
    phase = "idle"; msg = "Закинь вудку й чекай поклювання";
    $("fishSheetBackdrop").style.display = "block"; $("fishSheet").style.display = "block"; render();
  }
  function close() {
    cancelAnimationFrame(rafId); clearTimeout(biteTimer); clearTimeout(escapeTimer); phase = "idle";
    const bd = $("fishSheetBackdrop"), sh = $("fishSheet"); if (bd) bd.style.display = "none"; if (sh) sh.style.display = "none";
  }
  function render() {
    const f = F(); const body = $("fishBody"); if (!body) return;
    const canCast = phase === "idle" && canAfford(BAIT);
    const btnLabel = phase === "idle" ? `Закинути вудку (−1 ${resIcon("food")})` : phase === "wait" ? "Чекаємо поклювання…" : phase === "bite" ? "ПІДСІКАЙ!" : "…";
    const zone = zoneWidth(null);
    const next = RODS[f.rod + 1];
    const rodRow = next
      ? `<div class="buildOption${canAfford(next.cost) ? "" : " disabled"}" id="fishRodUp"><div class="buildOptIcon">🎣</div><div class="buildOptInfo"><div class="buildOptName">Покращити: ${next.name}</div><div class="buildOptDesc">Ширша зона вдалого підсікання й більше шансів на рідкісну рибу</div><div class="buildOptCost">${costHTML(next.cost)}</div></div></div>`
      : `<div class="fishMax">🏅 Золота вудка — максимум</div>`;
    const col = FISH.map((x) => {
      const c = f.col[x.id]; const rr = RARITY[x.r];
      return c ? `<div class="fishCell" style="border-color:${rr.color}" title="${x.name} · ${rr.name}"><span>${x.e}</span><b>${x.name}</b><i>×${c.n} · рекорд ${c.best} см</i></div>`
               : `<div class="fishCell unk"><span>❔</span><b>???</b><i>${rr.name}</i></div>`;
    }).join("");
    body.innerHTML = `
      <div class="fishScene"><div class="fishWave"></div><div class="fishBobber ${phase}" id="fishBobber">${phase === "bite" ? "❗" : "🎣"}</div></div>
      <div class="fishMsg" id="fishMsg">${msg}</div>
      <div class="fishBar" id="fishBar"><div class="fishZone" style="left:${50 - zone / 2}%;width:${zone}%"></div><div class="fishMark" id="fishMark"></div></div>
      <button class="fishBtn${canCast || phase === "bite" ? "" : " disabled"}" id="fishCast">${btnLabel}</button>
      <div class="fishStats">Вудка: ${RODS[f.rod].name} · спроб: ${f.casts} · улов: ${f.catches}</div>
      <div class="fishSection">🧺 Улов у кошику: ${stockCount()}</div>
      <div class="fishActions">
        <button class="fishAct${stockCount() ? "" : " disabled"}" id="fishSell">💰 Продати все (+${stockValue()})</button>
        <button class="fishAct${stockCount() ? "" : " disabled"}" id="fishCook">🍲 Приготувати (+${stockFood()} ${resIcon("food")})</button>
      </div>
      ${rodRow}
      <div class="fishSection">📖 Колекція ${Object.keys(f.col).length}/${FISH.length}</div>
      <div class="fishGrid">${col}</div>`;
    $("fishCast").addEventListener("click", onMain);
    $("fishBar").addEventListener("pointerdown", () => { if (phase === "bite") strike(); });
    $("fishSell").addEventListener("click", sellAll);
    $("fishCook").addEventListener("click", cookAll);
    const up = $("fishRodUp"); if (up) up.addEventListener("click", upgradeRod);
  }
  function setMsg(t) { msg = t; const m = $("fishMsg"); if (m) m.textContent = t; }

  /* ---------- game ---------- */
  function zoneWidth(fish) { return Math.max(8, 20 + 6 * F().rod - (fish ? RARITY[fish.r].pen : 0)); }
  function onMain() {
    if (phase === "bite") return strike();
    if (phase !== "idle") return;
    if (!canAfford(BAIT)) { setMsg("Немає наживки — потрібна 1 " + resIcon("food")); return; }
    spend(BAIT); F().casts++; updateHeader(); saveGame();
    phase = "wait"; current = pickFish(); render(); setMsg("Поплавок на воді… чекай");
    biteTimer = setTimeout(startBite, rnd(1200, 3200));
  }
  function startBite() {
    if (phase !== "wait") return;
    phase = "bite"; render(); setMsg("Клює! Тисни, коли маркер у зеленій зоні");
    t0 = performance.now();
    const speed = rnd(0.0011, 0.0016) * (1 + 0.15 * ["common", "uncommon", "rare", "epic", "legendary"].indexOf(current.r));
    const loop = (now) => {
      if (phase !== "bite") return;
      const mk = $("fishMark"); if (!mk) return;
      const pos = 50 + 50 * Math.sin((now - t0) * speed * 2 * Math.PI * 0.5 * 1.8);
      mk.style.left = pos + "%"; mk.dataset.pos = pos;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    escapeTimer = setTimeout(() => { if (phase === "bite") finish(false, true); }, 4500);
  }
  function strike() {
    if (phase !== "bite") return;
    const mk = $("fishMark"); const pos = parseFloat(mk && mk.dataset.pos) || 0;
    const hit = Math.abs(pos - 50) <= zoneWidth(current) / 2;
    finish(hit, false);
  }
  function finish(hit, timeout) {
    cancelAnimationFrame(rafId); clearTimeout(escapeTimer); clearTimeout(biteTimer);
    const f = F(); const fish = current; phase = "idle";
    if (!hit) { render(); setMsg(timeout ? "Риба зірвалась — запізно!" : "Промах! Риба втекла."); return; }
    const size = Math.round(rnd(fish.s[0], fish.s[1]));
    const isNew = !f.col[fish.id];
    const c = f.col[fish.id] || (f.col[fish.id] = { n: 0, best: 0 });
    c.n++; c.best = Math.max(c.best, size);
    f.stock[fish.id] = (f.stock[fish.id] | 0) + 1; f.catches++;
    if (!state.lifetime) state.lifetime = {};
    state.lifetime.fish = (state.lifetime.fish || 0) + 1;
    try { gainXP(RARITY[fish.r].xp); } catch (e) {}
    if (isNew) addResource("gold", 5);
    try { updateHeader(); } catch (e) {}
    saveGame(); render();
    setMsg(`${fish.e} ${fish.name} · ${size} см · ${RARITY[fish.r].name}${isNew ? " — НОВА РИБА! +5 💰" : ""}`);
  }
  function sellAll() {
    const v = stockValue(); if (!v) return;
    addResource("gold", v); F().stock = {}; updateHeader(); saveGame(); render(); setMsg(`Продано! +${v} 💰`);
  }
  function cookAll() {
    const v = stockFood(); if (!v) return;
    const before = state.resources.food || 0;
    addResource("food", v); const got = (state.resources.food || 0) - before;
    F().stock = {}; updateHeader(); saveGame(); render();
    setMsg(got < v ? `Юшка готова: +${got} ${resIcon("food")} (склад повний, частина пропала)` : `Юшка готова! +${got} ${resIcon("food")}`);
  }
  function upgradeRod() {
    const f = F(); const next = RODS[f.rod + 1]; if (!next || !canAfford(next.cost)) return;
    spend(next.cost); f.rod++; try { gainXP(15); updateHeader(); } catch (e) {} saveGame(); render(); setMsg("Вудку покращено: " + RODS[f.rod].name);
  }
  window.__fishing = { FISH, RARITY, F, pickFish, zoneWidth, open, close };
  const boot = () => { try { if (document.getElementById("menuBackup")) build(); } catch (e) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
