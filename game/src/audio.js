// All sound. Web Audio buffers: effects overlap, loops are clean, and the first
// tap or key press wakes everything up.
const SFX_FILES = [
  'spinner', 'saw', 'hammer', 'clang-s', 'clang-m', 'clang-l', 'flipper', 'drill', 'flame', 'arc', 'rail-charge', 'rail-fire', 'autocannon', 'rocket', 'explosion', 'shield', 'overdrive', 'emp', 'repair', 'jets', 'motor', 'tread', 'hover', 'stomp', 'ratchet', 'cash', 'spray', 'horn', 'crowd-roar', 'crowd', 'lava', 'electric', 'ice', 'wind', 'crusher', 'pit', 'swing', 'fall',
];
const VOICE_FILES = ['countdown', 'ko', 'ringout', 'flawless', 'backstab', 'hazard', 'judges', 'champion', 'salvage', 'moveit'];

export const Audio = {
  ctx: null, master: null, musicGain: null, sfxGain: null, filter: null,
  buffers: {}, loading: {}, musicId: null, musicNodes: null, mutedAll: false, musicOn: true, sfxOn: true,
  loops: new Map(), wanted: null, duck: 1,

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
    this.musicGain.connect(this.filter); this.filter.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.applyMute();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    for (const id of SFX_FILES) this.load(`sfx/${id}`);
    for (const id of VOICE_FILES) this.load(`voice/${id}`);
    if (this.wanted) this.music(this.wanted);
  },

  async load(path) {
    if (!this.ctx) return null;
    if (this.buffers[path]) return this.buffers[path];
    if (!this.loading[path]) {
      this.loading[path] = fetch(`assets/audio/${path}.mp3`).then((r) => r.arrayBuffer())
        .then((b) => this.ctx.decodeAudioData(b)).then((d) => { this.buffers[path] = d; return d; })
        .catch(() => null);
    }
    return this.loading[path];
  },

  applyMute() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.musicOn && !this.mutedAll ? 0.5 * this.duck : 0, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxOn && !this.mutedAll ? 0.9 : 0, t, 0.02);
  },
  setMuted(m) { this.mutedAll = m; this.applyMute(); },
  setDuck(d) { this.duck = d; this.applyMute(); },
  setFilter(on) {
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(on ? 700 : 20000, this.ctx.currentTime, 0.15);
  },

  // Music: looped with a 2 s crossfade at the seam; tracks crossfade over 2 s.
  async music(id) {
    this.wanted = id;
    if (!this.ctx || this.musicId === id) return;
    this.musicId = id;
    const buf = await this.load(`music/${id}`);
    if (!buf || this.musicId !== id) return;
    this.stopMusicNodes(2);
    const nodes = { stop: false, srcs: [] };
    this.musicNodes = nodes;
    const fade = 2;
    const play = (when) => {
      if (nodes.stop) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(1, when + fade);
      g.gain.setValueAtTime(1, when + buf.duration - fade);
      g.gain.linearRampToValueAtTime(0, when + buf.duration);
      src.connect(g); g.connect(this.musicGain);
      src.start(when);
      nodes.srcs.push({ src, g });
      if (nodes.srcs.length > 3) nodes.srcs.shift();
      nodes.timer = setTimeout(() => play(when + buf.duration - fade), Math.max(0, (when + buf.duration - fade - this.ctx.currentTime - 1) * 1000));
    };
    play(this.ctx.currentTime + 0.05);
  },
  stopMusicNodes(fade = 0.5) {
    const n = this.musicNodes;
    if (!n) return;
    n.stop = true; clearTimeout(n.timer);
    const t = this.ctx.currentTime;
    for (const { src, g } of n.srcs) {
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, fade / 3);
        src.stop(t + fade + 0.2);
      } catch { /* already stopped */ }
    }
    this.musicNodes = null;
  },
  async sting(cutAt) {
    if (!this.ctx) return;
    this.stopMusicNodes(0.4);
    this.musicId = 'sting';
    const buf = await this.load('music/sting');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    src.connect(g); g.connect(this.musicGain);
    src.start();
    if (cutAt) { g.gain.setValueAtTime(1, this.ctx.currentTime + cutAt - 0.5); g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + cutAt); src.stop(this.ctx.currentTime + cutAt + 0.1); }
  },

  play(id, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    if (!this.sfxOn || this.mutedAll) return null;
    const path = o.voice ? `voice/${id}` : `sfx/${id}`;
    const buf = this.buffers[path];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (o.vary ? 1 + (Math.random() - 0.5) * o.vary : 1);
    const g = this.ctx.createGain();
    g.gain.value = o.vol === undefined ? 1 : o.vol;
    if (o.lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.lowpass;
      src.connect(f); f.connect(g);
    } else src.connect(g);
    g.connect(this.sfxGain);
    src.start();
    return src;
  },
  voice(id, vol = 1) { return this.play(id, { voice: true, vol }); },

  // Loops that follow a state: set(id, wanted volume, pitch) each frame.
  loop(key, id, vol, rate = 1) {
    if (!this.ctx) return;
    let l = this.loops.get(key);
    if (vol <= 0.001) {
      if (l) { l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06); }
      return;
    }
    if (!l) {
      const buf = this.buffers[`sfx/${id}`];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g); g.connect(this.sfxGain);
      src.start();
      l = { src, g };
      this.loops.set(key, l);
    }
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(vol, t, 0.06);
    l.src.playbackRate.setTargetAtTime(rate, t, 0.05);
  },
  stopLoops() {
    if (!this.ctx) return;
    for (const [, l] of this.loops) { try { l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); l.src.stop(this.ctx.currentTime + 0.5); } catch { /* done */ } }
    this.loops.clear();
  },

  // Made in code.
  tone(freq, dur, type = 'square', vol = 0.15, to = null) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn || this.mutedAll) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq = 1200, vol = 0.25) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn || this.mutedAll) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
  },
  click() { this.tone(900, 0.05, 'square', 0.08, 500); },
  denied() { this.tone(180, 0.14, 'sawtooth', 0.14, 120); },
  dry() { this.noise(0.05, 3000, 0.25); },
  ready() { this.tone(1200, 0.1, 'sine', 0.1, 1600); },
  tick() { this.tone(1000, 0.04, 'square', 0.1); },
  vent() { this.noise(0.5, 2500, 0.2); },
  mineBeep() { this.tone(1500, 0.07, 'square', 0.07); },
  staticBurst(d = 1) { this.noise(d, 3500, 0.32); },

  state() {
    return { context: this.ctx ? this.ctx.state : 'none', muted: this.mutedAll, musicOn: this.musicOn, sfxOn: this.sfxOn, music: this.musicId };
  },
};
