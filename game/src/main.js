// Salvage Rights: boot, render loop, scenes, the fight's view and the flow
// between screens. Screens themselves are in ui.js; the fight rules in sim.js.
import * as THREE from 'three';
import { RIVALS, LEAGUES, PARTS, DEFAULT_PAINT, STARTER_BUILD } from './catalog.js';
import { Save, currentBuild, prizeFor, recordWin, recordLoss, salvageOffer, lockRinger, salvagePayout } from './state.js';
import { Input } from './input.js';
import { PadNav } from './padnav.js';
import { Audio } from './audio.js';
import { DT } from './sim.js';
import { Driver } from './ai.js';
import { setupFight, rivalSpec } from './fightsetup.js';
import { disposeScene, makeRobot, initHardware, preload, buildModels, modelsFor, setAniso, Hardware, MODELS, RobotView, loadModel } from './assembly.js';
import { ArenaView, loadTex } from './arena.js';
import { Fx } from './fx.js';
import { UI } from './ui.js';
import { CANONICAL, parseBuild } from './canonical.js';
import { setupVersus, rosterBuild, VS_ARENAS } from './versus.js';

const canvas = document.getElementById('view');
const isPhone = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isPhone, powerPreference: 'high-performance' });
renderer.setClearColor(0x0c0d10);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = !isPhone;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let pixelRatioCap = isPhone ? 1.5 : 2;
setAniso(isPhone ? 2 : Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400);
UI.camera = camera; UI.vec = new THREE.Vector3();
const pmrem = new THREE.PMREMGenerator(renderer);
const envCache = new Map();

function envFor(color, ambient) {
  const key = color + ambient;
  if (envCache.has(key)) return envCache.get(key);
  const s = new THREE.Scene();
  s.background = new THREE.Color(ambient).multiplyScalar(0.35);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(5) }));
  lamp.position.y = 6; s.add(lamp);
  for (const [x, z, c, m] of [[8, 0, 0xffffff, 1.6], [-8, 2, color, 2], [0, -8, 0x4a5060, 2], [2, 8, 0xfff0e0, 1.2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(m) }));
    b.position.set(x, 1.5, z); b.lookAt(0, 1, 0); s.add(b);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 30), new THREE.MeshBasicMaterial({ color: 0x2a2c30 }));
  floor.position.y = -3; s.add(floor);
  const t = pmrem.fromScene(s, 0.04).texture;
  envCache.set(key, t);
  return t;
}

export const G = {
  state: 'boot', scene: null, fight: null, driver: null, views: [], arena: null, fx: null, rivalN: 1, exhibition: false,
  camMode: 'booth', frozen: false, paused: false, accum: 0, hitStop: 0, timeScale: 1, koT: 0, shake: 0, punch: 0, camTarget: new THREE.Vector3(), camDist: 16, chaseH: 0,
  mode: 'career', vs: null, show: null, time: 0, prompts: null, fightStartT: 0, offer: null, picks: [], lastResult: null, stepping: false,
};
window.__G = G;

// ---------------------------------------------------------------- render
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatioCap));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (G.fx) G.fx.setViewport(renderer.domElement.height, camera.fov);
  const wrongWay = isPhone && h > w;
  document.getElementById('rotate').classList.toggle('hidden', !wrongWay);
  if (wrongWay && (G.state === 'fight' || G.state === 'countdown') && !G.paused) Flow.pause();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));

let lastT = performance.now(), slowFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.1) dt = 0.1;
  if (G.paused) Input.pollPauseButton();
  const driving = !G.paused && ['fight', 'countdown', 'ko', 'loading', 'boot'].includes(G.state);
  PadNav.update(dt, !driving, `${G.state}:${document.querySelectorAll('#ui .modal').length}`);
  if (!G.frozen) frame(dt);
  if (G.scene && !G.stepping && !G.noRender) renderer.render(G.scene, camera);
  // Lower the resolution if a phone can't keep up.
  if (dt > 1 / 28) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 120 && pixelRatioCap > 1 && isPhone) { pixelRatioCap = Math.max(1, pixelRatioCap - 0.25); slowFrames = 0; resize(); }
}

function frame(dt) {
  G.time += dt;
  if (G.state === 'fight' || G.state === 'countdown' || G.state === 'ko') updateFight(dt);
  else if (G.show) G.show.update(dt);
  UI.tick(dt);
}

// ---------------------------------------------------------------- showroom scenes
class Showroom {
  constructor(kind) { this.kind = kind; this.scene = new THREE.Scene(); this.robots = []; this.yaw = 0.6; this.yawV = 0; this.t = 0; this.camBase = new THREE.Vector3(); this.target = new THREE.Vector3(); this.pyro = 0; }
  async build() {
    const s = this.scene;
    const garage = this.kind === 'garage' || this.kind === 'salvage';
    const color = garage ? '#ffd9b0' : '#ffb066';
    s.environment = envFor(color, '#6f6a60');
    s.background = new THREE.Color(0x0c0d10);
    s.fog = new THREE.Fog(0x0c0d10, 8.5, 15.5);
    s.add(new THREE.HemisphereLight(0xfff0e0, 0x20222a, garage ? 1.1 : 0.7));
    const key = new THREE.DirectionalLight(0xfff2e0, garage ? 2.6 : 3.2);
    key.position.set(3.5, 7, 4.5);
    key.castShadow = !isPhone;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
    s.add(key);
    const rim = new THREE.DirectionalLight(garage ? 0x9fd8ff : 0xff8a44, 1.7);
    rim.position.set(-4, 3, -5);
    s.add(rim);
    const [floorT, wallT, backT] = await Promise.all([
      loadTex(garage ? 'assets/tiles/garage-floor.jpg' : 'assets/tiles/bowl-floor.jpg', garage ? 6 : 9),
      loadTex('assets/tiles/garage-wall.jpg', 3),
      loadTex(garage ? 'assets/bg/garage-back.jpg' : 'assets/bg/bowl.jpg', 1),
    ]);
    this.textures = [floorT, wallT, backT];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.62, metalness: 0.3, color: garage ? 0xffffff : 0x8a8a90 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(40, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.9 }));
    skirt.position.set(0, 0.35, -6.2);
    s.add(skirt);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(garage ? 18 : 34, garage ? 10.1 : 14.6), new THREE.MeshBasicMaterial({ map: backT, color: new THREE.Color(garage ? 1.9 : 1.1, garage ? 1.85 : 1.1, garage ? 1.75 : 1.15), fog: false }));
    back.position.set(0, garage ? 4.6 : 7, -6.5);
    s.add(back);
    if (garage) {
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.9, color: 0x9a9a9a }));
        w.rotation.y = -sx * Math.PI / 2;
        w.position.set(sx * 9, 5, 2);
        s.add(w);
      }
    }
    // Code-built turntable and lift.
    const table = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2, 0.14, 40), Hardware.dark);
    disc.position.y = 0.07;
    disc.receiveShadow = true; disc.castShadow = true;
    table.add(disc);
    const stripeRing = new THREE.Mesh(new THREE.RingGeometry(1.72, 1.86, 48), new THREE.MeshBasicMaterial({ color: 0x9c7a12 }));
    stripeRing.rotation.x = -Math.PI / 2;
    stripeRing.position.y = 0.145;
    table.add(stripeRing);
    s.add(table);
    this.table = table;
    if (garage) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.4, 0.28), Hardware.dark);
        post.position.set(sx * 3.6, 2.2, -3.2);
        post.castShadow = true;
        s.add(post);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 1.4), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
        lamp.position.set(sx * 1.8, 4.45, -2);
        s.add(lamp);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.22, 0.22), Hardware.trim);
      beam.position.set(0, 4.4, -3.2);
      s.add(beam);
    } else if (this.kind === 'podium') {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.8, 40), Hardware.dark);
      plinth.position.y = 0.4;
      plinth.castShadow = true; plinth.receiveShadow = true;
      s.add(plinth);
      table.position.y = 0.8;
    }
    return this;
  }
  setRobot(v) {
    if (this.robot) this.robot.dispose();
    this.robot = v;
    this.table.add(v.root);
    v.root.userData.baseY = this.table.scale.y !== 1 ? 0.14 : 0.14;
  }
  frame() {
    const landscapeShift = this.kind === 'salvage' ? 0 : innerWidth / innerHeight > 1.1 ? 1 : 0;
    const a = this.kind;
    let dist = 7.2, h = 2.4, look = 0.65, xOff = 0;
    const short = innerHeight < 460;
    const across = 2 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
    if (a === 'garage') {
      // The free gap on a phone is between the panel and the stats.
      dist = short ? 10 : 7.4; h = 2.5;
      xOff = landscapeShift * -(short ? 0.14 : 0.1) * across * dist;
    }
    if (a === 'title') { dist = short ? 9 : 7.3; xOff = short ? -0.2 * across * dist : -1.5; h = 2.0; look = 0.75; }
    if (a === 'salvage') { dist = short ? 9.5 : 7.5; h = 3.0; look = short ? -0.45 : 0.45; }
    if (a === 'podium') { dist = 10; h = 2.8; look = 1.2; xOff = -0.17 * across * dist; }
    if (innerHeight / innerWidth > 0.75) dist *= 1.3;
    camera.position.set(xOff, h, dist);
    camera.lookAt(xOff, look, 0);
  }
  update(dt) {
    this.t += dt;
    this.yaw += (0.32 + this.yawV) * dt;
    this.yawV *= Math.max(0, 1 - dt * 3);
    this.table.rotation.y = this.yaw;
    if (this.robot && !this.wreck) this.robot.idle(dt);
    this.frame();
    if (this.fx) { this.fx.update(dt); }
    if (this.onUpdate) this.onUpdate(dt);
  }
  dispose() {
    if (this.robot) this.robot.dispose();
    this.robot = null;
    if (this.fx) { this.fx.dispose(); this.fx = null; }
    disposeScene(this.scene);
    for (const t of this.textures || []) if (t) t.dispose();
    this.scene.environment = null;
  }
}

