// Six arenas, built from code with generated textures. Everything the camera
// looks down on is here: floor, walls, stands, hazards, signature props.
import * as THREE from 'three';
import { ARENAS } from './catalog.js';
import { Hardware, cacheGet, preload } from './assembly.js';
import { tilePattern } from './sim.js';

const tex = new THREE.TextureLoader();
const texCache = new Map();
export function loadTex(path, repeat = 1, srgb = true) {
  const key = path;
  let t = texCache.get(key);
  if (!t) {
    t = new Promise((res) => {
      tex.load(path, (x) => {
        x.wrapS = x.wrapT = THREE.RepeatWrapping;
        if (srgb) x.colorSpace = THREE.SRGBColorSpace;
        x.anisotropy = 8;
        res(x);
      }, undefined, () => { texCache.delete(key); res(null); });
    });
    texCache.set(key, t);
  }
  return t.then((x) => {
    if (!x) return null;
    const c = x.clone();
    c.repeat.set(repeat, repeat);
    c.needsUpdate = true;
    return c;
  });
}

const box = (w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
};
const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

function outline(a) {
  // Points of the arena's edge, as [x, z] going round.
  const hw = a.w / 2, hd = a.d / 2;
  if (a.shape === 'circle') {
    const pts = [];
    for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; pts.push([Math.sin(t) * hw, Math.cos(t) * hw]); }
    return pts;
  }
  if (a.shape === 'octagon') {
    const pts = [];
    const c = hw * Math.tan(Math.PI / 8);
    return [[c, hd], [hw, c], [hw, -c], [c, -hd], [-c, -hd], [-hw, -c], [-hw, c], [-c, hd]].concat(pts);
  }
  if (a.shape === 'roundsquare') {
    const c = hw * 0.75;
    return [[c, hd], [hw, c], [hw, -c], [c, -hd], [-c, -hd], [-hw, -c], [-hw, c], [-c, hd]];
  }
  return [[hw, hd], [hw, -hd], [-hw, -hd], [-hw, hd]];
}

export class ArenaView {
  constructor(id) {
    this.id = id;
    this.a = ARENAS[id];
    this.group = new THREE.Group();
    this.anim = [];
    this.tiles = null;
    this.gridColor = new THREE.Color();
    this.spin = 0;
  }

