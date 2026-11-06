// The player's career: scrap, garage, ladder, paint and settings. Saved to
// localStorage. Everything that moves money or parts lives here.
import {
  PARTS, CHIPS, RIVALS, LEAGUES, STOCK, SLOTS, DEFAULT_PAINT, MK_NAMES,
  buyPrice, sellPrice, scrapValue, retrofitPrice,
} from './catalog.js';

const KEY = 'salvage-rights-save-v1';

export function freshSave() {
  const s = {
    v: 1, name: 'ROOKIE', scrap: 100, next: 1, nextUid: 1, inventory: [], build: {}, chipsOwned: [], chips: [],
    beaten: {}, paint: { ...DEFAULT_PAINT }, finishes: [], ringer: null, won: false, ng: 0, lossStreak: 0, offeredEasy: false,
    trophies: [], tabs: { exchange: false, paint: false, retrofit: false }, seen: {}, spoils: [], fightSeed: 1, started: false,
    settings: { music: true, sfx: true, assist: 'normal', cam: 'booth', vibrate: true },
  };
  for (const [slot, id] of [['chassis', 'crate'], ['drive', 'scrapwheels'], ['main', 'ram']]) s.build[slot] = addPart(s, id, 1);
  return s;
}

function addPart(s, id, mk, from) {
  const uid = s.nextUid++;
  s.inventory.push({ uid, id, mk, from: from || null });
  return uid;
}

let storage = null;
try { storage = globalThis.localStorage || null; } catch { storage = null; }

// Whatever a save holds, leave it playable: known parts only, a chassis and a
// drive fitted, no slot pointing at a part that's gone.
function sanitize(d) {
  d.inventory = d.inventory.filter((p) => p && PARTS[p.id] && [1, 2, 3].includes(p.mk) && Number.isFinite(p.uid));
  d.nextUid = Math.max(d.nextUid || 1, ...d.inventory.map((p) => p.uid + 1), 1);
  for (const sl of SLOTS) {
    const p = d.inventory.find((q) => q.uid === d.build[sl]);
    if (!p || PARTS[p.id].slot !== sl) d.build[sl] = null;
  }
  for (const [sl, id] of [['chassis', 'crate'], ['drive', 'scrapwheels']]) {
    if (!d.build[sl]) {
      const have = d.inventory.find((q) => PARTS[q.id].slot === sl);
      d.build[sl] = have ? have.uid : addPart(d, id, 1);
    }
  }
  d.chipsOwned = (Array.isArray(d.chipsOwned) ? d.chipsOwned : []).filter((c) => CHIPS[c]);
  const max = PARTS[d.inventory.find((q) => q.uid === d.build.chassis).id].chips;
  d.chips = (Array.isArray(d.chips) ? d.chips : []).filter((c) => d.chipsOwned.includes(c)).slice(0, max);
  if (!Number.isInteger(d.next) || d.next < 1) d.next = 1;
  if (!Number.isFinite(d.scrap) || d.scrap < 0) d.scrap = 0;
  return d;
}

export const Save = {
  data: freshSave(),
  exists() {
    try {
      const d = storage && JSON.parse(storage.getItem(KEY));
      return !!(d && d.v === 1 && d.started && Array.isArray(d.inventory));
    } catch { return false; }
  },
  load() {
    try {
      const raw = storage && storage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1 && Array.isArray(d.inventory)) {
          const f = freshSave();
          this.data = sanitize({ ...f, ...d, build: d.build || {}, settings: { ...f.settings, ...d.settings }, tabs: { ...f.tabs, ...d.tabs } });
          return true;
        }
      }
    } catch { /* a broken save falls back to a fresh one */ }
    this.data = freshSave();
    return false;
  },
  write() { try { if (storage) storage.setItem(KEY, JSON.stringify(this.data)); } catch { /* full or private mode */ } },
  reset() { this.data = freshSave(); try { if (storage) storage.removeItem(KEY); } catch { /* ignore */ } },
  newGame() { const st = this.data.settings; this.data = freshSave(); this.data.settings = st; this.data.started = true; this.write(); },
};

const part = (uid) => Save.data.inventory.find((p) => p.uid === uid);
export const getPart = part;

// The build the sim and the view use.
export function currentBuild() {
  const s = Save.data;
  const b = { chips: [...s.chips] };
  for (const slot of SLOTS) {
    const p = s.build[slot] ? part(s.build[slot]) : null;
    b[slot] = p ? { id: p.id, mk: p.mk } : null;
  }
  return b;
}

export const ownedBest = (id) => Save.data.inventory.reduce((m, p) => (p.id === id ? Math.max(m, p.mk) : m), 0);
export const isEquipped = (uid) => SLOTS.some((sl) => Save.data.build[sl] === uid);

