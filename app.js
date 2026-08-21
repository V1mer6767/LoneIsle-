const STORAGE_KEY = "loneisle_save_v1";
const TILE_W = 74;
const TILE_H = 40;

const $ = (id) => document.getElementById(id);

const BUILDING_DEFS = {
  sawmill: { id: "sawmill", name: "Лісопилка", icon: "🌲", unlockLevel: 1, baseCost: { wood: 6 }, produce: { res: "wood", interval: 4000, cap: 60 }, desc: "Виробляє дерево з часом" },
  farm: { id: "farm", name: "Ферма", icon: "🌾", unlockLevel: 2, baseCost: { wood: 10 }, produce: { res: "food", interval: 5000, cap: 60 }, desc: "Виробляє їжу з часом" },
  mine: { id: "mine", name: "Копальня", icon: "⛏️", unlockLevel: 3, baseCost: { wood: 14, food: 7 }, produce: { res: "stone", interval: 6000, cap: 50 }, desc: "Виробляє камінь з часом" },
  house: { id: "house", name: "Хатина", icon: "🏠", unlockLevel: 4, baseCost: { wood: 18, stone: 10 }, produce: { res: "gold", interval: 10000, cap: 40 }, desc: "Приносить золото з часом" },
  dock: { id: "dock", name: "Причал", icon: "⚓", unlockLevel: 5, baseCost: { wood: 22, stone: 14, food: 7 }, produce: null, special: "dock", desc: "Відкриває будівництво на воді" },
  boat: { id: "boat", name: "Рибальський човен", icon: "⛵", unlockLevel: 6, baseCost: { wood: 18, gold: 10 }, produce: { res: "fish", interval: 5000, cap: 70 }, desc: "Плаває в морі й ловить рибу" },
};
const BUILDING_ORDER = ["sawmill", "farm", "mine", "house", "dock"];

const RES_ICON = { wood: "🌲", stone: "🪨", food: "🌾", fish: "🐟", gold: "💰" };

const WORKER_DEFS = {
  wood: { res: "wood", name: "Лісоруб", icon: "🧝", unlockLevel: 2, cost: { wood: 40 } },
  food: { res: "food", name: "Фермер", icon: "🧑‍🌾", unlockLevel: 3, cost: { wood: 30, food: 20 } },
  stone: { res: "stone", name: "Шахтар", icon: "👷", unlockLevel: 4, cost: { wood: 40, stone: 20 } },
  fish: { res: "fish", name: "Рибалка", icon: "🎣", unlockLevel: 6, cost: { wood: 35, gold: 20 } },
  gold: { res: "gold", name: "Скарбник", icon: "🧞", unlockLevel: 6, cost: { wood: 50, gold: 30 } },
};
const WORKER_CYCLE_MS = 3500;

const ISLAND_CENTERS = [
  { c: 0, r: 0 },   // головний острів (завжди твій)
  { c: 7, r: -3 },  // 2-й
  { c: 3, r: 9 },   // 3-й
  { c: -9, r: 4 },  // 4-й
  { c: -4, r: -10 }, // 5-й
  { c: 12, r: 7 },  // 6-й
];
const ISLAND_LEVEL_REQ = [0, 7, 9, 11, 13, 15];
const ISLAND_BASE_COST = { wood: 200, stone: 80, gold: 60 };
const ISLAND_COST_MULT = 1.7;

let state = null;
const tileEls = new Map();
const badgeEls = new Map();
const dockShedEls = new Map();

let pan = { x: 0, y: 0 };
let rotation = 0;
let sheetContext = null; // {kind:'unlock', c, r, unlockKind} | {kind:'build', c, r}

function coordKey(c, r) { return `${c},${r}`; }
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

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
    resources: { wood: 20, stone: 0, food: 0, fish: 0, gold: 5 },
    tiles,
    hasDock: false,
    boats: [],
    workers: {},
    islandsBought: 0,
    treasures: {},
    lastSaveAt: now,
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: defaultState(), gapMs: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.tiles) return { state: defaultState(), gapMs: 0 };
    if (!Array.isArray(parsed.boats)) parsed.boats = [];
    const now0 = Date.now();
    parsed.boats.forEach((b) => {
      if (typeof b.expiresAt !== "number") b.expiresAt = now0 + BOAT_RENT_MS;
    });
    if (parsed.boats.length > MAX_BOATS) {
      parsed.boats = parsed.boats.slice(-MAX_BOATS);
    }
    if (!parsed.workers || typeof parsed.workers !== "object") parsed.workers = {};
    if (typeof parsed.resources.fish !== "number") parsed.resources.fish = 0;
    if (typeof parsed.islandsBought !== "number") {
      parsed.islandsBought = parsed.secondIslandBought ? 1 : 0;
    }
    if (!parsed.treasures || typeof parsed.treasures !== "object") parsed.treasures = {};
    delete parsed.secondIslandBought;
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
  const unlocked = Object.values(BUILDING_DEFS).filter((b) => b.unlockLevel === level);
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
  const mult = 1 + count * 0.1;
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
  if (kind === "land") {
    const growth = Math.round(landCount * 1.5);
    const cost = { wood: 6 + growth };
    if (state.level >= 2) cost.food = 5 + growth; // ферма вже доступна
    if (state.level >= 3) cost.stone = 5 + growth; // копальня вже доступна
    return cost;
  }
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

/* ---------- fishing boats ---------- */
const boatEls = new Map();

const BOAT_LAND_MARGIN = 1.7;

function isFarEnoughFromLand(c, r, margin) {
  for (const key of Object.keys(state.tiles)) {
    const [tc, tr] = key.split(",").map(Number);
    if (Math.hypot(c - tc, r - tr) < margin) return false;
  }
  return true;
}