async function enterShow(kind, makeRobotFn) {
  const sh = await new Showroom(kind).build();
  const v = await makeRobotFn();
  if (G.show) G.show.dispose();
  sh.setRobot(v);
  G.show = sh;
  G.scene = sh.scene;
  sh.frame();
  disposeFight();
  return sh;
}

const myRobot = (opts = {}) => makeRobot(currentBuild(), Save.data.paint, { trophies: Save.data.trophies, ...opts });

// Drag to spin the robot in the garage.
let dragX = null;
canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; });
addEventListener('pointermove', (e) => { if (dragX !== null && G.show) { G.show.yaw += (e.clientX - dragX) * 0.01; dragX = e.clientX; } });
addEventListener('pointerup', () => { dragX = null; });

// ---------------------------------------------------------------- flow
export const Flow = {
  async title() {
    G.state = 'title';
    G.mode = 'career';
    Input.endVersus();
    Input.active = false;
    clearTimeout(G.victoryTimer);
    Audio.stopLoops();
    UI.clear();
    await enterShow('title', () => myRobot());
    Audio.music('garage');
    Audio.setFilter(false);
    UI.title();
  },
  newGame() {
    Save.newGame();
    G.state = 'contract';
    UI.clear();
    UI.contract();
  },
  signed(name) {
    Save.data.name = (name || 'ROOKIE').toUpperCase().slice(0, 14);
    Save.write();
    Flow.startFight(1, false, { tutorial: true });
  },
  async garage(tab) {
    G.state = 'garage';
    G.mode = 'career';
    Input.endVersus();
    clearTimeout(G.victoryTimer);
    Audio.stopLoops();
    UI.clear();
    await enterShow('garage', () => myRobot());
    Audio.music('garage');
    Audio.setFilter(false);
    UI.garage(tab);
  },
  async refreshGarageRobot() {
    const show = G.show;
    if (!show) return;
    const ticket = (G.rebuildTicket = (G.rebuildTicket || 0) + 1);
    let v;
    try { v = await myRobot(); } catch (e) { console.error(e); return; }
    if (ticket !== G.rebuildTicket || G.show !== show) { v.dispose(); return; }
    show.setRobot(v);
  },
  // Versus: pick robots and an arena.
  async versus() {
    G.mode = 'versus';
    Input.startVersus([{ fire: false, top: false }, { fire: false, top: false }]);
    Input.active = false;
    G.paused = false; Input.paused = false;
    G.state = 'versus';
    Audio.stopLoops();
    UI.clear();
    if (!G.show) await enterShow('title', () => myRobot());
    Audio.music('garage');
    Audio.setFilter(false);
    UI.versusSelect(G.vs);
  },
  async startVersus(cfg) {
    G.mode = 'versus';
    G.state = 'loading';
    G.paused = false; Input.paused = false;
    UI.clear();
    UI.loading('Rolling out the robots');
    Audio.stopLoops();
    const garageBuild = currentBuild();
    const arena = cfg.arena === 'random' ? VS_ARENAS[Math.floor(Math.random() * VS_ARENAS.length)] : cfg.arena;
    cfg.playing = arena;
    const fight = setupVersus({ a: cfg.a, b: cfg.b, arena, seed: Math.floor(Math.random() * 2147483647) + 1, garageBuild, garageName: Save.data.name });
    const paintFor = (c) => (c === 'garage' ? Save.data.paint : RIVALS[c - 1].paint);
    // The same robot twice: Player 2's copy is black and red.
    const paintB = cfg.a === cfg.b ? { c1: '#0c0c10', c2: '#d81e2c', pattern: 'solid', finish: 'gloss' } : paintFor(cfg.b);
    await stageFight({ fight, driver: null, arenaId: arena, buildA: fight.robots[0].build, paintA: paintFor(cfg.a), trophiesA: cfg.a === 'garage' ? Save.data.trophies : null, paintB, trophiesB: cfg.b === 'garage' ? Save.data.trophies : null, bossRail: false, tutorial: false, camMode: 'booth', colorB: 0x35e8ff });
    const holdsFor = (r) => ({ fire: !!(r.build.main && PARTS[r.build.main.id].use === 'hold'), top: !!(r.build.top && PARTS[r.build.top.id].hold) });
    Input.startVersus(fight.robots.map(holdsFor));
    G.state = 'prefight';
    G.vs = cfg;
    Audio.music('battle-b');
    Audio.setFilter(true);
    UI.clear();
    UI.versusPrefight(cfg);
  },
  async startFight(n, exhibition = false, o = {}) {
    G.mode = 'career';
    Input.endVersus();
    G.state = 'loading';
    UI.clear();
    UI.loading(`Loading ${RIVALS[n - 1].name}`);
    Audio.stopLoops();
    if (RIVALS[n - 1].mirror && !exhibition && !o.build) lockRinger();
    await buildFightScene(n, exhibition, o);
    UI.clear();
    if (o.tutorial || o.skipIntro) {
      if (o.skipIntro) { G.state = 'fight'; UI.hud(); return; }
      Flow.beginFight();
      return;
    }
    G.state = 'prefight';
    const lg = LEAGUES[RIVALS[n - 1].league - 1];
    Audio.music(battleTrack(lg.id));
    Audio.setFilter(true);
    UI.prefight(n);
    G.prefightT = 0;
  },
  beginFight() {
    UI.clear();
    UI.hud();
    Audio.setFilter(false);
    if (G.mode === 'versus') Audio.music('battle-b');
    else Audio.music(battleTrack(LEAGUES[RIVALS[G.rivalN - 1].league - 1].id));
    Audio.loop('crowd', 'crowd', 0.28);
    G.state = 'countdown';
    G.countT = G.tutorial ? 1.0 : 2.6;
    G.countShown = -1;
    if (!G.tutorial) Audio.voice('countdown');
    Input.clear();
    Input.active = true;
    Input.lock = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  },
  pause() {
    if (G.state !== 'fight' && G.state !== 'countdown') return;
    if (G.paused) return;
    G.paused = true;
    Input.paused = true;
    for (const b of document.querySelectorAll('.tbtn.fire.on, .tbtn.top.on')) { b.classList.remove('on'); if (b.classList.contains('fire')) b.textContent = 'FIRE'; }
    Audio.setDuck(0.35);
    Audio.stopLoops();
    Input.clear();
    UI.pause();
  },
  resume() {
    G.paused = false;
    Input.paused = false;
    Input.latched = { fire: false, top: false, power: false };
    Audio.setDuck(1);
    Audio.loop('crowd', 'crowd', 0.28);
    UI.closeModal();
    lastT = performance.now();
  },
  retry() {
    G.paused = false;
    Input.paused = false;
    if (G.mode === 'versus') { Input.active = false; Flow.startVersus(G.vs); return; }
    Audio.setDuck(1);
    Input.active = false;
    Flow.startFight(G.rivalN, G.exhibition);
  },
  quitToGarage() {
    G.paused = false;
    Input.paused = false;
    if (G.mode === 'versus') { Input.active = false; Flow.versus(); return; }
    Audio.setDuck(1);
    Input.active = false;
    Flow.garage();
  },
  async afterWin() {
    // Salvage screen with the wreck on the turntable.
    const n = G.rivalN;
    G.state = 'salvage';
    Audio.stopLoops();
    const spec = rivalSpec(n, currentBuild(), Save.data.ringer, Save.data.ng);
    const riv = RIVALS[n - 1];
    UI.clear();
    UI.loading('Dragging in the wreck');
    const pend = Save.data.pending;
    const offer = pend.offer || salvageOffer(n, G.exhibition);
    pend.offer = offer; pend.picks = pend.picks || [];
    Save.write();
    G.offer = offer; G.picks = pend.picks;
    await preload([...new Set(offer.cards.flatMap((c) => modelsFor(c.id)))]);
    await enterShow('salvage', async () => {
      const paint = riv.mirror ? { ...Save.data.paint, c1: '#0c0c10', c2: '#d81e2c' } : riv.paint;
      const v = await makeRobot(spec.build, paint, {});
      v.uniforms.uWreck.value = 0.45;
      // Exploded view: pull the parts away from the body.
      for (const d of v.detachables) {
        const p = d.position;
        const len = Math.hypot(p.x, p.y * 0.5, p.z) || 1;
        p.x += p.x / len * 0.4; p.z += p.z / len * 0.4; p.y += 0.3;
      }
      return v;
    });
    G.show.wreck = true;
    Audio.music('garage');
    UI.clear();
    UI.salvage(n, offer, G.prize, G.exhibition);
    Audio.voice('salvage', 0.9);
  },
  afterSalvage() {
    const n = G.rivalN;
    const payout = G.exhibition ? 0 : salvagePayout(G.offer.cards, G.picks);
    if (payout) { Save.data.scrap += payout; Save.write(); }
    const out = G.record || {};
    Save.data.pending = null;
    Save.write();
    if (n === 18 && out.firstWin) { Flow.victory(); return; }
    if (out.promoted) { Flow.promotion(out); return; }
    Flow.garage();
  },
  async promotion(out) {
    G.state = 'promotion';
    Audio.sting(5);
    UI.clear();
    UI.promotion(G.rivalN, out);
  },
  async victory() {
    G.state = 'victory';
    UI.clear();
    await enterShow('podium', () => myRobot());
    Audio.sting();
    Audio.voice('champion');
    Audio.play('crowd-roar', { vol: 0.8 });
    G.victoryTimer = setTimeout(() => { if (G.state === 'victory') { Audio.music('battle-c'); Audio.loop('crowd', 'crowd', 0.3); } }, 9000);
    const sh = G.show;
    sh.fx = new Fx(sh.scene, isPhone);
    sh.fx.setViewport(renderer.domElement.height, camera.fov);
    let t = 0;
    sh.onUpdate = (dt) => {
      t += dt;
      if (t > 0.5) {
        t = 0;
        const x = (Math.random() - 0.5) * 7, z = -1.5 + (Math.random() - 0.5) * 3;
        sh.fx.explosion(x, 2.5 + Math.random() * 2, z, 0.5);
        Audio.play('explosion', { rate: 1.4, vol: 0.25, vary: 0.2 });
      }
    };
    UI.victory();
  },
};

