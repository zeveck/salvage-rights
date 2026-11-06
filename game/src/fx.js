// Effects, drawn in code: sparks, smoke, flames, beams, arcs, rockets, shields
// and floor markers. View only: uses its own random, never the sim's.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
uniform float uSoft;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, uSoft, d);
  if (a <= 0.003) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

class Particles {
  constructor(max, additive, soft) {
    this.max = max;
    this.p = [];
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.g = g;
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    const out = [];
    for (const q of this.p) {
      q.t += dt;
      if (q.t >= q.life) continue;
      q.vy -= (q.g || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.03 && q.bounce) { q.y = 0.03; q.vy = -q.vy * 0.4; q.vx *= 0.6; q.vz *= 0.6; }
      if (q.drag) { const f = Math.max(0, 1 - q.drag * dt); q.vx *= f; q.vz *= f; q.vy *= f; }
      out.push(q);
    }
    this.p = out;
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const q = out[i];
      const k = q.t / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      const c = q.c;
      const c2 = q.c2 || c;
      this.col[i * 4] = c[0] + (c2[0] - c[0]) * k;
      this.col[i * 4 + 1] = c[1] + (c2[1] - c[1]) * k;
      this.col[i * 4 + 2] = c[2] + (c2[2] - c[2]) * k;
      this.col[i * 4 + 3] = (q.a === undefined ? 1 : q.a) * (1 - k);
      this.size[i] = q.s + (q.s2 === undefined ? 0 : (q.s2 - q.s) * k);
    }
    this.g.setDrawRange(0, n);
    this.g.attributes.position.needsUpdate = true;
    this.g.attributes.aColor.needsUpdate = true;
    this.g.attributes.aSize.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene, low) {
    this.scene = scene;
    this.low = low;
    this.group = new THREE.Group();
    scene.add(this.group);
    const mult = low ? 0.6 : 1;
    this.hot = new Particles(Math.floor(700 * mult), true, 0.15);
    this.smokeP = new Particles(Math.floor(200 * mult), false, 0.1);
    this.group.add(this.smokeP.points, this.hot.points);
    this.chunks = [];
    this.temp = [];
  }
  setViewport(h, fov) {
    const s = h / (2 * Math.tan(fov * Math.PI / 360));
    this.hot.mat.uniforms.uScale.value = s;
    this.smokeP.mat.uniforms.uScale.value = s;
  }
  r(a = 1) { return Math.random() * a; }

  sparks(x, y, z, n = 14, speed = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.r(Math.PI * 2);
      const up = 0.2 + this.r(1);
      const sp = speed * (0.3 + this.r(0.9));
      this.hot.add({ x, y, z, vx: Math.sin(a) * sp, vy: up * sp, vz: Math.cos(a) * sp, g: 12, bounce: true, life: 0.25 + this.r(0.45), t: 0, s: 0.07 + this.r(0.06), s2: 0.02, c: o.c || [1.0, 0.85, 0.45], c2: [1, 0.25, 0.05] });
    }
  }
  flash(x, y, z, size = 1.2, c = [1, 0.8, 0.45]) {
    this.hot.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.12, t: 0, s: size, s2: size * 1.6, c, a: 0.9 });
  }
  debris(x, y, z, n = 5, mat) {
    for (let i = 0; i < n; i++) {
      const s = 0.05 + this.r(0.1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s * 1.4), mat);
      m.position.set(x, y, z);
      m.castShadow = false;
      this.group.add(m);
      const a = this.r(Math.PI * 2), sp = 2 + this.r(4);
      this.chunks.push({ obj: m, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: 2 + this.r(4), rx: this.r(10), ry: this.r(10), rz: this.r(10), life: 1.6, t: 0, disposeGeo: true });
    }
  }
  panelChunk(x, y, z, mat, w = 0.45, h = 0.3) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    this.group.add(m);
    const a = this.r(Math.PI * 2);
    this.chunks.push({ obj: m, vx: Math.sin(a) * 3.5, vz: Math.cos(a) * 3.5, vy: 4 + this.r(2), rx: 7, ry: 5, rz: 4, life: 3, t: 0, disposeGeo: true });
  }
  addChunks(list) { for (const c of list) { c.life = 7; c.t = 0; this.chunks.push(c); } }
  smoke(x, y, z, dark = true, s = 0.6) {
    this.smokeP.add({ x, y, z, vx: (this.r() - 0.5) * 0.5, vy: 0.9 + this.r(0.6), vz: (this.r() - 0.5) * 0.5, life: 1 + this.r(0.7), t: 0, s, s2: s * 3, c: dark ? [0.12, 0.12, 0.13] : [0.6, 0.6, 0.62], a: 0.5 });
  }
  dust(x, z, c = [0.5, 0.48, 0.45]) {
    this.smokeP.add({ x, y: 0.1, z, vx: (this.r() - 0.5) * 0.7, vy: 0.3, vz: (this.r() - 0.5) * 0.7, life: 0.5, t: 0, s: 0.25, s2: 0.8, c, a: 0.35 });
  }
  flame(x, y, z, dx, dz, spread = 0.3, speed = 7, heat = 1) {
    const a = Math.atan2(dx, dz) + (this.r() - 0.5) * spread * 2;
    const sp = speed * (0.75 + this.r(0.4));
    this.hot.add({ x, y, z, vx: Math.sin(a) * sp, vy: 0.3 + this.r(0.8), vz: Math.cos(a) * sp, drag: 1.4, life: 0.32 + this.r(0.16), t: 0, s: 0.25, s2: 1.1 * heat, c: [1.0, 0.8, 0.3], c2: [0.95, 0.15, 0.02], a: 0.85 });
  }
  burnOn(x, y, z) {
    this.hot.add({ x: x + (this.r() - 0.5) * 0.6, y: y + this.r(0.5), z: z + (this.r() - 0.5) * 0.6, vx: 0, vy: 1.4 + this.r(1), vz: 0, life: 0.4, t: 0, s: 0.4, s2: 0.1, c: [1, 0.6, 0.15], c2: [0.8, 0.1, 0.02], a: 0.8 });
  }
  thruster(x, y, z, dx, dy, dz) {
    this.hot.add({ x, y, z, vx: dx * 4 + (this.r() - 0.5), vy: dy * 4, vz: dz * 4 + (this.r() - 0.5), life: 0.25, t: 0, s: 0.45, s2: 0.1, c: [0.6, 0.85, 1], c2: [1, 0.4, 0.1], a: 0.9 });
  }
  explosion(x, y, z, s = 1) {
    this.flash(x, y + 0.3, z, 3 * s, [1, 0.7, 0.3]);
    this.sparks(x, y + 0.3, z, Math.floor(30 * s), 9);
    for (let i = 0; i < (this.low ? 6 : 12) * s; i++) {
      this.hot.add({ x, y: y + 0.3, z, vx: (this.r() - 0.5) * 6, vy: this.r(5), vz: (this.r() - 0.5) * 6, drag: 2.5, life: 0.5 + this.r(0.3), t: 0, s: 0.8, s2: 2 * s, c: [1, 0.7, 0.25], c2: [0.6, 0.1, 0.02], a: 0.8 });
      this.smoke(x + (this.r() - 0.5) * s, y + 0.3, z + (this.r() - 0.5) * s, true, 0.8 * s);
    }
  }
  beam(x1, y1, z1, x2, y2, z2, color, width = 0.08, life = 0.14) {
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.lookAt(x2, y2, z2);
    m.rotateX(Math.PI / 2);
    this.group.add(m);
    this.temp.push({ obj: m, t: 0, life, fade: true });
  }
  arc(x1, y1, z1, x2, y2, z2, color = 0xa8d8ff, segs = 9, life = 0.16) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const w = i === 0 || i === segs ? 0 : 0.28;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * k + (this.r() - 0.5) * w, y1 + (y2 - y1) * k + (this.r() - 0.5) * w, z1 + (z2 - z1) * k + (this.r() - 0.5) * w));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
    this.group.add(line);
    this.temp.push({ obj: line, t: 0, life, fade: true });
  }
  floorRing(x, z, r, color, life = 0.5, y = 0.04) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.group.add(m);
    this.temp.push({ obj: m, t: 0, life, grow: 1.2, fade: true });
  }
  // A red wedge on the floor: danger arc.
  dangerArc(parent, range, arcDeg, life) {
    const a = arcDeg * Math.PI / 180;
    const g = new THREE.CircleGeometry(range, 28, Math.PI / 2 - a / 2 + Math.PI / 2 * 0, a);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff2a20, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.045;
    parent.add(m);
    this.temp.push({ obj: m, t: 0, life, parent, pulse: true });
    return m;
  }
  aimLine(parent, len, life) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.05, len / 2);
    parent.add(m);
    this.temp.push({ obj: m, t: 0, life, parent, pulse: true });
  }

  update(dt) {
    this.hot.update(dt);
    this.smokeP.update(dt);
    const keep = [];
    for (const c of this.chunks) {
      c.t += dt;
      c.vy -= 12 * dt;
      const o = c.obj;
      o.position.x += c.vx * dt; o.position.y += c.vy * dt; o.position.z += c.vz * dt;
      o.rotation.x += c.rx * dt; o.rotation.y += c.ry * dt; o.rotation.z += c.rz * dt;
      if (o.position.y < 0.05 && !c.falls) {
        o.position.y = 0.05; c.vy = Math.abs(c.vy) * 0.35; c.vx *= 0.6; c.vz *= 0.6; c.rx *= 0.5; c.ry *= 0.5; c.rz *= 0.5;
      }
      if (c.t < c.life) keep.push(c);
      else { if (o.parent) o.parent.remove(o); if (c.disposeGeo && o.geometry) o.geometry.dispose(); }
    }
    this.chunks = keep;
    const t2 = [];
    for (const q of this.temp) {
      q.t += dt;
      const k = q.t / q.life;
      const mat = q.obj.material;
      if (q.fade && mat) mat.opacity = Math.max(0, 1 - k);
      if (q.pulse && mat) mat.opacity = 0.25 + 0.3 * Math.abs(Math.sin(q.t * 18));
      if (q.grow) q.obj.scale.setScalar(1 + k * q.grow);
      if (k < 1) t2.push(q);
      else { if (q.obj.parent) q.obj.parent.remove(q.obj); if (q.obj.geometry) q.obj.geometry.dispose(); if (mat) mat.dispose(); }
    }
    this.temp = t2;
  }
  dispose() {
    for (const c of this.chunks) if (c.obj.parent) c.obj.parent.remove(c.obj);
    this.chunks = [];
    this.hot.g.dispose(); this.smokeP.g.dispose(); this.hot.mat.dispose(); this.smokeP.mat.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