function boatGridPos(index, startAngle, startRadius) {
  const angle = startAngle !== undefined ? startAngle : index * 137.5 * (Math.PI / 180);
  let radius = startRadius !== undefined ? startRadius : 3.3 + index * 0.55;
  let c = Math.cos(angle) * radius;
  let r = Math.sin(angle) * radius;
  let guard = 0;
  while (!isFarEnoughFromLand(c, r, BOAT_LAND_MARGIN) && guard < 80) {
    radius += 0.5;
    c = Math.cos(angle) * radius;
    r = Math.sin(angle) * radius;
    guard++;
  }
  return { c, r };
}

function repositionBoatsIfTooClose() {
  let moved = false;
  for (const boat of state.boats) {
    if (isFarEnoughFromLand(boat.gc, boat.gr, BOAT_LAND_MARGIN)) continue;
    const angle = Math.atan2(boat.gr, boat.gc);
    const currentRadius = Math.hypot(boat.gc, boat.gr);
    const pos = boatGridPos(null, angle, currentRadius);
    boat.gc = pos.c;
    boat.gr = pos.r;
    moved = true;
    const { x, y } = isoPos(pos.c, pos.r);
    const boatEl = boatEls.get(boat.id);
    if (boatEl) { boatEl.style.left = x + "px"; boatEl.style.top = y + "px"; }
    const badge = badgeEls.get(`boat:${boat.id}`);
    if (badge) { badge.style.left = x + "px"; badge.style.top = y - 34 + "px"; }
  }
  if (moved) saveGame();
}

const MAX_BOATS = 3;
const BOAT_RENT_MS = 10 * 60 * 1000;
const BOAT_RENT_COST = { wood: 20, gold: 15 };

function rentBoat() {
  if (state.boats.length >= MAX_BOATS) return;
  if (!canAfford(BOAT_RENT_COST)) return;
  spend(BOAT_RENT_COST);
  const pos = boatGridPos(state.boats.length);
  state.boats.push({ id: uid(), lastCollect: Date.now(), gc: pos.c, gr: pos.r, expiresAt: Date.now() + BOAT_RENT_MS });
  gainXP(15);
  renderWorld();
  updateHeader();
  saveGame();
  renderBoatSheet();
}

function expireBoats() {
  const now = Date.now();
  const before = state.boats.length;
  state.boats = state.boats.filter((b) => (b.expiresAt || Infinity) > now);
  if (state.boats.length !== before) {
    renderWorld();
    saveGame();
    if ($("boatSheet").style.display !== "none") renderBoatSheet();
  }
}

function collectBoat(boatId) {
  const boat = state.boats.find((b) => b.id === boatId);
  if (!boat) return;
  const def = BUILDING_DEFS.boat;
  const ready = readyAmount({ id: "boat", lastCollect: boat.lastCollect });
  if (ready <= 0) return;
  addResource(def.produce.res, ready);
  boat.lastCollect = Date.now();
  gainXP(2);
  const { x, y } = isoPos(boat.gc, boat.gr);
  spawnFloatTextAt(x, y, `+${ready} ${RES_ICON[def.produce.res]}`);
  updateHeader();
  saveGame();
}

function renderBoats() {
  const world = $("world");
  boatEls.clear();
  for (const boat of state.boats) {
    const { x, y } = isoPos(boat.gc, boat.gr);
    const el = document.createElement("div");
    el.className = "boat";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.textContent = BUILDING_DEFS.boat.icon;
    el.dataset.boatId = boat.id;
    world.appendChild(el);
    boatEls.set(boat.id, el);
  }
}

function pickBoatAt(clientX, clientY) {
  const o = viewportOrigin();
  const relX = (clientX - o.x - pan.x) / scale;
  const relY = (clientY - o.y - pan.y) / scale;
  const HIT_R = 30;
  for (const boat of state.boats) {
    const { x, y } = isoPos(boat.gc, boat.gr);
    if (Math.hypot(relX - x, relY - y) <= HIT_R) return boat.id;
  }
  return null;
}

function openBoatSheet() {
  renderBoatSheet();
  $("boatSheetBackdrop").style.display = "block";
  $("boatSheet").style.display = "block";
}
function closeBoatSheet() {
  $("boatSheetBackdrop").style.display = "none";
  $("boatSheet").style.display = "none";
}
function closeMoreSheet() {
  $("moreSheetBackdrop").style.display = "none";
  $("moreSheet").style.display = "none";
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  return totalMin >= 1 ? `${totalMin} хв` : "менше хв";
}

function renderBoatSheet() {
  const locked = state.level < BUILDING_DEFS.boat.unlockLevel;
  $("boatLocked").style.display = locked ? "block" : "none";
  $("boatUnlocked").style.display = locked ? "none" : "block";
  if (locked) return;

  const afford = canAfford(BOAT_RENT_COST);
  const atCap = state.boats.length >= MAX_BOATS;
  const list = $("boatList");
  list.innerHTML = "";

  const info = document.createElement("div");
  info.className = "buildOptDesc";
  info.style.padding = "0 2px 10px";
  info.textContent = `Орендовано човнів: ${state.boats.length} / ${MAX_BOATS}. Кожен ловить рибу (їжу), поки оренда активна — потім зникає.`;
  list.appendChild(info);

  for (const boat of state.boats) {
    const remaining = (typeof boat.expiresAt === "number" ? boat.expiresAt : Date.now() + BOAT_RENT_MS) - Date.now();
    const row = document.createElement("div");
    row.className = "buildOption";
    row.innerHTML = `
      <div class="buildOptIcon">⛵</div>
      <div class="buildOptInfo">
        <div class="buildOptName">Орендований човен</div>
        <div class="buildOptDesc">Залишилось: ${formatDuration(remaining)}</div>
      </div>
    `;
    list.appendChild(row);
  }

  const opt = document.createElement("div");
  opt.className = "buildOption" + (afford && !atCap ? "" : " disabled");
  opt.innerHTML = `
    <div class="buildOptIcon">⛵</div>
    <div class="buildOptInfo">
      <div class="buildOptName">Орендувати човен</div>
      <div class="buildOptDesc">${atCap ? `Максимум ${MAX_BOATS} одночасно` : `На ${BOAT_RENT_MS / 60000} хв — ${BUILDING_DEFS.boat.desc}`}</div>
      <div class="buildOptCost">${atCap ? "" : costChips(BOAT_RENT_COST, afford)}</div>
    </div>
  `;
  if (!atCap) opt.addEventListener("click", rentBoat);
  list.appendChild(opt);
}