// Continue: back to an unfinished salvage, otherwise the garage.
Flow.resume_ = function resumeCareer() {
  const pend = Save.data.pending;
  if (pend && pend.n) {
    G.rivalN = pend.n; G.exhibition = pend.exhibition; G.prize = pend.prize; G.record = pend.record;
    return Flow.afterWin();
  }
  return Flow.garage();
};

// A failed download never leaves a dead screen.
for (const name of ['title', 'garage', 'startFight', 'afterWin', 'victory', 'resume_', 'versus', 'startVersus']) {
  const fn = Flow[name];
  Flow[name] = async function guarded(...args) {
    try { return await fn.apply(Flow, args); } catch (e) {
      console.error(e);
      Input.active = false;
      UI.loadError(() => Flow[name](...args));
      return undefined;
    }
  };
}

const battleTrack = (lg) => (lg <= 2 ? 'battle-a' : lg <= 5 ? 'battle-b' : 'battle-c');

// ---------------------------------------------------------------- fight scene
function disposeFight() {
  projMeshes.clear();
  if (G.fightScene) disposeScene(G.fightScene);
  if (G.arena) { G.arena.dispose(); G.arena = null; }
  for (const v of G.views) v.dispose();
  G.views = [];
  if (G.fx) { G.fx.dispose(); G.fx = null; }
  G.fight = null; G.driver = null;
  G.fightScene = null;
}

async function buildFightScene(n, exhibition, o) {
  const riv = RIVALS[n - 1];
  const lg = LEAGUES[riv.league - 1];
  const build = o.build || currentBuild();
  Save.data.fightSeed = (Save.data.fightSeed * 31 + 7) >>> 0;
  const seed = o.seed || (Save.data.fightSeed ^ (n * 2654435761)) >>> 0;
  const { fight, driver } = setupFight({ n, playerBuild: build, playerName: Save.data.name, seed, assist: Save.data.settings.assist, ringerBuild: Save.data.ringer, ng: Save.data.ng });
  const paintR = riv.mirror ? { ...Save.data.paint, c1: '#0c0c10', c2: '#d81e2c', finish: 'gloss' } : riv.paint;
  G.rivalN = n; G.exhibition = exhibition;
  await stageFight({ fight, driver, arenaId: lg.arena, buildA: build, paintA: Save.data.paint, trophiesA: Save.data.trophies, paintB: paintR, trophiesB: null, bossRail: riv.boss, tutorial: !!o.tutorial, camMode: Save.data.settings.cam || 'booth', colorB: 0xff3b30 });
}

async function stageFight({ fight, driver, arenaId, buildA, paintA, trophiesA, paintB, trophiesB, bossRail, tutorial, camMode, colorB }) {
  const scene = new THREE.Scene();
  const a = fight.arena;
  scene.environment = envFor(a.color, a.ambient);
  scene.background = new THREE.Color(a.sky);
  scene.add(new THREE.HemisphereLight(new THREE.Color(a.color).lerp(new THREE.Color(0xffffff), 0.7), new THREE.Color(a.ambient), 0.8));
  const key = new THREE.DirectionalLight(new THREE.Color(a.color).lerp(new THREE.Color(0xffffff), 0.8), 2.0);
  key.position.set(5, 18, 9);
  key.castShadow = !isPhone;
  key.shadow.mapSize.set(2048, 2048);
  const ext = Math.max(a.w, a.d) * 0.72;
  Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 50 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(a.color, 1.6);
  rim.position.set(-6, 5, -10);
  scene.add(rim);
  const arena = new ArenaView(arenaId);
  const rb = fight.robots[1].build;
  const [viewA, viewB] = await Promise.all([
    makeRobot(buildA, paintA, { trophies: trophiesA, shadows: !isPhone }),
    makeRobot(rb, paintB, { bossRail, trophies: trophiesB, shadows: !isPhone }),
    bossRail ? preload(['thruster', 'rail']) : null,
  ]);
  await arena.build(fight);
  disposeFight();
  if (G.show) { G.show.dispose(); G.show = null; }
  G.fight = fight; G.driver = driver; G.arena = arena;
  G.tutorial = !!tutorial;
  G.lastEvents = [];
  G.views = [viewA, viewB];
  scene.add(arena.group, viewA.root, viewB.root);
  G.scene = scene; G.fightScene = scene;
  G.fx = new Fx(scene, isPhone);
  G.fx.setViewport(renderer.domElement.height, camera.fov);
  G.timeScale = 1; G.koT = 0; G.hitStop = 0; G.shake = 0; G.punch = 0; G.accum = 0; G.paused = false;
  G.camMode = camMode;
  G.chaseH = Math.PI / 2;
  G.broke = [{ 66: false, 33: false }, { 66: false, 33: false }];
  G.promptStep = 0; G.promptT = 0; G.slowHit = false; G.movedDist = 0;
  addAids(viewA, 0xffc21a, fight.robots[0]);
  addAids(viewB, colorB, fight.robots[1]);
  viewA.update(0, fight.robots[0]); viewB.update(0, fight.robots[1]);
  G.camTarget.set(0, 0, 0);
  G.camDist = 24;
  updateBoothCam(1, true);
  scene.traverse((m) => { if (m.isMesh && m.material) m.material.needsUpdate = m.material.needsUpdate || false; });
  renderer.compile(scene, camera);
}

function addAids(view, color, r) {
  const rad = r.stats.radius + 0.12;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(rad, rad + 0.09, 40), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.renderOrder = 2;
  view.root.add(ring);
  const wedge = new THREE.Shape();
  wedge.moveTo(-0.22, 0); wedge.lineTo(0, 0.42); wedge.lineTo(0.22, 0); wedge.closePath();
  const w = new THREE.Mesh(new THREE.ShapeGeometry(wedge), mat);
  w.rotation.x = -Math.PI / 2;
  w.position.set(0, 0.03, rad + 0.02);
  view.root.add(w);
  view.aids = [ring, w];
  // Soft contact shadow, for phones and to seat the robot.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.95, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: isPhone ? 0.45 : 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.022;
  view.root.add(blob);
  // Shield bubble.
  const bub = new THREE.Mesh(new THREE.SphereGeometry(rad * 1.35, 24, 16), new THREE.MeshStandardMaterial({ color: 0x4fe6ff, emissive: 0x2299cc, emissiveIntensity: 1.2, transparent: true, opacity: 0.25, depthWrite: false, roughness: 0.2 }));
  bub.position.y = 0.5;
  bub.visible = false;
  view.root.add(bub);
  view.bubble = bub;
}

