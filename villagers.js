/* LoneIsle — living villagers.
   Real 3D-rendered characters (sprite sheets: 4 directions x walk / work-idle frames)
   that walk the island tile by tile, sleep in houses at night, grow up, learn
   their trade and chat when tapped. Hired workers are villagers too. */
(function () {
  "use strict";

  const FW = 24, FH = 32, COLS = 6;
  const CHILD_MS = 25 * 60 * 1000;          // child -> adult
  const MAX_VISIBLE_RESIDENTS = 24;
  const WALK_SPEED = 30;                    // px / s (world units)
  const SEG_LEN = 42;                       // distance between neighbouring tile centres

  const NAMES_F = ["Оксана", "Марічка", "Соломія", "Ярина", "Леся", "Орися", "Дарина", "Устина", "Злата", "Мілана", "Влада", "Христя"];
  const NAMES_M = ["Тарас", "Остап", "Богдан", "Данило", "Іван", "Максим", "Назар", "Мирон", "Левко", "Єгор", "Роман", "Андрій"];
  const ADULT_F = ["r0", "r2", "r4"], ADULT_M = ["r1", "r3", "r5"];
  const KID_F = ["k0"], KID_M = ["k1", "k2"];

  const JOBS = {
    wood: { title: "Лісоруб", act: "рубає дерево" },
    food: { title: "Фермер", act: "доглядає поле" },
    stone: { title: "Шахтар", act: "добуває камінь" },
    meat: { title: "М'ясник", act: "працює на фермі" },
    fish: { title: "Рибалка", act: "ловить рибу" },
    gold: { title: "Скарбник", act: "рахує золото" },
  };
  const LEVEL_NAMES = ["Новачок", "Учень", "Майстер", "Знавець", "Старійшина", "Легенда"];

  const SAY = {
    day: ["Яка гарна погода!", "Чуєш, як шумить море?", "Острів з кожним днем кращий.", "Пахне свіжим хлібом...", "Тут так спокійно.", "Сьогодні добрий день для прогулянки."],
    eve: ["Який чудовий захід сонця.", "Скоро час відпочити.", "Люблю цю пору, коли небо рожеве."],
    night: ["Зорі сьогодні дуже яскраві...", "Тихо-тихо. Лише цвіркуни.", "Мабуть, час спати."],
    kid: ["Пограємо?", "Я бачив чайку! Велику!", "А коли я виросту?", "Дивись, який камінчик!"],
    wood: ["Дерево пахне смолою.", "Ще одне повалимо — і чай.", "Сосна — найкраща для дошок."],
    food: ["Урожай буде щедрий!", "Земля тепла — добрий знак.", "Пшениця вже золота."],
    stone: ["Камінь міцний, як наша дружба.", "Колись я знайду справжній самоцвіт.", "Ліхтар, кирка — і вперед."],
    meat: ["Тварини сьогодні спокійні.", "Господарство — справа терпіння."],
    fish: ["Клює! О, ні, це водорість...", "Море сьогодні лагідне.", "Найкраща риба — та, що ще попереду."],
    gold: ["Золото любить лік.", "Монетка до монетки — ось і скарб."],
  };

  const rt = new Map();   // runtime data per villager id (not saved)
  let bubbleEl = null, bubbleId = null, bubbleUntil = 0;
  let lastTap = 0;

  /* ---------- helpers ---------- */
  const hour = () => (typeof window.cozyHour === "function" ? window.cozyHour() : new Date().getHours());
  function sleepTime() { const h = hour(); return h >= 22 || h < 6; }
  function V() { if (!Array.isArray(state.villagers)) state.villagers = []; return state.villagers; }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const key = (c, r) => c + "," + r;

  function isWalkable(c, r) {
    const t = state.tiles[key(c, r)];
    return !!t && (t.type === "land" || (t.building && t.building.id === "dock"));
  }
  function isEmpty(c, r) {
    const t = state.tiles[key(c, r)];
    return !!t && (!t.building || t.building.id === "dock");
  }
  function landCells() {
    return Object.keys(state.tiles).filter((k) => { const [c, r] = k.split(",").map(Number); return isWalkable(c, r); })
      .map((k) => { const [c, r] = k.split(",").map(Number); return { c, r }; });
  }

  // Dijkstra over walkable tiles; walking through buildings is allowed but discouraged
  function findPath(from, to) {
    if (from.c === to.c && from.r === to.r) return [];
    const dist = new Map(); const prev = new Map();
    const open = [{ c: from.c, r: from.r, d: 0 }];
    dist.set(key(from.c, from.r), 0);
    let guard = 0;
    while (open.length && guard++ < 4000) {
      open.sort((a, b) => a.d - b.d);
      const cur = open.shift();
      if (cur.c === to.c && cur.r === to.r) break;
      if (cur.d > dist.get(key(cur.c, cur.r))) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (!isWalkable(nc, nr)) continue;
        const nd = cur.d + (isEmpty(nc, nr) ? 1 : 4);
        const k = key(nc, nr);
        if (!dist.has(k) || nd < dist.get(k)) { dist.set(k, nd); prev.set(k, key(cur.c, cur.r)); open.push({ c: nc, r: nr, d: nd }); }
      }
    }
    const tk = key(to.c, to.r);
    if (!prev.has(tk)) return null;
    const path = []; let k = tk;
    while (k !== key(from.c, from.r)) { const [c, r] = k.split(",").map(Number); path.unshift({ c, r }); k = prev.get(k); }
    return path;
  }

  function standCell(c, r) {
    const opts = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter((p) => isWalkable(p.c, p.r) && isEmpty(p.c, p.r));
    return opts.length ? pick(opts) : { c, r };
  }
  function buildingCells(pred) {
    const out = [];
    for (const [k, t] of Object.entries(state.tiles)) {
      if (!t.building || !pred(t.building)) continue;
      const [c, r] = k.split(",").map(Number); out.push({ c, r });
    }
    return out;
  }
  function houseCells() { return buildingCells((b) => b.id === "house" || b.id === "townhouse"); }

  /* ---------- entities ---------- */
  function newId() { return "v" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
  function makeVillager(opts) {
    const female = opts.female != null ? opts.female : Math.random() < 0.5;
    const kid = !!opts.kid;
    const used = new Set(V().map((v) => v.name));
    let name; const pool = female ? NAMES_F : NAMES_M;
    const free = pool.filter((n) => !used.has(n));
    name = free.length ? pick(free) : pick(pool) + " " + (V().length + 1);
    const look = opts.look || (kid ? pick(female ? KID_F : KID_M) : pick(female ? ADULT_F : ADULT_M));
    return { id: opts.id || newId(), name, female, look, job: opts.job || null, kid, born: opts.born || Date.now(), xp: 0 };
  }

  function levelOf(xp) { return Math.min(6, 1 + Math.floor(Math.sqrt((xp || 0) / 4))); }

  function ensureEls() {
    const world = document.getElementById("world");
    if (!world) return;
    for (const v of V()) {
      let d = rt.get(v.id);
      if (!d) { d = newRuntime(v); rt.set(v.id, d); }
      if (!d.el) d.el = makeEl(v);
      if (d.el.parentNode !== world) world.appendChild(d.el);
      if (d.el.dataset.look !== v.look) setLook(d.el, v.look);
    }
  }
  function makeEl(v) {
    const el = document.createElement("div");
    el.className = "vil";
    el.dataset.id = v.id;
    setLook(el, v.look);
    return el;
  }
  function setLook(el, look) {
    el.dataset.look = look;
    el.style.backgroundImage = `url(sprites/chars/${look}.webp)`;
  }
  function newRuntime(v) {
    const cells = landCells();
    let start = null;
    if (v.job) {
      const t = targetsFor(v.job);
      if (t.length) start = standCell(pick(t).c, pick(t).r);
    }
    if (!start) { const e = cells.filter((p) => isEmpty(p.c, p.r)); start = pick(e.length ? e : (cells.length ? cells : [{ c: 0, r: 0 }])); }
    return { el: null, c: start.c, r: start.r, to: null, t: 0, path: [], mode: "idle", until: Date.now() + 500 + Math.random() * 3000, dir: 1, frame: 0, ft: 0, hidden: false, x: 0, y: 0 };
  }

  function targetsFor(res) {
    const out = buildingCells((b) => { const d = BUILDING_DEFS[b.id]; return d && d.produce && d.produce.res === res; });
    if (res === "fish") out.push(...buildingCells((b) => b.id === "dock"));
    return out;
  }

  /* ---------- behaviour ---------- */
  function goTo(v, d, cell, thenMode, thenFor) {
    const path = findPath({ c: d.c, r: d.r }, cell);
    if (path === null) { d.mode = "idle"; d.until = Date.now() + 3000; return; }
    d.path = path; d.thenMode = thenMode; d.thenFor = thenFor;
    if (!path.length) { arrive(v, d); return; }
    startSeg(d);
  }
  function startSeg(d) {
    const nx = d.path.shift();
    d.to = nx; d.t = 0; d.mode = "walk";
    const a = window.isoPos(d.c, d.r), b = window.isoPos(nx.c, nx.r);
    const dx = b.x - a.x, dy = b.y - a.y;
    d.dir = dx > 0 && dy > 0 ? 0 : dx < 0 && dy > 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
  }
  function arrive(v, d) {
    d.mode = d.thenMode || "idle";
    d.until = Date.now() + (d.thenFor || 4000);
    d.arrivedHome = d.mode === "enter";
    if (d.mode === "enter") d.until = Date.now() + 400;
  }
  function decide(v, d) {
    const now = Date.now();
    if (sleepTime()) {
      const homes = houseCells();
      if (homes.length) {
        // nearest house
        homes.sort((a, b) => (Math.abs(a.c - d.c) + Math.abs(a.r - d.r)) - (Math.abs(b.c - d.c) + Math.abs(b.r - d.r)));
        goTo(v, d, homes[0], "enter", 400); return;
      }
      d.mode = "idle"; d.until = now + 8000; return;
    }
    if (v.job) {
      const t = targetsFor(v.job);
      if (t.length) { const b = pick(t); const sc = standCell(b.c, b.r); goTo(v, d, sc, "work", 3500); return; }
      d.mode = "idle"; d.until = now + 5000; return;
    }
    const hh = hour();
    if (hh >= 18.5 && hh < 22) {
      const spots = buildingCells((b) => ["campfire", "fountain", "bench", "gazebo", "lantern"].indexOf(b.id) >= 0);
      if (spots.length && Math.random() < 0.75) { const b = pick(spots); goTo(v, d, standCell(b.c, b.r), "idle", 9000 + Math.random() * 9000); return; }
    }
    const roll = Math.random();
    if (roll < 0.3) {
      const bl = buildingCells(() => true);
      if (bl.length) { const b = pick(bl); goTo(v, d, standCell(b.c, b.r), "idle", 3000 + Math.random() * 6000); return; }
    }
    if (roll < 0.85) {
      const e = landCells().filter((p) => isEmpty(p.c, p.r) && (Math.abs(p.c - d.c) + Math.abs(p.r - d.r)) <= (v.kid ? 3 : 6));
      if (e.length) { goTo(v, d, pick(e), "idle", (v.kid ? 2000 : 3500) + Math.random() * 5000); return; }
    }
    d.mode = "idle"; d.until = now + 3000 + Math.random() * 5000;
  }

  /* ---------- animation loop ---------- */
  let last = performance.now();
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || typeof state === "undefined" || !state) { last = ts; return; }
    const dt = Math.min(0.06, (ts - last) / 1000); last = ts;
    const now = Date.now();
    for (const v of V()) {
      const d = rt.get(v.id);
      if (!d || !d.el) continue;
      if (d.mode === "walk") {
        const spd = (v.kid ? WALK_SPEED * 1.15 : WALK_SPEED);
        d.t += (dt * spd) / SEG_LEN;
        if (d.t >= 1) {
          d.c = d.to.c; d.r = d.to.r; d.t = 0; d.to = null;
          if (d.path.length) startSeg(d); else arrive(v, d);
        }
      } else if (now >= d.until) {
        if (d.mode === "sleep") {
          if (!sleepTime()) { d.hidden = false; d.mode = "idle"; d.until = now; decide(v, d); }
        } else if (d.mode === "enter") {
          if (sleepTime()) { d.hidden = true; d.mode = "sleep"; d.until = now + 20000; } else decide(v, d);
        } else decide(v, d);
      }
      // world position
      const a = window.isoPos(d.c, d.r);
      let x = a.x, y = a.y;
      if (d.to) { const b = window.isoPos(d.to.c, d.to.r); x = a.x + (b.x - a.x) * d.t; y = a.y + (b.y - a.y) * d.t; }
      d.x = x; d.y = y;
      if (v.job && state.workers && state.workers[v.job]) { state.workers[v.job].x = x; state.workers[v.job].y = y - 14; }
      const el = d.el;
      if (d.hidden) { if (el.style.display !== "none") el.style.display = "none"; continue; }
      if (el.style.display === "none") el.style.display = "";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -84%)`;
      el.style.zIndex = String(Math.round(y) + 5002);
      // sprite frame
      d.ft += dt;
      const per = d.mode === "walk" ? 0.1 : 0.17;
      if (d.ft >= per) { d.ft = 0; d.frame = (d.frame + 1) % COLS; }
      let row, col = d.frame;
      if (d.mode === "walk") row = d.dir;
      else if (d.mode === "work") row = 4 + d.dir;
      else { row = 4 + d.dir; if (!v.job) col = d.frame; }
      el.style.backgroundPosition = `${-col * FW}px ${-row * FH}px`;
    }
    if (bubbleEl && bubbleId) {
      const d = rt.get(bubbleId);
      if (!d || now > bubbleUntil) hideBubble();
      else placeBubble(d);
    }
  }

  /* ---------- population / growth ---------- */
  function syncPopulation() {
    if (typeof state === "undefined" || !state) return;
    const list = V();
    let changed = false;
    // workers
    for (const res of Object.keys(state.workers || {})) {
      if (!state.workers[res]) continue;
      if (!list.some((v) => v.job === res)) { list.push(makeVillager({ job: res, look: res, female: res === "meat" ? false : Math.random() < 0.2 })); changed = true; }
    }
    // residents follow population
    const want = Math.min(MAX_VISIBLE_RESIDENTS, Math.max(0, state.population | 0));
    const res = list.filter((v) => !v.job);
    if (res.length < want) {
      const adults = res.filter((v) => !v.kid).length;
      const makeKid = adults >= 2 && (state.happiness || 0) >= 60 && Math.random() < 0.35 && res.filter((v) => v.kid).length < 6;
      const nv = makeVillager({ kid: makeKid });
      list.push(nv); changed = true;
      ensureEls();
      const d = rt.get(nv.id);
      if (d && d.el) {
        toast(d, makeKid ? `👶 Народилась ${nv.female ? "дівчинка" : "хлопчик"}: ${nv.name}` : `👋 ${nv.name} оселився на острові`);
      }
    } else if (res.length > want) {
      const rm = res.filter((v) => v.kid)[0] || res[res.length - 1];
      const i = list.indexOf(rm); if (i >= 0) list.splice(i, 1);
      const d = rt.get(rm.id); if (d && d.el) d.el.remove(); rt.delete(rm.id);
      changed = true;
    }
    // growing up
    const now = Date.now();
    for (const v of list) {
      if (v.kid && now - v.born >= CHILD_MS) {
        v.kid = false;
        v.look = pick(v.female ? ADULT_F : ADULT_M);
        changed = true;
        ensureEls();
        const d = rt.get(v.id); if (d) toast(d, `🎉 ${v.name} виріс${v.female ? "ла" : ""}!`);
      }
    }
    if (changed) { ensureEls(); try { saveGame(); } catch (e) {} }
  }

  function toast(d, text) {
    if (typeof spawnFloatTextAt === "function") spawnFloatTextAt(d.x || 0, (d.y || 0) - 20, text);
  }


  /* ---------- personal stories: past + a request ---------- */
  const RES_UA = { wood: "дерева", stone: "каменю", food: "їжі", fish: "риби", meat: "м'яса", gold: "золота" };
  const BIOS = [
    { g: "m", past: "Я колись був штурманом на великому кораблі. Шторм забрав і корабель, і компас. Лишилася тільки звичка дивитись на зорі.", ask: { res: "wood", n: 20, text: "Допоможи зробити невеликий компас на підставці — потрібно {n} {r}.", thanks: "Тепер я знову знаю, де північ. Дякую, друже!", gift: { gold: 25 } } },
    { g: "f", past: "Я пекла хліб у містечку за морем. Тут пекти ніде, і мені бракує запаху печі.", ask: { res: "food", n: 25, text: "Якщо принесеш {n} {r}, я спечу тобі перший хліб на острові.", thanks: "Тримай хліб! Ще теплий. Острів тепер пахне домом.", gift: { food: 30 } } },
    { g: "m", past: "У мене була майстерня музичних інструментів. Єдине, що врятував із води, — одна струна.", ask: { res: "wood", n: 30, text: "Мені потрібно {n} {r} на корпус гітари.", thanks: "Слухай — це для тебе! Вечорами біля вогнища буде музика.", gift: { gold: 40 } } },
    { g: "m", past: "Я мандрував з місця на місце і ніде не затримувався. Тут вперше захотілося лишитися.", ask: { res: "fish", n: 15, text: "Якщо принесеш {n} {r}, зварю юшку — як у мами.", thanks: "Смачно ж, правда? Здається, я нарешті вдома.", gift: { gold: 30 } } },
    { g: "f", past: "Я малювала карти. На них були острови, яких нема в жодному атласі. Один з них, виявляється, справжній.", ask: { res: "stone", n: 15, text: "Мені потрібно {n} {r}: хочу поставити камінь-покажчик на пагорбі.", thanks: "Готово! Тепер кожен мандрівник знатиме, що тут є острів.", gift: { gold: 35 } } },
    { g: "m", past: "У дитинстві я бачив маяк і мріяв, що колись сам його запалю. Мабуть, дарма.", ask: { res: "stone", n: 25, text: "Дай мені {n} {r} — зроблю невеликий ліхтар для причалу.", thanks: "Світить! Це ще не маяк, але шлях уже не загубиться.", gift: { gold: 45 } } },
    { g: "f", past: "Я садила троянди у великому саду. Коли довелося тікати, взяла лише пакетик насіння.", ask: { res: "food", n: 20, text: "Мені б {n} {r}: посаджу біля хати квіти.", thanks: "Бачиш, перша квітка вже виглядає! Дякую тобі.", gift: { gold: 25, wood: 10 } } },
    { g: "m", past: "Я ловив рибу ще з дідом. Він казав: море не віддає, але ділиться — треба лише слухати.", ask: { res: "wood", n: 25, text: "Потрібно {n} {r} на новий човен, а то старий протікає.", thanks: "Спущу на воду на світанку. Приєднаєшся?", gift: { fish: 15 } } },
    { g: "m", past: "Колись я навчав дітей читати. Тут дітей мало, але я й досі пам'ятаю кожну букву.", ask: { res: "gold", n: 20, text: "Мені потрібно {n} {r}: куплю чорнило і папір для книжки історій.", thanks: "Першу сторінку присвячую тобі. Острів заслуговує на книгу.", gift: { gold: 40 } } },
    { g: "f", past: "Я була лікаркою. Тут усі здорові, і це найкращий діагноз.", ask: { res: "food", n: 30, text: "Приготую трав'яний чай, якщо знайдеться {n} {r}.", thanks: "Випий — буде спокійний сон. Це мій рецепт!", gift: { gold: 30 } } },
  ];
  function bioOf(v) {
    if (v.kid) return null;
    if (v.bio == null) {
      const used = new Set(V().map((x) => x.bio).filter((x) => x != null));
      const gk = v.female ? "f" : "m";
      const free = BIOS.map((_, i) => i).filter((i) => BIOS[i].g === gk && !used.has(i));
      v.bio = free.length ? pick(free) : pick(BIOS.map((_, i) => i).filter((i) => BIOS[i].g === gk));
      v.st = 0;
    }
    return BIOS[v.bio] || null;
  }
  function resLabel(r) { return (typeof RES_ICON !== "undefined" && RES_ICON[r] ? RES_ICON[r] + " " : "") + (RES_UA[r] || r); }
  function giveRequest(v) {
    const b = bioOf(v); if (!b || v.st !== 1) return;
    const a = b.ask;
    if ((state.resources[a.res] || 0) < a.n) { toast(rt.get(v.id) || {}, `Бракує ${RES_UA[a.res]} (${a.n})`); return; }
    state.resources[a.res] -= a.n;
    for (const [k, n] of Object.entries(b.ask.gift || {})) addResource(k, n);
    v.st = 2; v.helped = true;
    try { updateHeader(); } catch (e) {}
    try { saveGame(); } catch (e) {}
    const d = rt.get(v.id); if (d) toast(d, "💛 " + v.name + " дякує!");
    showBubble(v);
  }

  /* ---------- tap bubble ---------- */
  function line(v) {
    if (v.kid) return pick(SAY.kid);
    if (sleepTime()) return pick(SAY.night);
    if (v.job && Math.random() < 0.7) return pick(SAY[v.job]);
    const h = hour();
    return pick(h >= 17 ? SAY.eve : SAY.day);
  }
  function subtitle(v) {
    if (v.job) {
      const w = state.workers[v.job] || {};
      const lvl = levelOf(w.xp);
      return `${JOBS[v.job].title} · ${LEVEL_NAMES[lvl - 1]} (рів. ${lvl})`;
    }
    if (v.kid) {
      const left = Math.max(1, Math.ceil((CHILD_MS - (Date.now() - v.born)) / 60000));
      return `Дитина · виросте через ~${left} хв`;
    }
    const days = Math.max(0, Math.floor((Date.now() - v.born) / 86400000));
    return days ? `Мешканець · на острові ${days} дн.` : "Мешканець острова";
  }
  function showBubble(v) {
    hideBubble();
    const d = rt.get(v.id); if (!d) return;
    bubbleEl = document.createElement("div");
    bubbleEl.className = "vilBubble";
    bubbleEl.innerHTML = `<b></b><i></i><span></span>`;
    bubbleEl.querySelector("b").textContent = v.name;
    bubbleEl.querySelector("i").textContent = subtitle(v);
    const b = (!v.kid && !sleepTime()) ? bioOf(v) : null;
    let ms = 4200, txt = line(v), btn = null;
    if (b) {
      if (v.st === 0) { txt = b.past; v.st = 1; ms = 9000; try { saveGame(); } catch (e) {} }
      else if (v.st === 1) {
        txt = b.ask.text.replace("{n}", b.ask.n).replace("{r}", RES_UA[b.ask.res]); ms = 12000;
        btn = `Віддати ${b.ask.n} ${resLabel(b.ask.res)}`;
      } else if (Math.random() < 0.6) { txt = b.thanks; ms = 5500; }
    }
    bubbleEl.querySelector("span").textContent = "«" + txt + "»";
    if (btn) {
      const bt = document.createElement("button");
      bt.className = "vilAsk"; bt.textContent = btn;
      bt.addEventListener("click", (e) => { e.stopPropagation(); giveRequest(v); });
      bt.addEventListener("pointerup", (e) => e.stopPropagation());
      bubbleEl.appendChild(bt);
      bubbleEl.style.pointerEvents = "auto";
    }
    document.getElementById("floaters").appendChild(bubbleEl);
    bubbleId = v.id; bubbleUntil = Date.now() + ms;
    placeBubble(d);
    d.mode = d.mode === "walk" ? d.mode : "idle";
  }
  function hideBubble() { if (bubbleEl) bubbleEl.remove(); bubbleEl = null; bubbleId = null; }
  function placeBubble(d) {
    const o = viewportOrigin();
    const px = o.x + pan.x + d.x * scale;
    const w = bubbleEl.offsetWidth || 160, h = bubbleEl.offsetHeight || 80;
    const cx = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, px));
    bubbleEl.style.left = cx + "px";
    bubbleEl.style.top = Math.max(h + 150, o.y + pan.y + (d.y - 30) * scale) + "px";
    bubbleEl.style.setProperty("--ax", Math.max(-w / 2 + 16, Math.min(w / 2 - 16, px - cx)) + "px");
  }

  function hitVillager(cx, cy) {
    let best = null, bd = 26;
    for (const v of V()) {
      const d = rt.get(v.id); if (!d || !d.el || d.hidden) continue;
      const r = d.el.getBoundingClientRect();
      const dist = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height * 0.55));
      if (dist < bd) { bd = dist; best = v; }
    }
    return best;
  }

  /* ---------- wiring (after app.js has run) ---------- */
  window.addEventListener("load", () => {
    if (typeof state === "undefined") return;

    // hired workers are villagers now: no more emoji
    window.renderWorkers = function () { document.querySelectorAll(".worker").forEach((e) => e.remove()); syncPopulation(); ensureEls(); };
    window.moveWorkerTo = function (res) {
      const v = V().find((x) => x.job === res); if (!v) return;
      const d = rt.get(v.id); if (!d) return;
      if (d.mode === "walk" || d.hidden || sleepTime()) return;
      const t = targetsFor(res);
      if (!t.length) return;
      if (d.mode === "work" && t.length === 1) { d.until = Date.now() + 3500; return; }
      const b = pick(t); goTo(v, d, standCell(b.c, b.r), "work", 3500);
    };
    const origCollect = window.workerCollectAllOfType;
    window.workerCollectAllOfType = function (res) {
      const out = origCollect(res);
      if (out && out.total > 0 && state.workers[res]) {
        const w = state.workers[res];
        w.xp = (w.xp || 0) + 1;
        const lvl = levelOf(w.xp);
        const extra = Math.floor(out.total * 0.1 * (lvl - 1) + Math.random());
        if (extra > 0 && lvl > 1) { addResource(res, extra); out.total += extra; }
        if (lvl > (w.lvl || 1)) {
          w.lvl = lvl;
          const v = V().find((x) => x.job === res);
          if (v) { const d = rt.get(v.id); if (d) toast(d, `⭐ ${v.name}: ${LEVEL_NAMES[lvl - 1]} (рів. ${lvl})`); }
        }
      }
      return out;
    };
    // taps on villagers should not also hit the tile underneath
    const origPick = window.pickTileAt;
    window.pickTileAt = function (x, y) { if (Date.now() - lastTap < 250) return null; return origPick(x, y); };
    const vp = document.getElementById("viewport");
    let dx0 = 0, dy0 = 0;
    vp.addEventListener("pointerdown", (e) => { dx0 = e.clientX; dy0 = e.clientY; }, true);
    vp.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - dx0, e.clientY - dy0) > 8) return;
      const v = hitVillager(e.clientX, e.clientY);
      if (v) { lastTap = Date.now(); showBubble(v); }
    }, true);

    syncPopulation();
    ensureEls();
    document.querySelectorAll(".worker").forEach((e) => e.remove());
    setInterval(syncPopulation, 2500);
    // renderWorld() wipes #world, put the villagers back right after it
    const origRender = window.renderWorld;
    window.renderWorld = function () { origRender.apply(this, arguments); ensureEls(); };
    requestAnimationFrame(frame);
    window.__vil = { V, rt, syncPopulation, showBubble, BIOS, giveRequest };
    window.cozyHelped = () => V().filter((v) => v.helped).length;
  });
})();