/* ---------- worker characters ---------- */
const workerEls = new Map();

function findBuildingsOfType(res) {
  const list = [];
  for (const [key, tile] of Object.entries(state.tiles)) {
    if (!tile.building) continue;
    const def = BUILDING_DEFS[tile.building.id];
    if (!def.produce || def.produce.res !== res) continue;
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    list.push({ x, y });
  }
  if (BUILDING_DEFS.boat.produce.res === res) {
    for (const boat of state.boats) {
      const { x, y } = isoPos(boat.gc, boat.gr);
      list.push({ x, y });
    }
  }
  return list;
}

function workerCollectAllOfType(res) {
  let total = 0;
  for (const tile of Object.values(state.tiles)) {
    if (!tile.building) continue;
    const def = BUILDING_DEFS[tile.building.id];
    if (!def.produce || def.produce.res !== res) continue;
    const ready = readyAmount(tile.building);
    if (ready > 0) {
      addResource(res, ready);
      tile.building.lastCollect = Date.now();
      total += ready;
    }
  }
  if (BUILDING_DEFS.boat.produce.res === res) {
    for (const boat of state.boats) {
      const ready = readyAmount({ id: "boat", lastCollect: boat.lastCollect });
      if (ready > 0) {
        addResource(res, ready);
        boat.lastCollect = Date.now();
        total += ready;
      }
    }
  }
  return total;
}

function hireWorker(res) {
  const def = WORKER_DEFS[res];
  if (state.workers[res]) return;
  if (state.level < def.unlockLevel) return;
  if (!canAfford(def.cost)) return;
  spend(def.cost);
  state.workers[res] = { lastCycle: Date.now(), x: 0, y: 0 };
  gainXP(15);
  renderWorkers();
  updateHeader();
  saveGame();
  renderWorkerSheet();
  moveWorkerTo(res);
}

function moveWorkerTo(res) {
  const targets = findBuildingsOfType(res);
  const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : { x: 0, y: 0 };
  state.workers[res].x = t.x;
  state.workers[res].y = t.y;
  const el = workerEls.get(res);
  if (el) {
    el.style.left = t.x + "px";
    el.style.top = t.y + "px";
  }
}

function tickWorkers() {
  if (!state.workers) return;
  let changed = false;
  for (const res of Object.keys(state.workers)) {
    const w = state.workers[res];
    if (!w) continue;
    if (Date.now() - w.lastCycle < WORKER_CYCLE_MS) continue;
    w.lastCycle = Date.now();
    const total = workerCollectAllOfType(res);
    if (total > 0) {
      changed = true;
      spawnFloatTextAt(w.x || 0, w.y || 0, `+${total} ${RES_ICON[res]}`);
    }
    moveWorkerTo(res);
  }
  if (changed) {
    updateHeader();
    updateBadges();
    saveGame();
  }
}

function renderWorkers() {
  const world = $("world");
  workerEls.clear();
  for (const res of Object.keys(state.workers)) {
    const w = state.workers[res];
    if (!w) continue;
    const def = WORKER_DEFS[res];
    const el = document.createElement("div");
    el.className = "worker";
    el.style.left = (w.x || 0) + "px";
    el.style.top = (w.y || 0) + "px";
    el.textContent = def.icon;
    world.appendChild(el);
    workerEls.set(res, el);
  }
}

function openWorkerSheet() {
  renderWorkerSheet();
  $("workerSheetBackdrop").style.display = "block";
  $("workerSheet").style.display = "block";
}
function closeWorkerSheet() {
  $("workerSheetBackdrop").style.display = "none";
  $("workerSheet").style.display = "none";
}

function renderWorkerSheet() {
  const list = $("workerList");
  list.innerHTML = "";
  for (const res of Object.keys(WORKER_DEFS)) {
    const def = WORKER_DEFS[res];
    const hired = !!state.workers[res];
    const levelOk = state.level >= def.unlockLevel;
    const afford = levelOk && canAfford(def.cost);
    const opt = document.createElement("div");
    opt.className = "buildOption" + (hired || !afford ? " disabled" : "");
    const statusLine = hired
      ? `<span class="costChip" style="color:var(--grass-dark);">✓ найнято</span>`
      : levelOk
      ? costChips(def.cost, afford)
      : `<span class="costChip short">Доступно з LV.${def.unlockLevel}</span>`;
    opt.innerHTML = `
      <div class="buildOptIcon">${def.icon}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${def.name}</div>
        <div class="buildOptDesc">${res === "fish" ? "Приганяє човен до причалу й забирає улов" : `Автоматично збирає ${RES_ICON[res]} ${res === "wood" ? "дерево" : res === "stone" ? "камінь" : res === "food" ? "їжу" : "золото"}`}</div>
        <div class="buildOptCost">${statusLine}</div>
      </div>
    `;
    if (!hired) opt.addEventListener("click", () => hireWorker(res));
    list.appendChild(opt);
  }
}

