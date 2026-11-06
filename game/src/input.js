// One input layer: keyboard, touch and gamepad all become the same actions.
// `consume()` hands the fight one tick of input and clears the "just pressed"
// latches, so a press shorter than a frame still counts.
const hyp = Math.hypot;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyJ: 'fire', KeyK: 'top', KeyE: 'top', KeyF: 'top', KeyL: 'power', KeyR: 'power', KeyQ: 'lock', Tab: 'lock',
};
const GAME_KEYS = new Set([...Object.keys(KEYMAP), 'Escape', 'KeyP', 'KeyM', 'KeyC']);

export const Input = {
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
