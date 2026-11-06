// Builds a robot out of separate GLB parts. Sockets come from the chassis's
// real surface (found with rays), so any part sits properly on any chassis.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PARTS, MK } from './catalog.js';
import { applyPaintShader, makePaintUniforms, FINISHES } from './paint.js';

const HALF = Math.PI / 2;
// yaw turns the model so its front faces +Z. h = its length or height in meters when mounted.
export const MODELS = {
  crate: { file: 'chassis-crate', yaw: -HALF, len: 1.45 },
  wedge: { file: 'wedge', yaw: HALF, len: 1.7 },
  scarab: { file: 'scarab', yaw: 0, len: 1.75 },
  bulwark: { file: 'bulwark', yaw: -HALF, len: 1.95 },
  sovereign: { file: 'sovereign', yaw: HALF, len: 2.15 },
  scrapwheel: { file: 'scrapwheel', yaw: HALF },
  spikewheel: { file: 'spikewheel', yaw: HALF },
  leg: { file: 'leg', yaw: 0 },
  hoverpod: { file: 'hoverpod', yaw: 0 },
  treadframe: { file: 'treadframe', yaw: HALF },
  ram: { file: 'ram', yaw: 0 },
  drum: { file: 'drum', yaw: 0 },
  saw: { file: 'saw', yaw: HALF },
  hammer: { file: 'hammer', yaw: 0 },
  flipper: { file: 'flipper', yaw: 0 },
  drill: { file: 'drill', yaw: 0 },
  flame: { file: 'flame', yaw: HALF },
  arc: { file: 'arc', yaw: 0 },
  rail: { file: 'rail', yaw: HALF },
  autocannon: { file: 'autocannon', yaw: HALF },
  rockets: { file: 'rockets', yaw: 0 },
  mines: { file: 'mines', yaw: Math.PI },
  shield: { file: 'shield', yaw: 0 },
  thruster: { file: 'thruster', yaw: -HALF },
  emp: { file: 'emp', yaw: 0 },
  nanite: { file: 'nanite', yaw: 0 },
  plate: { file: 'plate', yaw: 0 },
  spikeskirt: { file: 'spikeskirt', yaw: 0 },
};

// Which models each catalog part needs.
export function modelsFor(id) {
  switch (id) {
    case 'scrapwheels': return ['scrapwheel'];
    case 'spikewheels': return ['spikewheel'];
    case 'treads': return ['treadframe', 'scrapwheel'];
    case 'legs': return ['leg'];
    case 'hover': return ['hoverpod'];
    case 'overdrive': case 'jets': return ['thruster'];
    case 'repair': return ['nanite'];
    case 'plates': return ['plate'];
    case 'spikes': return ['spikeskirt'];
    default: return [id];
  }
}
export function buildModels(build) {
  const out = new Set();
  for (const sl of ['chassis', 'drive', 'main', 'top', 'power', 'armor']) {
    if (build[sl]) for (const m of modelsFor(build[sl].id)) out.add(m);
  }
  return [...out];
}

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 4;
export const setAniso = (a) => { maxAniso = a; };

// Load one model and its paint mask (once). Bounding box is measured after the yaw fix.
export function loadModel(id) {
  if (cache.has(id)) return cache.get(id);
  const m = MODELS[id];
  const p = (async () => {
    const [gltf, mask] = await Promise.all([
      loader.loadAsync(`assets/models/${m.file}.glb`),
      texLoader.loadAsync(`assets/models/${m.file}.mask.png`),
    ]);
    mask.flipY = false;
    mask.colorSpace = THREE.NoColorSpace;
    mask.anisotropy = 2;
    let mesh = null;
    gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    gltf.scene.updateMatrixWorld(true);
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geo.rotateY(m.yaw);
    geo.computeBoundingBox();
    geo.userData.shared = true;
    const mat = mesh.material;
    if (mat.map) mat.map.anisotropy = maxAniso;
    return { geo, mat, mask, box: geo.boundingBox.clone(), size: geo.boundingBox.getSize(new THREE.Vector3()) };
  })();
  cache.set(id, p);
  p.catch(() => cache.delete(id)); // A failed download can be tried again.
  return p;
}
export const isLoaded = (id) => cache.has(id);
export const loadBuild = (build) => Promise.all(buildModels(build).map(loadModel));

// A mesh of a model with the origin at pivot (fractions of its box), at this scale.
function partMesh(asset, uniforms, scale, pivot, finishOverride, castShadow) {
  const mat = asset.mat.clone();
  const u = finishOverride ? { ...uniforms, uFinishMetal: { value: finishOverride.metal }, uFinishRough: { value: finishOverride.rough } } : uniforms;
  applyPaintShader(mat, asset.mask, scale, u);
  const mesh = new THREE.Mesh(asset.geo, mat);
  const { box, size } = asset;
  mesh.scale.setScalar(scale);
  mesh.position.set(
    -(box.min.x + size.x * pivot[0]) * scale,
    -(box.min.y + size.y * pivot[1]) * scale,
    -(box.min.z + size.z * pivot[2]) * scale,
  );
  mesh.castShadow = !!castShadow;
  return mesh;
}