const projMeshes = new Map();

// ---- camera
const TILT = 50 * Math.PI / 180;
function updateBoothCam(dt, snap) {
  const f = G.fight;
  const [a, b] = f.robots;
  const hx = Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
  const hy = Math.tan(camera.fov * Math.PI / 360);
  const narrow = innerHeight < 460;
  const minWidth = narrow ? 14 : 16;
  const maxWidth = Math.max(f.arena.w, f.arena.d) + 4;
  // Target between robots, a bit nearer the player.
  const cx = (a.x * 1.1 + b.x * 0.9) / 2, cz = (a.z * 1.1 + b.z * 0.9) / 2;
  // Distance that fits both robots plus a margin, on both screen axes.
  const sinT = Math.sin(TILT), cosT = Math.cos(TILT);
  const marginX = 2.2, marginY = 2.4;
  let d = minWidth / (2 * hx);
  for (const r of [a, b]) {
    const dx = Math.abs(r.x - cx) + marginX, dz = r.z - cz;
    d = Math.max(d, dx / (hx * 0.92) + cosT * dz);
    const ay = (Math.abs(dz) * sinT + marginY);
    d = Math.max(d, ay / (hy * (narrow ? 0.7 : 0.86)) + cosT * Math.abs(dz));
  }
  d = Math.min(d, maxWidth / (2 * hx));
  G.camDist = snap ? d : G.camDist + (d - G.camDist) * Math.min(1, dt * 2.6);
  const keepZ = narrow ? 1.2 : 0.2; // Phones: action sits above the thumbs.
  const lim = Math.max(f.arena.w, f.arena.d) * 0.28;
  const tx = Math.max(-lim, Math.min(lim, cx));
  const tz = Math.max(-lim, Math.min(lim, cz)) + keepZ;
  const k = snap ? 1 : Math.min(1, dt * 3.2);
  G.camTarget.x += (tx - G.camTarget.x) * k;
  G.camTarget.z += (tz - G.camTarget.z) * k;
  const dist = G.camDist * (1 - G.punch * 0.05);
  camera.position.set(G.camTarget.x, sinT * dist, G.camTarget.z + cosT * dist);
  camera.lookAt(G.camTarget.x, 0, G.camTarget.z);
  camera.position.x += shakeX(); camera.position.y += shakeX() * 0.6;
}
const shakeX = () => (G.shake > 0.001 ? (Math.random() - 0.5) * G.shake * 0.6 : 0);