/* ---------- extra islands ---------- */
function islandCost(n) {
  const mult = Math.pow(ISLAND_COST_MULT, n - 1);
  const cost = {};
  Object.entries(ISLAND_BASE_COST).forEach(([res, amt]) => {
    cost[res] = Math.round(amt * mult);
  });
  return cost;
}

function buyNextIsland() {
  const n = state.islandsBought + 1;
  if (n >= ISLAND_CENTERS.length) return;
  if (state.level < ISLAND_LEVEL_REQ[n]) return;
  const cost = islandCost(n);
  if (!canAfford(cost)) return;
  spend(cost);

  const { c: cc, r: cr } = ISLAND_CENTERS[n];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      state.tiles[coordKey(cc + dc, cr + dr)] = { type: "land", building: null };
    }
  }
  state.tiles[coordKey(cc, cr)].building = { id: "sawmill", lastCollect: Date.now() };
  state.islandsBought = n;

  gainXP(50);
  repositionBoatsIfTooClose();
  renderWorld();
  updateHeader();
  saveGame();
  closeIslandSheet();
  flyTo(cc, cr);
}

function flyTo(c, r) {
  const { x, y } = isoPos(c, r);
  pan.x = -x * scale;
  pan.y = -y * scale;
  applyPan();
}

function openIslandSheet() {
  renderIslandSheet();
  $("islandSheetBackdrop").style.display = "block";
  $("islandSheet").style.display = "block";
}
function closeIslandSheet() {
  $("islandSheetBackdrop").style.display = "none";
  $("islandSheet").style.display = "none";
}

function renderIslandSheet() {
  const list = $("islandList");
  list.innerHTML = "";

  const owned = document.createElement("div");
  owned.className = "buildOptDesc";
  owned.style.padding = "0 2px 10px";
  owned.textContent = `Островів у тебе: ${1 + state.islandsBought}. Кожен наступний — далі від центру й дорожчий.`;
  list.appendChild(owned);

  const n = state.islandsBought + 1;
  if (n >= ISLAND_CENTERS.length) {
    const done = document.createElement("div");
    done.className = "buildOptDesc";
    done.style.padding = "6px 2px";
    done.textContent = "Ти вже викупив усі доступні острови!";
    list.appendChild(done);
    return;
  }

  const cost = islandCost(n);
  const levelOk = state.level >= ISLAND_LEVEL_REQ[n];
  const afford = levelOk && canAfford(cost);
  const opt = document.createElement("div");
  opt.className = "buildOption" + (afford ? "" : " disabled");
  const statusLine = levelOk
    ? costChips(cost, afford)
    : `<span class="costChip short">Доступно з LV.${ISLAND_LEVEL_REQ[n]}</span>`;
  opt.innerHTML = `
    <div class="buildOptIcon">🏝️</div>
    <div class="buildOptInfo">
      <div class="buildOptName">Острів №${n + 1}</div>
      <div class="buildOptDesc">Ще одна ділянка землі, далі в морі, з безкоштовною лісопилкою на старт</div>
      <div class="buildOptCost">${statusLine}</div>
    </div>
  `;
  if (levelOk) opt.addEventListener("click", buyNextIsland);
  list.appendChild(opt);
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

  dockShedEls.clear();
  for (const [key, tile] of Object.entries(state.tiles)) {
    if (!tile.building || tile.building.id !== "dock") continue;
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    const shed = document.createElement("div");
    shed.className = "dockShed";
    shed.style.left = x - TILE_W * 0.14 + "px";
    shed.style.top = y - TILE_H * 0.16 + "px";
    world.appendChild(shed);
    dockShedEls.set(key, shed);
  }

  treasureMarkerEls.clear();
  for (const [key, tile] of Object.entries(state.tiles)) {
    if (!tile.treasureFound) continue;
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    const marker = document.createElement("div");
    marker.className = "treasureMarker";
    marker.textContent = "✕";
    marker.style.left = x + TILE_W * 0.28 + "px";
    marker.style.top = y - TILE_H * 0.22 + "px";
    world.appendChild(marker);
    treasureMarkerEls.set(key, marker);
  }

  renderBoats();
  renderWorkers();

  applyPan();
  updateBadges();
}

function tileZoneKey(tile) {
  if (!tile || !tile.building) return "empty";
  const id = tile.building.id;
  if (id === "sawmill") return "forest";
  if (id === "farm") return "farm";
  if (id === "dock") return "dock";
  return "buildings";
}

function hasSameZoneNeighbor(c, r, zoneKey) {
  for (const [nc, nr] of neighbors4(c, r)) {
    const nt = state.tiles[coordKey(nc, nr)];
    if (nt && tileZoneKey(nt) === zoneKey) return true;
  }
  return false;
}