// Shared code-built hardware.
export const Hardware = { trim: null, dark: null, glow: new Map() };
export function initHardware(trimTex) {
  if (trimTex) { trimTex.wrapS = trimTex.wrapT = THREE.RepeatWrapping; trimTex.colorSpace = THREE.SRGBColorSpace; trimTex.anisotropy = 4; }
  Hardware.trim = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, map: trimTex || null, metalness: 0.75, roughness: 0.48 });
  Hardware.dark = new THREE.MeshStandardMaterial({ color: 0x3a3e45, map: trimTex || null, metalness: 0.7, roughness: 0.55 });
  Hardware.tire = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.9 });
}
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const cyl = (r, l, mat, axis = 'y', x = 0, y = 0, z = 0, seg = 14) => {
  const g = new THREE.CylinderGeometry(r, r, l, seg);
  const m = new THREE.Mesh(g, mat);
  if (axis === 'x') m.rotation.z = HALF;
  if (axis === 'z') m.rotation.x = HALF;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

// Find where the chassis's surface is, with rays. Cached per chassis.
const surfaceCache = new Map();
function surfaceProbe(chassisId, mesh, L, W, H, baseY) {
  if (surfaceCache.has(chassisId)) return surfaceCache.get(chassisId);
  const ray = new THREE.Raycaster();
  mesh.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().identity();
  const down = new THREE.Vector3(0, -1, 0);
  const top = (x, z) => {
    ray.set(new THREE.Vector3(x, baseY + H + 2, z), down);
    const hit = ray.intersectObject(mesh, false)[0];
    return hit ? hit.point.y : baseY + H * 0.6;
  };
  const back = new THREE.Vector3(0, 0, -1);
  const front = (y) => {
    ray.set(new THREE.Vector3(0, y, L), back);
    const hit = ray.intersectObject(mesh, false)[0];
    return hit ? hit.point.z : L / 2;
  };
  const res = { top, front, inv };
  // Sample the positions the sockets use.
  const samples = {};
  samples.topC = top(0, 0);
  samples.topF = top(0, L * 0.22);
  samples.topR = top(0, -L * 0.3);
  samples.topFar = top(0, -L * 0.42);
  samples.frontMid = front(baseY + H * 0.42);
  samples.frontLow = front(baseY + H * 0.2);
  samples.frontHi = front(baseY + H * 0.7);
  surfaceCache.set(chassisId, samples);
  return samples;
}

// Where every robot's parts go.
function layout(chassisAsset, model) {
  const s = model.len / Math.max(chassisAsset.size.z, 0.01);
  return { s, L: chassisAsset.size.z * s, W: chassisAsset.size.x * s, H: chassisAsset.size.y * s };
}

export class RobotView {
  constructor(build, paint, opts = {}) {
    this.build = build; this.paint = paint;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.uniforms = makePaintUniforms(paint);
    this.opts = opts;
    this.anim = {};
    this.detachables = [];
    this.spin = 0;
    this.phase = 0;
    this.smoke = 0;
    this.flash = 0;
    this.tilt = 0; this.tiltZ = 0; this.tiltX = 0;
    this.dead = false;
  }

  async init() {
    await loadBuild(this.build);
    await this.assemble();
    return this;
  }

  finishFor(slot) {
    const p = this.build[slot];
    if (p && p.mk === 3) return FINISHES.chrome;
    return null;
  }

  async assemble() {
    const b = this.build;
    const u = this.uniforms;
    const chId = b.chassis.id;
    const ca = await loadModel(chId);
    const lay = layout(ca, MODELS[chId]);
    this.lay = lay;
    const shadows = this.opts.shadows !== false;
    // Drive decides how high the body rides.
    const driveId = b.drive.id;
    let clearance = 0.18;
    if (driveId === 'legs') clearance = 0.62;
    if (driveId === 'hover') clearance = 0.42;
    if (driveId === 'treads') clearance = 0.22;
    const scaleUp = lay.L / 1.45;
    const wheelD = (driveId === 'spikewheels' ? 0.72 : 0.64) * Math.max(0.9, scaleUp * 0.95);
    if (driveId === 'scrapwheels' || driveId === 'spikewheels') clearance = wheelD * 0.3;
    this.clearance = clearance;
    const baseY = clearance;
    const chMesh = partMesh(ca, u, lay.s, [0.5, 0, 0.5], this.finishFor('chassis'), shadows);
    const chGroup = new THREE.Group();
    chGroup.position.y = baseY;
    chGroup.add(chMesh);
    this.body.add(chGroup);
    this.chGroup = chGroup;
    this.anim.chassis = chGroup;
    this.root.updateMatrixWorld(true);
    const surf = surfaceProbe(chId, chMesh, lay.L, lay.W, lay.H, baseY);
    this.surf = surf;

    this.buildDrive(lay, driveId, baseY, wheelD, shadows);
    if (b.main) this.buildMain(lay, baseY, surf, shadows);
    if (b.top) this.buildTop(b.top.id, lay, baseY, surf, shadows);
    if (b.power) this.buildPower(b.power.id, lay, baseY, surf, shadows);
    if (b.armor) this.buildArmor(lay, baseY, shadows);
    if (this.opts.trophies) this.buildTrophies(this.opts.trophies, lay, baseY, surf);
    this.addMkGlow();
    this.root.traverse((o) => { if (o.isMesh && o.material && !o.material.userData.noFrustumFix) o.frustumCulled = false; });
  }

  addDetach(obj) { this.detachables.push(obj); return obj; }

  buildDrive(lay, id, baseY, wheelD, shadows) {
    const u = this.uniforms;
    const f = this.finishFor('drive');
    const { W, L } = lay;
    const wheels = [];
    const drive = new THREE.Group();
    this.body.add(drive);
    if (id === 'scrapwheels' || id === 'spikewheels') {
      const a = cacheGet(id === 'spikewheels' ? 'spikewheel' : 'scrapwheel');
      const sc = wheelD / a.size.y;
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const hold = new THREE.Group();
        hold.position.set(sx * (W / 2 + a.size.x * sc * 0.42), wheelD / 2, sz * L * 0.3);
        const spin = new THREE.Group();
        spin.add(partMesh(a, u, sc, [0.5, 0.5, 0.5], f, shadows));
        hold.add(spin);
        // Axle block hides the join.
        hold.add(cyl(0.06, 0.28, Hardware.dark, 'x', -sx * 0.1, 0, 0));
        drive.add(hold);
        wheels.push({ spin, hold, front: sz > 0 });
        this.addDetach(hold);
      }
      this.anim.wheels = wheels;
      this.anim.wheelR = wheelD / 2;
    } else if (id === 'treads') {
      const fa = cacheGet('treadframe');
      const wa = cacheGet('scrapwheel');
      const tL = L * 1.08, tH = 0.5;
      const sc = tL / Math.max(fa.size.z, fa.size.x);
      const linkG = new THREE.BoxGeometry(0.2, 0.05, 0.13);
      const nLinks = Math.round((tL * 2 + Math.PI * tH) / 0.17);
      this.anim.treads = [];
      for (const sx of [-1, 1]) {
        const group = new THREE.Group();
        group.position.set(sx * (W / 2 + 0.14), 0, 0);
        const frame = partMesh(fa, u, sc, [0.5, 0.5, 0.5], f, shadows);
        if (fa.size.x > fa.size.z) frame.rotation.y = HALF; // Long axis along Z.
        const fh = new THREE.Group();
        fh.position.y = tH / 2 + 0.03;
        fh.scale.y = Math.min(1, tH * 1.05 / (fa.size.y * sc));
        fh.add(frame);
        group.add(fh);
        const links = new THREE.InstancedMesh(linkG, Hardware.tire, nLinks);
        links.castShadow = true;
        group.add(links);
        const sprockets = [];
        for (const sz of [-1, 1]) {
          const hold = new THREE.Group();
          hold.position.set(sx * 0.03, tH / 2, sz * (tL / 2 - tH / 2));
          hold.add(partMesh(wa, u, (tH * 0.88) / wa.size.y, [0.5, 0.5, 0.5], f, false));
          group.add(hold);
          sprockets.push(hold);
        }
        drive.add(group);
        this.anim.treads.push({ links, n: nLinks, tL, tH, sprockets, off: 0 });
        this.addDetach(group);
      }
      this.updateTreads(0);
    } else if (id === 'legs') {
      const a = cacheGet('leg');
      const sc = (baseY + lay.H * 0.25 + 0.15) / a.size.y;
      this.anim.legs = [];
      for (const sz of [1, -1]) {
        const hold = new THREE.Group();
        hold.position.set(0, baseY + lay.H * 0.25 + 0.15, sz * L * 0.28);
        const widen = (W + 0.4) / (a.size.x * sc);
        const m = partMesh(a, u, sc, [0.5, 1, 0.5], f, shadows);
        m.scale.x *= Math.max(1, widen);
        m.position.x *= Math.max(1, widen);
        hold.add(m);
        drive.add(hold);
        this.anim.legs.push({ hold, sz, y0: hold.position.y });
        this.addDetach(hold);
      }
    } else if (id === 'hover') {
      const a = cacheGet('hoverpod');
      const d = Math.max(0.5, W * 0.42);
      const sc = d / Math.max(a.size.x, a.size.z);
      this.anim.pods = [];
      const glow = new THREE.MeshBasicMaterial({ color: 0x4fe6ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      this.podGlow = glow;
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const hold = new THREE.Group();
        hold.position.set(sx * (W / 2 + d * 0.12), 0.3, sz * L * 0.34);
        hold.add(partMesh(a, u, sc, [0.5, 0.5, 0.5], f, shadows));
        const g = new THREE.Mesh(new THREE.CircleGeometry(d * 0.42, 16), glow);
        g.rotation.x = HALF;
        g.position.y = -a.size.y * sc * 0.52;
        hold.add(g);
        const strutLen = d * 0.62 + 0.1;
        hold.add(box(strutLen, 0.1, 0.16, Hardware.dark, -sx * strutLen * 0.5, 0.2, 0));
        hold.add(box(0.1, 0.22, 0.1, Hardware.dark, -sx * d * 0.2, 0.1, 0));
        drive.add(hold);
        this.anim.pods.push({ hold, y0: 0.3, i: this.anim.pods.length });
        this.addDetach(hold);
      }
    }
  }

  paintMat() {
    const m = new THREE.MeshStandardMaterial({ color: this.uniforms.uPaint1.value.clone(), metalness: 0.4, roughness: 0.35 });
    (this.paintMats = this.paintMats || []).push(m);
    return m;
  }

  buildMain(lay, baseY, surf, shadows) {
    const u = this.uniforms;
    const id = this.build.main.id;
    const w = PARTS[id];
    const f = this.finishFor('main');
    const a = cacheGet(id);
    const R = PARTS[this.build.chassis.id].radius;
    const tipZ = R + (w.range || 0.5);
    const hold = new THREE.Group();
    this.body.add(hold);
    const y = baseY + lay.H * 0.32;
    const faceZ = surf.frontMid;
    const hw = lay.W * 0.5;
    const trim = Hardware.trim, dark = Hardware.dark;
    this.anim.main = { id, hold };
    const fork = (zFrom, zTo, xx, yy, t = 0.09) => {
      const len = zTo - zFrom;
      return box(t, t * 1.3, len, dark, xx, yy, zFrom + len / 2);
    };
    if (id === 'ram') {
      const sc = Math.min(lay.W * 1.1 / a.size.x, 0.85 / a.size.y);
      const m = partMesh(a, u, sc, [0.5, 0, 1], f, shadows);
      hold.position.set(0, baseY - 0.02, tipZ);
      hold.add(m);
      this.anim.main.rest = tipZ;
    } else if (id === 'drum') {
      const rad = 0.42;
      const sc = (rad * 2) / a.size.y;
      const zC = tipZ - rad;
      const spin = new THREE.Group();
      spin.position.set(0, baseY + rad * 0.5, zC);
      const mesh = partMesh(a, u, sc, [0.5, 0.5, 0.5], f, shadows);
      spin.add(mesh);
      hold.add(spin);
      const half = a.size.x * sc * 0.5 + 0.05;
      hold.add(fork(faceZ - 0.1, zC + 0.05, -half, spin.position.y));
      hold.add(fork(faceZ - 0.1, zC + 0.05, half, spin.position.y));
      this.anim.main.spin = spin;
    } else if (id === 'saw') {
      const rad = 0.62;
      const sc = (rad * 2) / a.size.y;
      const zC = tipZ - rad;
      const spin = new THREE.Group();
      spin.position.set(0, baseY + lay.H * 0.28 + rad * 0.3, zC);
      spin.add(partMesh(a, u, sc, [0.5, 0.5, 0.5], f, shadows));
      hold.add(spin);
      hold.add(fork(faceZ - 0.1, zC + 0.06, 0.12, spin.position.y));
      hold.add(fork(faceZ - 0.1, zC + 0.06, -0.12, spin.position.y));
      hold.add(cyl(0.08, 0.32, trim, 'x', 0, spin.position.y, zC));
      this.anim.main.spin = spin;
    } else if (id === 'hammer') {
      const hingeY = surf.topC + 0.12;
      const hingeZ = 0.15;
      const len = tipZ - hingeZ;
      const sc = len / a.size.y;
      const arm = new THREE.Group();
      arm.position.set(0, hingeY, hingeZ);
      arm.add(partMesh(a, u, sc, [0.5, 0.02, 0.5], f, shadows));
      hold.add(arm);
      hold.add(box(0.34, 0.2, 0.34, dark, 0, hingeY - 0.08, hingeZ));
      hold.add(cyl(0.08, 0.42, trim, 'x', 0, hingeY, hingeZ));
      this.anim.main.arm = arm;
      arm.rotation.x = -0.45;
    } else if (id === 'flipper') {
      const hingeY = baseY + lay.H * 0.14;
      const hingeZ = faceZ - 0.02;
      const len = tipZ - hingeZ;
      const sc = len / a.size.y;
      const arm = new THREE.Group();
      arm.position.set(0, hingeY, hingeZ);
      const m = partMesh(a, u, sc, [0.5, 0.02, 0.5], f, shadows);
      const widen = Math.max(1, lay.W * 0.95 / (a.size.x * sc));
      m.scale.x *= widen; m.position.x *= widen;
      arm.add(m);
      arm.rotation.x = 1.42;
      hold.add(arm);
      hold.add(cyl(0.07, lay.W * 0.8, trim, 'x', 0, hingeY, hingeZ));
      this.anim.main.arm = arm;
    } else if (id === 'drill') {
      const base = faceZ + 0.1;
      const len = tipZ - base - 0.25;
      const sc = len / a.size.y;
      const slide = new THREE.Group();
      slide.position.set(0, y, base);
      const spin = new THREE.Group();
      spin.rotation.x = HALF;
      spin.add(partMesh(a, u, sc, [0.5, 0, 0.5], f, shadows));
      slide.add(spin);
      hold.add(slide);
      hold.add(cyl(0.14, 0.3, dark, 'z', 0, y, faceZ));
      this.anim.main.slide = slide;
      this.anim.main.spin = spin;
      this.anim.main.base = base;
    } else if (id === 'flame') {
      const sc = 0.5 / a.size.y;
      const m = partMesh(a, u, sc, [0.5, 0.5, 1], f, shadows);
      const yy = surf.topF + 0.2;
      hold.position.set(0, yy, tipZ * 0.35 + faceZ * 0.65);
      hold.add(m);
      hold.add(box(0.2, 0.18, 0.3, dark, 0, -0.18, -0.3));
      this.anim.main.muzzleZ = hold.position.z;
      this.anim.main.muzzleY = yy;
    } else if (id === 'arc') {
      const sc = 0.82 / a.size.y;
      const zz = Math.min(faceZ - 0.15, lay.L * 0.32);
      hold.position.set(0, surf.topF - 0.02, zz);
      hold.add(partMesh(a, u, sc, [0.5, 0, 0.5], f, shadows));
      hold.add(cyl(0.2, 0.08, dark, 'y', 0, 0.02, 0));
      this.anim.main.tipY = hold.position.y + 0.82;
      this.anim.main.tipZ = zz;
    } else if (id === 'rail') {
      const l = Math.max(a.size.x, a.size.z);
      const sc = Math.max(lay.L * 1.25, 1.8) / l;
      const m = partMesh(a, u, sc, [0.5, 0.5, 0.5], f, shadows);
      const yy = surf.topC + 0.25;
      hold.position.set(0, yy, lay.L * 0.18);
      hold.add(m);
      hold.add(box(0.26, 0.2, 0.4, dark, 0, -0.22, -0.1));
      this.anim.main.slide = hold;
      this.anim.main.base = hold.position.z;
      this.anim.main.muzzleZ = hold.position.z + l * sc * 0.5;
      this.anim.main.muzzleY = yy;
    }
    this.addDetach(hold);
  }

  buildTop(id, lay, baseY, surf, shadows, swap = false) {
    const u = this.uniforms;
    const f = this.finishFor('top');
    const a = cacheGet(id === 'rail' ? 'rail' : id);
    const hold = new THREE.Group();
    const hasHammer = this.build.main && (this.build.main.id === 'hammer');
    const z = hasHammer ? -lay.L * 0.14 : 0;
    const top = hasHammer ? Math.max(surf.topC, surf.topR) : surf.topC;
    hold.position.set(0, top - 0.02, z);
    this.body.add(hold);
    this.anim.top = { id, hold };
    const ring = cyl(0.28, 0.1, Hardware.dark, 'y', 0, 0.04, 0, 16);
    hold.add(ring);
    if (id === 'autocannon') {
      const sc = 0.52 / a.size.y;
      const yaw = new THREE.Group();
      yaw.position.y = 0.08;
      yaw.add(partMesh(a, u, sc, [0.5, 0, 0.5], f, shadows));
      hold.add(yaw);
      this.anim.top.yaw = yaw;
      this.anim.top.muzzle = 0.45;
    } else if (id === 'rockets') {
      const sc = 0.44 / a.size.y;
      hold.add(partMesh(a, u, sc, [0.5, 0, 0.5], f, shadows)).position.y += 0.08;
    } else if (id === 'mines') {
      const sc = 0.42 / a.size.y;
      hold.add(partMesh(a, u, sc, [0.5, 0, 0.5], f, shadows)).position.y += 0.08;
      hold.position.z = -lay.L * 0.18;
    } else if (id === 'rail') {
      const l = Math.max(a.size.x, a.size.z);
      const sc = 1.7 / l;
      hold.add(partMesh(a, u, sc, [0.5, 0, 0.5], FINISHES.chrome, shadows)).position.y += 0.1;
    }
    this.addDetach(hold);
  }

  buildPower(id, lay, baseY, surf, shadows) {
    const u = this.uniforms;
    const f = this.finishFor('power');
    const hold = new THREE.Group();
    this.body.add(hold);
    const z = -lay.L * 0.32;
    const hasMines = this.build.top && this.build.top.id === 'mines';
    hold.position.set(hasMines ? lay.W * 0.28 : 0, surf.topR - 0.02, z);
    this.anim.power = { id, hold };
    const add = (mid, size, pivot = [0.5, 0, 0.5]) => {
      const a = cacheGet(mid);
      return partMesh(a, u, size / a.size.y, pivot, f, shadows);
    };
    if (id === 'shield') {
      hold.add(add('shield', 0.5));
    } else if (id === 'emp') {
      hold.add(add('emp', 0.92));
    } else if (id === 'repair') {
      hold.add(add('nanite', 0.62));
    } else if (id === 'overdrive') {
      hold.position.set(0, baseY + lay.H * 0.55, -lay.L * 0.5 - 0.08);
      const a = cacheGet('thruster');
      for (const sx of [-1, 1]) {
        const m = partMesh(a, u, 0.42 / a.size.y, [0.5, 0.5, 0.5], f, shadows);
        m.position.x += sx * 0.28;
        hold.add(m);
      }
      hold.add(box(0.8, 0.1, 0.1, Hardware.dark, 0, 0, 0.1));
      this.anim.power.flames = [[-0.28, 0, -0.45], [0.28, 0, -0.45]];
    } else if (id === 'jets') {
      hold.position.set(0, baseY + lay.H * 0.3, -lay.L * 0.15);
      const a = cacheGet('thruster');
      for (const sx of [-1, 1]) {
        const g = new THREE.Group();
        g.position.x = sx * (lay.W / 2 + 0.12);
        g.rotation.x = -HALF; // Nozzle down.
        g.add(partMesh(a, u, 0.38 / a.size.y, [0.5, 0.5, 0.5], f, shadows));
        hold.add(g);
        hold.add(box(0.2, 0.08, 0.14, Hardware.dark, sx * (lay.W / 2 + 0.02), 0, 0));
      }
    }
    if (id === 'shield' || id === 'emp' || id === 'repair') hold.add(cyl(0.16, 0.06, Hardware.dark, 'y', 0, 0.02, 0));
    this.addDetach(hold);
  }

  buildArmor(lay, baseY, shadows) {
    const id = this.build.armor.id === 'plates' ? 'plate' : 'spikeskirt';
    const a = cacheGet(id);
    const f = this.finishFor('armor');
    // One big piece hung off each side on a code-built rail.
    const sideOut = this.build.drive.id === 'legs' || this.build.drive.id === 'hover' ? lay.W / 2 + 0.08 : lay.W / 2 + 0.05;
    const wheeled = this.build.drive.id.includes('wheels');
    this.anim.armor = [];
    for (const sx of [-1, 1]) {
      const hold = new THREE.Group();
      const h = wheeled ? lay.H * 0.55 : lay.H * 0.72;
      const sc = h / a.size.y;
      const widen = Math.max(0.8, Math.min(1.5, (wheeled ? lay.L * 0.34 : lay.L * 0.8) / (a.size.x * sc)));
      const yy = wheeled ? baseY + lay.H * 0.55 : baseY + lay.H * 0.4;
      hold.position.set(sx * sideOut, yy, 0);
      const m = partMesh(a, this.uniforms, sc, [0.5, 0.5, 0.5], f, shadows);
      m.scale.x *= widen; m.position.x *= widen;
      const inner = new THREE.Group();
      inner.rotation.y = sx * HALF; // Face out to each side.
      inner.add(m);
      hold.add(inner);
      hold.add(box(0.06, 0.1, lay.L * 0.5, Hardware.dark, -sx * 0.06, h * 0.2, 0));
      this.body.add(hold);
      this.anim.armor.push(hold);
      this.addDetach(hold);
    }
  }

  buildTrophies(list, lay, baseY, surf) {
    const dark = Hardware.dark, trim = Hardware.trim;
    const paint = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.4 });
    const spots = [
      [-lay.W * 0.32, -lay.L * 0.4], [lay.W * 0.32, -lay.L * 0.4], [-lay.W * 0.36, 0], [lay.W * 0.36, 0], [-lay.W * 0.3, lay.L * 0.25], [lay.W * 0.3, lay.L * 0.25],
    ];
    const group = new THREE.Group();
    const top = Math.max(surf.topC, surf.topR);
    list.forEach((n, i) => {
      const [x, z] = spots[Math.min(i, spots.length - 1)];
      const g = new THREE.Group();
      g.position.set(x, surf.topFar * 0.5 + top * 0.5 - 0.05, z);
      if (n === 3) { g.add(cyl(0.025, 0.35, dark, 'y', 0, 0.17, 0, 6)); g.add(box(0.2, 0.12, 0.12, paint('#d94f8a'), 0, 0.36, 0)); }
      if (n === 6) { g.add(cyl(0.03, 0.25, dark, 'y', 0, 0.12, 0, 6)); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.12, 10), paint('#ff7a1a')); c.position.y = 0.3; c.rotation.z = 0.5; g.add(c); }
      if (n === 9) for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28 - k * 0.03, 5), paint('#bfe6ff')); c.position.set((k - 1.5) * 0.06, 0.13, (k % 2) * 0.05); c.rotation.z = (k - 1.5) * 0.25; g.add(c); }
      if (n === 12) { g.add(cyl(0.025, 0.2, dark, 'y', 0, 0.1, 0, 6)); const t = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), paint('#c9843a')); t.position.y = 0.26; g.add(t); }
      if (n === 15) { g.add(box(0.04, 0.3, 0.04, paint('#f2b705'), 0, 0.15, 0)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc21a, emissive: 0xffa010, emissiveIntensity: 1.4 })); b.position.y = 0.33; g.add(b); }
      if (n === 18) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.25 })); c.rotation.x = HALF; c.position.y = 0.12; g.add(c); for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), c.material); const ang = k / 6 * Math.PI * 2; s.position.set(Math.sin(ang) * 0.2, 0.2, Math.cos(ang) * 0.2); g.add(s); } g.position.set(0, top - 0.02, lay.L * 0.05); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(g);
    });
    this.body.add(group);
    this.addDetach(group);
    void trim;
  }

  addMkGlow() {
    const b = this.build;
    const mats = [];
    const ringFor = (slot, pos) => {
      if (!b[slot] || b[slot].mk < 2) return;
      const m = new THREE.MeshBasicMaterial({ color: this.uniforms.uPaint2.value.clone() });
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 5, 18), m);
      r.rotation.x = HALF;
      r.position.set(...pos);
      this.body.add(r);
      mats.push(m);
    };
    const l = this.lay;
    if (this.anim.top) ringFor('top', [this.anim.top.hold.position.x, this.anim.top.hold.position.y + 0.1, this.anim.top.hold.position.z]);
    if (this.anim.power) ringFor('power', [this.anim.power.hold.position.x, this.anim.power.hold.position.y + 0.08, this.anim.power.hold.position.z]);
    ringFor('main', [0, this.surf.topF + 0.03, l.L * 0.22]);
    ringFor('chassis', [0, this.surf.topC + 0.02, 0]);
    this.glowMats = mats;
  }

  setPaint(s) {
    this.paint = s;
    import('./paint.js').then(({ setPaint }) => setPaint(this.uniforms, s));
    for (const m of this.paintMats || []) m.color.set(s.c1);
    for (const m of this.glowMats || []) m.color.set(s.c2);
  }

  updateTreads(dist) {
    const dummy = this.dummy || (this.dummy = new THREE.Object3D());
    for (const t of this.anim.treads || []) {
      t.off = (t.off + dist) % 1000;
      const { tL, tH, n, links } = t;
      const r = tH / 2 + 0.02;
      const straight = tL - tH;
      const per = 2 * straight + 2 * Math.PI * r;
      for (let i = 0; i < n; i++) {
        let s = ((i / n) * per + t.off) % per;
        if (s < 0) s += per;
        let x = 0, y = 0, a = 0;
        if (s < straight) { x = -straight / 2 + s; y = -r; a = 0; }
        else if (s < straight + Math.PI * r) { const q = (s - straight) / r; x = straight / 2 + Math.sin(q) * r; y = -Math.cos(q) * r; a = q; }
        else if (s < 2 * straight + Math.PI * r) { const q = s - straight - Math.PI * r; x = straight / 2 - q; y = r; a = Math.PI; }
        else { const q = (s - 2 * straight - Math.PI * r) / r; x = -straight / 2 - Math.sin(q) * r; y = Math.cos(q) * r; a = Math.PI + q; }
        dummy.position.set(0, tH / 2 + y + 0.02, x);
        dummy.rotation.set(-a, 0, 0);
        dummy.updateMatrix();
        links.setMatrixAt(i, dummy.matrix);
      }
      links.instanceMatrix.needsUpdate = true;
    }
  }

  // Idle movement for showroom scenes.
  idle(dt) {
    this.update(dt, { speedNow: 0, h: 0, y: 0, flipped: 0, rpm: 0.25, firing: false, wWind: 0, hammerSwing: 0, extend: 0, lungeT: 0, turretA: Math.sin(performance.now() / 1600) * 0.5, shieldT: 0, hp: 1, stats: { maxHp: 1, speed: 1 }, teeter: 0, vx: 0, vz: 0, kbx: 0, kbz: 0, overEdge: false, showroom: true });
  }

  // Read the sim robot and pose everything.
  update(dt, r) {
    const a = this.anim;
    this.phase += dt;
    const sp = r.speedNow || 0;
    if (a.wheels) {
      const d = sp * dt / a.wheelR;
      for (const w of a.wheels) {
        w.spin.rotation.x += d;
        if (r.turning !== undefined && w.front) w.hold.rotation.y = r.turning * 0.4;
      }
    }
    if (a.treads) this.updateTreads(sp * dt);
    if (a.legs) {
      this.legPhase = (this.legPhase || 0) + sp * dt * 3.2;
      for (const l of a.legs) {
        const q = this.legPhase + (l.sz > 0 ? 0 : Math.PI);
        const amp = Math.min(0.4, sp * 0.1);
        l.hold.rotation.x = Math.sin(q) * amp;
        l.hold.position.y = l.y0 + Math.max(0, Math.cos(q)) * amp * 0.08;
      }
      this.body.position.y = Math.abs(Math.sin(this.legPhase)) * 0.015 * Math.min(1, sp);
    }
    if (a.pods) {
      for (const p of a.pods) p.hold.position.y = p.y0 + Math.sin(this.phase * 3 + p.i * 1.7) * 0.02;
      this.body.position.y = Math.sin(this.phase * 2.2) * 0.025;
    }
    const m = a.main;
    if (m) {
      if (m.id === 'drum' || m.id === 'saw') {
        const rate = r.showroom ? 2 : (m.id === 'drum' ? (r.rpm || 0) * 55 : (r.firing || r.extend > 0 ? 42 : 2));
        m.spin.rotation.x += rate * dt;
      } else if (m.id === 'hammer') {
        // Rest back, wind further back, then slam down and recover.
        let target = -0.45;
        if (r.wWind > 0) target = -1.05;
        else if (r.hammerSwing > 0) target = 1.5;
        m.arm.rotation.x += (target - m.arm.rotation.x) * Math.min(1, dt * (r.hammerSwing > 0.5 ? 40 : 10));
      } else if (m.id === 'flipper') {
        let target = 1.42;
        if (r.hammerSwing > 0) target = 0.35;
        m.arm.rotation.x += (target - m.arm.rotation.x) * Math.min(1, dt * (r.hammerSwing > 0.5 ? 34 : 8));
      } else if (m.id === 'drill') {
        m.spin.rotation.y += (r.extend > 0 ? 40 : 1) * dt;
        m.slide.position.z = m.base + (r.extend || 0) * 0.28;
      } else if (m.id === 'ram') {
        const target = m.rest + (r.lungeT > 0 ? 0.18 : 0);
        m.hold.position.z += (target - m.hold.position.z) * Math.min(1, dt * 18);
      } else if (m.id === 'rail') {
        m.slide.position.z += (m.base - m.slide.position.z) * Math.min(1, dt * 6);
      }
    }
    if (a.top && a.top.yaw) a.top.yaw.rotation.y = r.turretA || 0;

    if (!r.showroom) {
      // Heading and position.
      this.root.position.set(r.x, r.y, r.z);
      this.root.rotation.y = r.h;
    }
    // Body attitude: flip, teeter, lean.
    let wantZ = r.flipped > 0 ? Math.PI : 0;
    if (r.teeter > 0) wantZ = 0;
    let wantX = 0;
    if (r.teeter > 0) wantX = Math.sin(this.phase * 18) * 0.05 + 0.2 * (r.z > 0 ? 1 : -1) * Math.cos(r.h);
    if (r.y > 0.1) wantX += 0.2;
    const fwd = (r.vx || 0) * Math.sin(r.h || 0) + (r.vz || 0) * Math.cos(r.h || 0);
    const acc = (fwd - (this.lastFwd || 0)) / Math.max(dt, 0.001);
    this.lastFwd = fwd;
    wantX += Math.max(-0.1, Math.min(0.1, -acc * 0.006));
    this.tiltZ += (wantZ - this.tiltZ) * Math.min(1, dt * 7);
    this.tiltX += (wantX - this.tiltX) * Math.min(1, dt * 9);
    const liftForFlip = Math.abs(Math.sin(this.tiltZ)) * 0.5 + (this.tiltZ > 1.5 ? this.lay.H * 0.9 + this.clearance : 0);
    this.body.rotation.set(this.tiltX, 0, this.tiltZ);
    if (!a.legs && !a.pods) this.body.position.y = 0;
    this.root.position.y = (r.y || 0) + (r.showroom ? this.root.userData.baseY || 0 : liftForFlip);
    // Damage: darken and jitter.
    const hpf = r.hp / r.stats.maxHp;
    this.uniforms.uWreck.value = Math.max(0, (0.35 - hpf) * 1.5);
    this.flash = Math.max(0, this.flash - dt * 8);
    this.uniforms.uFlash.value = this.flash;
    if (hpf < 0.3 && !r.showroom) this.body.position.x = Math.sin(this.phase * 50) * 0.012;
  }

  hitFlash(v = 1) { this.flash = Math.max(this.flash, v); }

  // Break it apart: returns chunks with their world transforms, off the robot.
  explode(scene, rng = Math.random) {
    this.root.updateMatrixWorld(true);
    const chunks = [];
    const all = [...this.detachables, this.chGroup].filter(Boolean);
    for (const g of all) {
      scene.attach(g);
      const a = rng() * Math.PI * 2;
      const up = 3 + rng() * 5;
      const sp = 2 + rng() * 4;
      chunks.push({ obj: g, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: up, rx: (rng() - 0.5) * 8, ry: (rng() - 0.5) * 8, rz: (rng() - 0.5) * 8 });
    }
    return chunks;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material && o.material !== Hardware.trim && o.material !== Hardware.dark && o.material !== Hardware.tire) o.material.dispose();
      }
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}

// Synchronous access to loaded assets (loadBuild was awaited first).
const loaded = new Map();
export function cacheGet(id) {
  const a = loaded.get(id);
  if (!a) throw new Error('model not loaded: ' + id);
  return a;
}
const realLoad = loadModel;
export async function preload(ids) {
  await Promise.all(ids.map(async (id) => { loaded.set(id, await realLoad(id)); }));
}
export async function makeRobot(build, paint, opts) {
  await preload(buildModels(build));
  if (opts && opts.bossRail) await preload(['rail']);
  const v = new RobotView(build, paint, opts);
  await v.assemble();
  return v;
}
export function _resetSurfaceCache() { surfaceCache.clear(); }
export function mkMult(slot, mk) { return MK[slot][mk]; }

// Free everything a scene owns, except what's shared between scenes.
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.dispose && o.isLight) o.dispose();
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (m !== Hardware.trim && m !== Hardware.dark && m !== Hardware.tire) m.dispose();
  });
}