  async build(fight) {
    const id = this.id, a = this.a;
    const needHammer = id === 'bowl';
    if (needHammer) await preload(['hammer']);
    const [floorT, wallT, bgT, crowdT, lavaT, streetT] = await Promise.all([
      loadTex(`assets/tiles/${id}-floor.jpg`, 1),
      loadTex(`assets/tiles/${id}-wall.jpg`, 1),
      loadTex(`assets/bg/${id}.jpg`, 1),
      loadTex('assets/bg/crowd.jpg', 1),
      id === 'crucible' ? loadTex('assets/tiles/lava.jpg', 1) : null,
      id === 'rise' ? loadTex('assets/bg/street.jpg', 1) : null,
    ]);
    this.floorMat = new THREE.MeshStandardMaterial({ map: floorT, roughness: a.ice ? 0.18 : 0.72, metalness: a.ice ? 0.15 : 0.25, color: a.ice ? 0x8fa8bc : (this.id === 'crucible' ? 0x7f8488 : 0x8c8a88) });
    const shape = new THREE.Shape();
    const pts = outline(a);
    pts.forEach((p, i) => (i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1])));
    shape.closePath();
    const floorG = new THREE.ShapeGeometry(shape);
    const uv = floorG.attributes.uv;
    const pos = floorG.attributes.position;
    const tileSize = 5;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tileSize, pos.getY(i) / tileSize);
    const floor = new THREE.Mesh(floorG, this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls round the edge, with a skirt under the floor for open sides.
    const wallMat = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.7, metalness: 0.4 });
    const H = 1.4;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      const open = a.openSides && Math.abs(dz) < 0.01;
      const wall = box(len + 0.3, open ? 0.25 : H, 0.4, wallMat, (p[0] + q[0]) / 2, (open ? 0.125 : H / 2), (p[1] + q[1]) / 2, !open);
      wall.rotation.y = -Math.atan2(dz, dx);
      if (wallT) {
        // Tile along the wall.
        const g = wall.geometry; const u = g.attributes.uv;
        for (let k = 0; k < u.count; k++) u.setX(k, u.getX(k) * len / 3);
      }
      this.group.add(wall);
      if (open) {
        // Warning stripe inside the kerb.
        const st = new THREE.Mesh(new THREE.PlaneGeometry(len, 1), stripeMat());
        st.rotation.x = -Math.PI / 2;
        st.position.set(0, 0.015, (p[1] + q[1]) / 2 - Math.sign(p[1]) * 0.6);
        this.group.add(st);
      }
      // A trim cap along the top of each wall so the edge reads from above.
      if (!open) {
        const cap = box(len + 0.3, 0.08, 0.5, Hardware.dark, (p[0] + q[0]) / 2, H + 0.04, (p[1] + q[1]) / 2, false);
        cap.rotation.y = wall.rotation.y;
        this.group.add(cap);
      }
    }
    this.surround(bgT, crowdT, streetT);
    this.hazards(fight, lavaT);
    this.signature();
    return this;
  }

  // What's past the walls, as the booth camera sees it.
  surround(bgT, crowdT, streetT) {
    const a = this.a;
    const R = Math.max(a.w, a.d) * 0.72;
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.6, R * 2.6, 40, 40, 1, true), new THREE.MeshBasicMaterial({ map: bgT, side: THREE.BackSide, color: 0xffffff, fog: false }));
    sky.position.y = 15;
    this.group.add(sky);
    if (this.id === 'rise') {
      // No stands. The street is far below, with a roof deck skirt.
      const under = box(a.w + 0.4, 18, a.d + 0.4, new THREE.MeshBasicMaterial({ color: 0x17141c }), 0, -9.02, 0, false);
      this.group.add(under);
      if (streetT) { streetT.repeat.set(6, 6); }
      const street = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ map: streetT, color: 0xbba0a0 }));
      street.rotation.x = -Math.PI / 2;
      street.position.y = -32;
      this.group.add(street);
      this.street = street;
      return;
    }
    // Raked stands, a cone of crowd rising away from the walls.
    if (crowdT) crowdT.repeat.set(14, 2);
    const mat = new THREE.MeshStandardMaterial({ map: crowdT, color: 0xbfbfc8, roughness: 1 });
    const rakes = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.1, R * 1.02, 9, 40, 1, true), mat);
    rakes.material.side = THREE.BackSide;
    rakes.position.y = 5.0;
    this.group.add(rakes);
    this.crowd = crowdT;
    // A dark gutter between wall and stands.
    const gutter = new THREE.Mesh(new THREE.RingGeometry(R * 0.5, R * 1.1, 40), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 1 }));
    gutter.rotation.x = -Math.PI / 2;
    gutter.position.y = -0.04;
    this.group.add(gutter);
  }

  hazards(fight, lavaT) {
    const hz = fight ? fight.hz : {};
    const g = this.group;
    const id = this.id;
    if (id === 'pit') {
      this.junkMeshes = [];
      const scrapMats = [new THREE.MeshStandardMaterial({ color: 0x8f8a82, map: Hardware.trim.map, roughness: 0.75, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: 0x9c6a3a, map: Hardware.trim.map, roughness: 0.8, metalness: 0.15 }), new THREE.MeshStandardMaterial({ color: 0x5f6f7a, map: Hardware.trim.map, roughness: 0.7, metalness: 0.2 })];
      for (const j of hz.junk || []) {
        const c = new THREE.Group();
        const seed = j.x * 3 + j.z;
        for (let i = 0; i < 6; i++) {
          const q = (seed + i * 1.7) * 7.3;
          const b = box(0.35 + (Math.abs(Math.sin(q)) * 0.55), 0.3 + Math.abs(Math.cos(q)) * 0.4, 0.4 + Math.abs(Math.sin(q * 1.3)) * 0.5, scrapMats[i % 3], Math.sin(q) * 0.42, 0.2 + i * 0.08, Math.cos(q * 1.1) * 0.42);
          b.rotation.set(q, q * 0.7, q * 1.3);
          c.add(b);
        }
        c.position.set(j.x, 0, j.z);
        g.add(c);
        this.junkMeshes.push({ j, c });
      }
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.95 });
      for (const t of hz.tires || []) {
        const n = Math.round(Math.hypot(t.bx - t.ax, t.bz - t.az) / 0.8);
        for (let i = 0; i <= n; i++) {
          for (let h = 0; h < 2; h++) {
            const m = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.17, 6, 12), tireMat);
            m.rotation.x = Math.PI / 2;
            m.position.set(t.ax + (t.bx - t.ax) * i / n, 0.18 + h * 0.3, t.az + (t.bz - t.az) * i / n);
            m.castShadow = true;
            g.add(m);
          }
        }
      }
    }
    if (id === 'crucible') {
      if (lavaT) { lavaT.repeat.set(1, 6); lavaT.wrapS = lavaT.wrapT = THREE.RepeatWrapping; }
      this.lavaMat = new THREE.MeshBasicMaterial({ map: lavaT, color: 0xffffff });
      this.lavaT = lavaT;
      for (const l of hz.lava || []) {
        for (const s of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.8), this.lavaMat);
          m.rotation.x = -Math.PI / 2;
          m.position.set(l.x, 0.012, s * 3.6);
          g.add(m);
          // Dark lip.
          for (const dx of [-0.85, 0.85]) g.add(box(0.1, 0.05, 4.9, Hardware.dark, l.x + dx, 0.025, s * 3.6, false));
          const light = null; void light;
        }
      }
      this.jetMeshes = [];
      for (const j of hz.jets || []) {
        g.add(box(0.5, 0.8, 1, Hardware.dark, j.x + j.dx * 0.1, 0.5, j.z));
        const lamp = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        lamp.rotation.x = -Math.PI / 2;
        lamp.position.set(j.x + j.dx * 1.5, 0.02, j.z);
        g.add(lamp);
        this.jetMeshes.push({ j, lamp });
      }
    }
    if (id === 'freeze') {
      const m = new THREE.Group();
      const head = cyl(1.8, 1.8, 0.5, Hardware.dark, 0, 0.25, 0, 24);
      m.add(head);
      m.add(cyl(0.6, 0.6, 3.5, Hardware.trim, 0, 2.2, 0, 12));
      m.add(cyl(1.4, 1.7, 0.2, Hardware.trim, 0, 0.6, 0, 20));
      m.position.y = 6;
      m.visible = false;
      g.add(m);
      this.pistonMesh = m;
      this.pistonY = 6;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
      this.pistonRing = ring;
    }
    if (id === 'dome') {
      const s = 1.92;
      const count = 100;
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
      const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(s, s), mat, count);
      const d = new THREE.Object3D();
      d.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 100; i++) {
        const ix = i % 10, iz = Math.floor(i / 10);
        d.position.set(ix * 2 - 9, 0.02, iz * 2 - 9);
        d.updateMatrix();
        tiles.setMatrixAt(i, d.matrix);
        tiles.setColorAt(i, new THREE.Color(0, 0, 0));
      }
      tiles.instanceColor.needsUpdate = true;
      g.add(tiles);
      this.tiles = tiles;
      this.tileState = null;
      for (const p of hz.pylons || []) {
        g.add(cyl(p.r, p.r * 1.15, 1.1, Hardware.trim, p.x, 0.55, p.z, 12));
        g.add(cyl(p.r * 0.5, p.r * 0.8, 0.4, Hardware.trim, p.x, 1.3, p.z, 10));
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xc9a6ff }));
        b.position.set(p.x, 1.6, p.z);
        g.add(b);
      }
    }
    if (id === 'bowl') {
      const hm = cacheGet('hammer');
      this.sawMeshes = [];
      const sawMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 0.55, roughness: 0.32 });
      for (const s of hz.saws || []) {
        const d = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 18), sawMat);
        disc.rotation.x = Math.PI / 2;
        d.add(disc);
        const teeth = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.2, 3), sawMat, 12);
        const dd = new THREE.Object3D();
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          dd.position.set(Math.sin(a) * 0.74, Math.cos(a) * 0.74, 0);
          dd.rotation.set(0, 0, -a);
          dd.updateMatrix();
          teeth.setMatrixAt(i, dd.matrix);
        }
        d.add(teeth);
        d.position.y = 0.25;
        g.add(d);
        const shade = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.34), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
        shade.rotation.x = -Math.PI / 2;
        shade.position.y = -0.2;
        d.add(shade);
        this.sawMeshes.push({ s, d, spin: disc, teeth });
      }
      // Saw track.
      const track = new THREE.Mesh(new THREE.RingGeometry(6.96, 7.04, 64), new THREE.MeshBasicMaterial({ color: 0x4a4436 }));
      track.rotation.x = -Math.PI / 2;
      track.position.y = 0.012;
      g.add(track);
      // The swinging hammer hangs from a gantry over the center line.
      const hg = new THREE.Group();
      hg.position.set(0, 6.2, 0);
      const mat = hm.mat.clone();
      const sc = 5.9 / hm.size.y;
      const mesh = new THREE.Mesh(hm.geo, mat);
      mesh.scale.setScalar(sc);
      mesh.rotation.x = Math.PI;
      mesh.position.set(0, (hm.box.max.y) * sc, 0);
      mesh.castShadow = true;
      hg.add(mesh);
      g.add(hg);
      this.swing = hg;
      hg.visible = false;
      hg.rotation.z = -1.25;
      // The pit: a black disc under two floor halves.
      const pit = new THREE.Mesh(new THREE.CircleGeometry(3.5, 40), new THREE.MeshBasicMaterial({ color: 0x030304 }));
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.02;
      pit.visible = false;
      g.add(pit);
      this.pit = pit;
      const pr = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.7, 48), new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0, depthWrite: false }));
      pr.rotation.x = -Math.PI / 2;
      pr.position.y = 0.025;
      g.add(pr);
      this.pitRing = pr;
    }
    if (id === 'rise') {
      this.windArrows = [];
      const mat = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0, depthWrite: false });
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 3), mat);
        m.rotation.x = Math.PI / 2;
        m.position.set(-9 + i * 3, 0.5, 0);
        g.add(m);
        this.windArrows.push(m);
      }
      this.windMat = mat;
    }
  }

  // A prop that says which arena this is, visible from the booth camera.
  signature() {
    const g = this.group, a = this.a;
    const far = -a.d / 2 - 2.5;
    const add = (o) => { g.add(o); return o; };
    if (this.id === 'pit') {
      // A crane with a big magnet over one corner.
      add(cyl(0.5, 0.7, 13, Hardware.dark, -a.w / 2 - 2, 6.5, far + 1.5, 10));
      add(box(13, 0.6, 0.6, Hardware.trim, -a.w / 2 + 3, 12.5, far + 1.5));
      const swing = new THREE.Group();
      swing.position.set(-a.w / 2 + 7, 12.3, far + 1.5);
      const cable = box(0.08, 4, 0.08, Hardware.dark, 0, -2, 0, false);
      swing.add(cable);
      const mag = cyl(1.2, 1.3, 0.5, Hardware.dark, 0, -4.2, 0, 16);
      swing.add(mag);
      add(swing);
      this.anim.push((t) => { swing.rotation.z = Math.sin(t * 0.5) * 0.14; });
    } else if (this.id === 'crucible') {
      // A giant ladle tipping a molten stream at the far wall.
      const lad = new THREE.Group();
      const body = cyl(2.2, 1.6, 2.6, Hardware.dark, 0, 0, 0, 16);
      lad.add(body);
      const molten = new THREE.Mesh(new THREE.CircleGeometry(2.05, 20), new THREE.MeshBasicMaterial({ color: 0xff8a20 }));
      molten.rotation.x = -Math.PI / 2; molten.position.y = 1.31;
      lad.add(molten);
      lad.position.set(3, 5.2, far - 1.5);
      lad.rotation.z = -0.5;
      add(lad);
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 6, 10), new THREE.MeshBasicMaterial({ color: 0xffa530 }));
      stream.position.set(4.6, 2.7, far - 1.3);
      add(stream);
      const pl = new THREE.PointLight(0xff6020, 30, 18, 1.8);
      pl.position.set(4.5, 1.8, far + 1);
      add(pl);
      this.anim.push((t) => { pl.intensity = 28 + Math.sin(t * 13) * 5; if (this.lavaT) this.lavaT.offset.y = -t * 0.05; });
    } else if (this.id === 'freeze') {
      // A frozen turbine, slowly turning, in the far wall.
      const hub = new THREE.Group();
      hub.position.set(0, 3.6, -a.d / 2 - 1.2);
      const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, metalness: 0.7, roughness: 0.25 });
      hub.add(cyl(0.6, 0.6, 0.9, Hardware.dark, 0, 0, 0, 16)).rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const b = box(0.7, 2.7, 0.1, iceMat, 0, 1.6, 0);
        const piv = new THREE.Group();
        piv.rotation.z = i / 6 * Math.PI * 2;
        b.rotation.y = 0.5;
        piv.add(b);
        hub.add(piv);
      }
      add(hub);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.22, 8, 30), Hardware.dark);
      rim.position.copy(hub.position);
      add(rim);
      this.anim.push((t) => { hub.rotation.z = t * 0.25; });
    } else if (this.id === 'dome') {
      // A coil hanging over the middle, arcing to the pylons is drawn in fx.
      const cz = -a.d / 2 - 1.8;
      add(cyl(0.3, 0.45, 6, Hardware.dark, 0, 3, cz, 8));
      const c = cyl(1.4, 0.7, 1.8, Hardware.trim, 0, 6.6, cz, 16);
      add(c);
      for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(1.4 - i * 0.3, 0.1, 6, 20), new THREE.MeshBasicMaterial({ color: 0xc9a6ff }));
        t.rotation.x = Math.PI / 2;
        t.position.set(0, 7.2 - i * 0.55, cz);
        add(t);
      }
      this.coilTop = new THREE.Vector3(0, 7.4, cz);
    } else if (this.id === 'rise') {
      // Water tower and crane, on the roofs behind.
      const tw = new THREE.Group();
      tw.position.set(-a.w / 2 + 3, 0, -a.d / 2 - 3.5);
      tw.add(cyl(1.5, 1.5, 2.4, Hardware.dark, 0, 5, 0, 16));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 16), Hardware.trim);
      cone.position.y = 6.65;
      tw.add(cone);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tw.add(cyl(0.08, 0.08, 4, Hardware.trim, x, 2, z, 6));
      add(tw);
      add(box(4, 2.5, 3, Hardware.dark, a.w / 2 - 3, -1, -a.d / 2 - 3.5));
      add(cyl(0.2, 0.2, 9, Hardware.dark, a.w / 2 - 2, 4, -a.d / 2 - 3.5, 8));
      add(box(10, 0.3, 0.3, Hardware.trim, a.w / 2 - 5, 8.2, -a.d / 2 - 3.5));
    } else if (this.id === 'bowl') {
      // Four crown towers with turning spotlights.
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const R = a.w / 2 + 3;
        const x = sx * R * 0.72, z = sz * R * 0.72;
        add(cyl(0.45, 0.8, 10, Hardware.dark, x, 5, z, 8));
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.6, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.3 }));
        crown.position.set(x, 10.3, z);
        add(crown);
        const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 12, 1, true), beamMat);
        const piv = new THREE.Group();
        piv.position.set(x, 10.5, z);
        beam.position.y = -8;
        piv.add(beam);
        add(piv);
        const ph = sx * 1.3 + sz;
        this.anim.push((t) => { piv.rotation.x = 0.6 * sz * -1 + Math.sin(t * 0.5 + ph) * 0.3; piv.rotation.z = 0.6 * sx + Math.cos(t * 0.4 + ph) * 0.3; });
      }
    }
  }

  // Follow the sim's hazards.
  update(t, fight) {
    for (const f of this.anim) f(t);
    if (this.crowd) this.crowd.offset.y = Math.sin(t * 2.5) * 0.004;
    if (this.street) this.street.position.x = Math.sin(t * 0.1) * 2;
    if (!fight) return;
    const hz = fight.hz;
    if (this.junkMeshes) for (const { j, c } of this.junkMeshes) c.position.set(j.x, 0, j.z);
    if (this.jetMeshes) for (const { j, lamp } of this.jetMeshes) lamp.material.opacity = j.st === 'glow' ? 0.5 + Math.sin(t * 20) * 0.2 : j.st === 'fire' ? 0.8 : 0;
    if (this.pistonMesh) {
      const p = hz.piston;
      // Slam fast from just above the action, then lift away and vanish.
      if (p.state === 'warn') { this.pistonY = 6; this.pistonMesh.visible = false; }
      if (p.state === 'down') { this.pistonMesh.visible = true; this.pistonY = Math.max(0, this.pistonY - 0.9); }
      if (p.state === 'idle') { this.pistonY = Math.min(6, this.pistonY + 0.22); if (this.pistonY >= 6) this.pistonMesh.visible = false; }
      this.pistonMesh.position.set(p.x, this.pistonY, p.z);
      this.pistonRing.position.x = p.x; this.pistonRing.position.z = p.z;
      this.pistonRing.material.opacity = p.state === 'warn' ? 0.6 + Math.sin(t * 22) * 0.35 : 0;
    }
    if (this.tiles) {
      const g = hz.grid;
      const key = g.state + g.pat;
      const flick = g.state === 'live' ? Math.floor(t * 30) % 2 : 0;
      if (key + flick !== this.tileState) {
        this.tileState = key + flick;
        const c = this.gridColor;
        for (let i = 0; i < 100; i++) {
          const ix = i % 10, iz = Math.floor(i / 10);
          const on = g.state !== 'idle' && tilePattern(ix, iz, g.pat);
          if (!on) c.setRGB(0, 0, 0);
          else if (g.state === 'warn') c.setRGB(0.8, 0.65, 0.05);
          else if (flick) c.setRGB(0.75, 0.9, 1.3);
          else c.setRGB(0.5, 0.35, 1.1);
          this.tiles.setColorAt(i, c);
        }
        this.tiles.instanceColor.needsUpdate = true;
      }
    }
    if (this.windArrows) {
      const w = hz.wind;
      this.windMat.opacity = w.state === 'warn' ? 0.95 : w.state === 'gust' ? 0.6 : 0;
      for (let i = 0; i < this.windArrows.length; i++) {
        const m = this.windArrows[i];
        m.rotation.x = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        m.position.z = (((t * 8 + i * 3.1) % 14) - 7) * w.dir;
      }
    }
    if (this.sawMeshes) for (const { s, d, spin, teeth } of this.sawMeshes) {
      d.position.x = s.x; d.position.z = s.z;
      d.rotation.y = s.a + Math.PI / 2;
      const tgt = s.up ? 0.3 : -0.9;
      d.position.y += (tgt - d.position.y) * 0.2;
      spin.rotation.y = t * 22; teeth.rotation.z = t * 22;
    }
    if (this.swing) {
      const sw = hz.swing;
      const ph = t % 8;
      let a = sw.dir ? sw.dir * -1.25 : -1.25;
      if (sw.state === 'swing') a = sw.dir * (ph - 7.5) * 2 * 1.25 * -1 * -1;
      else if (sw.state === 'warn') a = (sw.dir || 1) * -1.25 - (sw.dir || 1) * 0.1 * Math.sin((ph - 6) * Math.PI);
      this.swing.rotation.z += (a - this.swing.rotation.z) * 0.35;
      this.swing.visible = sw.state !== 'idle';
    }
    if (this.pit) {
      const p = hz.pit;
      this.pit.visible = p.open;
      this.pitRing.material.opacity = p.open ? 0.9 : p.warn ? 0.5 + Math.sin(t * 16) * 0.4 : 0;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        const m = o.material;
        if (m && m !== Hardware.trim && m !== Hardware.dark && m !== Hardware.tire) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

let stripe = null;
function stripeMat() {
  if (stripe) return stripe;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#16171a'; x.fillRect(0, 0, 128, 32);
  x.fillStyle = '#ffc21a';
  for (let i = -32; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 32); x.lineTo(i + 16, 32); x.lineTo(i + 48, 0); x.lineTo(i + 32, 0); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(10, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  stripe = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  return stripe;
}