function updateChaseCam(dt) {
  const r = G.fight.robots[0];
  G.chaseH += ((r.h - G.chaseH + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
  const sx = Math.sin(G.chaseH), sz = Math.cos(G.chaseH);
  const k = 7.2 * (1 - G.punch * 0.05);
  camera.position.set(r.x - sx * k, 4.6 + r.y * 0.5, r.z - sz * k);
  camera.position.x += shakeX();
  camera.lookAt(r.x + sx * 3, 0.5 + r.y * 0.5, r.z + sz * 3);
}

function toWorld(x, y) {
  if (G.camMode === 'chase') {
    const r = G.fight.robots[0];
    if (!x && !y) return { x: 0, z: 0 };
    const ang = r.h + Math.atan2(x, Math.max(y, -0.2)) * 0.9;
    const mag = Math.min(1, Math.hypot(x, y));
    return { x: Math.sin(ang) * mag, z: Math.cos(ang) * mag };
  }
  return { x, z: -y };
}

// ---- the fight's tick
function simTick() {
  const f = G.fight;
  if (f.over) return;
  if (G.mode === 'versus') {
    f.step([Input.consumeVersus(0), Input.consumeVersus(1)]);
    for (const e of f.events) onEvent(e);
    f.events.length = 0;
    return;
  }
  const inp = Input.consume(toWorld);
  const ai = G.driver.update();
  if (G.autopilot) G.autopilot.feed(inp);
  f.step([inp, ai]);
  for (const e of f.events) onEvent(e);
  f.events.length = 0;
}

function updateFight(dt) {
  const f = G.fight;
  if (!f) return;
  if (G.paused) return;
  if (G.state === 'countdown') {
    G.countT -= dt;
    const c = Math.ceil(G.countT * (G.tutorial ? 1 : 1.2));
    if (c !== G.countShown && c > 0 && !G.tutorial) { G.countShown = c; UI.bigText(String(c), 0.7); Audio.tick(); }
    if (G.countT <= 0) { G.state = 'fight'; UI.bigText(G.tutorial ? 'GO' : 'FIGHT!', 0.7); Audio.play('horn', { vol: 0.5 }); G.fightStartT = G.time; }
  }
  // Hit-stop and slow motion live only in the view: sim ticks stay the same.
  let simDt = dt * G.timeScale;
  if (G.hitStop > 0) { G.hitStop -= dt; simDt = 0; }
  if (G.state === 'fight') {
    if (!G.stepping) {
      G.accum += simDt;
      let n = 0;
      while (G.accum >= DT && n++ < 6) { simTick(); G.accum -= DT; if (f.over) break; }
    }
    if (f.over && G.state === 'fight') onFightOver();
  }
  // View.
  const vdt = dt * (G.state === 'ko' ? 0.45 : 1);
  G.shake = Math.max(0, G.shake - dt * 2.2);
  G.punch = Math.max(0, G.punch - dt * 5);
  updateViews(vdt);
  G.arena.update(f.t, f);
  G.fx.update(vdt);
  if (G.camMode === 'chase' && G.state !== 'ko') updateChaseCam(dt); else updateBoothCam(dt);
  UI.updateHud(f, G);
  if (G.tutorial) tutorialPrompts(dt);
  else if (G.state === 'fight' && G.mode !== 'versus') fightPrompts(dt);
  driveAudio(f);
  if (G.state === 'ko') {
    G.koT -= dt;
    if (G.koT <= 0) koDone();
  }
}

function tutorialPrompts(dt) {
  const f = G.fight;
  const [me, foe] = f.robots;
  G.promptT += dt;
  const d = Math.hypot(me.x - foe.x, me.z - foe.z) - me.stats.radius - foe.stats.radius;
  G.movedDist += (me.speedNow || 0) * dt;
  const touch = Input.usingTouch;
  let msg = '';
  if (G.promptStep === 0) {
    msg = Input.usingPad ? 'Drive with the left stick' : touch ? 'Drag on the left to drive' : 'Drive with WASD or the arrow keys';
    if (G.movedDist > 2) G.promptStep = 1;
  } else if (G.promptStep === 1) {
    if (d < 4) msg = Input.usingPad ? 'Tap A to lunge' : touch ? 'Tap FIRE to lunge' : 'Tap SPACE to lunge';
    if (me.dealt > 0) { G.promptStep = 2; G.promptT = 0; }
  } else if (G.promptStep === 2) {
    if (G.slowHit) msg = 'Hit it at speed: back off, then charge';
    if (G.promptT > 12) G.promptStep = 3;
  }
  UI.prompt(msg);
}

// Teach each new thing once, the first fight it's fitted; nudge a weapon that isn't being used right.
function teachList() {
  const me = G.fight.robots[0];
  const touch = Input.usingTouch;
  const pad = Input.usingPad;
  const fireKey = pad ? 'A' : touch ? 'FIRE' : 'SPACE';
  const list = [];
  const main = me.build.main && PARTS[me.build.main.id];
  if (main) list.push(['main_' + main.id, main.use === 'hold' ? (pad ? `${main.name}: HOLD A to run it` : touch ? `${main.name}: tap FIRE to switch it on` : `${main.name}: HOLD SPACE to run it`) : `${main.name}: tap ${fireKey} to strike`]);
  const top = me.build.top && PARTS[me.build.top.id];
  if (top) list.push(['top_' + top.id, pad ? `${top.name}: press X` : touch ? `${top.name}: use TOP` : `${top.name}: press K`]);
  const pow = me.build.power && PARTS[me.build.power.id];
  if (pow) list.push(['power_' + pow.id, pad ? `${pow.name}: press B, it costs energy` : touch ? `${pow.name}: use POWER, it costs energy` : `${pow.name}: press L, it costs energy`]);
  if (G.rivalN >= 2) list.push(['lock', pad ? 'LB locks on to the rival, but slows you' : touch ? 'LOCK always faces the rival, but slows you' : 'Q locks on to the rival, but slows you']);
  return list;
}
function fightPrompts(dt) {
  const f = G.fight, me = f.robots[0], foe = f.robots[1], seen = Save.data.seen;
  if (G.teach === undefined || G.teachFight !== f) { G.teach = teachList(); G.teachFight = f; G.teachT = 0; G.noHitT = 0; G.dealtMark = 0; }
  G.teachT -= dt;
  let msg = G.teachMsg || '';
  if (G.teachT <= 0) {
    msg = '';
    const next = G.teach.find(([k]) => !seen['t_' + k]);
    if (next) { seen['t_' + next[0]] = true; Save.write(); msg = next[1]; G.teachT = 3.5; }
  }
  // Up close for a while with no damage done: say how this weapon works.
  const d = Math.hypot(me.x - foe.x, me.z - foe.z) - me.stats.radius - foe.stats.radius;
  if (me.dealt !== G.dealtMark) { G.dealtMark = me.dealt; G.noHitT = 0; }
  else if (d < 1.2) G.noHitT += dt;
  const main = me.build.main && PARTS[me.build.main.id];
  if (G.noHitT > 6 && G.teachT <= 0 && main) {
    msg = main.use === 'hold' ? (Input.usingPad ? 'HOLD A to run your weapon' : Input.usingTouch ? 'Tap FIRE to switch your weapon on' : 'HOLD SPACE to run your weapon') : `Point your ${main.name} at the rival and hit fire`;
    G.teachT = 3; G.noHitT = 0;
  }
  G.teachMsg = msg;
  UI.prompt(msg);
}

const LOOPS = { drum: 'spinner', saw: 'saw', drill: 'drill', flame: 'flame' };
function driveAudio(f) {
  if (G.state === 'ko' || !Audio.ctx) { Audio.loop('w0', 'saw', 0); Audio.loop('w1', 'saw', 0); Audio.loop('d0', 'motor', 0); return; }
  for (const r of f.robots) {
    const m = r.build.main && r.build.main.id;
    const lp = LOOPS[m];
    const keyW = 'w' + r.idx + (lp || '');
    if (lp) {
      let vol = 0, rate = 1;
      if (m === 'drum') { vol = r.rpm * 0.5; rate = 0.5 + r.rpm * 0.8; }
      else vol = r.firing ? 0.5 : 0;
      Audio.loop(keyW, lp, r.idx === 0 || G.mode === 'versus' ? vol : vol * 0.7, rate);
    }
    const dr = r.build.drive.id;
    const sp = r.speedNow / (r.stats.speed || 1);
    const key = 'd' + r.idx;
    if (dr === 'treads') Audio.loop(key, 'tread', sp * 0.3 * (r.idx && G.mode !== 'versus' ? 0.5 : 1), 0.7 + sp * 0.5);
    else if (dr === 'hover') Audio.loop(key, 'hover', (0.12 + sp * 0.18) * (r.idx && G.mode !== 'versus' ? 0.5 : 1), 0.8 + sp * 0.5);
    else if (dr === 'legs') {
      const ph = Math.floor(G.views[r.idx].legPhase / Math.PI || 0);
      if (ph !== G.views[r.idx].lastStomp && sp > 0.15) { G.views[r.idx].lastStomp = ph; Audio.play('stomp', { vol: 0.2 * (r.idx && G.mode !== 'versus' ? 0.5 : 1), vary: 0.15 }); }
    } else Audio.loop(key, 'motor', sp * 0.22 * (r.idx && G.mode !== 'versus' ? 0.5 : 1), 0.6 + sp * 0.8);
    if (r.repairT > 0) Audio.loop('rep' + r.idx, 'repair', 0.3); else Audio.loop('rep' + r.idx, 'repair', 0);
  }
  if (f.hz.lava) {
    const me = f.robots[0];
    Audio.loop('lava', 'lava', 0.14 + (f.onLava(me.x, me.z) ? 0.3 : 0));
  }
  if (f.hz.wind) Audio.loop('wind', 'wind', f.hz.wind.state === 'gust' ? 0.55 : 0.12);
  if (f.hz.saws) Audio.loop('fsaw', 'saw', 0.12, 0.55);
  if (f.hz.jets) Audio.loop('jet', 'flame', f.hz.jets.some((j) => j.st === 'fire') ? 0.25 : 0);
}

function updateViews(dt) {
  const f = G.fight;
  const fx = G.fx;
  f.robots.forEach((r, i) => {
    const v = G.views[i];
    if (!v) return;
    if (r.exploded) return;
    v.update(dt, r);
    if (v.bubble) { v.bubble.visible = r.shieldT > 0; if (r.shieldT > 0) v.bubble.rotation.y += dt * 2; }
    const hpf = r.hp / r.stats.maxHp;
    const tx = r.x, tz = r.z, ty = r.y + 0.9;
    // Smoke and flames on a hurt robot.
    if (hpf < 0.55 && Math.random() < dt * (hpf < 0.3 ? 16 : 6)) fx.smoke(tx, ty, tz, true, 0.5);
    if (hpf < 0.25 && Math.random() < dt * 22) fx.burnOn(tx, ty - 0.1, tz);
    if (r.burn > 0 && Math.random() < dt * 30) fx.burnOn(tx, r.y + 0.5, tz);
    if (r.repairT > 0 && Math.random() < dt * 22) fx.hot.add({ x: tx + (Math.random() - 0.5), y: r.y + 0.3, z: tz + (Math.random() - 0.5), vx: 0, vy: 1.3, vz: 0, life: 0.6, t: 0, s: 0.14, s2: 0.03, c: [0.3, 1, 0.75] });
    // Panels shear off at 66% and 33%.
    for (const lim of [66, 33]) {
      if (!G.broke[i][lim] && hpf * 100 < lim) {
        G.broke[i][lim] = true;
        fx.panelChunk(tx, ty, tz, Hardware.dark);
        fx.panelChunk(tx, ty, tz, v.paintMat ? v.paintMat() : Hardware.trim, 0.35, 0.24);
        fx.sparks(tx, ty, tz, 14, 6);
        Audio.play('clang-m', { vol: 0.7, vary: 0.2 });
        Audio.play('crowd-roar', { vol: 0.35 });
      }
    }
    // Weapon effects.
    const sx = Math.sin(r.h), sz = Math.cos(r.h);
    const m = r.build.main && r.build.main.id;
    const hull = r.stats.radius;
    if (m === 'flame' && r.firing) {
      for (let k = 0; k < 2; k++) {
        const a = v.anim.main;
        const mz = (a.muzzleZ || hull) + 0.1;
        fx.flame(r.x + sx * mz, r.y + (a.muzzleY || 0.8), r.z + sz * mz, sx, sz, 0.3, 8, 1);
      }
    }
    if ((m === 'saw' || m === 'drill' || m === 'drum') && r.firing && Math.random() < dt * 6) fx.sparks(r.x + sx * (hull + 0.4), r.y + 0.4, r.z + sz * (hull + 0.4), 1, 2);
    if (r.odT > 0 && r.y < 0.5) {
      const a = v.anim.power;
      if (a && a.id === 'overdrive') for (const sg of [-1, 1]) fx.thruster(r.x - sx * (hull + 0.4) + sz * sg * 0.28, r.y + v.lay.H * 0.6, r.z - sz * (hull + 0.4) - sx * sg * 0.28, -sx, 0.05, -sz);
    }
    if (r.jetT > 0) for (const sg of [-1, 1]) fx.thruster(r.x + sz * sg * (v.lay.W / 2 + 0.12), r.y + 0.3, r.z - sx * sg * (v.lay.W / 2 + 0.12), 0, -1, 0);
    // Dust and spray.
    if (r.speedNow > 2 && r.y < 0.1 && Math.random() < dt * 8) {
      if (f.arena.ice) fx.dust(r.x, r.z, [0.82, 0.92, 1]);
      else if (r.build.drive.id !== 'hover') fx.dust(r.x, r.z);
    }
    if (r.y < 0.1 && r.build.drive.id === 'hover' && Math.random() < dt * 8) fx.dust(r.x + (Math.random() - 0.5), r.z + (Math.random() - 0.5), [0.5, 0.75, 0.85]);
    if (r.falling) { v.root.position.y -= dt * 14; v.root.rotation.x += dt * 2; }
  });
  // Flame jets.
  if (f.hz.jets) for (const j of f.hz.jets) if (j.st === 'fire') for (let k = 0; k < 2; k++) fx.flame(j.x + j.dx * 0.3, 0.5, j.z, j.dx, 0, 0.18, 7, 1.1);
  // Rockets and mines.
  syncProjectiles();
}

function syncProjectiles() {
  const f = G.fight, sc = G.scene;
  const alive = new Set();
  for (const p of f.projectiles) {
    alive.add(p);
    let m = projMeshes.get(p);
    if (!m) {
      m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), Hardware.trim);
      b.rotation.x = Math.PI / 2; m.add(b);
      const n = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xff6a13 }));
      n.rotation.x = Math.PI / 2; n.position.z = 0.28; m.add(n);
      sc.add(m);
      projMeshes.set(p, m);
    }
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.h;
    G.fx.thruster(p.x - Math.sin(p.h) * 0.25, p.y, p.z - Math.cos(p.h) * 0.25, -Math.sin(p.h) * 0.5, 0, -Math.cos(p.h) * 0.5);
  }
  for (const m of f.mines) {
    alive.add(m);
    let g = projMeshes.get(m);
    if (!g) {
      g = new THREE.Group();
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 12), Hardware.dark);
      d.position.y = 0.07; g.add(d);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
      l.position.y = 0.15; g.add(l);
      g.userData.l = l;
      g.position.set(m.x, 0, m.z);
      sc.add(g);
      projMeshes.set(m, g);
    }
    g.userData.l.visible = m.arm > 0 ? false : Math.floor(f.t * 3) % 2 === 0;
  }
  for (const [k, m] of projMeshes) {
    if (!alive.has(k)) {
      if (m.parent) m.parent.remove(m);
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== Hardware.trim && o.material !== Hardware.dark) o.material.dispose(); });
      projMeshes.delete(k);
    }
  }
}

