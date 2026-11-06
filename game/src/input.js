// One input layer: keyboard, touch and gamepad all become the same actions.
// `consume()` hands the fight one tick of input and clears the "just pressed"
// latches, so a press shorter than a frame still counts.
const hyp = Math.hypot;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyJ: 'fire', KeyK: 'top', KeyE: 'top', KeyF: 'top', KeyL: 'power', KeyR: 'power', KeyQ: 'lock', Tab: 'lock',
};
const GAME_KEYS = new Set([...Object.keys(KEYMAP), 'Escape', 'KeyP', 'KeyM', 'KeyC']);

// Versus has its own keys: [player, action]. Only these, Esc and M are live.
const VS_KEYS = {
  KeyW: [0, 'up'], KeyS: [0, 'down'], KeyA: [0, 'left'], KeyD: [0, 'right'], KeyF: [0, 'fire'], KeyG: [0, 'top'], KeyH: [0, 'power'], KeyR: [0, 'lock'],
  ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], Comma: [1, 'fire'], Period: [1, 'top'], Slash: [1, 'power'], KeyL: [1, 'lock'],
};
const freshVs = () => [0, 1].map(() => ({ keys: {}, fire: false, top: false, power: false, fireOn: false, topOn: false, lock: false, holdFire: false, holdTop: false }));