export function equip(uid) {
  const p = part(uid);
  if (!p) return;
  Save.data.build[PARTS[p.id].slot] = uid;
  chipTrim();
  Save.write();
}
export function unequip(slot) {
  if (slot === 'chassis' || slot === 'drive') return false; // A robot needs these.
  Save.data.build[slot] = null;
  Save.write();
  return true;
}

export const chipSlots = () => {
  const ch = part(Save.data.build.chassis);
  return PARTS[ch.id].chips;
};
function chipTrim() { Save.data.chips = Save.data.chips.slice(0, chipSlots()); }
export function toggleChip(id) {
  const s = Save.data;
  if (s.chips.includes(id)) s.chips = s.chips.filter((c) => c !== id);
  else if (s.chips.length < chipSlots()) s.chips.push(id);
  else return false;
  Save.write();
  return true;
}

// ---- exchange --------------------------------------------------------
export const currentLeague = () => {
  const s = Save.data;
  if (s.next > 18) return 6;
  return RIVALS[s.next - 1].league;
};

// After two straight losses the sponsors open up next league's stock, so a
// player can always buy a way past a wall.
export const sponsorDeal = () => Save.data.lossStreak >= 2 && currentLeague() < 6;
export function shopStock() {
  const lg = currentLeague() + (sponsorDeal() ? 1 : 0);
  const items = [];
  for (const id in STOCK) {
    if (STOCK[id] > lg) continue;
    items.push({ id, mk: 1, price: buyPrice(id, 1) });
    if (lg >= 4 && id !== 'crate' && id !== 'scrapwheels' && id !== 'ram') items.push({ id, mk: 2, price: buyPrice(id, 2) });
  }
  return items;
}
export function shopChips() {
  const lg = currentLeague();
  return Object.values(CHIPS).filter((c) => c.league <= lg && !Save.data.chipsOwned.includes(c.id));
}
export function buy(id, mk) {
  const s = Save.data, cost = buyPrice(id, mk);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  const uid = addPart(s, id, mk);
  Save.write();
  return uid;
}
export function buyChip(id) {
  const s = Save.data, c = CHIPS[id];
  if (s.scrap < c.price || s.chipsOwned.includes(id)) return false;
  s.scrap -= c.price;
  s.chipsOwned.push(id);
  Save.write();
  return true;
}
export function sell(uid) {
  const s = Save.data, p = part(uid);
  if (!p || isEquipped(uid)) return false;
  s.scrap += sellPrice(p.id, p.mk);
  s.inventory = s.inventory.filter((x) => x.uid !== uid);
  Save.write();
  return true;
}
export function retrofit(uid) {
  const s = Save.data, p = part(uid);
  if (!p || p.mk >= 3) return false;
  const cost = retrofitPrice(p.id, p.mk);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  p.mk++;
  Save.write();
  return true;
}

// ---- salvage ---------------------------------------------------------
function wreckParts(riv, exhibition) {
  const list = [];
  const b = riv.mirror ? (Save.data.ringer || currentBuild()) : riv.build;
  for (const sl of SLOTS) if (b[sl]) list.push({ id: b[sl].id, mk: b[sl].mk });
  if (riv.boss) { list.push({ id: 'rail', mk: 3 }); list.push({ id: 'overdrive', mk: 3 }); }
  if (exhibition) for (const p of list) p.mk = Math.max(1, p.mk - 1);
  return list;
}

// Cards for the Salvage screen. `isNew` = something you don't own yet at this Mk.
export function salvageOffer(n, exhibition) {
  const riv = RIVALS[n - 1];
  if (riv.mirror && !exhibition) {
    return { picks: 0, ringer: true, cards: [], fully: false };
  }
  const cards = wreckParts(riv, exhibition).map((p) => ({ ...p, isNew: ownedBest(p.id) < p.mk }));
  let fresh = cards.filter((c) => c.isNew).length;
  // Guarantee: two worth having. Add spares from the league's pool if short.
  if (fresh < 2) {
    const pool = [];
    for (const rv of RIVALS) {
      if (rv.league !== riv.league || !rv.build) continue;
      for (const sl of SLOTS) if (rv.build[sl]) pool.push({ id: rv.build[sl].id, mk: rv.build[sl].mk });
    }
    const top = pool.reduce((m, p) => Math.max(m, p.mk), 1);
    const spareMk = Math.min(3, top + 1);
    const seen = new Set(cards.map((c) => c.id));
    for (const p of pool) {
      if (fresh >= 2) break;
      if (seen.has(p.id) || ownedBest(p.id) >= spareMk) continue;
      seen.add(p.id);
      cards.push({ id: p.id, mk: spareMk, isNew: true, spare: true });
      fresh++;
    }
  }
  const fully = !cards.some((c) => c.isNew);
  const picks = exhibition ? 1 : (riv.champ ? 2 : 1);
  return { picks, cards, fully, ringer: false };
}