function impactFeel(size) {
  G.hitStop = Math.max(G.hitStop, size * 0.12);
  G.shake = Math.max(G.shake, size * 0.75);
  G.punch = Math.max(G.punch, size);
  if (Save.data.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(15 + size * 25); } catch { /* not allowed */ } }
}

// Everything the sim says happened.
function onEvent(e) {
  const fx = G.fx, f = G.fight;
  const v = e.r !== undefined ? G.views[e.r] : null;
  const R = e.r !== undefined ? f.robots[e.r] : null;
  switch (e.type) {
    case 'hit': {
      const size = Math.min(1, e.amount / 40);
      const y = (R ? R.y : 0) + 0.7;
      fx.sparks(e.x, y, e.z, 8 + Math.floor(size * 26), 5 + size * 5);
      fx.flash(e.x, y, e.z, 0.8 + size * 1.5);
      if (size > 0.3) fx.debris(e.x, y, e.z, 2 + Math.floor(size * 6), Hardware.dark);
      if (v) v.hitFlash(0.18 + size * 0.3);
      UI.number(e.x, y + 0.5, e.z, e.amount, e.r === 0, e.big);
      if (e.kind === 'wall') { Audio.play('clang-m', { vol: 0.5, vary: 0.2 }); break; }
      if (e.kind === 'hammer' && e.hazard) Audio.play('hammer', { vol: 1, rate: 0.75 });
      else if (e.kind === 'hammer') Audio.play('hammer', { vol: 0.9, vary: 0.1 });
      else if (e.kind === 'flipper') Audio.play('flipper', { vol: 0.9 });
      else if (e.kind === 'piston') { /* the slam covers it */ }
      else if (R && R.shieldT > 0) Audio.play('clang-m', { vol: 0.5, lowpass: 900 });
      else Audio.play(size > 0.6 ? 'clang-l' : size > 0.25 ? 'clang-m' : 'clang-s', { vol: 0.8, vary: 0.15 });
      impactFeel(size * (e.big ? 1 : 0.7));
      if (e.amount >= 22) Audio.play('crowd-roar', { vol: 0.28, vary: 0.1 });
      if (e.backstab && (e.by === 0 || G.mode === 'versus')) { UI.callout(G.mode === 'versus' ? `P${e.by + 1} BACKSTAB` : 'BACKSTAB'); Audio.voice('backstab', 0.85); }
      if (G.tutorial && e.by === 0 && e.amount < 13 && e.kind === 'ram') G.slowHit = true;
      break;
    }
    case 'tickhit': {
      UI.number(e.x, (R ? R.y : 0) + 1.2, e.z, e.amount, e.r === 0, false);
      if (v) v.hitFlash(0.15);
      Audio.play('clang-s', { vol: 0.45, vary: 0.3 });
      G.shake = Math.max(G.shake, 0.22);
      if (e.backstab && R && e.r === 1) UI.callout('BACKSTAB');
      break;
    }
    case 'grind': {
      fx.sparks(e.x, 0.7, e.z, 4, 6);
      G.shake = Math.max(G.shake, 0.09);
      if (v) v.hitFlash(0.08);
      break;
    }
    case 'lunge': Audio.play('jets', { vol: 0.35, rate: 1.4 }); break;
    case 'windup': if (v) G.fx.dangerArc(v.root, e.range, e.arc, e.t); break;
    case 'swing': Audio.play(e.kind === 'flipper' ? 'flipper' : 'swing', { vol: 0.5, rate: 1.4, vary: 0.1 }); break;
    case 'launch': Audio.play('jets', { vol: 0.4 }); Audio.play('crowd-roar', { vol: 0.4 }); break;
    case 'flipped': fx.sparks(e.x, 0.3, e.z, 18, 5); Audio.play('clang-l', { vol: 0.7 }); UI.callout(G.mode === 'versus' ? `P${e.r + 1} FLIPPED` : e.r === 0 ? 'FLIPPED' : 'ON ITS BACK'); break;
    case 'selfright': Audio.play('ratchet', { vol: 0.5 }); break;
    case 'land': if (e.big) { fx.dust(e.x, e.z); fx.dust(e.x + 0.3, e.z + 0.2); Audio.play('stomp', { vol: 0.5 }); } break;
    case 'stun': if (e.r === 0 || G.mode === 'versus') Audio.tone(320, 0.2, 'sawtooth', 0.07, 140); break;
    case 'linklost': Audio.play('emp', { vol: 0.9 }); if (G.mode !== 'versus' && e.r === 0) { UI.linkLost(e.t); Audio.staticBurst(e.t); } break;
    case 'overheat': Audio.vent(); break;
    case 'nopower': if (e.r === 0 || G.mode === 'versus') Audio.denied(); break;
    case 'arc': {
      const a = v.anim.main;
      const sx = Math.sin(R.h), sz = Math.cos(R.h);
      const ox = R.x + sx * a.tipZ, oz = R.z + sz * a.tipZ;
      if (e.hit) { fx.arc(ox, R.y + a.tipY, oz, e.tx, 0.7, e.tz); fx.arc(ox, R.y + a.tipY, oz, e.tx, 0.5, e.tz, 0xdff2ff); }
      else fx.arc(ox, R.y + a.tipY, oz, ox + sx * 2, 0.2, oz + sz * 2);
      Audio.play('arc', { vol: 0.8, vary: 0.2 });
      break;
    }
    case 'railcharge': if (v) { G.fx.aimLine(v.root, 14, e.t); Audio.play('rail-charge', { vol: 0.7 }); } break;
    case 'rail': {
      fx.beam(e.x, 0.8, e.z, e.x + e.dx * e.len, 0.8, e.z + e.dz * e.len, 0xbfeaff, 0.11, 0.2);
      fx.beam(e.x, 0.8, e.z, e.x + e.dx * e.len, 0.8, e.z + e.dz * e.len, 0xffffff, 0.04, 0.14);
      fx.flash(e.x, 0.8, e.z, 1.6, [0.7, 0.9, 1]);
      Audio.play('rail-fire', { vol: 1 });
      G.shake = Math.max(G.shake, 0.6);
      if (v && v.anim.main && v.anim.main.slide) v.anim.main.slide.position.z -= 0.25;
      break;
    }
    case 'shot': {
      const sx = Math.sin(e.a), sz = Math.cos(e.a);
      const ox = R.x + sx * 0.6, oz = R.z + sz * 0.6, oy = R.y + v.surf.topC + 0.35;
      if (e.hit) { fx.beam(ox, oy, oz, e.tx, e.ty + 0.6, e.tz, 0xffd27a, 0.025, 0.05); fx.sparks(e.tx, e.ty + 0.6, e.tz, 2, 3); }
      else fx.beam(ox, oy, oz, ox + sx * 8, oy - 0.5, oz + sz * 8, 0xffd27a, 0.02, 0.05);
      Audio.play('autocannon', { vol: 0.32, vary: 0.2 });
      if (R.ammo === 0) { Audio.dry(); if (G.mode === 'versus') UI.callout(`P${e.r + 1} OUT OF AMMO`); else if (e.r === 0) UI.callout('AUTOCANNON DRY'); }
      break;
    }
    case 'rocket': Audio.play('rocket', { vol: 0.6, vary: 0.15 }); break;
    case 'mine': Audio.mineBeep(); Audio.play('ratchet', { vol: 0.25, rate: 1.6 }); break;
    case 'explode': fx.explosion(e.x, 0, e.z, 0.8); Audio.play('explosion', { vol: 0.8, vary: 0.15 }); G.shake = Math.max(G.shake, 0.7); break;
    case 'power': {
      const a = { shield: 'shield', overdrive: 'overdrive', emp: 'emp', repair: 'repair', jets: 'jets' }[e.id];
      if (e.id !== 'emp' && e.id !== 'repair') Audio.play(a, { vol: 0.75 });
      if (e.id === 'emp') { fx.floorRing(R.x, R.z, 4, 0x9fd8ff, 0.45); Audio.play('emp', { vol: 0.5 }); }
      if (e.id === 'jets') fx.dust(R.x, R.z);
      break;
    }
    case 'wall': if (e.v > 4) { fx.sparks(e.x, 0.6, e.z, 5 + Math.floor(e.v), 5); Audio.play(e.hard ? 'clang-l' : 'clang-s', { vol: 0.45, vary: 0.2 }); } break;
    case 'bump': fx.sparks(e.x, 0.5, e.z, 6, 4); Audio.play('clang-s', { vol: Math.min(0.7, e.v * 0.1), vary: 0.2 }); break;
    case 'teeter': Audio.play('saw', { vol: 0.35, rate: 0.5 }); UI.callout(G.mode === 'versus' ? `P${e.r + 1} ON THE EDGE` : e.r === 0 ? 'BACK UP!' : 'ON THE EDGE'); break;
    case 'jet': if (e.state === 'fire') { /* looped */ } break;
    case 'piston':
      if (e.state === 'warn') Audio.tone(620, 0.12, 'square', 0.06);
      if (e.state === 'slam') { Audio.play('crusher', { vol: 0.9 }); Audio.play('ice', { vol: 0.5, vary: 0.15 }); fx.sparks(e.x, 0.2, e.z, 26, 8, { c: [0.8, 0.95, 1] }); G.shake = Math.max(G.shake, 0.8); for (let i = 0; i < 6; i++) fx.dust(e.x + Math.sin(i) * 1.8, e.z + Math.cos(i) * 1.8, [0.8, 0.9, 1]); }
      break;
    case 'grid':
      if (e.state === 'warn') Audio.tone(800, 0.1, 'square', 0.04);
      if (e.state === 'live') Audio.play('electric', { vol: 0.55 });
      if (e.state === 'live' && G.arena.coilTop) for (const p of f.hz.pylons) fx.arc(G.arena.coilTop.x, G.arena.coilTop.y, G.arena.coilTop.z, p.x, 1.6, p.z, 0xc9a6ff, 8, 0.3);
      break;
    case 'wind': if (e.state === 'warn') { UI.callout(e.dir > 0 ? 'WIND: TOWARD THE NEAR EDGE' : 'WIND: TOWARD THE FAR EDGE'); Audio.tone(300, 0.3, 'sine', 0.06, 500); } break;
    case 'swinghammer': if (e.state === 'swing') { Audio.play('swing', { vol: 0.9, rate: 0.7 }); } if (e.state === 'warn') fx.floorRing(0, 0, 2, 0xff3b30, 1); break;
    case 'pit': Audio.play('pit', { vol: e.state === 'warn' ? 0.9 : 0.5 }); if (e.state === 'warn') UI.callout('THE PIT IS OPENING'); break;
    case 'phase2': {
      G.hitStop = 0.5;
      UI.callout('You want it? Come and take it.');
      Audio.play('crowd-roar', { vol: 0.8 });
      G.shake = 1;
      fx.addChunks(v.anim.armor ? v.anim.armor.map((a) => { const c = G.scene; c.attach(a); return { obj: a, vx: (Math.random() - 0.5) * 6, vy: 5, vz: (Math.random() - 0.5) * 6, rx: 5, ry: 3, rz: 4 }; }) : []);
      v.anim.armor = null;
      if (v.anim.top) { v.anim.top.hold.parent.remove(v.anim.top.hold); }
      v.buildTop('rail', v.lay, v.clearance, v.surf, true);
      Audio.play('ratchet', { vol: 0.5 });
      break;
    }
    case 'stalemate': Audio.voice('moveit'); UI.callout('KEEP IT MOVING'); break;
    case 'end': break;
    default: break;
  }
}

