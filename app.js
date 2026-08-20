const STORAGE_KEY = "loneisle_save_v1";
const TILE_W = 74;
const TILE_H = 40;

const $ = (id) => document.getElementById(id);

const BUILDING_DEFS = {
  sawmill: { id: "sawmill", name: "Лісопилка", icon: "🌲", unlockLevel: 1, baseCost: { wood: 10 }, produce: { res: "wood", interval: 4000, cap: 60 }, desc: "Виробляє дерево з часом" },
  farm: { id: "farm", name: "Ферма", icon: "🌾", unlockLevel: 2, baseCost: { wood: 15 }, produce: { res: "food", interval: 5000, cap: 60 }, desc: "Виробляє їжу з часом" },
  mine: { id: "mine", name: "Копальня", icon: "⛏️", unlockLevel: 3, baseCost: { wood: 20, food: 10 }, produce: { res: "stone", interval: 6000, cap: 50 }, desc: "Виробляє камінь з часом" },
  house: { id: "house", name: "Хатина", icon: "🏠", unlockLevel: 4, baseCost: { wood: 25, stone: 15 }, produce: { res: "gold", interval: 10000, cap: 40 }, desc: "Приносить золото з часом" },
  dock: { id: "dock", name: "Причал", icon: "⚓", unlockLevel: 5, baseCost: { wood: 30, stone: 20, food: 10 }, produce: null, special: "dock", desc: "Відкриває будівництво на воді" },
};
const BUILDING_ORDER = ["sawmill", "farm", "mine", "house", "dock"];

const RES_ICON = { wood: "🌲", stone: "🪨", food: "🌾", gold: "🪙" };

let state = null;
const tileEls = new Map();
const badgeEls = new Map();

let pan = { x: 0, y: 0 };
let rotation = 0;
let sheetContext = null; // {kind:'unlock', c, r, unlockKind} | {kind:'build', c, r}

function coordKey(c, r) { return `${c},${r}`; }

function defaultState() {
  const now = Date.now();
  const tiles = {};
  for (let c = -1; c <= 1; c++) {
    for (let r = -1; r <= 1; r++) {
      tiles[coordKey(c, r)] = { type: "land", building: null };
    }
  }
  tiles[coordKey(0, 0)] = { type: "land", building: { id: "sawmill", lastCollect: now } };
  return {
    level: 1,
    xp: 0,
    resources: { wood: 20, stone: 0, food: 0, gold: 5 },
    tiles,
    hasDock: false,
    lastSaveAt: now,
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: defaultState(), gapMs: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.tiles) return { state: defaultState(), gapMs: 0 };
    const gapMs = Date.now() - (parsed.lastSaveAt || Date.now());
    return { state: parsed, gapMs };
  } catch {
    return { state: defaultState(), gapMs: 0 };
  }
}