export function takeSalvage(card, fromName) {
  const s = Save.data;
  const uid = addPart(s, card.id, card.mk, fromName);
  s.spoils.push({ id: card.id, mk: card.mk, from: fromName });
  Save.write();
  return uid;
}

export function salvagePayout(cards, picked) {
  let pay = 0;
  const left = [...cards];
  for (const p of picked) {
    const i = left.findIndex((c) => c.id === p.id && c.mk === p.mk);
    if (i >= 0) left.splice(i, 1);
  }
  for (const c of left) pay += scrapValue(c.id, c.mk);
  return pay;
}

// Dead Ringer's reward: raise one owned part a Mk for free.
export function ringerUpgrade(uid) {
  const p = part(uid);
  if (p && p.mk < 3) p.mk++;
  if (!Save.data.finishes.includes('ringer')) Save.data.finishes.push('ringer');
  Save.write();
}

// ---- prizes and the ladder -------------------------------------------
export function prizeFor(n, result, exhibition) {
  const riv = RIVALS[n - 1];
  const lg = LEAGUES[riv.league - 1];
  const base = (riv.champ ? lg.champ : lg.win) * (exhibition ? 0.5 : 1) * (Save.data.ng ? 1.25 : 1);
  const lines = [{ label: exhibition ? 'Exhibition purse' : 'Prize', amount: Math.round(base) }];
  const pct = (label, p) => lines.push({ label, amount: Math.round(base * p) });
  if (result.cause === 'ko') pct('Knockout', 0.25);
  if (result.cause === 'hazard' || result.cause === 'pit') pct('Hazard KO', 0.2);
  if (result.cause === 'ringout') pct('Ring-out', 0.2);
  if (result.taken[0] <= 0) pct('Flawless', 0.3);
  if (result.time < 40) pct('Fast', 0.15);
  let total = lines.reduce((a, l) => a + l.amount, 0);
  if (currentBuild().chips.includes('scavenger')) {
    const extra = Math.round(total * 0.25);
    lines.push({ label: 'Scavenger chip', amount: extra });
    total += extra;
  }
  return { lines, total };
}

export const lossPrize = (n) => {
  const riv = RIVALS[n - 1];
  const lg = LEAGUES[riv.league - 1];
  return Math.round((riv.champ ? lg.champ : lg.win) * 0.15);
};

export function recordWin(n, exhibition, prize) {
  const s = Save.data;
  const riv = RIVALS[n - 1];
  s.scrap += prize;
  s.lossStreak = 0;
  const out = { promoted: false, chip: null, chipCash: 0, firstWin: false };
  if (exhibition) { Save.write(); return out; }
  s.beaten[n] = true;
  s.next = Math.max(s.next, n + 1);
  out.firstWin = true;
  if (n >= 1) s.tabs.exchange = true;
  if (n >= 3) { s.tabs.paint = true; s.tabs.retrofit = true; }
  if (riv.champ) {
    out.promoted = true;
    if (!s.trophies.includes(n)) s.trophies.push(n);
    const drop = Object.values(CHIPS).find((c) => c.drop === n);
    if (drop) {
      if (s.chipsOwned.includes(drop.id)) { s.scrap += drop.price; out.chipCash = drop.price; out.chip = drop.id; }
      else { s.chipsOwned.push(drop.id); out.chip = drop.id; }
    }
  }
  if (n === 17 && !s.finishes.includes('ringer')) s.finishes.push('ringer');
  if (n === 18) s.won = true;
  Save.write();
  return out;
}

export function recordLoss(n) {
  const s = Save.data;
  s.lossStreak++;
  s.scrap += lossPrize(n);
  Save.write();
}

export function lockRinger() {
  const s = Save.data;
  if (!s.ringer) { s.ringer = currentBuild(); s.ringer.chips = []; Save.write(); }
  return s.ringer;
}

export function startNgPlus() {
  const s = Save.data;
  s.ng++; s.next = 1; s.beaten = {}; s.ringer = null; s.won = false;
  Save.write();
}

// Give a rival parts one Mk higher in New Game+.
export function ngBuild(build) {
  if (!Save.data.ng) return build;
  const b = { ...build };
  for (const sl of SLOTS) if (b[sl]) b[sl] = { id: b[sl].id, mk: Math.min(3, b[sl].mk + 1) };
  return b;
}

export const mkName = (mk) => MK_NAMES[mk];
export { sellPrice, retrofitPrice, buyPrice };