export const Input = {
  mode: 'career',
  vs: freshVs(),
  keys: {}, latched: { fire: false, top: false, power: false }, lock: false,
  stick: { x: 0, y: 0 },
  touchFireHeld: false, touchTopHeld: false,
  usingTouch: false,
  usingPad: false,
  paused: false,
  active: false, // true during a fight
  onPause: null, onMute: null, onCamera: null, onAny: null,

  init() {
    addEventListener('keydown', (e) => {
      if (this.onAny) this.onAny();
      if (this.mode === 'versus') { this.vsKeyDown(e); return; }
      if (GAME_KEYS.has(e.code) && (this.active || !['Tab', 'Space', 'Enter'].includes(e.code))) e.preventDefault();
      if (e.repeat) {
        // A key held through a pause comes back on its next repeat.
        const held = KEYMAP[e.code];
        if (this.active && held && held !== 'lock') this.keys[held] = true;
        return;
      }
      if (e.code === 'KeyM' && this.onMute) { this.onMute(); return; }
      if (!this.active) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { if (this.onPause) this.onPause(); return; }
      if (e.code === 'KeyC' && this.onCamera) { this.onCamera(); return; }
      const a = KEYMAP[e.code];
      if (!a) return;
      this.keys[a] = true;
      if (this.paused) return; // No shots saved up during a pause.
      if (a === 'fire' || a === 'top' || a === 'power') this.latched[a] = true;
      if (a === 'lock') this.lock = !this.lock;
    });
    addEventListener('keyup', (e) => {
      if (this.mode === 'versus') {
        const v = VS_KEYS[e.code];
        if (v) this.vs[v[0]].keys[v[1]] = false;
        return;
      }
      const a = KEYMAP[e.code];
      if (a) this.keys[a] = false;
    });
    addEventListener('blur', () => this.clear());
    addEventListener('pointerdown', () => { if (this.onAny) this.onAny(); }, { passive: true });
    addEventListener('touchstart', () => { if (this.onAny) this.onAny(); }, { passive: true });
  },

  clear() {
    this.keys = {};
    this.stick.x = 0; this.stick.y = 0;
    this.touchFireHeld = false; this.touchTopHeld = false;
    this.latched = { fire: false, top: false, power: false };
    for (const v of this.vs) { v.keys = {}; v.fire = false; v.top = false; v.power = false; v.fireOn = false; v.topOn = false; }
  },

  // Fire and top mount that run while held switch on and off with a tap in
  // Versus, so two players never need more keys down than a keyboard allows.
  startVersus(holds) {
    this.mode = 'versus';
    this.vs = freshVs();
    holds.forEach((h, i) => { this.vs[i].holdFire = h.fire; this.vs[i].holdTop = h.top; });
  },
  endVersus() { this.mode = 'career'; this.vs = freshVs(); },
  vsKeyDown(e) {
    const v = VS_KEYS[e.code];
    if (v || e.code === 'Escape' || e.code === 'KeyM') { if (this.active) e.preventDefault(); }
    if (e.code === 'KeyM' && !e.repeat && this.onMute) { this.onMute(); return; }
    if (!this.active) return;
    if (e.code === 'Escape' && !e.repeat) { if (this.onPause) this.onPause(); return; }
    if (!v) return;
    const [i, a] = v;
    const p = this.vs[i];
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') { p.keys[a] = true; return; }
    if (e.repeat || this.paused) return;
    if (a === 'lock') p.lock = !p.lock;
    else if (a === 'fire') { p.fire = true; if (p.holdFire) p.fireOn = !p.fireOn; }
    else if (a === 'top') { p.top = true; if (p.holdTop) p.topOn = !p.topOn; }
    else if (a === 'power') p.power = true;
  },
  consumeVersus(i) {
    const p = this.vs[i], k = p.keys;
    let x = (k.right ? 1 : 0) - (k.left ? 1 : 0), y = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    if (x && y) { const l = Math.SQRT1_2; x *= l; y *= l; }
    const out = { mx: x, mz: -y, fire: p.fireOn || p.fire, firePressed: p.fire, top: p.topOn || p.top, topPressed: p.top, powerPressed: p.power, lock: p.lock };
    p.fire = false; p.top = false; p.power = false;
    return out;
  },

  pressTouch(a) { this.latched[a] = true; },

  // A gamepad must be able to resume too; consume() doesn't run while paused.
  pollPauseButton() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = p.buttons[9] && p.buttons[9].pressed;
      if (b && !this.pad9 && this.onPause) this.onPause();
      this.pad9 = b;
    }
  },

  // One tick. `toWorld(x, y)` maps screen-relative push to floor direction.
  consume(toWorld) {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.left) x -= 1;
    if (k.right) x += 1;
    if (k.up) y += 1;
    if (k.down) y -= 1;
    if (x || y) { const l = hyp(x, y); x /= l; y /= l; }
    else { x = this.stick.x; y = this.stick.y; }
    let firePressed = this.latched.fire, topPressed = this.latched.top, powerPressed = this.latched.power;
    let fire = !!k.fire || this.touchFireHeld, top = !!k.top || this.touchTopHeld;
    // Gamepad.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      if (Math.abs(p.axes[0]) > 0.2 || Math.abs(p.axes[1]) > 0.2) { x = p.axes[0]; y = -p.axes[1]; }
      else if (b(12) || b(13) || b(14) || b(15)) {
        x = (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
        y = (b(12) ? 1 : 0) - (b(13) ? 1 : 0);
        const l = hyp(x, y); if (l > 1) { x /= l; y /= l; }
      }
      if (b(3) && !this.pad3 && this.onCamera) this.onCamera();
      this.pad3 = b(3);
      if (b(0) && !this.pad0) firePressed = true;
      if (b(2) && !this.pad2) topPressed = true;
      if (b(1) && !this.pad1) powerPressed = true;
      if (b(4) && !this.pad4) this.lock = !this.lock;
      if (b(9) && !this.pad9 && this.onPause) this.onPause();
      this.pad0 = b(0); this.pad1 = b(1); this.pad2 = b(2); this.pad4 = b(4); this.pad9 = b(9);
      fire = fire || b(0); top = top || b(2);
    }
    this.latched = { fire: false, top: false, power: false };
    const w = toWorld(x, y);
    return { mx: w.x, mz: w.z, fire: fire || firePressed, firePressed, top: top || topPressed, topPressed, powerPressed, lock: this.lock };
  },
};