function setWorldPos(el, x, y) {
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

function buildTileEl(c, r, cssType, tile) {
  const { x, y } = isoPos(c, r);
  const isDock = tile && tile.building && tile.building.id === "dock";
  const zoneKey = tileZoneKey(tile);
  const zoneClass = zoneKey !== "empty" && zoneKey !== "dock" ? ` zone-${zoneKey}` : "";
  const el = document.createElement("div");
  el.className = `tile ${cssType}${isDock ? " dockTile" : ""}${zoneClass}`;
  setWorldPos(el, x, y);
  el.dataset.c = c;
  el.dataset.r = r;

  const diamond = document.createElement("div");
  diamond.className = "tileDiamond";
  el.appendChild(diamond);

  if (cssType === "land" || cssType === "water") {
    const merged = zoneKey !== "empty" && hasSameZoneNeighbor(c, r, zoneKey);
    if (!merged) {
      const edge = document.createElement("div");
      edge.className = "tileEdge";
      el.appendChild(edge);
    }
  }

  if (cssType === "lockedLand" || cssType === "lockedWater") {
    const lock = document.createElement("div");
    lock.className = "tileLockIcon";
    lock.textContent = cssType === "lockedLand" ? "🔒" : (state && state.hasDock ? "🔓" : "🔒");
    el.appendChild(lock);
  }

  if (tile && tile.building) {
    const icon = document.createElement("div");
    icon.className = "buildingIcon" + (isDock ? " dockIcon" : "");
    icon.textContent = BUILDING_DEFS[tile.building.id].icon;
    el.appendChild(icon);
  }

  return el;
}

function updateBadges() {
  // Disabled: the floating "+N" collect badges were a source of lag
  // while panning (continuously-animated elements repositioning on
  // every drag frame). Tapping still collects fine without them, and
  // hired workers already auto-collect anyway.
}

function updateHeader() {
  $("levelNum").textContent = state.level;
  $("xpFill").style.width = Math.min(100, (state.xp / xpToNext(state.level)) * 100) + "%";
  $("resWood").textContent = formatNum(state.resources.wood);
  $("resStone").textContent = formatNum(state.resources.stone);
  $("resFood").textContent = formatNum(state.resources.food);
  $("resFish").textContent = formatNum(state.resources.fish);
  $("resGold").textContent = formatNum(state.resources.gold);
}

/* ---------- floating text ---------- */
function spawnFloatTextAt(x, y, text) {
  const o = viewportOrigin();
  const el = document.createElement("div");
  el.className = "floatText";
  el.textContent = text;
  el.style.left = o.x + pan.x + x * scale + "px";
  el.style.top = o.y + pan.y + y * scale - 20 + "px";
  $("floaters").appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function spawnFloatText(c, r, text) {
  const { x, y } = isoPos(c, r);
  spawnFloatTextAt(x, y, text);
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
  } else {
    openManageTileSheet(c, r);
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
  for (const boat of state.boats) {
    const ready = readyAmount({ id: "boat", lastCollect: boat.lastCollect });
    if (ready > 0) {
      addResource(BUILDING_DEFS.boat.produce.res, ready);
      boat.lastCollect = Date.now();
      totals[BUILDING_DEFS.boat.produce.res] = (totals[BUILDING_DEFS.boat.produce.res] || 0) + ready;
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
const ZONE_DEFS = {
  forest: { label: "Ліс", icon: "🌲", buildingId: "sawmill" },
  farm: { label: "Город", icon: "🌾", buildingId: "farm" },
  dock: { label: "Причал", icon: "⚓", buildingId: "dock" },
  plain: { label: "Забудова", icon: "🏠", buildingId: null },
};

function mergeCosts(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([res, amt]) => { out[res] = (out[res] || 0) + amt; });
  return out;
}

function openUnlockSheet(c, r, kind) {
  sheetContext = { kind: "unlock", c, r, unlockKind: kind };
  const isWater = kind === "water";
  if (isWater && !state.hasDock) {
    $("sheetTitle").textContent = "Потрібен причал";
    $("buildList").innerHTML = `<div class="buildOptDesc" style="padding:6px 2px;">Спочатку побудуй ⚓ Причал (доступний з LV.5), щоб освоювати воду.</div>`;
    openSheet();
    return;
  }

  const unlockCostBase = unlockCost(kind);
  $("sheetTitle").textContent = isWater ? "Освоїти воду" : "Розширити острів";
  $("buildList").innerHTML = "";

  const zoneKeys = isWater ? ["plain", "dock"] : ["plain", "forest", "farm", "dock"];
  for (const zoneKey of zoneKeys) {
    const zone = ZONE_DEFS[zoneKey];
    const buildingDef = zone.buildingId ? BUILDING_DEFS[zone.buildingId] : null;
    const levelOk = !buildingDef || state.level >= buildingDef.unlockLevel;
    if (!levelOk) continue;

    const cost = buildingDef ? mergeCosts(unlockCostBase, scaledCost(zone.buildingId)) : unlockCostBase;
    const afford = canAfford(cost);
    const opt = document.createElement("div");
    opt.className = "buildOption" + (afford ? "" : " disabled");
    opt.innerHTML = `
      <div class="buildOptIcon">${zone.icon}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${zone.label}</div>
        <div class="buildOptDesc">${buildingDef ? `Клітинка одразу з готовою будівлею: ${buildingDef.name}` : (isWater ? "Відкриває клітинку для забудови на воді" : "Відкриває нову клітинку землі")}</div>
        <div class="buildOptCost">${costChips(cost, afford)}</div>
      </div>
    `;
    opt.addEventListener("click", () => {
      if (!canAfford(cost)) return;
      spend(cost);
      const tile = { type: isWater ? "water" : "land", building: null };
      if (zone.buildingId) {
        tile.building = { id: zone.buildingId, lastCollect: Date.now() };
        if (zone.buildingId === "dock") state.hasDock = true;
      }
      state.tiles[coordKey(c, r)] = tile;
      gainXP(zone.buildingId ? 20 : 8);
      repositionBoatsIfTooClose();
      if (zoneKey === "plain") maybeFindTreasure(c, r);
      renderWorld();
      updateHeader();
      saveGame();
      closeSheet();
    });
    $("buildList").appendChild(opt);

    if (zoneKey === "plain") {
      const landCount = Object.values(state.tiles).filter((t) => t.type === "land").length;
      const goldCost = 8 + Math.round(landCount * 1.1);
      const goldAfford = (state.resources.gold || 0) >= goldCost;
      const goldOpt = document.createElement("div");
      goldOpt.className = "buildOption" + (goldAfford ? "" : " disabled");
      goldOpt.innerHTML = `
        <div class="buildOptIcon">💰</div>
        <div class="buildOptInfo">
          <div class="buildOptName">Забудова — оплатити золотом</div>
          <div class="buildOptDesc">Той самий варіант, але замість дерева/каменю/їжі — просто золото</div>
          <div class="buildOptCost">${costChips({ gold: goldCost }, goldAfford)}</div>
        </div>
      `;
      goldOpt.addEventListener("click", () => {
        if ((state.resources.gold || 0) < goldCost) return;
        state.resources.gold -= goldCost;
        state.tiles[coordKey(c, r)] = { type: isWater ? "water" : "land", building: null };
        gainXP(8);
        repositionBoatsIfTooClose();
        maybeFindTreasure(c, r);
        renderWorld();
        updateHeader();
        saveGame();
        closeSheet();
      });
      $("buildList").appendChild(goldOpt);
    }
  }
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

function openManageTileSheet(c, r) {
  const tile = state.tiles[coordKey(c, r)];
  if (!tile || !tile.building) return;
  sheetContext = { kind: "manage", c, r };
  const currentDef = BUILDING_DEFS[tile.building.id];
  $("sheetTitle").textContent = `${currentDef.icon} ${currentDef.name}`;
  const list = $("buildList");
  list.innerHTML = "";

  const info = document.createElement("div");
  info.className = "buildOptDesc";
  info.style.padding = "0 2px 10px";
  info.textContent = "Тут уже стоїть " + currentDef.name.toLowerCase() + ". Можеш безкоштовно змінити призначення ділянки:";
  list.appendChild(info);

  const options = [
    { id: null, name: "Забудова (прибрати будівлю)", icon: "🏠", desc: "Порожня ділянка, готова під будь-що" },
    ...BUILDING_ORDER.map((id) => BUILDING_DEFS[id]),
  ];

  options.forEach((opt) => {
    if (opt.id === tile.building.id) return;
    const locked = opt.id && state.level < opt.unlockLevel;
    const row = document.createElement("div");
    row.className = "buildOption" + (locked ? " disabled" : "");
    row.innerHTML = `
      <div class="buildOptIcon">${opt.icon}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${opt.name}</div>
        <div class="buildOptDesc">${locked ? `Доступно з LV.${opt.unlockLevel}` : (opt.desc || "")}</div>
      </div>
    `;
    if (!locked) {
      row.addEventListener("click", () => {
        const t = state.tiles[coordKey(c, r)];
        if (!t) return;
        if (opt.id) {
          t.building = { id: opt.id, lastCollect: Date.now() };
          if (opt.special === "dock") state.hasDock = true;
        } else {
          t.building = null;
        }
        renderWorld();
        updateHeader();
        saveGame();
        closeSheet();
      });
    }
    list.appendChild(row);
  });

  openSheet();
}

/* ---------- treasures & black market ---------- */
const TREASURE_DEFS = {
  gem: { name: "Коштовний камінь", icon: "💎", baseValue: 40 },
  vase: { name: "Стародавня ваза", icon: "🏺", baseValue: 30 },
  crown: { name: "Корона", icon: "👑", baseValue: 70 },
  sword: { name: "Стародавній меч", icon: "🗡️", baseValue: 50 },
  necklace: { name: "Намисто", icon: "📿", baseValue: 35 },
};
const TREASURE_CHANCE = 0.18;
const BLACK_MARKET_BUYERS = ["Загадковий колекціонер", "Портовий торговець", "Заможний купець", "Таємничий незнайомець", "Мандрівний скупник", "Старий капітан"];

const treasureMarkerEls = new Map();
let blackMarketOffers = {};

function maybeFindTreasure(c, r) {
  if (Math.random() >= TREASURE_CHANCE) return;
  const types = Object.keys(TREASURE_DEFS);
  const type = types[Math.floor(Math.random() * types.length)];
  state.treasures[type] = (state.treasures[type] || 0) + 1;
  const tile = state.tiles[coordKey(c, r)];
  if (tile) tile.treasureFound = true;
  showTreasureFound(type);
}

function showTreasureFound(type) {
  const def = TREASURE_DEFS[type];
  $("treasureIcon").textContent = def.icon;
  $("treasureName").textContent = def.name;
  $("treasureOverlay").style.display = "flex";
}

function rollBuyerOffer(baseValue) {
  return Math.round(baseValue * (0.7 + Math.random() * 0.6));
}

function openMarketSheet() {
  blackMarketOffers = {};
  for (const type of Object.keys(TREASURE_DEFS)) {
    if ((state.treasures[type] || 0) <= 0) continue;
    blackMarketOffers[type] = {
      buyer: BLACK_MARKET_BUYERS[Math.floor(Math.random() * BLACK_MARKET_BUYERS.length)],
      price: rollBuyerOffer(TREASURE_DEFS[type].baseValue),
    };
  }
  renderMarketSheet();
  $("marketSheetBackdrop").style.display = "block";
  $("marketSheet").style.display = "block";
}
function closeMarketSheet() {
  $("marketSheetBackdrop").style.display = "none";
  $("marketSheet").style.display = "none";
}

function sellTreasure(type) {
  if ((state.treasures[type] || 0) <= 0) return;
  const offer = blackMarketOffers[type];
  if (!offer) return;
  state.treasures[type]--;
  addResource("gold", offer.price);
  gainXP(10);
  updateHeader();
  saveGame();
  renderMarketSheet();
}

function renderMarketSheet() {
  const list = $("marketList");
  list.innerHTML = "";
  const held = Object.keys(TREASURE_DEFS).filter((t) => (state.treasures[t] || 0) > 0);

  if (!held.length) {
    const empty = document.createElement("div");
    empty.className = "buildOptDesc";
    empty.style.padding = "6px 2px";
    empty.textContent = "Скарбів поки нема. Купуй порожні ділянки (Забудова) — час від часу там щось знаходиться.";
    list.appendChild(empty);
    return;
  }

  held.forEach((type) => {
    const def = TREASURE_DEFS[type];
    const offer = blackMarketOffers[type];
    const count = state.treasures[type];
    const row = document.createElement("div");
    row.className = "buildOption";
    row.innerHTML = `
      <div class="buildOptIcon">${def.icon}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${def.name} × ${count}</div>
        <div class="buildOptDesc">${offer.buyer} пропонує</div>
        <div class="buildOptCost"><span class="costChip">💰 ${offer.price}</span></div>
      </div>
      <div class="shopBtns">
        <button class="btn small sell">Продати</button>
      </div>
    `;
    row.querySelector(".sell").addEventListener("click", () => sellTreasure(type));
    list.appendChild(row);
  });
}

/* ---------- shop ---------- */
const SHOP_RES = ["wood", "stone", "food", "fish"];
const SHOP_SELL_BATCH = { wood: 15, stone: 12, food: 15, fish: 12 };
const SHOP_SELL_GOLD = { wood: 5, stone: 5, food: 5, fish: 6 };
const SHOP_BUY_BATCH = { wood: 10, stone: 8, food: 10, fish: 8 };
const SHOP_BUY_GOLD = { wood: 6, stone: 7, food: 6, fish: 7 };

function sellResource(res) {
  const batch = SHOP_SELL_BATCH[res];
  if ((state.resources[res] || 0) < batch) return;
  state.resources[res] -= batch;
  addResource("gold", SHOP_SELL_GOLD[res]);
  updateHeader();
  saveGame();
  renderShopSheet();
}

function buyResource(res) {
  const cost = SHOP_BUY_GOLD[res];
  if ((state.resources.gold || 0) < cost) return;
  state.resources.gold -= cost;
  addResource(res, SHOP_BUY_BATCH[res]);
  updateHeader();
  saveGame();
  renderShopSheet();
}

function openShopSheet() {
  renderShopSheet();
  $("shopSheetBackdrop").style.display = "block";
  $("shopSheet").style.display = "block";
}
function closeShopSheet() {
  $("shopSheetBackdrop").style.display = "none";
  $("shopSheet").style.display = "none";
}

function renderShopSheet() {
  const list = $("shopList");
  list.innerHTML = "";
  SHOP_RES.forEach((res) => {
    const have = state.resources[res] || 0;
    const canSell = have >= SHOP_SELL_BATCH[res];
    const canBuy = (state.resources.gold || 0) >= SHOP_BUY_GOLD[res];
    const row = document.createElement("div");
    row.className = "buildOption shopRow";
    row.innerHTML = `
      <div class="buildOptIcon">${RES_ICON[res]}</div>
      <div class="buildOptInfo">
        <div class="buildOptName">${res === "wood" ? "Дерево" : res === "stone" ? "Камінь" : res === "fish" ? "Риба" : "Їжа"}</div>
        <div class="buildOptDesc">У тебе: ${formatNum(have)}</div>
      </div>
      <div class="shopBtns">
        <button class="btn small sell" ${canSell ? "" : "disabled"}>Продати ${SHOP_SELL_BATCH[res]} → +${SHOP_SELL_GOLD[res]} 💰</button>
        <button class="btn small buy" ${canBuy ? "" : "disabled"}>Купити ${SHOP_BUY_BATCH[res]} → -${SHOP_BUY_GOLD[res]} 💰</button>
      </div>
    `;
    row.querySelector(".sell").addEventListener("click", () => sellResource(res));
    row.querySelector(".buy").addEventListener("click", () => buyResource(res));
    list.appendChild(row);
  });
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
    setWorldPos(el, x, y);
  }
  for (const [key, el] of badgeEls.entries()) {
    if (key.startsWith("boat:")) continue;
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    el.style.left = x + "px";
    el.style.top = y - TILE_H * 0.75 + "px";
  }
  for (const [key, el] of dockShedEls.entries()) {
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    el.style.left = x - TILE_W * 0.14 + "px";
    el.style.top = y - TILE_H * 0.16 + "px";
  }
  for (const [key, el] of treasureMarkerEls.entries()) {
    const [c, r] = key.split(",").map(Number);
    const { x, y } = isoPos(c, r);
    el.style.left = x + TILE_W * 0.28 + "px";
    el.style.top = y - TILE_H * 0.22 + "px";
  }
  for (const boat of state.boats) {
    const { x, y } = isoPos(boat.gc, boat.gr);
    const boatEl = boatEls.get(boat.id);
    if (boatEl) { boatEl.style.left = x + "px"; boatEl.style.top = y + "px"; }
    const badge = badgeEls.get(`boat:${boat.id}`);
    if (badge) { badge.style.left = x + "px"; badge.style.top = y - 34 + "px"; }
  }
}

/* ---------- panning + zoom ---------- */
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.9;
let scale = 1;
const activePointers = new Map();
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchStartPan = { x: 0, y: 0 };
let pinchAnchor = { x: 0, y: 0 }; // viewport-relative reference point (world origin)

function applyPan() {
  $("world").style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
}

function viewportOrigin() {
  const vpRect = $("viewport").getBoundingClientRect();
  return { x: vpRect.left + vpRect.width * 0.5, y: vpRect.top + vpRect.height * 0.46 };
}

function zoomAround(clientX, clientY, newScale) {
  const o = viewportOrigin();
  const px = clientX - o.x;
  const py = clientY - o.y;
  const s0 = scale;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  pan.x = px - ((px - pan.x) / s0) * clamped;
  pan.y = py - ((py - pan.y) / s0) * clamped;
  scale = clamped;
  applyPan();
}

function zoomButton(factor) {
  const vpRect = $("viewport").getBoundingClientRect();
  zoomAround(vpRect.left + vpRect.width / 2, vpRect.top + vpRect.height / 2, scale * factor);
}

function wirePanning() {
  const viewport = $("viewport");
  let down = false, moved = false, startX = 0, startY = 0, origX = 0, origY = 0;

  viewport.addEventListener("pointerdown", (e) => {
    viewport.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      down = false;
      const pts = Array.from(activePointers.values());
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale = scale;
      pinchStartPan = { x: pan.x, y: pan.y };
      pinchAnchor = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    } else if (activePointers.size === 1) {
      down = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      origX = pan.x; origY = pan.y;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const targetScale = pinchStartScale * (dist / (pinchStartDist || 1));
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
      const o = viewportOrigin();
      const px = pinchAnchor.x - o.x;
      const py = pinchAnchor.y - o.y;
      pan.x = px - ((px - pinchStartPan.x) / pinchStartScale) * clamped + (mid.x - pinchAnchor.x);
      pan.y = py - ((py - pinchStartPan.y) / pinchStartScale) * clamped + (mid.y - pinchAnchor.y);
      scale = clamped;
      applyPan();
      return;
    }

    if (!down) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    pan.x = origX + dx;
    pan.y = origY + dy;
    applyPan();
  });

  const end = (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size >= 1) {
      // still at least one finger down: restart single-drag reference from here
      down = false;
      return;
    }
    if (!down) { down = false; return; }
    down = false;
    if (!moved) {
      const boatId = pickBoatAt(e.clientX, e.clientY);
      if (boatId) { collectBoat(boatId); return; }
      const tile = pickTileAt(e.clientX, e.clientY);
      if (tile) onTileTap(tile.c, tile.r);
    }
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0018);
    zoomAround(e.clientX, e.clientY, scale * factor);
  }, { passive: false });

  $("btnZoomIn").addEventListener("click", () => zoomButton(1.25));
  $("btnZoomOut").addEventListener("click", () => zoomButton(0.8));
}