function onFightOver() {
  const f = G.fight;
  G.state = 'ko';
  G.lastResult = f.result;
  const r = f.result;
  const loser = r.winner === -1 ? null : f.robots[1 - r.winner];
  G.koT = 2.6;
  Input.active = false;
  Input.clear();
  Audio.play('horn', { vol: 0.7 });
  Audio.stopLoops();
  if (r.cause === 'draw') {
    Audio.voice('draw');
  } else if (r.cause === 'ko' || r.cause === 'hazard' || r.cause === 'immobile') {
    if (r.cause !== 'immobile') {
      const chunks = G.views[loser.idx].explode(G.scene);
      loser.exploded = true;
      G.fx.addChunks(chunks);
      G.fx.explosion(loser.x, 0.4, loser.z, 1.5);
      Audio.play('explosion', { vol: 1 });
      G.views[loser.idx].uniforms.uWreck.value = 0.6;
      if (G.views[loser.idx].aids) for (const a of G.views[loser.idx].aids) a.visible = false;
      if (G.views[loser.idx].bubble) G.views[loser.idx].bubble.visible = false;
    }
    Audio.voice(r.cause === 'hazard' ? 'hazard' : 'ko');
  } else if (r.cause === 'ringout' || r.cause === 'pit') {
    Audio.play('fall', { vol: 0.9 });
    Audio.voice(r.cause === 'pit' ? 'hazard' : 'ringout');
  } else Audio.voice('judges');
  G.shake = 1;
  const big = { ko: 'KNOCKOUT', hazard: 'HAZARD KO', ringout: 'RING OUT', pit: 'INTO THE PIT', decision: "TIME!", immobile: 'IMMOBILE', draw: 'DRAW' }[r.cause];
  UI.bigText(big, 2.4, true);
  Audio.play('crowd-roar', { vol: 0.9 });
}

function koDone() {
  const f = G.fight;
  const r = f.result;
  UI.clear();
  if (G.mode === 'versus') {
    if (r.winner >= 0) { G.vs.score[r.winner]++; Audio.voice(r.winner === 0 ? 'p1wins' : 'p2wins'); }
    G.state = 'vsresult';
    Audio.music('garage');
    UI.versusResult(r, G.vs);
    return;
  }
  if (r.winner === 0) {
    const n = G.rivalN;
    if (r.taken[0] <= 0) Audio.voice('flawless');
    G.prize = prizeFor(n, r, G.exhibition);
    Save.data.pending = { n, exhibition: G.exhibition, prize: G.prize };
    G.record = recordWin(n, G.exhibition, G.prize.total);
    Save.data.pending.record = G.record;
    Save.write();
    Audio.sting(5);
    Flow.afterWin();
  } else {
    if (!G.exhibition) recordLoss(G.rivalN);
    G.state = 'lost';
    Audio.music('garage');
    UI.lost(G.rivalN, r);
  }
}

// ---------------------------------------------------------------- input wiring
addEventListener('mousemove', () => { if (PadNav.active) PadNav.clear(); });
Input.init();
Input.onAny = () => Audio.unlock();
Input.onPause = () => { if (G.paused) Flow.resume(); else Flow.pause(); };
Input.onCamera = () => setCamera();
Input.onMute = () => toggleMute();
addEventListener('visibilitychange', () => { if (document.hidden) { if (G.state === 'fight' || G.state === 'countdown') Flow.pause(); if (Audio.ctx) Audio.ctx.suspend(); } else if (Audio.ctx) Audio.ctx.resume(); });
addEventListener('blur', () => { if ((G.state === 'fight' || G.state === 'countdown') && !G.stepping) Flow.pause(); });

export function setCamera(mode) {
  if (G.mode === 'versus') return;
  G.camMode = mode || (G.camMode === 'booth' ? 'chase' : 'booth');
  Save.data.settings.cam = G.camMode;
  Save.write();
}
export function toggleMute() {
  if (G.mode === 'versus') { Audio.setMuted(!Audio.mutedAll); UI.onMuted(); return; }
  Save.data.settings.muted = !Save.data.settings.muted;
  Audio.setMuted(!!Save.data.settings.muted);
  Save.write();
  UI.onMuted();
}