function saveGame() {
  state.lastSaveAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- xp / level ---------- */
function xpToNext(level) { return 40 + level * 35; }

function gainXP(amount) {
  state.xp += amount;
  let leveled = false;
  let newLevel = state.level;
  while (state.xp >= xpToNext(newLevel)) {
    state.xp -= xpToNext(newLevel);
    newLevel++;
    leveled = true;
  }
  if (leveled) {
    state.level = newLevel;
    showLevelUp(newLevel);
  }
  updateHeader();
}

function showLevelUp(level) {
  const unlocked = BUILDING_ORDER.filter((id) => BUILDING_DEFS[id].unlockLevel === level).map((id) => BUILDING_DEFS[id]);
  $("levelUpLv").textContent = `LV.${level}`;
  $("levelUpUnlock").textContent = unlocked.length
    ? `Розблоковано: ${unlocked.map((b) => `${b.icon} ${b.name}`).join(", ")}`
    : "Продовжуй розвивати острів!";
  $("levelUpOverlay").style.display = "flex";
}

/* ---------- resources ---------- */
function canAfford(cost) {
  return Object.entries(cost).every(([res, amt]) => (state.resources[res] || 0) >= amt);
}
function spend(cost) {
  Object.entries(cost).forEach(([res, amt]) => { state.resources[res] -= amt; });
}
function addResource(res, amt) {
  state.resources[res] = (state.resources[res] || 0) + amt;
}
function formatNum(n) {
  n = Math.floor(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function scaledCost(buildingId) {
  const def = BUILDING_DEFS[buildingId];
  const count = countBuildings(buildingId);
  const mult = Math.pow(1.5, count);
  const cost = {};
  Object.entries(def.baseCost).forEach(([res, amt]) => {
    cost[res] = Math.round(amt * mult);
  });
  return cost;
}

function countBuildings(buildingId) {
  return Object.values(state.tiles).filter((t) => t.building && t.building.id === buildingId).length;
}

function unlockCost(kind) {
  const landCount = Object.values(state.tiles).filter((t) => t.type === "land").length;
  const waterCount = Object.values(state.tiles).filter((t) => t.type === "water").length;
  if (kind === "land") return { wood: 15 + landCount * 5 };
  return { gold: 10 + waterCount * 3 };
}

/* ---------- production ---------- */
function readyAmount(building) {
  const def = BUILDING_DEFS[building.id];
  if (!def.produce) return 0;
  const elapsed = Date.now() - building.lastCollect;
  const ready = Math.floor(elapsed / def.produce.interval);
  return Math.min(ready, def.produce.cap);
}

/* ---------- grid / frontier ---------- */
function neighbors4(c, r) { return [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]; }

function computeFrontier() {
  const frontier = new Map(); // key -> 'land'|'water'
  for (const key of Object.keys(state.tiles)) {
    const [c, r] = key.split(",").map(Number);
    for (const [nc, nr] of neighbors4(c, r)) {
      const nkey = coordKey(nc, nr);
      if (state.tiles[nkey] || frontier.has(nkey)) continue;
      const adjacentToLand = neighbors4(nc, nr).some((n2) => {
        const t = state.tiles[coordKey(n2[0], n2[1])];
        return t && t.type === "land";
      });
      frontier.set(nkey, adjacentToLand ? "land" : "water");
    }
  }
  return frontier;
}

/* ---------- iso positioning ---------- */
function rotateCoord(c, r) {
  switch (rotation % 4) {
    case 1: return [-r, c];
    case 2: return [-c, -r];
    case 3: return [r, -c];
    default: return [c, r];
  }
}
function unrotateCoord(rc, rr) {
  switch (rotation % 4) {
    case 1: return [rr, -rc];
    case 2: return [-rc, -rr];
    case 3: return [-rr, rc];
    default: return [rc, rr];
  }
}
function isoPos(c, r) {
  const [rc, rr] = rotateCoord(c, r);
  return { x: (rc - rr) * (TILE_W / 2), y: (rc + rr) * (TILE_H / 2) };
}

/* ---------- rendering ---------- */
function renderWorld() {
  const world = $("world");
  world.innerHTML = "";
  tileEls.clear();
  badgeEls.clear();
  world.style.setProperty("--tw", TILE_W + "px");
  world.style.setProperty("--th", TILE_H + "px");

  for (const [key, tile] of Object.entries(state.tiles)) {
    const [c, r] = key.split(",").map(Number);
    const el = buildTileEl(c, r, tile.type, tile);
    world.appendChild(el);
    tileEls.set(key, el);
  }

  const frontier = computeFrontier();
  for (const [key, kind] of frontier.entries()) {
    const [c, r] = key.split(",").map(Number);
    const el = buildTileEl(c, r, kind === "land" ? "lockedLand" : "lockedWater", null);
    world.appendChild(el);
    tileEls.set(key, el);
  }

  applyPan();
  updateBadges();
}

function buildTileEl(c, r, cssType, tile) {
  const { x, y } = isoPos(c, r);
  const el = document.createElement("div");
  el.className = `tile ${cssType}`;
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.dataset.c = c;
  el.dataset.r = r;

  const diamond = document.createElement("div");
  diamond.className = "tileDiamond";
  el.appendChild(diamond);

  if (cssType === "land" || cssType === "water") {
    const edge = document.createElement("div");
    edge.className = "tileEdge";
    el.appendChild(edge);
  }

  if (cssType === "lockedLand" || cssType === "lockedWater") {
    const lock = document.createElement("div");
    lock.className = "tileLockIcon";
    lock.textContent = cssType === "lockedLand" ? "🔒" : (state && state.hasDock ? "🔓" : "🔒");
    el.appendChild(lock);
  }

  if (tile && tile.building) {
    const icon = document.createElement("div");
    icon.className = "buildingIcon";
    icon.textContent = BUILDING_DEFS[tile.building.id].icon;
    el.appendChild(icon);

    const badge = document.createElement("div");
    badge.className = "collectBadge";
    badge.style.display = "none";
    el.appendChild(badge);
    badgeEls.set(coordKey(c, r), badge);
  }

  return el;
}

function updateBadges() {
  for (const [key, tile] of Object.entries(state.tiles)) {
    if (!tile.building) continue;
    const def = BUILDING_DEFS[tile.building.id];
    if (!def.produce) continue;
    const badge = badgeEls.get(key);
    if (!badge) continue;
    const ready = readyAmount(tile.building);
    if (ready > 0) {
      badge.style.display = "flex";
      badge.textContent = `+${ready} ${RES_ICON[def.produce.res]}`;
    } else {
      badge.style.display = "none";
    }
  }
}

function updateHeader() {
  $("levelNum").textContent = state.level;
  $("xpFill").style.width = Math.min(100, (state.xp / xpToNext(state.level)) * 100) + "%";
  $("resWood").textContent = formatNum(state.resources.wood);
  $("resStone").textContent = formatNum(state.resources.stone);
  $("resFood").textContent = formatNum(state.resources.food);
  $("resGold").textContent = formatNum(state.resources.gold);
}

/* ---------- floating text ---------- */
function spawnFloatText(c, r, text) {
  const { x, y } = isoPos(c, r);
  const world = $("world");
  const rect = world.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "floatText";
  el.textContent = text;
  el.style.left = rect.left + rect.width / 2 + x + pan.x + "px";
  el.style.top = rect.top + rect.height / 2 + y + pan.y - 20 + "px";
  $("floaters").appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/* ---------- tile interactions ---------- */
function onTileTap(c, r) {
  const key = coordKey(c, r);
  const tile = state.tiles[key];

  if (!tile) {
    const frontier = computeFrontier();
    const kind = frontier.get(key);
    if (!kind) return;
    openUnlockSheet(c, r, kind);
    return;
  }

  if (!tile.building) {
    openBuildSheet(c, r);
    return;
  }

  const ready = readyAmount(tile.building);
  if (ready > 0) {
    collectTile(c, r);
  }
}

function collectTile(c, r) {
  const key = coordKey(c, r);
  const tile = state.tiles[key];
  const def = BUILDING_DEFS[tile.building.id];
  const ready = readyAmount(tile.building);
  if (ready <= 0) return;
  addResource(def.produce.res, ready);
  tile.building.lastCollect = Date.now();
  gainXP(2);
  spawnFloatText(c, r, `+${ready} ${RES_ICON[def.produce.res]}`);
  updateBadges();
  updateHeader();
  saveGame();
}

function collectAll() {
  const totals = {};
  let any = false;
  for (const [key, tile] of Object.entries(state.tiles)) {
    if (!tile.building) continue;
    const def = BUILDING_DEFS[tile.building.id];
    if (!def.produce) continue;
    const ready = readyAmount(tile.building);
    if (ready > 0) {
      addResource(def.produce.res, ready);
      tile.building.lastCollect = Date.now();
      totals[def.produce.res] = (totals[def.produce.res] || 0) + ready;
      any = true;
      gainXP(2);
    }
  }
  if (any) {
    updateBadges();
    updateHeader();
    saveGame();
  }
  return totals;
}

/* ---------- unlock sheet ---------- */
function openUnlockSheet(c, r, kind) {
  sheetContext = { kind: "unlock", c, r, unlockKind: kind };
  const isWater = kind === "water";
  if (isWater && !state.hasDock) {
    $("sheetTitle").textContent = "Потрібен причал";
    $("buildList").innerHTML = `<div class="buildOptDesc" style="padding:6px 2px;">Спочатку побудуй ⚓ Причал (доступний з LV.5), щоб освоювати воду.</div>`;
    openSheet();
    return;
  }
  const cost = unlockCost(kind);
  const afford = canAfford(cost);
  $("sheetTitle").textContent = isWater ? "Освоїти воду" : "Розширити острів";
  $("buildList").innerHTML = "";
  const opt = document.createElement("div");
  opt.className = "buildOption" + (afford ? "" : " disabled");
  opt.innerHTML = `
    <div class="buildOptIcon">${isWater ? "🌊" : "🏝️"}</div>
    <div class="buildOptInfo">
      <div class="buildOptName">${isWater ? "Платформа на воді" : "Нова ділянка землі"}</div>
      <div class="buildOptDesc">${isWater ? "Відкриває клітинку для забудови на воді" : "Відкриває нову клітинку землі"}</div>
      <div class="buildOptCost">${costChips(cost, afford)}</div>
    </div>
  `;
  opt.addEventListener("click", () => {
    if (!canAfford(cost)) return;
    spend(cost);
    state.tiles[coordKey(c, r)] = { type: isWater ? "water" : "land", building: null };
    gainXP(8);
    renderWorld();
    updateHeader();
    saveGame();
    closeSheet();
  });
  $("buildList").appendChild(opt);
  openSheet();
}

/* ---------- build sheet ---------- */
function openBuildSheet(c, r) {
  sheetContext = { kind: "build", c, r };
  $("sheetTitle").textContent = "Що збудувати?";
  const list = $("buildList");
  list.innerHTML = "";

  const available = BUILDING_ORDER.filter((id) => BUILDING_DEFS[id].unlockLevel <= state.level);
  const locked = BUILDING_ORDER.filter((id) => BUILDING_DEFS[id].unlockLevel > state.level);

  available.forEach((id) => {
    const def = BUILDING_DEFS[id];
    const cost = scaledCost(id);
    const afford = canAfford(cost);
    const opt = document.createElement("div");
    opt.className = "buildOption" + (afford ? "" : " disabled");
    opt.innerHTML = `
      <div class="buildOptIcon">${def.icon}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${def.name}</div>
        <div class="buildOptDesc">${def.desc}</div>
        <div class="buildOptCost">${costChips(cost, afford)}</div>
      </div>
    `;
    opt.addEventListener("click", () => {
      if (!canAfford(cost)) return;
      spend(cost);
      state.tiles[coordKey(c, r)].building = { id, lastCollect: Date.now() };
      if (def.special === "dock") state.hasDock = true;
      gainXP(12);
      renderWorld();
      updateHeader();
      saveGame();
      closeSheet();
    });
    list.appendChild(opt);
  });

  if (locked.length) {
    const hint = document.createElement("div");
    hint.className = "buildOptDesc";
    hint.style.padding = "4px 2px";
    hint.textContent = "Ще недоступно: " + locked.map((id) => `${BUILDING_DEFS[id].icon} ${BUILDING_DEFS[id].name} (LV.${BUILDING_DEFS[id].unlockLevel})`).join(", ");
    list.appendChild(hint);
  }

  openSheet();
}

function costChips(cost, afford) {
  return Object.entries(cost)
    .map(([res, amt]) => {
      const have = state.resources[res] || 0;
      const short = have < amt;
      return `<span class="costChip${short ? " short" : ""}">${RES_ICON[res]} ${amt}</span>`;
    })
    .join("");
}

function openSheet() {
  $("sheetBackdrop").style.display = "block";
  $("buildSheet").style.display = "block";
}
function closeSheet() {
  $("sheetBackdrop").style.display = "none";
  $("buildSheet").style.display = "none";
  sheetContext = null;
}

function rotateView() {
  rotation = (rotation + 1) % 4;
  for (const [key, el] of tileEls.entries()) {
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
}

/* ---------- panning ---------- */
function applyPan() {
  $("world").style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}

function wirePanning() {
  const viewport = $("viewport");
  let down = false, moved = false, startX = 0, startY = 0, origX = 0, origY = 0;

  viewport.addEventListener("pointerdown", (e) => {
    down = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    origX = pan.x; origY = pan.y;
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    pan.x = origX + dx;
    pan.y = origY + dy;
    applyPan();
  });

  const end = (e) => {
    if (!down) return;
    down = false;
    if (!moved) {
      const tile = pickTileAt(e.clientX, e.clientY);
      if (tile) onTileTap(tile.c, tile.r);
    }
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
}

function pickTileAt(clientX, clientY) {
  const vpRect = $("viewport").getBoundingClientRect();
  const originX = vpRect.left + vpRect.width * 0.5 + pan.x;
  const originY = vpRect.top + vpRect.height * 0.46 + pan.y;
  const relX = clientX - originX;
  const relY = clientY - originY;
  const rcf = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
  const rrf = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
  const [c, r] = unrotateCoord(Math.round(rcf), Math.round(rrf));
  return { c, r };
}

/* ---------- misc ---------- */
function hardRefresh() {
  const btn = $("btnRefresh");
  if (btn) { btn.textContent = "⏳"; btn.disabled = true; }
  const cleanup = [];
  if ("caches" in window) cleanup.push(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  if ("serviceWorker" in navigator) cleanup.push(navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))));
  Promise.all(cleanup).catch(() => {}).finally(() => {
    location.replace(location.pathname + "?v=" + Date.now());
  });
}

async function registerSW() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }
}

function wire() {
  $("btnRotate").addEventListener("click", rotateView);
  $("btnRefresh").addEventListener("click", hardRefresh);
  $("btnCloseSheet").addEventListener("click", closeSheet);
  $("sheetBackdrop").addEventListener("click", closeSheet);
  $("btnLevelUpClose").addEventListener("click", () => { $("levelUpOverlay").style.display = "none"; });
  $("btnWelcomeClose").addEventListener("click", () => { $("welcomeOverlay").style.display = "none"; });
  wirePanning();
}

function init() {
  const { state: loaded, gapMs } = loadGame();
  state = loaded;
  wire();
  registerSW();
  renderWorld();
  updateHeader();

  if (gapMs > 30000) {
    const totals = collectAll();
    const parts = Object.entries(totals).map(([res, amt]) => `+${amt} ${RES_ICON[res]}`);
    if (parts.length) {
      $("welcomeText").textContent = "Поки тебе не було, острів попрацював: " + parts.join("  ");
      $("welcomeOverlay").style.display = "flex";
    }
  }
  saveGame();

  setInterval(updateBadges, 1000);
  setInterval(saveGame, 8000);
}

init();