function pickTileAt(clientX, clientY) {
  const o = viewportOrigin();
  const relX = (clientX - o.x - pan.x) / scale;
  const relY = (clientY - o.y - pan.y) / scale;
  const rcf = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
  const rrf = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
  const [c, r] = unrotateCoord(Math.round(rcf), Math.round(rrf));
  return { c, r };
}

/* ---------- misc ---------- */
const CURRENT_BUILD = 31;

async function checkForUpdate() {
  try {
    const res = await fetch("./version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const diff = (data.build || CURRENT_BUILD) - CURRENT_BUILD;
    const badge = $("updateBadge");
    if (diff > 0) {
      badge.textContent = diff > 9 ? "9+" : String(diff);
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  } catch {
    // offline or blocked — silently skip, no badge
  }
}

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
  $("btnMore").addEventListener("click", () => {
    $("moreSheetBackdrop").style.display = "block";
    $("moreSheet").style.display = "block";
  });
  $("btnCloseMoreSheet").addEventListener("click", closeMoreSheet);
  $("moreSheetBackdrop").addEventListener("click", closeMoreSheet);
  $("menuNewIsland").addEventListener("click", () => { closeMoreSheet(); openIslandSheet(); });
  $("menuWorkers").addEventListener("click", () => { closeMoreSheet(); openWorkerSheet(); });
  $("menuFishing").addEventListener("click", () => { closeMoreSheet(); openBoatSheet(); });
  $("menuBlackMarket").addEventListener("click", () => { closeMoreSheet(); openMarketSheet(); });
  $("btnCloseMarketSheet").addEventListener("click", closeMarketSheet);
  $("marketSheetBackdrop").addEventListener("click", closeMarketSheet);
  $("btnShop").addEventListener("click", openShopSheet);
  $("btnCloseShopSheet").addEventListener("click", closeShopSheet);
  $("shopSheetBackdrop").addEventListener("click", closeShopSheet);
  $("menuReset").addEventListener("click", () => {
    closeMoreSheet();
    if (!confirm("Скинути весь прогрес і почати острів заново? Це не можна скасувати.")) return;
    if (!confirm("Точно? Всі будівлі, ресурси, персонажі та рівень зникнуть назавжди.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.href = location.pathname + "?v=" + Date.now();
  });
  $("btnCloseBoatSheet").addEventListener("click", closeBoatSheet);
  $("boatSheetBackdrop").addEventListener("click", closeBoatSheet);
  $("btnCloseWorkerSheet").addEventListener("click", closeWorkerSheet);
  $("workerSheetBackdrop").addEventListener("click", closeWorkerSheet);
  $("btnCloseIslandSheet").addEventListener("click", closeIslandSheet);
  $("islandSheetBackdrop").addEventListener("click", closeIslandSheet);
  $("btnRotate").addEventListener("click", rotateView);
  $("btnRefresh").addEventListener("click", hardRefresh);
  $("btnCloseSheet").addEventListener("click", closeSheet);
  $("sheetBackdrop").addEventListener("click", closeSheet);
  $("btnLevelUpClose").addEventListener("click", () => { $("levelUpOverlay").style.display = "none"; });
  $("btnTreasureClose").addEventListener("click", () => { $("treasureOverlay").style.display = "none"; });
  $("btnWelcomeClose").addEventListener("click", () => { $("welcomeOverlay").style.display = "none"; });
  wirePanning();
}

function init() {
  const { state: loaded, gapMs } = loadGame();
  state = loaded;
  wire();
  registerSW();
  expireBoats();
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

  setInterval(tickWorkers, 1200);
  setInterval(saveGame, 8000);
  setInterval(expireBoats, 15000);

  checkForUpdate();
  setInterval(checkForUpdate, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });
}

init();
