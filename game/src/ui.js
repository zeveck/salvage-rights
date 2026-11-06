// Every screen, the HUD and the touch controls, in HTML over the canvas.
import { PARTS, CHIPS, RIVALS, LEAGUES, SLOTS, SLOT_NAMES, MK, ARENAS, garageStats, computeStats, retrofitPrice, TROPHIES, MK_NAMES, STOCK } from './catalog.js';
import {
  Save, currentBuild, equip, unequip, getPart, isEquipped, shopStock, shopChips, buy, buyChip, sell, retrofit, toggleChip, chipSlots,
  takeSalvage, ringerUpgrade, startNgPlus, sellPrice, sponsorDeal,
} from './state.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Flow, G, toggleMute, setCamera } from './main.js';
import { PATTERNS } from './paint.js';

const uiRoot = () => document.getElementById('ui');
function h(tag, props = {}, ...kids) {
  const [t, ...cls] = tag.split('.');
  const e = document.createElement(t || 'div');
  if (cls.length) e.className = cls.join(' ');
  for (const k in props) {
    if (k === 'on') for (const ev in props.on) e.addEventListener(ev, props.on[ev]);
    else if (k === 'html') e.innerHTML = props.html;
    else if (k === 'style') Object.assign(e.style, props.style);
    else if (props[k] !== undefined && props[k] !== null && props[k] !== false) e.setAttribute(k, props[k]);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
const btn = (label, fn, cls = '', extra = {}) => h(`button${cls ? '.' + cls.split(' ').join('.') : ''}`, { ...extra, on: { click: (e) => { Audio.unlock(); Audio.click(); fn(e); } } }, label);

const SVG = {
  pause: '<svg width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M4 3h4v14H4zM12 3h4v14h-4z"/></svg>',
  camera: '<svg width="24" height="20" viewBox="0 0 24 20"><path fill="currentColor" d="M2 5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm15 3 6-3v10l-6-3z"/></svg>',
  sound: '<svg width="22" height="20" viewBox="0 0 22 20"><path fill="currentColor" d="M2 7h4l5-4v14l-5-4H2z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M14 6c2 2 2 6 0 8M17 3c4 4 4 10 0 14"/></svg>',
  muted: '<svg width="22" height="20" viewBox="0 0 22 20"><path fill="currentColor" d="M2 7h4l5-4v14l-5-4H2z"/><path fill="none" stroke="currentColor" stroke-width="2" d="m14 7 6 6m0-6-6 6"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 20 20"><path fill="none" stroke="currentColor" stroke-width="3" d="M13 3 5 10l8 7"/></svg>',
  scrap: '<svg width="20" height="20" viewBox="0 0 20 20"><path fill="#ffc21a" d="M8.4 1h3.2l.5 2.4 1.7.7 2-1.4 2.3 2.3-1.4 2 .7 1.7 2.4.5v3.2l-2.4.5-.7 1.7 1.4 2-2.3 2.3-2-1.4-1.7.7-.5 2.4H8.4l-.5-2.4-1.7-.7-2 1.4-2.3-2.3 1.4-2-.7-1.7L0 11.6V8.4l2.4-.5.7-1.7-1.4-2L4 1.9l2 1.4 1.7-.7zM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" transform="translate(0 -.5)"/></svg>',
  slot: '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" d="M3 3h18v18H3z"/></svg>',
  star: (n) => `<svg class="badge" viewBox="0 0 120 120"><path fill="#1d2128" stroke="#ffc21a" stroke-width="4" d="M60 6 106 24v40c0 26-20 42-46 50-26-8-46-24-46-50V24z"/><text x="60" y="76" text-anchor="middle" font-family="Teko" font-size="58" font-weight="700" fill="#ffc21a">${n}</text></svg>`,
};
const iconBtn = (svg, fn, title) => h('button.icon', { html: svg, title, 'aria-label': title, on: { click: () => { Audio.unlock(); Audio.click(); fn(); } } });

const thumb = (id) => h('img.thumb', { src: `assets/ui/parts/${id}.webp`, alt: '', draggable: 'false' });
const mkTag = (mk) => h(`span.mk.m${mk}`, {}, MK_NAMES[mk]);
const scrapTag = () => h('span.scrap', { html: SVG.scrap }, ` ${Save.data.scrap.toLocaleString('en-US')}`);

// A part's description, worded for this device.
const isTouch = () => matchMedia('(pointer: coarse)').matches;
export function partDesc(id) {
  const p = PARTS[id];
  if (isTouch() && p.hold) return 'Tap TOP to switch on: it aims itself.';
  if (isTouch() && p.use === 'hold') return p.desc.replace(/^Hold( and| to)?\s*/, 'Tap FIRE to switch on: ').replace(': grind', ': it grinds').replace(': spin up', ': it spins up').replace(': extend', ': it extends').replace(': burn', ': it burns');
  return p.desc;
}

// Numbers shown for a part at some Mk.
export function partStats(id, mk) {
  const p = PARTS[id];
  const m = MK[p.slot][mk];
  const out = [];
  const add = (l, v) => out.push([l, v]);
  if (p.slot === 'chassis') { add('Health', Math.round(p.hp * 4 * m)); add('Capacity', Math.round(p.cap * m)); if (p.armor) add('Armor', `${p.armor}%`); }
  if (p.slot === 'drive') { add('Speed', (p.speed * m).toFixed(1)); add('Turn', p.turn); add('Weight', p.weight); }
  if (p.slot === 'main') {
    if (p.dps) add('Damage/s', Math.round(p.dps * m));
    else if (id === 'ram') add('Damage', `${Math.round((p.damage + p.speedDamage * 5) * m)}+`);
    else add('Damage', Math.round(p.damage * m));
    if (p.cooldown) add('Reload', `${p.cooldown}s`);
    add('Reach', `${p.range}m`);
    add('Weight', p.weight);
  }
  if (p.slot === 'top') { add('Damage', +(p.damage * m).toFixed(1)); add('Ammo', p.ammo); add('Weight', p.weight); }
  if (p.slot === 'power') { add('Energy', p.energy); add('Reload', `${p.cooldown}s`); add('Weight', p.weight); }
  if (p.slot === 'armor') { add('Protection', `${Math.round(p.reduce * m * 100)}%`); if (p.contact) add('Spikes/s', Math.round(p.contact * m)); add('Weight', p.weight); }
  return out;
}

export const UI = {
  offline: null,
  modalEl: null,
  bigEl: null, promptEl: null, garageTab: 'build', hudRefs: null,

  clear() {
    uiRoot().innerHTML = '';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('touch').classList.add('hidden');
    document.getElementById('numbers').innerHTML = '';
    document.getElementById('static').className = '';
    document.getElementById('static').textContent = '';
    for (const c of document.querySelectorAll('.callout,.big,#prompt,.arrow')) c.remove();
    this.modalEl = null; this.hudRefs = null; this.promptEl = null;
  },
  add(e) { uiRoot().append(e); return e; },
  tick() {},

  loading(text) {
    this.add(h('.screen.center', {}, h('h2.teko', { style: { fontSize: 'clamp(30px,6vw,52px)' } }, text), h('.boot-bar', {}, h('div', { id: 'boot-fill', style: { width: '100%', animation: 'pulse 0.9s infinite' } }))));
  },

  loadError(retry) {
    this.clear();
    this.add(h('.screen.center', {},
      h('h2.lost', { style: { fontSize: 'clamp(38px,8vw,64px)' } }, 'Couldn\'t load that'),
      h('p', {}, 'A file didn\'t arrive. Check your connection and try again. Your progress is saved.'),
      h('.row', { style: { justifyContent: 'center' } }, btn('Try again', () => { this.clear(); retry(); }, 'primary'), btn('Reload the game', () => location.reload()))));
  },
  bootError() {
    this.clear();
    this.add(h('.screen.center', {},
      h('h2.lost', { style: { fontSize: 'clamp(38px,8vw,64px)' } }, 'Couldn\'t start'),
      h('p', {}, 'Check your connection and reload. If this keeps happening, your save may be damaged.'),
      h('.row', { style: { justifyContent: 'center' } }, btn('Reload', () => location.reload(), 'primary'),
        btn('Reset save and reload', () => { Save.reset(); location.reload(); }))));
  },

  // ---- title -----------------------------------------------------------
  title() {
    const has = Save.exists();
    const newGame = () => {
      if (has) this.confirm('Start over?', 'Your garage and ladder position will be replaced.', 'New game', () => Flow.newGame());
      else Flow.newGame();
    };
    this.add(h('.screen.title', {},
      h('h1.logo', {}, 'SALVAGE', h('em', {}, 'RIGHTS')),
      h('p.tag', {}, 'Beat them. Strip them. Bolt it on.'),
      h('.menu', {},
        has ? btn('Continue', () => Flow.resume_(), 'primary') : null,
        btn('New game', newGame, has ? '' : 'primary'),
        btn('How to play', () => this.howto()),
        btn('Settings', () => this.settings()),
        btn('Credits', () => this.credits()),
      )));
  },
  modal(...content) {
    this.closeModal();
    const m = h('.modal', {}, h('.box.panel', {}, ...content));
    this.modalEl = m;
    this.add(m);
    return m;
  },
  closeModal() { if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; } },
  confirm(title, text, yes, fn) {
    this.modal(h('h2', {}, title), h('p', {}, text), h('.row', {}, btn(yes, () => { this.closeModal(); fn(); }, 'primary'), btn('Cancel', () => this.closeModal())));
  },
  howto(back) {
    const touch = matchMedia('(pointer: coarse)').matches;
    const mh = this.modal(
      h('h2', {}, 'How to play'),
      h('p', {}, 'You are in the driver\'s booth with a remote control. Your robot steers toward where you push and drives there, so aiming your weapon means driving well.'),
      h('h3', {}, 'Controls'),
      touch
        ? h('.keys', {}, h('b', {}, 'Left side'), h('span', {}, 'Drag to drive'), h('b', {}, 'Fire'), h('span', {}, 'Main weapon. Hold-type weapons switch on and off with a tap'), h('b', {}, 'Top'), h('span', {}, 'Top mount, if fitted'), h('b', {}, 'Power'), h('span', {}, 'Your power, if fitted; uses energy'), h('b', {}, 'Lock'), h('span', {}, 'Always face the rival, at lower speed'))
        : h('.keys', {}, h('b', {}, 'WASD / Arrows'), h('span', {}, 'Drive'), h('b', {}, 'Space or J'), h('span', {}, 'Main weapon: tap or hold, depending on the weapon'), h('b', {}, 'K, E or F'), h('span', {}, 'Top mount'), h('b', {}, 'L or R'), h('span', {}, 'Power (uses energy)'), h('b', {}, 'Q or Tab'), h('span', {}, 'Lock: always face the rival, at lower speed'), h('b', {}, 'C'), h('span', {}, 'Change camera: booth or chase'), h('b', {}, 'Esc or P'), h('span', {}, 'Pause'), h('b', {}, 'M'), h('span', {}, 'Mute')),
      h('h3', {}, 'Winning'),
      h('ul', {}, h('li', {}, 'Empty their health, push them off the arena, or out-damage them by the horn.'), h('li', {}, 'Hits to the rear do 25% more; to the side, 10% more.'), h('li', {}, 'A red wedge on the floor means a big swing is coming: get out of it.')),
      h('h3', {}, 'Salvage rights'),
      h('p', {}, 'Every win lets you take one part from the wreck. League champions give two. In the garage you can change parts, retrofit them, buy, sell and repaint.'),
      h('.row', {}, btn('Close', () => (back ? back() : this.closeModal()), 'primary')));
    mh.querySelector('.box').classList.add('wide');
  },
  settings() {
    const st = Save.data.settings;
    const seg = (opts, cur, fn) => {
      const e = h('.seg');
      const render = (val) => {
        e.innerHTML = '';
        for (const [v, l] of opts) e.append(btn(l, () => { fn(v); render(v); }, v === val ? 'on' : ''));
      };
      render(cur);
      return e;
    };
    const offlineText = this.offline === null ? 'Available once published' : this.offline >= 100 ? 'Offline ready' : `Saving for offline: ${Math.round(this.offline)}%`;
    this.modal(
      h('h2', {}, 'Settings'),
      h('.setrow', {}, h('span', {}, 'Music'), seg([[true, 'On'], [false, 'Off']], st.music !== false, (v) => { st.music = v; Audio.musicOn = v; Audio.applyMute(); Save.write(); })),
      h('.setrow', {}, h('span', {}, 'Sound effects'), seg([[true, 'On'], [false, 'Off']], st.sfx !== false, (v) => { st.sfx = v; Audio.sfxOn = v; Audio.applyMute(); Save.write(); })),
      h('.setrow', {}, h('span', {}, 'Driver assist'), seg([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], st.assist, (v) => { st.assist = v; Save.write(); })),
      h('.setrow', {}, h('span', {}, 'Camera'), seg([['booth', 'Booth'], ['chase', 'Chase']], st.cam, (v) => { setCamera(v); })),
      navigator.vibrate ? h('.setrow', {}, h('span', {}, 'Vibration'), seg([[true, 'On'], [false, 'Off']], st.vibrate !== false, (v) => { st.vibrate = v; Save.write(); })) : null,
      h('.setrow', {}, h('span', {}, 'Offline play'), h('span.note', {}, offlineText)),
      h('.row', {}, btn('Close', () => this.closeModal(), 'primary'), btn('Reset save', () => this.confirm('Reset your save?', 'This wipes your garage and ladder position for good.', 'Reset', () => { Save.reset(); Flow.title(); }))));
  },
  credits() {
    this.modal(
      h('h2', {}, 'Credits'),
      h('p', {}, 'An idea by Rich Conlan.'),
      h('p', {}, 'Music and sound effects created with ElevenLabs.'),
      h('p', {}, 'Fonts: Teko and Rajdhani, SIL Open Font License. Built on three.js, MIT License.'),
      h('.row', {}, btn('Close', () => this.closeModal(), 'primary')));
  },

  // ---- contract --------------------------------------------------------
  contract() {
    const input = h('input', { type: 'text', value: Save.data.name, maxlength: '14', 'aria-label': 'Robot name', autocomplete: 'off', spellcheck: 'false' });
    const sign = () => { Audio.unlock(); Flow.signed(input.value.trim() || 'ROOKIE'); };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') sign(); });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    this.add(h('.screen.contract', {}, h('.box.panel', {},
      h('h2', {}, 'Driver contract'),
      h('p', {}, 'Clause 1: You drive. The robot takes the hits.'),
      h('p', {}, 'Clause 2: Salvage rights. Beat a robot and one part of the wreck is yours.'),
      h('p', {}, 'Clause 3: Six leagues. One champion. Your crate has to start somewhere.'),
      h('label', {}, 'Name your robot'),
      input,
      h('.row', {}, btn('Sign', sign, 'primary')))));
  },

  // ---- garage ----------------------------------------------------------
  garage(tab) {
    const s = Save.data;
    if (tab) this.garageTab = tab;
    const firstVisit = !s.seen.garage;
    s.seen.garage = true;
    const root = h(`.screen.garage.pass.tab-${this.garageTab}`);
    const top = h('.g-top', {},
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, iconBtn(SVG.back, () => Flow.title(), 'Back to title'), scrapTag()),
      h('div', { style: { display: 'flex', gap: '6px' } }, iconBtn(Audio.mutedAll ? SVG.muted : SVG.sound, () => { toggleMute(); this.garage(); }, 'Mute'), btn('Settings', () => this.settings(), 'small')));
    const side = h('.g-side.panel');
    const tabs = h('.tabs');
    const addTab = (id, label, pulse) => tabs.append(btn(label, () => { this.garageTab = id; if (s.seen['tab_' + id] !== true) { s.seen['tab_' + id] = true; Save.write(); } this.garage(); }, `${this.garageTab === id ? 'on' : ''} ${pulse ? 'pulse' : ''}`.trim()));
    addTab('build', 'Build');
    if (s.tabs.exchange) addTab('exchange', 'Exchange', !s.seen.tab_exchange);
    if (s.tabs.paint) addTab('paint', 'Paint', !s.seen.tab_paint);
    addTab('ladder', 'Ladder');
    if (this.garageTab === 'exchange' && !s.tabs.exchange) this.garageTab = 'build';
    if (this.garageTab === 'paint' && !s.tabs.paint) this.garageTab = 'build';
    const body = h('.tabbody');
    side.append(tabs, body);
    if (this.garageTab === 'build') this.tabBuild(body);
    if (this.garageTab === 'exchange') this.tabExchange(body);
    if (this.garageTab === 'paint') this.tabPaint(body);
    if (this.garageTab === 'ladder') this.tabLadder(body);

    const stats = this.statsPanel(currentBuild());
    const next = s.next <= 18 ? RIVALS[s.next - 1] : null;
    const go = h('.g-go', {},
      next ? h('.next', {}, 'Next: ', h('b', {}, next.name), ` in ${ARENAS[LEAGUES[next.league - 1].arena].name}`) : h('.next', {}, h('b', {}, 'You are the champion')),
      next ? btn('Next fight', () => Flow.startFight(s.next, false), 'yellow') : btn('Pick a rival', () => { this.garageTab = 'ladder'; this.garage(); }, 'yellow'));
    root.append(top, side, stats, go);
    const old = uiRoot().querySelector('.garage');
    if (old) { const sc = old.querySelector('.tabbody'); const y = sc ? sc.scrollTop : 0; old.replaceWith(root); body.scrollTop = y; } else this.add(root);
    if (firstVisit) Save.write();
  },
  statsPanel(b, compare) {
    const s = garageStats(b);
    const c = compare ? garageStats(compare) : null;
    const row = (label, val, max, suffix = '', cmp, bad) => {
      let diff = null;
      if (cmp !== undefined && cmp !== val) diff = cmp > val ? 'up' : 'down';
      return h('.bar-row', {},
        h('.lab', {}, h('span', {}, label), h('b', { class: diff || '' }, `${cmp !== undefined ? cmp : val}${suffix}`)),
        h(`.bar${bad ? '.over' : ''}`, {}, h('i', { style: { width: `${Math.min(100, ((cmp !== undefined ? cmp : val) / max) * 100)}%` } })));
    };
    return h('.g-stats.panel', {},
      h('h3', {}, Save.data.name),
      row('Health', s.health, 1000, '', c ? c.health : undefined),
      row('Armor', s.armor, 45, '%', c ? c.armor : undefined),
      row('Speed', s.speed, 8, ' m/s', c ? c.speed : undefined),
      row('Damage', s.damage, 40, '/s', c ? c.damage : undefined),
      row('Load', (c || s).load, Math.max((c || s).cap, (c || s).load), ` / ${(c || s).cap}`, undefined, (c || s).over > 0));
  },
  tabBuild(body) {
    const s = Save.data;
    for (const sl of SLOTS) {
      const uid = s.build[sl];
      const p = uid ? getPart(uid) : null;
      const has = s.inventory.filter((q) => PARTS[q.id].slot === sl);
      const spare = has.filter((q) => !isEquipped(q.uid)).length;
      const fresh = has.some((q) => !isEquipped(q.uid) && !s.seen['p' + q.uid]);
      body.append(h(`button.slot${fresh ? '.new' : ''}`, { on: { click: () => { Audio.click(); this.slotPicker(sl); } } },
        p ? thumb(p.id) : h('.thumb.empty', { html: SVG.slot }),
        h('.info', {}, h('.kind', {}, SLOT_NAMES[sl]),
          h('.nm', {}, p ? PARTS[p.id].name : 'Empty'),
          h('.sub', {}, spare ? `${spare} spare` : (has.length ? 'No spares' : 'Nothing to fit yet'))),
        p ? mkTag(p.mk) : null,
        fresh ? h('span.tagnew', {}, 'NEW') : null));
    }
    body.append(h('.sec', {}, `Chips ${s.chips.length}/${chipSlots()}`));
    if (!s.chipsOwned.length) body.append(h('p.note', {}, 'Chips are buffs. League champions drop them, and the Exchange sells them.'));
    const list = h('.chips');
    for (const id of s.chipsOwned) {
      const c = CHIPS[id];
      list.append(h(`button.chip${s.chips.includes(id) ? '.on' : ''}`, { on: { click: () => { Audio.click(); if (!toggleChip(id)) Audio.denied(); this.garage(); Flow.refreshGarageRobot(); } } }, h('img', { src: `assets/ui/chips/${id}.png`, alt: '' }), h('span', {}, h('b', {}, c.name), c.desc)));
    }
    body.append(list);
    if (s.trophies.length) {
      body.append(h('.sec', {}, 'Trophies'));
      body.append(h('p.note', {}, s.trophies.map((n) => `${TROPHIES[n]} (${RIVALS[n - 1].name})`).join(', ')));
    }
  },
  slotPicker(sl) {
    const s = Save.data;
    const cur = currentBuild();
    const items = s.inventory.filter((q) => PARTS[q.id].slot === sl).sort((a, b) => (isEquipped(b.uid) - isEquipped(a.uid)) || (b.mk - a.mk));
    for (const q of items) s.seen['p' + q.uid] = true;
    Save.write();
    const list = h('div');
    for (const q of items) {
      const on = isEquipped(q.uid);
      const b2 = JSON.parse(JSON.stringify(cur));
      b2[sl] = { id: q.id, mk: q.mk };
      const before = garageStats(cur), after = garageStats(b2);
      const diffs = [];
      const d = (lab, a, b, suf = '') => { if (a !== b) diffs.push(`${lab} ${b > a ? '+' : ''}${+(b - a).toFixed(1)}${suf}`); };
      d('Health', before.health, after.health); d('Armor', before.armor, after.armor, '%'); d('Speed', before.speed, after.speed); d('Damage', before.damage, after.damage);
      const rp = q.mk < 3 ? retrofitPrice(q.id, q.mk) : null;
      list.append(h('.item', {},
        thumb(q.id),
        h('.info', {}, h('.nm', {}, PARTS[q.id].name), h('.sub', {}, q.from ? `From ${q.from}. ` : '', partDesc(q.id)), h('.sub', { style: { color: '#1fd6c2' } }, on ? 'Fitted' : diffs.join('  ') || 'No change to the main numbers')),
        mkTag(q.mk),
        h('.row', { style: { flexDirection: 'column', alignItems: 'stretch', gap: '3px', flex: '0 0 112px' } },
          on ? null : btn('Fit', () => { equip(q.uid); Audio.play('ratchet', { vol: 0.7 }); this.closeModal(); this.garage(); Flow.refreshGarageRobot(); }, 'small primary'),
          s.tabs.retrofit && rp ? btn(`Retrofit ${rp}`, () => { if (retrofit(q.uid)) { Audio.play('ratchet', { vol: 0.7 }); this.closeModal(); this.garage(); Flow.refreshGarageRobot(); this.slotPicker(sl); } else Audio.denied(); }, 'small', { disabled: s.scrap < rp ? 'true' : null }) : null)));
    }
    this.modal(
      h('.spread', {}, h('h2', {}, SLOT_NAMES[sl]), scrapTag()),
      s.tabs.retrofit ? h('p.note', {}, 'Retrofit raises a part one Mk for good. Mk III parts are chrome.') : null,
      list,
      h('.row', {}, btn('Close', () => this.closeModal(), 'primary'),
        (sl !== 'chassis' && sl !== 'drive' && s.build[sl]) ? btn('Remove part', () => { unequip(sl); this.closeModal(); this.garage(); Flow.refreshGarageRobot(); }) : null));
  },
  tabExchange(body) {
    const s = Save.data;
    this.exMode = this.exMode || 'buy';
    if (!s.seen.exExplain) { s.seen.exExplain = true; }
    const sub = h('.subtabs', {}, btn('Buy', () => { this.exMode = 'buy'; this.garage(); }, this.exMode === 'buy' ? 'on' : ''), btn('Sell', () => { this.exMode = 'sell'; this.garage(); }, this.exMode === 'sell' ? 'on' : ''));
    body.append(sub);
    if (this.exMode === 'buy') {
      if (sponsorDeal()) body.append(h('p.note', { style: { marginBottom: '5px', color: '#1fd6c2', fontWeight: 700 } }, 'Sponsor deal: after those losses, next league\'s stock is open to you.'));
      else body.append(h('p.note', { style: { marginBottom: '5px' } }, 'New stock with every promotion. Mk III never comes up for sale: you have to take it from a wreck, or retrofit.'));
      for (const c of shopChips()) {
        const can = s.scrap >= c.price;
        body.append(h('.item', {}, h('img.thumb', { src: `assets/ui/chips/${c.id}.png`, alt: '' }), h('.info', {}, h('.kind', {}, 'Chip'), h('.nm', {}, c.name), h('.sub', {}, c.desc)),
          btn(`Buy ${c.price}`, () => { if (buyChip(c.id)) { Audio.play('cash', { vol: 0.7 }); this.garage(); } else Audio.denied(); }, 'small', { disabled: can ? null : 'true' })));
      }
      const stock = shopStock().sort((a, b) => a.price - b.price);
      for (const it of stock) {
        const can = s.scrap >= it.price;
        body.append(h('.item', {}, thumb(it.id), h('.info', {}, h('.kind', {}, SLOT_NAMES[PARTS[it.id].slot]), h('.nm', {}, PARTS[it.id].name), h('.sub', {}, partDesc(it.id))), mkTag(it.mk),
          btn(`Buy ${it.price}`, () => { const uid = buy(it.id, it.mk); if (uid) { Audio.play('cash', { vol: 0.7 }); this.garage(); } else Audio.denied(); }, 'small', { disabled: can ? null : 'true' })));
      }
    } else {
      const spares = s.inventory.filter((q) => !isEquipped(q.uid));
      if (!spares.length) body.append(h('p.note', {}, 'Nothing to sell. Fitted parts can\'t be sold: swap them out first.'));
      for (const q of spares) {
        const pr = sellPrice(q.id, q.mk);
        body.append(h('.item', {}, thumb(q.id), h('.info', {}, h('.kind', {}, SLOT_NAMES[PARTS[q.id].slot]), h('.nm', {}, PARTS[q.id].name), h('.sub', {}, q.from ? `From ${q.from}` : 'Bought')), mkTag(q.mk),
          btn(`Sell ${pr}`, () => { sell(q.uid); Audio.play('cash', { vol: 0.7 }); this.garage(); }, 'small')));
      }
    }
  },
  tabPaint(body) {
    const s = Save.data;
    const COLORS = ['#ff6a13', '#ffc21a', '#e0301e', '#d94f8a', '#7a2bbf', '#2b6cff', '#1fd6c2', '#2fae4e', '#3d4f2a', '#8a6d4f', '#c9ced6', '#f4f4f6', '#3c3f46', '#101114', '#0c2a5e', '#b6ff4d'];
    const setPaint = () => {
      Save.write();
      if (G.show && G.show.robot) G.show.robot.setPaint(s.paint);
      Audio.play('spray', { vol: 0.5 });
      this.garage();
    };
    const swatches = (key) => {
      const e = h('.swatches');
      for (const c of COLORS) e.append(h(`button.swatch${s.paint[key] === c ? '.on' : ''}`, { style: { background: c }, 'aria-label': c, on: { click: () => { s.paint[key] = c; setPaint(); } } }));
      return e;
    };
    const nameInput = h('input', { type: 'text', value: s.name, maxlength: '14', 'aria-label': 'Robot name', spellcheck: 'false', autocomplete: 'off' });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    nameInput.addEventListener('keyup', (e) => e.stopPropagation());
    nameInput.addEventListener('change', () => { s.name = (nameInput.value.trim() || 'ROOKIE').toUpperCase().slice(0, 14); Save.write(); this.garage(); });
    body.append(h('.sec', {}, 'Main color'), swatches('c1'), h('.sec', {}, 'Accent color'), swatches('c2'));
    body.append(h('.sec', {}, 'Pattern'), h('.opts', {}, PATTERNS.map((p) => btn(p, () => { s.paint.pattern = p; setPaint(); }, s.paint.pattern === p ? 'on' : ''))));
    body.append(h('.sec', {}, 'Finish'), h('.opts', {}, ['matte', 'gloss', 'metallic'].map((f) => btn(f, () => { s.paint.finish = f; setPaint(); }, s.paint.finish === f ? 'on' : ''))));
    if (s.finishes.includes('ringer')) body.append(h('.opts', { style: { marginTop: '4px' } }, btn('Ringer black', () => { s.paint.c1 = '#0c0c10'; s.paint.c2 = '#d81e2c'; s.paint.finish = 'gloss'; setPaint(); })));
    body.append(h('.sec', {}, 'Name'), nameInput);
  },
  tabLadder(body) {
    const s = Save.data;
    let lastL = 0;
    for (const riv of RIVALS) {
      if (riv.league !== lastL) {
        lastL = riv.league;
        const lg = LEAGUES[lastL - 1];
        body.append(h('.sec', {}, `${lg.name}: ${ARENAS[lg.arena].name}`));
      }
      const beaten = !!s.beaten[riv.n] || s.won;
      const cur = s.next === riv.n;
      const locked = riv.n > s.next;
      body.append(h(`.ladder-row${cur ? '.cur' : ''}${locked ? '.locked' : ''}`, {},
        h('.num', {}, String(riv.n)),
        h('.fill', {}, h('.nm', {}, locked ? '???' : riv.name), h('.drv', {}, locked ? 'Win to find out' : `${riv.driver}${riv.champ ? ', league champion' : ''}`)),
        beaten ? btn('Exhibition', () => Flow.startFight(riv.n, true), 'small') : null,
        cur ? btn('Fight', () => Flow.startFight(riv.n, false), 'small primary') : null));
    }
    if (s.won) {
      body.append(h('.sec', {}, 'Champion'));
      body.append(h('p.note', { style: { marginBottom: '4px' } }, 'Run the ladder again with your garage. Rivals have one Mk more, react faster and pay 25% better.'));
      body.append(btn('New Game+', () => this.confirm('Start New Game+?', 'You keep your garage and go back to Fight 1.', 'Go', () => { startNgPlus(); this.garageTab = 'build'; Flow.garage(); }), 'primary'));
    }
  },

  // ---- pre-fight -------------------------------------------------------
  prefight(n) {
    const riv = RIVALS[n - 1];
    const lg = LEAGUES[riv.league - 1];
    const ar = ARENAS[lg.arena];
    let talk = riv.talk;
    if (riv.boss) {
      const sp = Save.data.spoils.length ? Save.data.spoils[Save.data.spoils.length - 1] : null;
      talk = sp ? riv.talk.replace('{part}', PARTS[sp.id].name).replace('{owner}', sp.from) : riv.talkPlain;
    }
    const portrait = riv.portrait ? `assets/ui/portraits/${riv.portrait}.jpg` : `assets/ui/portraits/generic-${(riv.n % 5) + 1}.jpg`;
    const port = h('img.port', { src: portrait, alt: riv.driver });
    if (!riv.portrait) port.style.filter = `sepia(0.7) saturate(1.5) hue-rotate(${(riv.n * 47) % 360}deg)`;
    this.add(h('.screen.prefight', {},
      h('.pf-top', {}, h('.lg', {}, `${lg.name}, fight ${((n - 1) % 3) + 1} of 3${G.exhibition ? ', exhibition' : ''}`), h('.arena', {}, ar.name)),
      h('.pf-bot', {},
        port,
        h('.who', {},
          h('.rname', {}, riv.name),
          h('.rdrv', {}, `${riv.driver}${riv.champ ? ', league champion' : ''}`),
          h('.talk', {}, `"${talk}"`),
          h('.hint', {}, `Scout: ${riv.hint}`)),
        h('.pf-btn', {}, btn('Fight', () => Flow.beginFight(), 'yellow'), btn('Back to garage', () => Flow.garage(), 'small')))));
  },

  // ---- HUD and touch ---------------------------------------------------
  hud() {
    const f = G.fight;
    const hud = document.getElementById('hud');
    hud.classList.remove('hidden');
    const b = f.robots[0].build;
    const r = {};
    r.myBar = h('i'); r.myU = h('u'); r.foeBar = h('i'); r.foeU = h('u');
    r.timer = h('.timer', {}, '2:00');
    r.signal = h('.signal', {}, ...[4, 6, 8, 10, 11].map((v) => h('i', { style: { height: `${v}px` } })));
    r.energy = h('i');
    r.w = h('i');
    r.wLabel = h('span', {}, b.main ? PARTS[b.main.id].name : '');
    r.top = h('span', {}, '');
    r.status = h('span', {}, '');
    const hasEnergy = !!b.power;
    hud.innerHTML = '';
    hud.append(h('.hudrow', {},
      h('.hp', {}, h('.nm', {}, Save.data.name), h('.hpbar', {}, r.myU, r.myBar),
        h('.gauges', {},
          h('.gauge', {}, r.wLabel, h('.g', {}, r.w)),
          hasEnergy ? h('.gauge', {}, 'Energy', h('.g', {}, r.energy)) : null,
          b.top ? h('.gauge', {}, r.top) : null, r.status)),
      h('div', {}, r.timer, r.signal),
      h('.hp.right', {}, h('.nm', {}, f.robots[1].name), h('.hpbar', {}, r.foeU, r.foeBar))));
    hud.append(h('.hud-btns', {}, iconBtn(SVG.camera, () => setCamera(), 'Change camera'), iconBtn(SVG.pause, () => Flow.pause(), 'Pause')));
    this.hudRefs = r;
    r.myShow = 1; r.foeShow = 1;
    this.setupTouch(b);
  },
  updateHud(f, g) {
    const r = this.hudRefs;
    if (!r) return;
    const [a, b] = f.robots;
    const af = Math.max(0, a.hp / a.stats.maxHp), bf = Math.max(0, b.hp / b.stats.maxHp);
    r.myBar.style.width = `${af * 100}%`; r.foeBar.style.width = `${bf * 100}%`;
    r.myShow = Math.max(af, r.myShow - 0.012); r.foeShow = Math.max(bf, r.foeShow - 0.012);
    r.myU.style.width = `${r.myShow * 100}%`; r.foeU.style.width = `${r.foeShow * 100}%`;
    const rem = Math.max(0, Math.ceil(f.timer - f.t));
    const txt = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;
    if (r.timer.textContent !== txt) { r.timer.textContent = txt; r.timer.classList.toggle('low', rem <= 10); if (rem <= 5 && rem > 0) Audio.tick(); }
    // Weapon state.
    const m = a.build.main && a.build.main.id;
    let w = 1, hot = false;
    if (m === 'drum') w = a.rpm;
    else if (m === 'flame') { w = a.lockout > 0 ? 1 : a.heat; hot = true; }
    else if (m === 'saw' || m === 'drill') w = a.extend;
    else if (m) { const cd = PARTS[m].cooldown || 1; w = 1 - a.wCd / (cd * a.stats.cooldownMult); }
    r.w.style.width = `${Math.max(0, Math.min(1, w)) * 100}%`;
    r.w.className = hot ? 'hot' : '';
    r.energy.style.width = `${a.energy}%`;
    if (a.build.top) r.top.textContent = `${PARTS[a.build.top.id].name} ${a.ammo}`;
    let status = '';
    if (a.immobileIn < 5) status = `Move! ${Math.max(0, Math.ceil(a.immobileIn))}`;
    else if (a.lock) status = 'Lock on';
    if (r.lastStatus !== status) { r.status.textContent = status; r.lastStatus = status; if (status.startsWith('Move')) Audio.tick(); }
    // Off-screen rival.
    this.offscreenArrow(b, g);
    this.updateTouch(a);
  },
  offscreenArrow(r, g) {
    let ar = this.arrowEl;
    const v = this.project(r.x, 0.5, r.z);
    const off = !v || v.x < 0 || v.x > innerWidth || v.y < 40 || v.y > innerHeight;
    if (!off || g.state !== 'fight') { if (ar) ar.style.display = 'none'; return; }
    if (!ar || !ar.isConnected) { ar = this.arrowEl = h('.arrow'); document.body.append(ar); }
    ar.style.display = 'block';
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const dx = v.x - cx, dy = v.y - cy;
    const k = Math.min((cx - 30) / Math.abs(dx || 1), (cy - 60) / Math.abs(dy || 1));
    ar.style.left = `${cx + dx * k - 11}px`;
    ar.style.top = `${cy + dy * k - 10}px`;
    ar.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
  },
  project(x, y, z) {
    const cam = this.camera;
    if (!cam) return null;
    const p = this.vec.set(x, y, z).project(cam);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
  },
  setupTouch(b) {
    const zone = document.getElementById('touch');
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (!coarse) { zone.classList.add('hidden'); return; }
    Input.usingTouch = true;
    zone.classList.remove('hidden');
    zone.innerHTML = '';
    // Stick: floats where the left thumb lands.
    const stickZone = h('.stickzone');
    const knob = h('.knob');
    const stick = h('.stick', { style: { left: '100px', bottom: 'auto', top: `${innerHeight - 110}px` } }, knob);
    zone.append(stickZone, stick);
    let pid = null, ox = 0, oy = 0;
    const R = 52;
    const moveStick = (e) => {
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 6;
      Input.stick.x = len < dead ? 0 : dx / R;
      Input.stick.y = len < dead ? 0 : -dy / R;
    };
    const endStick = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; Input.stick.x = 0; Input.stick.y = 0; knob.style.transform = ''; stick.classList.remove('on');
    };
    stickZone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pid = e.pointerId; stickZone.setPointerCapture(pid);
      ox = e.clientX; oy = e.clientY;
      stick.style.left = `${ox}px`; stick.style.top = `${oy}px`;
      stick.classList.add('on');
      moveStick(e);
    });
    stickZone.addEventListener('pointermove', (e) => { if (e.pointerId === pid) moveStick(e); });
    stickZone.addEventListener('pointerup', endStick);
    stickZone.addEventListener('pointercancel', endStick);
    const main = b.main ? PARTS[b.main.id] : null;
    const holdMain = main && main.use === 'hold';
    const fire = h('.tbtn.fire', {}, 'FIRE');
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Input.pressTouch('fire');
      if (holdMain) { Input.touchFireHeld = !Input.touchFireHeld; fire.classList.toggle('on', Input.touchFireHeld); fire.textContent = Input.touchFireHeld ? 'ON' : 'FIRE'; }
    });
    zone.append(fire);
    if (b.top) {
      const hold = b.top.id === 'autocannon';
      const top = h('.tbtn.top', {}, 'TOP');
      top.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Input.pressTouch('top');
        if (hold) { Input.touchTopHeld = !Input.touchTopHeld; top.classList.toggle('on', Input.touchTopHeld); }
      });
      zone.append(top);
    }
    if (b.power) {
      const pw = h('.tbtn.power', {}, 'POWER');
      pw.addEventListener('pointerdown', (e) => { e.preventDefault(); Input.pressTouch('power'); });
      this.pwBtn = pw;
      zone.append(pw);
    } else this.pwBtn = null;
    const lock = h('.tbtn.lock', {}, 'LOCK');
    lock.addEventListener('pointerdown', (e) => { e.preventDefault(); Input.lock = !Input.lock; lock.classList.toggle('on', Input.lock); });
    zone.append(lock);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  updateTouch(a) {
    if (this.pwBtn && a.build.power) {
      const cant = a.pCd > 0 || a.energy < PARTS[a.build.power.id].energy;
      this.pwBtn.classList.toggle('cool', cant);
    }
  },
  onMuted() { /* buttons read it next time they draw */ },

  number(x, y, z, amount, mine, big) {
    if (amount <= 0) return;
    const v = this.project(x, y, z);
    if (!v) return;
    const root = document.getElementById('numbers');
    if (root.childElementCount > 14) root.firstChild.remove();
    const e = h(`.num${big ? '.big' : ''}${mine ? '.me' : ''}`, { style: { left: `${v.x + (Math.random() - 0.5) * 30}px`, top: `${v.y + (Math.random() - 0.5) * 16}px` } }, String(amount));
    root.append(e);
    setTimeout(() => e.remove(), 800);
  },
  bigText(text, dur = 1, hold = false) {
    for (const c of document.querySelectorAll('.big')) c.remove();
    const e = h('.big.pop', { style: { animationDuration: `${dur}s` } }, text);
    document.body.append(e);
    setTimeout(() => e.remove(), dur * 1000);
    void hold;
  },
  callout(text) {
    for (const c of document.querySelectorAll('.callout')) c.remove();
    const e = h('.callout', {}, text);
    document.body.append(e);
    setTimeout(() => e.remove(), 900);
  },
  prompt(text) {
    if (!this.promptEl && !text) return;
    if (!this.promptEl || !this.promptEl.isConnected) { this.promptEl = h('div', { id: 'prompt' }); document.body.append(this.promptEl); }
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
  },
  linkLost(t) {
    if (!t) return;
    const s = document.getElementById('static');
    s.textContent = 'LINK LOST';
    s.classList.add('on');
    clearTimeout(this.staticT);
    this.staticT = setTimeout(() => { s.classList.remove('on'); s.textContent = ''; }, t * 1000);
  },

  // ---- pause and results -----------------------------------------------
  pause() {
    this.modal(
      h('h2', {}, 'Paused'),
      h('.menu', { style: { width: '100%' } },
        btn('Resume', () => Flow.resume(), 'primary'),
        btn('Retry fight', () => { this.closeModal(); Flow.retry(); }),
        btn('Back to garage', () => { this.closeModal(); Flow.quitToGarage(); }),
        btn(Audio.mutedAll ? 'Unmute' : 'Mute', () => { toggleMute(); this.pause(); }),
        btn(`Camera: ${G.camMode}`, () => { setCamera(); this.pause(); }),
        btn('How to play', () => this.howto(() => this.pause()))));
  },
  lost(n, r) {
    const riv = RIVALS[n - 1];
    const s = Save.data;
    const why = { ko: 'Your robot was knocked out.', hazard: 'The arena finished you off.', ringout: 'You went over the edge.', pit: 'You fell into the pit.', decision: 'The judges went with the rival: more damage dealt.', immobile: 'Your robot sat still too long.' }[r.cause];
    const canEasy = s.lossStreak >= 3 && !s.offeredEasy && s.settings.assist !== 'easy' && !G.exhibition;
    this.add(h('.screen.center', {},
      h('h2.lost', {}, 'Wrecked'),
      h('p', {}, why),
      h('p', {}, `Tip: ${riv.tip}`),
      G.exhibition ? null : h('p', { style: { color: '#ffc21a', fontWeight: 700 } }, `Free repair, plus ${Math.round((riv.champ ? LEAGUES[riv.league - 1].champ : LEAGUES[riv.league - 1].win) * 0.15)} scrap from the sponsors.`),
      !G.exhibition && s.tabs.exchange && sponsorDeal() ? h('p', { style: { color: '#1fd6c2', fontWeight: 700 } }, 'Sponsor deal: the Exchange has next league\'s parts for you. Try a new weapon.') : null,
      canEasy ? h('.row', { style: { justifyContent: 'center' } }, btn('Turn on easy driver assist', () => { s.settings.assist = 'easy'; s.offeredEasy = true; Save.write(); this.clear(); Flow.retry(); })) : null,
      h('.row', { style: { justifyContent: 'center' } }, btn('Retry', () => Flow.retry(), 'primary'), btn('Garage', () => Flow.garage()))));
  },
  salvage(n, offer, prize, exhibition) {
    const riv = RIVALS[n - 1];
    const s = Save.data;
    const root = h('.screen.salvage');
    const side = h('.sv-side', {}, prize.lines.map((l) => h('div', {}, `${l.label}: +${l.amount}`)), h('.scrap', {}, `+${prize.total}`));
    const remaining = () => offer.picks - G.picks.length;
    const head = h('h2', {}, 'Salvage rights');
    const sub = h('.note', {});
    const updateHead = () => {
      if (offer.ringer && this.ringerDone && s.inventory.some((q) => q.mk < 3)) sub.textContent = 'Done. The black Ringer finish is yours in the Paint tab.';
      else if (offer.ringer && !s.inventory.some((q) => q.mk < 3)) sub.textContent = 'Everything you own is Mk III already. The black Ringer finish is yours.';
      else if (offer.ringer) sub.textContent = 'It was your own build. Pick one part of yours to raise a Mk, and the black Ringer finish is yours.';
      else if (offer.fully) sub.textContent = 'Fully stocked. Nothing here beats what you have.';
      else if (remaining() > 0) sub.textContent = n === 1 && !s.seen.firstPick ? 'Pick one. It\'s yours.' : `${riv.name} is scrap. Pick ${remaining() > 1 ? `${remaining()} parts` : 'one part'}.`;
      else sub.textContent = 'Bolted on the truck. The rest goes for scrap.';
    };
    root.append(h('.sv-head', {}, h('div', {}, head, sub), side));
    const cards = h('.cards');
    const go = btn('Continue', () => Flow.afterSalvage(), 'primary', { disabled: 'true' });
    const curBuild = currentBuild();
    if (offer.ringer) this.ringerDone = !!offer.ringerDone;
    const renderDone = () => { updateHead(); go.disabled = !(offer.ringer ? this.ringerDone : remaining() <= 0 || offer.fully); };
    if (offer.ringer) {
      const list = s.inventory.filter((q) => q.mk < 3).sort((a, b) => isEquipped(b.uid) - isEquipped(a.uid)).slice(0, 12);
      for (const q of list) {
        const c = h('button.card', { on: { click: () => { if (this.ringerDone) return; const to = MK_NAMES[q.mk + 1]; ringerUpgrade(q.uid); this.ringerDone = true; offer.ringerDone = true; Save.write(); c.classList.add('picked'); c.querySelector('.row').textContent = `Now ${to}`; Audio.play('ratchet'); renderDone(); } } },
          h('.head', {}, thumb(q.id), h('.nm', {}, PARTS[q.id].name)), h('.row', { style: { gap: '4px' } }, mkTag(q.mk), `to ${MK_NAMES[q.mk + 1]}`, h('span.mk', {}, isEquipped(q.uid) ? 'Fitted' : 'Spare')));
        cards.append(c);
      }
      if (list.length === 0) this.ringerDone = true;
    }
    for (const card of offer.cards) {
      const p = PARTS[card.id];
      const cur = curBuild[p.slot];
      const curStats = cur ? Object.fromEntries(partStats(cur.id, cur.mk)) : {};
      const statRows = partStats(card.id, card.mk).map(([l, v]) => {
        const a = parseFloat(curStats[l]), b = parseFloat(v);
        let cls = '';
        if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) {
          const lowerBetter = l === 'Weight' || l === 'Reload' || l === 'Energy';
          cls = (b > a) !== lowerBetter ? 'up' : 'down';
        } else if (Number.isNaN(a)) cls = 'up';
        return h('.stat', {}, h('span', {}, l), h('b', { class: cls }, String(v)));
      });
      const el = h(`button.card${card.isNew ? '.fresh' : ''}${card.taken ? '.picked' : ''}`, { on: { click: () => {
        if (remaining() <= 0 || card.taken) { Audio.denied(); return; }
        card.taken = true;
        G.picks.push(card);
        const uid = takeSalvage(card, riv.name);
        el.classList.add('picked');
        Audio.play('ratchet', { vol: 0.9 });
        if (n === 1 && !exhibition && !s.seen.firstPick) { s.seen.firstPick = true; equip(uid); Save.write(); }
        else el.append(btn('Fit now', (e) => { e.stopPropagation(); equip(uid); Audio.play('ratchet', { vol: 0.8 }); e.target.textContent = 'Fitted'; e.target.disabled = true; }, 'small primary'));
        renderDone();
      } } },
        h('.head', {}, thumb(card.id), h('div', {}, h('.nm', {}, p.name), h('.row', { style: { gap: '4px' } }, mkTag(card.mk), card.isNew ? h('span.tagnew', {}, 'NEW') : h('span.mk', {}, 'Spare'), p.use ? h('span.mk', {}, p.use === 'hold' ? (isTouch() ? 'ON/OFF' : 'HOLD') : 'TAP') : null))),
        h('div', { style: { color: '#9aa4b1', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' } }, SLOT_NAMES[p.slot]),
        h('.cdesc', {}, partDesc(card.id)),
        statRows);
      cards.append(el);
    }
    root.append(cards, h('.sv-foot', {}, h('p.note', {}, exhibition ? 'Exhibition: parts are one Mk down, and no payout for the rest.' : ''), go));
    renderDone();
    this.add(root);
    if (cards.scrollWidth > cards.clientWidth + 4) {
      cards.classList.add('more');
      const n = cards.children.length;
      sub.append(document.createTextNode(` ${n} parts on this wreck: swipe to see them all.`));
      cards.addEventListener('scroll', () => { cards.classList.toggle('more', cards.scrollLeft + cards.clientWidth < cards.scrollWidth - 6); }, { passive: true });
    }
  },
  promotion(n, out) {
    const riv = RIVALS[n - 1];
    const lg = LEAGUES[riv.league - 1];
    const nextLg = LEAGUES[riv.league] || lg;
    const newStock = Object.keys(STOCK).filter((id) => STOCK[id] === nextLg.id).map((id) => PARTS[id].name);
    const chip = out.chip ? CHIPS[out.chip] : null;
    const trophy = TROPHIES[n];
    this.add(h('.screen.center', {},
      h('div', { html: SVG.star(riv.league) }),
      h('h2.won', {}, `${lg.rank}!`),
      h('p', {}, `You beat ${riv.name}. The ${lg.name} is yours.`),
      trophy ? h('p', {}, `Trophy bolted on: ${trophy}.`) : null,
      chip ? h('p', { style: { color: '#ffc21a', fontWeight: 700 } }, out.chipCash ? `Chip drop: ${chip.name}. You own one, so here's ${out.chipCash} scrap.` : `Chip drop: ${chip.name}. ${chip.desc}.`) : null,
      newStock.length ? h('p', { style: { color: '#1fd6c2', fontWeight: 700 } }, `New at the Exchange: ${newStock.slice(0, 6).join(', ')}${newStock.length > 6 ? ' and more' : ''}.`) : null,
      btn(`On to the ${nextLg.name}`, () => Flow.garage(), 'yellow')));
  },
  victory() {
    const s = Save.data;
    this.add(h('.screen.center', { style: { background: 'linear-gradient(90deg, rgba(6,7,9,0.8) 0%, rgba(6,7,9,0.7) 48%, rgba(6,7,9,0) 70%)', alignItems: 'flex-start', textAlign: 'left' } },
      h('h2.won', {}, 'Champion'),
      h('p', {}, `${s.name} is built from everyone it beat.`),
      h('.spoils', {}, s.spoils.slice(-14).map((sp) => h('div', {}, h('b', {}, PARTS[sp.id].name), ` ${MK_NAMES[sp.mk]}, from ${sp.from}`))),
      h('p.note', {}, 'An idea by Rich Conlan.'),
      h('.row', {}, btn('Champion\'s lap', () => { this.garageTab = 'ladder'; Flow.garage(); }, 'yellow'), btn('Title', () => Flow.title()), btn('Credits', () => this.credits()))));
  },
};
