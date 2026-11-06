// Every menu works with a controller: stick or d-pad moves between buttons,
// A presses, B goes back. Nothing shows until a controller is actually used.
import { Input } from './input.js';

const FOCUSABLE = 'button:not(:disabled), a[href]';
const BACK_LABELS = ['close', 'cancel', 'resume', 'back to garage'];

export const PadNav = {
  el: null, lastRect: null, lastKey: '', repeat: 0, held: '', prev: {}, active: false,

  // What's on top right now: a pop-up, else the screen.
  root() {
    const modals = document.querySelectorAll('#ui .modal');
    return modals.length ? modals[modals.length - 1] : document.getElementById('ui');
  },
  items() {
    return [...this.root().querySelectorAll(FOCUSABLE)].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
  },
  setFocus(e) {
    if (this.el) this.el.classList.remove('padfocus');
    this.el = e;
    if (!e) return;
    e.classList.add('padfocus');
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.lastRect = e.getBoundingClientRect();
  },
  // A sensible starting button for a screen.
  firstItem(items) {
    return items.find((e) => e.matches('.primary:not(.small), .yellow')) || items.find((e) => !e.closest('.g-top')) || items[0] || null;
  },
  ensure(screenKey) {
    const items = this.items();
    if (screenKey !== this.lastKey) {
      this.lastKey = screenKey;
      this.setFocus(this.firstItem(items));
      return;
    }
    if (this.el && this.el.isConnected && items.includes(this.el)) return;
    // The button redrew: stay near where it was.
    if (!items.length) { this.setFocus(null); return; }
    const c = this.lastRect ? { x: this.lastRect.x + this.lastRect.width / 2, y: this.lastRect.y + this.lastRect.height / 2 } : null;
    if (!c) { this.setFocus(this.firstItem(items)); return; }
    let best = items[0], bd = Infinity;
    for (const e of items) {
      const r = e.getBoundingClientRect();
      const d = Math.hypot(r.x + r.width / 2 - c.x, r.y + r.height / 2 - c.y);
      if (d < bd) { bd = d; best = e; }
    }
    this.setFocus(best);
  },
  move(dx, dy) {
    if (!this.el) return;
    const a = this.el.getBoundingClientRect();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    let best = null, score = Infinity;
    for (const e of this.items()) {
      if (e === this.el) continue;
      const r = e.getBoundingClientRect();
      const x = r.x + r.width / 2 - ax, y = r.y + r.height / 2 - ay;
      const along = x * dx + y * dy;
      if (along <= 2) continue;
      const across = Math.abs(x * dy) + Math.abs(y * dx);
      const s = along + across * 2.5;
      if (s < score) { score = s; best = e; }
    }
    if (best) this.setFocus(best);
  },
  back() {
    const items = this.items();
    const byLabel = items.find((e) => BACK_LABELS.includes(e.textContent.trim().toLowerCase()));
    const icon = items.find((e) => e.getAttribute('aria-label') === 'Back to title');
    const b = byLabel || icon;
    if (b) b.click();
  },
  clear() {
    this.active = false;
    Input.usingPad = false;
    this.setFocus(null);
    this.lastKey = '';
  },

  // Called every frame. `inMenus` is false while driving.
  update(dt, inMenus, screenKey) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const q of pads) if (q) { p = q; break; }
    if (!p) return;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    let x = Math.abs(p.axes[0]) > 0.5 ? Math.sign(p.axes[0]) : 0;
    let y = Math.abs(p.axes[1]) > 0.5 ? Math.sign(p.axes[1]) : 0;
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    const A = b(0), B = b(1);
    const used = A || B || x !== 0 || y !== 0 || b(9) || b(2) || b(3) || b(4);
    if (used && !Input.usingPad) Input.usingPad = true;
    if (!inMenus) {
      if (this.el) this.setFocus(null);
      this.lastKey = '';
      this.prev = { A, B };
      return;
    }
    if (used) this.active = true;
    if (!this.active) { this.prev = { A, B }; return; }
    this.ensure(screenKey);
    const dir = x || y ? (x ? `x${x}` : `y${y}`) : '';
    if (dir !== this.held) {
      this.held = dir;
      this.repeat = 0.34;
      if (dir) this.move(x && !y ? x : 0, y ? y : 0);
    } else if (dir) {
      this.repeat -= dt;
      if (this.repeat <= 0) { this.repeat = 0.15; this.move(x && !y ? x : 0, y ? y : 0); }
    }
    if (A && !this.prev.A && this.el) this.el.click();
    if (B && !this.prev.B) this.back();
    this.prev = { A, B };
    // A press that started a fight must not also fire the weapon.
    Input.pad0 = A; Input.pad1 = B;
  },
};