// ---------------------------------------------------------------- debug hook
function canonicalBuild(n) { return parseBuild(CANONICAL[n - 1]); }
window.__game = {
  state: () => {
    const f = G.fight;
    return {
      screen: G.state, level: G.rivalN, frozen: G.frozen, paused: G.paused,
      scrap: Save.data.scrap, next: Save.data.next, inventory: Save.data.inventory.length,
      fight: f ? { t: +f.t.toFixed(2), tick: f.tick, over: f.over, result: f.result, me: { x: +f.robots[0].x.toFixed(2), z: +f.robots[0].z.toFixed(2), h: +f.robots[0].h.toFixed(2), hp: +f.robots[0].hp.toFixed(1), speed: +f.robots[0].speedNow.toFixed(2) }, foe: { x: +f.robots[1].x.toFixed(2), z: +f.robots[1].z.toFixed(2), hp: +f.robots[1].hp.toFixed(1) } } : null,
      levelComplete: !!(f && f.over && f.result.winner === 0),
      gameWon: Save.data.won,
    };
  },
  levels: () => 18,
  setNoRender: (on) => { G.noRender = on; },
  goToLevel: async (n, o = {}) => {
    await Flow.startFight(n, false, { build: o.build || canonicalBuild(n), skipIntro: true, seed: o.seed || 1000 + n });
    Input.active = true; Input.clear(); Input.lock = false;
    return true;
  },
  step: (seconds, noRender) => {
    G.frozen = true;
    G.stepping = true;
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      G.time += DT;
      if (G.state === 'fight' && G.fight && !G.fight.over) simTick();
      frame(DT);
    }
    if (G.scene && !noRender) renderer.render(G.scene, camera);
    return window.__game.state();
  },
  resume: () => { G.frozen = false; G.stepping = false; lastT = performance.now(); },
  // Test driver: plays the current fight by sending real key events to the game.
  autoFight() {
    const f = G.fight;
    if (!f) return 'no fight';
    G.frozen = true; G.stepping = true;
    const bot = new Driver(f, 0, { react: 250, aim: 12, aggr: 0.75, hazard: 0.15, seeWarned: true }, (f.seed ^ 0x123456) >>> 0);
    const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    const held = {};
    const setKey = (code, on) => { if (!!held[code] !== !!on) { held[code] = !!on; send(on ? 'keydown' : 'keyup', code); } };
    const tap = (code) => { send('keydown', code); send('keyup', code); held[code] = false; };
    let lock = Input.lock;
    for (let i = 0; i < 60 * 300 && (G.state === 'countdown' || G.state === 'fight' || G.state === 'ko'); i++) {
      G.time += DT;
      if (G.state === 'fight' && !f.over) {
        const a = bot.update();
        const q = Math.hypot(a.mx, a.mz) < 0.15 ? -1 : ((Math.round(Math.atan2(a.mx, -a.mz) / (Math.PI / 4)) % 8) + 8) % 8;
        setKey('KeyW', [7, 0, 1].includes(q)); setKey('KeyD', [1, 2, 3].includes(q)); setKey('KeyS', [3, 4, 5].includes(q)); setKey('KeyA', [5, 6, 7].includes(q));
        if (a.firePressed) tap('Space'); else setKey('Space', a.fire);
        if (a.topPressed) tap('KeyK'); else setKey('KeyK', a.top);
        if (a.powerPressed) tap('KeyL');
        if (a.lock !== lock) { tap('KeyQ'); lock = a.lock; }
        simTick();
      }
      frame(DT);
    }
    for (const c of Object.keys(held)) setKey(c, false);
    if (G.scene && !G.noRender) renderer.render(G.scene, camera);
    return { state: G.state, result: f.result };
  },
  // Test driver for Versus: two bots, each sending that player's real key events.
  autoVersus() {
    const f = G.fight;
    if (!f || G.mode !== 'versus') return 'no versus fight';
    G.frozen = true; G.stepping = true;
    const persona = { react: 300, aim: 12, aggr: 0.7, hazard: 0.2, seeWarned: true };
    const bots = [new Driver(f, 0, persona, 77), new Driver(f, 1, persona, 88)];
    const KEYS = [{ u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', fire: 'KeyF', top: 'KeyG', pow: 'KeyH', lock: 'KeyR' }, { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight', fire: 'Comma', top: 'Period', pow: 'Slash', lock: 'KeyL' }];
    const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    const held = {};
    const setKey = (c, on) => { if (!!held[c] !== !!on) { held[c] = !!on; send(on ? 'keydown' : 'keyup', c); } };
    const tap = (c) => { send('keydown', c); send('keyup', c); };
    for (let i = 0; i < 60 * 300 && (G.state === 'countdown' || G.state === 'fight' || G.state === 'ko'); i++) {
      G.time += DT;
      if (G.state === 'fight' && !f.over) {
        bots.forEach((b, n) => {
          const a = b.update(), K = KEYS[n], v = Input.vs[n];
          const q = Math.hypot(a.mx, a.mz) < 0.15 ? -1 : ((Math.round(Math.atan2(a.mx, -a.mz) / (Math.PI / 4)) % 8) + 8) % 8;
          setKey(K.u, [7, 0, 1].includes(q)); setKey(K.r, [1, 2, 3].includes(q)); setKey(K.d, [3, 4, 5].includes(q)); setKey(K.l, [5, 6, 7].includes(q));
          if (v.holdFire) { if (a.fire !== v.fireOn) tap(K.fire); } else if (a.firePressed) tap(K.fire);
          if (v.holdTop) { if (a.top !== v.topOn) tap(K.top); } else if (a.topPressed) tap(K.top);
          if (a.powerPressed) tap(K.pow);
          if (a.lock !== v.lock) tap(K.lock);
        });
        simTick();
      }
      frame(DT);
    }
    for (const c of Object.keys(held)) setKey(c, false);
    if (G.scene && !G.noRender) renderer.render(G.scene, camera);
    return { state: G.state, result: f.result, hp: f.robots.map((r) => +r.hp.toFixed(1)), score: G.vs.score };
  },
  audioState: () => Audio.state(),
  simHash: () => (G.fight ? G.fight.hash() : 0),
  save: () => Save.data,
  writeSave: () => Save.write(),
  flow: Flow,
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
  camera: (x, y, z, lx, ly, lz) => { camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); if (G.scene) renderer.render(G.scene, camera); },
  // Show a build on its own, for the contact sheet.
  async showBuild(build, paint, yaw = 0.6) {
    UI.clear();
    G.state = 'sheet';
    await enterShow('salvage', () => makeRobot(build, paint || DEFAULT_PAINT, {}));
    G.show.yaw = yaw;
    G.show.update(0);
    G.frozen = true;
    camera.position.set(0, 3.0, 5.6);
    camera.lookAt(0, 0.65, 0);
    renderer.render(G.scene, camera);
    return true;
  },
  // A picture of one model, for the part icons.
  async thumb(id, size = 128, yaw = 0.7) {
    const mid = modelsFor(id)[0];
    await preload([mid]);
    const a = await loadModel(mid);
    const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r2.setSize(size, size);
    r2.outputColorSpace = THREE.SRGBColorSpace;
    r2.toneMapping = THREE.ACESFilmicToneMapping;
    const s = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r2);
    const es = new THREE.Scene(); es.background = new THREE.Color(0x8890a0);
    s.environment = pm.fromScene(es).texture;
    s.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4));
    const d = new THREE.DirectionalLight(0xffffff, 2.6); d.position.set(2, 3, 3); s.add(d);
    const m = new THREE.Mesh(a.geo, a.mat);
    const c = a.box.getCenter(new THREE.Vector3());
    m.position.copy(c).multiplyScalar(-1);
    const g = new THREE.Group(); g.add(m); g.rotation.y = yaw; s.add(g);
    const R = a.size.length() * 0.52;
    const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, 50);
    cam.position.set(0, R * 0.8, R * 3); cam.lookAt(0, 0, 0);
    r2.render(s, cam);
    const url = r2.domElement.toDataURL('image/webp', 0.86);
    r2.dispose();
    return url;
  },
};

// ---------------------------------------------------------------- boot
async function boot() {
  try { await bootInner(); } catch (e) {
    console.error(e);
    const b = document.getElementById('boot');
    if (b) b.remove();
    UI.bootError();
  }
}
async function bootInner() {
  const fill = document.getElementById('boot-fill');
  const set = (p) => { fill.style.width = `${Math.round(p * 100)}%`; };
  resize();
  Save.load();
  const st = Save.data.settings;
  Audio.mutedAll = !!st.muted; Audio.musicOn = st.music !== false; Audio.sfxOn = st.sfx !== false;
  set(0.1);
  await Promise.all([document.fonts.load('600 40px Teko'), document.fonts.load('500 18px Rajdhani'), document.fonts.load('700 18px Rajdhani')]).catch(() => {});
  set(0.25);
  const trim = await loadTex('assets/tiles/trim.jpg', 1);
  initHardware(trim);
  set(0.35);
  let done = 0;
  const needed = buildModels(currentBuild());
  await Promise.all(needed.map((m) => preload([m]).then(() => { done++; set(0.35 + 0.5 * done / needed.length); })));
  await Flow.title();
  set(1);
  renderer.render(G.scene, camera);
  requestAnimationFrame(loop);
  const b = document.getElementById('boot');
  b.style.opacity = 0;
  setTimeout(() => b.remove(), 380);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!window.desktop && 'serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) {
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.offline !== undefined) UI.offline = e.data.offline; });
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Every launch: finish caching anything still missing, and report how far it got.
    navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage('fill'); }).catch(() => {});
  }
}
void rosterBuild; void Hardware; void STARTER_BUILD; void MODELS; void RobotView; void PARTS;
boot();
