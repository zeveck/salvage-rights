// The fight itself: 60 Hz physics, weapons and hazards on a flat floor.
// No DOM, no three.js, no assets. The view only reads from this, and takes
// what happened from `events`. Same seed + same inputs = same fight.
import { PARTS, MK, ARENAS, computeStats } from './catalog.js';

export const DT = 1 / 60;
const G = 12;
const TAU = Math.PI * 2;

export class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() { // mulberry32
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
}

export const angleDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
// Square roots round the same in every browser; Math.hypot doesn't.
export const hyp = (x, y) => Math.sqrt(x * x + y * y);

export const EMPTY_INPUT = Object.freeze({ mx: 0, mz: 0, fire: false, firePressed: false, top: false, topPressed: false, powerPressed: false, lock: false });

function makeRobot(idx, spec, x, z, heading) {
  const stats = computeStats(spec.build, { hpMult: spec.hpMult });
  const r = {
    idx, name: spec.name, build: spec.build, stats, dmgMult: spec.dmgMult || 1,
    x, z, h: heading, vx: 0, vz: 0, kbx: 0, kbz: 0, y: 0, vy: 0,
    hp: stats.maxHp, energy: 100, maxEnergy: 100,
    stun: 0, stunImmune: 0, launchImmune: 0, flipped: 0, flipPending: false, lock: false,
    speedNow: 0, burn: 0, burnDps: 0, slow: 1, teeter: 0, teeterRev: 0, teeterCool: 0, falling: false, overEdge: false,
    // main weapon
    wCd: 0, wWind: 0, wWindDur: 0, wTick: 0, rpm: 0, heat: 0, lockout: 0, firing: false, extend: 0, lungeT: 0, lungeHit: false,
    hammerSwing: 0, flipSwing: 0, recoilT: 0,
    // top mount
    ammo: 0, topCd: 0, topWind: 0, turretA: 0,
    // power
    pCd: 0, shieldT: 0, odT: 0, repairT: 0, repairRate: 0, repairUses: 0, jetT: 0, pendStomp: false,
    // bookkeeping
    dealt: 0, taken: 0, hazardTaken: 0, lastHitBy: -1, lastHazard: null, tickAcc: 0,
    anchorX: x, anchorZ: z, anchorT: 0, nudged: false, immobileIn: 10,
    topOverride: null, powerOverride: null,
  };
  if (spec.build.top) r.ammo = Math.round(PARTS[spec.build.top.id].ammo * stats.ammoMult);
  if (spec.build.power && spec.build.power.id === 'repair') r.repairUses = PARTS.repair.uses;
  return r;
}

export class Fight {
  constructor({ player, rival, arena, seed = 1, assist = 'normal', timer = 120, boss = false, hazardLeague = 1, versus = false, aimAssist = [true, false] }) {
    this.versus = versus;
    this.aimAssist = aimAssist;
    this.seed = seed >>> 0;
    this.rng = new Rng(seed);
    this.arenaId = arena;
    this.arena = ARENAS[arena];
    this.assist = assist;
    this.t = 0; this.tick = 0; this.timer = timer;
    this.boss = boss; this.phase2 = false;
    this.events = [];
    this.over = false; this.result = null;
    this.noDamageT = 0; this.stalemateWarned = false;
    this.projectiles = []; this.mines = [];
    this.hazardLeague = hazardLeague;
    const a = this.arena;
    const startX = Math.min(a.w, a.d) * 0.3;
    this.robots = [
      makeRobot(0, player, -startX, 0, Math.PI / 2),
      makeRobot(1, rival, startX, 0, -Math.PI / 2),
    ];
    if (assist === 'easy') this.robots[1].dmgMult *= 0.75;
    if (assist === 'hard') this.robots[1].dmgMult *= 1.2;
    this.buildArena();
    this.buildHazards();
  }

  // ---- arena shape ----------------------------------------------------
  buildArena() {
    const a = this.arena;
    this.planes = [];
    const hw = a.w / 2, hd = a.d / 2;
    const add = (nx, nz, d, open = false) => this.planes.push({ nx, nz, d, open });
    if (a.shape === 'circle') { this.circleR = hw; return; }
    add(1, 0, hw); add(-1, 0, hw);
    if (a.openSides) { this.edgeZ = hd; } else { add(0, 1, hd); add(0, -1, hd); }
    if (a.shape === 'octagon' || a.shape === 'roundsquare') {
      const c = Math.SQRT1_2;
      const dd = a.shape === 'octagon' ? hw : hw * 1.25;
      add(c, c, dd); add(c, -c, dd); add(-c, c, dd); add(-c, -c, dd);
    }
  }

  buildHazards() {
    const id = this.arenaId;
    const hz = this.hz = { junk: [], pylons: [], tires: [] };
    if (id === 'pit') {
      const spots = [[-4, 4], [4, -4.5], [0, 5.5], [0, -5.5], [5.5, 3.5], [-5.5, -3.5]];
      hz.junk = spots.map(([x, z]) => ({ x, z, r: 0.8, vx: 0, vz: 0, mass: 60 }));
      hz.tires = [{ ax: -6.5, az: -7, bx: -2.5, bz: -7, r: 0.5 }, { ax: 2.5, az: 7, bx: 6.5, bz: 7, r: 0.5 }];
    } else if (id === 'crucible') {
      hz.lava = [{ x: -4.5 }, { x: 4.5 }];
      hz.jets = [{ x: -9, z: -4, dx: 1, phase: 0 }, { x: 9, z: 4, dx: -1, phase: 2.25 }, { x: -9, z: 4, dx: 1, phase: 4.5 }, { x: 9, z: -4, dx: -1, phase: 6.75 }];
    } else if (id === 'freeze') {
      hz.piston = { x: 0, z: 0, state: 'idle', t: 3, idx: 0 };
    } else if (id === 'dome') {
      hz.pylons = [[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, z]) => ({ x, z, r: 0.7 }));
      hz.grid = { t: 0, pat: 0, state: 'idle' };
    } else if (id === 'rise') {
      hz.wind = { t: 6, state: 'idle', dir: 1 };
    } else if (id === 'bowl') {
      hz.saws = [0, 1, 2, 3].map((i) => ({ a: i * Math.PI / 2, x: 0, z: 0, up: true, r: 0.7 }));
      hz.swing = { t: 0, state: 'idle', x: 0 };
      hz.pit = { open: false, warn: false, r: 3.5, at: this.timer / 2 };
      if (this.boss) hz.pit.at = 75 + 3; // or 3 s after Phase 2 starts
    }
  }

  emit(e) { this.events.push(e); }

  // ---- the main step --------------------------------------------------
  step(inputs) {
    if (this.over) return;
    this.tick++; this.t += DT;
    const [a, b] = this.robots;
    this.updateRobot(a, b, inputs[0] || EMPTY_INPUT);
    this.updateRobot(b, a, inputs[1] || EMPTY_INPUT);
    this.collideRobots(a, b);
    this.updateProjectiles();
    this.updateHazards();
    for (const r of this.robots) { this.constrain(r); this.updateImmobile(r); }
    this.updateJunk();
    this.updateStalemate();
    this.checkEnd();
  }

  other(r) { return this.robots[1 - r.idx]; }

  // ---- one robot ------------------------------------------------------
  updateRobot(r, foe, inp) {
    const s = r.stats;
    r.stun = Math.max(0, r.stun - DT);
    if (r.stunWas && r.stun === 0) { r.stunWas = false; r.stunImmune = 1.5; }
    r.stunImmune = Math.max(0, r.stunImmune - DT);
    r.launchImmune = Math.max(0, r.launchImmune - DT);
    if (r.flipped > 0) {
      r.flipped -= DT;
      if (r.flipped <= 0) { r.flipped = 0; r.stunImmune = 3; r.launchImmune = 6; this.emit({ type: 'selfright', r: r.idx }); }
    }
    r.energy = Math.min(r.maxEnergy, r.energy + s.energyRegen * DT);
    r.pCd = Math.max(0, r.pCd - DT);
    r.topCd = Math.max(0, r.topCd - DT);
    r.wCd = Math.max(0, r.wCd - DT);
    r.lockout = Math.max(0, r.lockout - DT);
    r.teeterCool = Math.max(0, r.teeterCool - DT);
    r.shieldT = Math.max(0, r.shieldT - DT);
    r.odT = Math.max(0, r.odT - DT);
    r.recoilT = Math.max(0, r.recoilT - DT);
    if (r.repairT > 0) {
      r.repairT -= DT;
      r.hp = Math.min(s.maxHp, r.hp + r.repairRate * DT);
    }
    if (r.burn > 0) {
      r.burn -= DT;
      this.damage(foe, r, r.burnDps * DT, { tick: true, burn: true, noFacing: true, noMult: true, kind: 'burn' });
    }
    const disabled = r.stun > 0 || r.flipped > 0 || r.falling;
    r.firing = false;
    r.lock = !!inp.lock;
    if (!disabled) this.drive(r, foe, inp);
    else { // coast
      r.vx *= 0.92; r.vz *= 0.92;
    }
    // Knockback decays with grip.
    const g = this.gripFor(r);
    const kb = hyp(r.kbx, r.kbz);
    if (kb > 0) {
      const dec = Math.max(10 * g, r.build.drive.id === 'hover' ? 6 : 4) * DT;
      const n = Math.max(0, kb - dec) / kb;
      r.kbx *= n; r.kbz *= n;
    }
    r.x += (r.vx + r.kbx) * DT;
    r.z += (r.vz + r.kbz) * DT;
    r.speedNow = hyp(r.vx, r.vz);
    // Height.
    if (r.y > 0 || r.vy > 0) {
      r.vy -= G * DT;
      r.y += r.vy * DT;
      if (r.y <= 0) this.land(r, foe);
    }
    if (!disabled) {
      this.updateMain(r, foe, inp);
      this.updateTop(r, foe, inp);
      this.updatePower(r, foe, inp);
    } else {
      r.wWind = 0; r.extend = Math.max(0, r.extend - DT * 4);
      r.rpm = Math.max(0, r.rpm - DT * 0.4);
    }
    // Spike skirt contact is handled in collideRobots.
  }

  gripFor(r) {
    let g = r.stats.grip;
    if (this.arena.ice) g *= r.stats.iceGrip;
    return Math.max(0.08, g);
  }

  drive(r, foe, inp) {
    const s = r.stats;
    let mag = Math.min(1, hyp(inp.mx, inp.mz));
    const airborne = r.y > 0.1;
    if (airborne && !(r.jetT > 0)) mag = 0;
    let speed = s.speed * r.slow;
    if (r.odT > 0) speed *= PARTS.overdrive.speed;
    const m = r.build.main ? PARTS[r.build.main.id] : null;
    if (m && m.selfSpeed && r.extend > 0.5) speed *= m.selfSpeed;
    r.slow = 1;
    if (r.jetT > 0) r.jetT -= DT;

    const grip = this.gripFor(r);
    let wantX = 0, wantZ = 0;
    const toFoeH = Math.atan2(foe.x - r.x, foe.z - r.z);
    if (r.lock) {
      // Face the rival, move any way: rotation limited by the drive.
      const d = angleDiff(r.h, toFoeH);
      const maxT = s.turn * DT;
      r.h += Math.max(-maxT, Math.min(maxT, d));
      if (mag > 0.05) {
        wantX = inp.mx / (mag || 1) * mag * speed * s.lockSpeed;
        wantZ = inp.mz / (mag || 1) * mag * speed * s.lockSpeed;
      }
    } else if (mag > 0.05) {
      let target = Math.atan2(inp.mx, inp.mz);
      // Aim assist for the player: steer roughly at the rival and the robot lines up.
      if (this.aimAssist[r.idx]) {
        const off = angleDiff(target, toFoeH);
        const dist = hyp(foe.x - r.x, foe.z - r.z);
        if (Math.abs(off) < 0.6 && dist < 9) target = toFoeH;
      }
      const d = angleDiff(r.h, target);
      const maxT = s.turn * DT;
      r.h += Math.max(-maxT, Math.min(maxT, d));
      const ad = Math.abs(d);
      // Drive where we face; slow while turning hard; treads pivot first.
      let throttle = Math.max(0, Math.cos(Math.min(ad, Math.PI / 2)));
      if (s.pivots && ad > 0.7) throttle = 0;
      throttle = 0.15 + 0.85 * throttle;
      if (s.pivots && ad > 0.7) throttle = 0;
      wantX = Math.sin(r.h) * speed * mag * throttle;
      wantZ = Math.cos(r.h) * speed * mag * throttle;
    }
    if (r.lungeT > 0) {
      r.lungeT -= DT;
      const boost = PARTS.ram.lunge;
      wantX = Math.sin(r.h) * (speed + boost);
      wantZ = Math.cos(r.h) * (speed + boost);
    }
    // Close velocity toward the wanted one, limited by acceleration and grip.
    const dvx = wantX - r.vx, dvz = wantZ - r.vz;
    const dv = hyp(dvx, dvz);
    const lim = (r.lungeT > 0 ? 60 : s.accel * (0.35 + grip) * 1.1) * DT;
    if (dv > 0) {
      const f = Math.min(1, lim / dv);
      r.vx += dvx * f; r.vz += dvz * f;
    }
  }

  land(r, foe) {
    r.y = 0;
    const impact = -r.vy;
    r.vy = 0;
    this.emit({ type: 'land', r: r.idx, x: r.x, z: r.z, big: impact > 4 });
    if (r.pendStomp) {
      r.pendStomp = false;
      const d = hyp(r.x - foe.x, r.z - foe.z);
      const pw = PARTS.jets;
      if (d < pw.stompRadius + foe.stats.radius && foe.y < 0.6) {
        const mk = MK.power[r.build.power.mk];
        this.damage(r, foe, pw.damage * mk, { kind: 'stomp', dirX: foe.x - r.x, dirZ: foe.z - r.z, big: true });
        this.knock(foe, foe.x - r.x, foe.z - r.z, 5);
      }
    }
    if (r.flipPending) {
      r.flipPending = false;
      if (r.stunImmune <= 0) {
        if (this.rng.next() < r.stats.flipRisk / 100) {
          r.flipped = r.stats.flipTime;
          this.damage(foe, r, r.flipDamage || 3, { kind: 'land', noFacing: true, noMult: true });
          this.emit({ type: 'flipped', r: r.idx, x: r.x, z: r.z });
        } else {
          // Landed upright: half the damage, and safe from another launch for as long as after a flip.
          r.stunImmune = 3; r.launchImmune = 6;
          this.damage(foe, r, (r.flipDamage || 3) * 0.5, { kind: 'land', noFacing: true, noMult: true });
          this.emit({ type: 'landed', r: r.idx, x: r.x, z: r.z });
        }
      }
    }
  }

  // ---- hits -----------------------------------------------------------
  inProfile(r, foe, range, arcDeg, opts = {}) {
    if (!opts.anyHeight && foe.y >= 0.6) return false;
    const d = hyp(foe.x - r.x, foe.z - r.z) - r.stats.radius - foe.stats.radius;
    if (d > range) return false;
    const a = Math.atan2(foe.x - r.x, foe.z - r.z);
    return Math.abs(angleDiff(r.h, a)) <= (arcDeg * Math.PI / 180) / 2 + Math.atan2(foe.stats.radius * 0.6, Math.max(0.5, d + r.stats.radius));
  }

  damage(att, tgt, amount, o = {}) {
    if (this.over || amount <= 0) return 0;
    let dmg = amount;
    let backstab = false, side = false;
    if (!o.noMult && att) {
      dmg *= att.dmgMult;
      if (att.odT > 0) dmg *= PARTS.overdrive.damage;
      if (att.stats.momentum && att.speedNow > att.stats.speed * 0.6) dmg *= 1.2;
    }
    if (!o.noFacing && att) {
      const a = Math.atan2(att.x - tgt.x, att.z - tgt.z);
      const rel = Math.abs(angleDiff(tgt.h, a));
      if (rel > Math.PI * 3 / 4) { dmg *= 1.25; backstab = true; }
      else if (rel > Math.PI / 4) { dmg *= 1.1; side = true; }
      else if (tgt.stats.frontGuard) dmg *= 1 - tgt.stats.frontGuard;
    }
    if (!o.ignoreArmor) dmg *= 1 - tgt.stats.armor;
    if (tgt.shieldT > 0) dmg *= 1 - PARTS.shield.block;
    if (o.hazard) dmg *= tgt.stats.hazardMult;
    tgt.hp -= dmg;
    tgt.taken += dmg;
    tgt.lastHitBy = o.hazard ? -1 : (att ? att.idx : -1);
    tgt.lastHazard = o.hazard ? o.kind : null;
    if (att && !o.hazard && !o.noCredit) { att.dealt += dmg; this.noDamageT = 0; this.stalemateWarned = false; }
    if (o.hazard) { tgt.hazardTaken += dmg; }
    // View: bursts report at once, continuous damage every 10 HP.
    if (o.tick) {
      tgt.tickAcc += dmg;
      if (tgt.tickAcc >= 10) {
        this.emit({ type: 'tickhit', r: tgt.idx, x: tgt.x, z: tgt.z, amount: Math.round(tgt.tickAcc), kind: o.kind, backstab });
        tgt.tickAcc = 0;
      }
    } else {
      this.emit({ type: 'hit', r: tgt.idx, by: att ? att.idx : -1, x: tgt.x, z: tgt.z, amount: Math.round(dmg), kind: o.kind, big: dmg >= 20 || o.big, backstab, side, hazard: !!o.hazard });
    }
    return dmg;
  }

  knock(r, dx, dz, kb, att) {
    const len = hyp(dx, dz) || 1;
    let dv = kb * 100 / r.stats.mass * (1 - r.stats.kbResist);
    if (r.shieldT > 0) {
      if (att) { const n = kb * 100 / att.stats.mass; att.kbx -= dx / len * n; att.kbz -= dz / len * n; }
      dv *= 0.2;
    }
    r.kbx += dx / len * dv;
    r.kbz += dz / len * dv;
    if (r.teeter > 0 && dv > 1.5) { this.goOver(r); }
  }

  applyStun(r, t) {
    if (r.stunImmune > 0 || r.shieldT > 0 || t <= 0) return false;
    r.stun = Math.max(r.stun, t);
    r.stunWas = true;
    this.emit({ type: 'stun', r: r.idx, t });
    return true;
  }

  // ---- main weapon ----------------------------------------------------
  updateMain(r, foe, inp) {
    if (!r.build.main) return;
    const w = PARTS[r.build.main.id];
    const mk = MK.main[r.build.main.mk];
    const cdMult = r.stats.cooldownMult;
    switch (w.id) {
      case 'ram': {
        if (inp.firePressed && r.wCd <= 0) {
          r.wCd = w.cooldown * cdMult;
          r.lungeT = w.lungeTime; r.lungeHit = false;
          this.emit({ type: 'lunge', r: r.idx });
        }
        if (r.lungeT > 0 && !r.lungeHit && this.inProfile(r, foe, w.range, w.arc)) {
          r.lungeHit = true;
          const dmg = (w.damage + w.speedDamage * r.speedNow) * mk * r.stats.ramBonus;
          this.damage(r, foe, dmg, { kind: 'ram', dirX: foe.x - r.x, dirZ: foe.z - r.z });
          this.knock(foe, foe.x - r.x, foe.z - r.z, w.kb, r);
          r.vx *= 0.3; r.vz *= 0.3;
        }
        break;
      }
      case 'drum': {
        if (inp.fire) { r.rpm = Math.min(1, r.rpm + DT / w.spinup); r.firing = true; }
        else r.rpm = Math.max(0, r.rpm - DT * 0.4);
        r.wTick = Math.max(0, r.wTick - DT);
        if (r.rpm >= w.minRpm && r.wTick <= 0 && this.inProfile(r, foe, w.range, w.arc)) {
          r.wTick = 0.6;
          const dmg = w.damage * mk * r.rpm;
          const dx = foe.x - r.x, dz = foe.z - r.z;
          this.damage(r, foe, dmg, { kind: 'drum', big: r.rpm > 0.7 });
          this.knock(foe, dx, dz, w.kb * (0.4 + 0.6 * r.rpm), r);
          if (foe.shieldT <= 0) { foe.vy = Math.max(foe.vy, G * w.pop / 2 * (0.4 + 0.6 * r.rpm)); foe.y = Math.max(foe.y, 0.02); }
          this.knock(r, -dx, -dz, w.recoil);
          r.rpm = Math.max(0, r.rpm - w.rpmCost);
          r.recoilT = 0.2;
        }
        break;
      }
      case 'saw': case 'drill': {
        if (inp.fire) { r.firing = true; r.extend = Math.min(1, r.extend + DT / (w.windup || 0.2)); }
        else r.extend = Math.max(0, r.extend - DT * 4);
        r.wTick = Math.max(0, r.wTick - DT);
        if (r.extend >= 1 && r.wTick <= 0) {
          r.wTick = 0.1;
          if (this.inProfile(r, foe, w.range, w.arc)) {
            this.damage(r, foe, w.dps * mk * 0.1, { kind: w.id, tick: true, ignoreArmor: w.ignoreArmor });
            if (w.kbTick) this.knock(foe, foe.x - r.x, foe.z - r.z, w.kbTick, r);
            this.emit({ type: 'grind', r: foe.idx, x: foe.x, z: foe.z, by: r.idx });
          }
        }
        break;
      }
      case 'hammer': case 'flipper': {
        r.hammerSwing = Math.max(0, r.hammerSwing - DT * 4);
        if (inp.firePressed && r.wCd <= 0 && r.wWind <= 0) {
          r.wWind = w.windup; r.wWindDur = w.windup;
          this.emit({ type: 'windup', r: r.idx, kind: w.id, range: w.range + r.stats.radius, arc: w.arc, t: w.windup });
        }
        if (r.wWind > 0) {
          r.wWind -= DT;
          if (r.wWind <= 0) {
            r.wWind = 0;
            r.wCd = w.cooldown * cdMult;
            r.hammerSwing = 1;
            this.emit({ type: 'swing', r: r.idx, kind: w.id });
            if (this.inProfile(r, foe, w.range, w.arc)) {
              const dx = foe.x - r.x, dz = foe.z - r.z;
              this.damage(r, foe, w.damage * mk, { kind: w.id, big: true });
              this.knock(foe, dx, dz, w.kb, r);
              if (w.launch && foe.shieldT <= 0 && foe.stunImmune <= 0 && foe.launchImmune <= 0 && foe.y < 0.1) {
                foe.vy = w.launch; foe.y = 0.02; foe.flipPending = true; foe.flipDamage = (w.landing || 3) * mk * r.dmgMult;
                this.emit({ type: 'launch', r: foe.idx, x: foe.x, z: foe.z });
              }
            }
          }
        }
        break;
      }
      case 'flame': {
        const canFire = r.lockout <= 0;
        if (inp.fire && canFire) {
          r.firing = true;
          r.heat += DT / w.heat;
          if (r.heat >= 1) { r.heat = 1; r.lockout = w.lockout; this.emit({ type: 'overheat', r: r.idx }); }
          r.wTick = Math.max(0, r.wTick - DT);
          if (r.wTick <= 0) {
            r.wTick = 0.1;
            if (this.inProfile(r, foe, w.range, w.arc, { anyHeight: true })) {
              this.damage(r, foe, w.dps * mk * 0.1, { kind: 'flame', tick: true });
              foe.burn = w.burnTime; foe.burnDps = w.burn * mk * r.dmgMult;
            }
          }
        } else {
          r.heat = Math.max(0, r.heat - w.cool * DT);
        }
        break;
      }
      case 'arc': {
        if (inp.firePressed && r.wCd <= 0) {
          r.wCd = w.cooldown * cdMult;
          const hit = this.inProfile(r, foe, w.range, w.arc, { anyHeight: true });
          this.emit({ type: 'arc', r: r.idx, hit, tx: foe.x, tz: foe.z });
          if (hit) {
            this.damage(r, foe, w.damage * mk, { kind: 'arc' });
            this.knock(foe, foe.x - r.x, foe.z - r.z, w.kb, r);
            this.applyStun(foe, w.stun);
          }
        }
        break;
      }
      case 'rail': this.updateRail(r, foe, inp, w, mk, 'main'); break;
      default: break;
    }
  }

  updateRail(r, foe, inp, w, mk, kind) {
    const pressed = kind === 'main' ? inp.firePressed : inp.topPressed;
    const cdKey = kind === 'main' ? 'wCd' : 'topCd';
    const windKey = kind === 'main' ? 'wWind' : 'topWind';
    const wind = kind === 'main' ? w.windup : w.windup + 0.4;
    if (pressed && r[cdKey] <= 0 && r[windKey] <= 0) {
      r[windKey] = wind;
      this.emit({ type: 'railcharge', r: r.idx, t: wind });
    }
    if (r[windKey] > 0) {
      r[windKey] -= DT;
      if (r[windKey] <= 0) {
        r[windKey] = 0;
        r[cdKey] = w.cooldown * r.stats.cooldownMult;
        const sx = Math.sin(r.h), sz = Math.cos(r.h);
        const ox = r.x + sx * r.stats.radius, oz = r.z + sz * r.stats.radius;
        // Beam: straight line; pylons block it.
        let maxT = w.range;
        for (const p of this.hz.pylons) {
          const px = p.x - ox, pz = p.z - oz;
          const t = px * sx + pz * sz;
          if (t > 0 && Math.abs(px * sz - pz * sx) < p.r && t < maxT) maxT = t;
        }
        const fx = foe.x - ox, fz = foe.z - oz;
        const t = fx * sx + fz * sz;
        const perp = Math.abs(fx * sz - fz * sx);
        const hit = t > -foe.stats.radius && t < maxT && perp < w.beam + foe.stats.radius * 0.8;
        this.emit({ type: 'rail', r: r.idx, x: ox, z: oz, dx: sx, dz: sz, len: hit ? t : maxT, hit });
        this.knock(r, -sx, -sz, w.recoil);
        if (hit) {
          this.damage(r, foe, w.damage * mk, { kind: 'rail', big: true });
          this.knock(foe, sx, sz, w.kb, r);
        }
      }
    }
  }

  // ---- top mount ------------------------------------------------------
  updateTop(r, foe, inp) {
    if (r.topOverride === 'rail') {
      this.updateRail(r, foe, inp, PARTS.rail, MK.main[3], 'top');
      return;
    }
    if (!r.build.top) return;
    const w = PARTS[r.build.top.id];
    const mk = MK.top[r.build.top.mk];
    if (w.id === 'autocannon') {
      const a = Math.atan2(foe.x - r.x, foe.z - r.z);
      const rel = angleDiff(r.h, a);
      const inCone = Math.abs(rel) <= (w.arc * Math.PI / 180) / 2;
      const clamp = Math.max(-0.8, Math.min(0.8, rel));
      r.turretA += angleDiff(r.turretA, clamp) * Math.min(1, DT * 8);
      if (inp.top && r.ammo > 0 && r.topCd <= 0) {
        r.topCd = 1 / w.rate;
        r.ammo--;
        const d = hyp(foe.x - r.x, foe.z - r.z);
        let blocked = false;
        for (const p of this.hz.pylons) {
          const px = p.x - r.x, pz = p.z - r.z, sx = (foe.x - r.x) / d, sz = (foe.z - r.z) / d;
          const t = px * sx + pz * sz;
          if (t > 0 && t < d && Math.abs(px * sz - pz * sx) < p.r) { blocked = true; break; }
        }
        const hit = inCone && d <= w.range && !blocked && this.rng.next() < 0.85;
        this.emit({ type: 'shot', r: r.idx, hit, tx: foe.x, tz: foe.z, ty: foe.y, a: r.h + r.turretA });
        if (hit) {
          this.damage(r, foe, w.damage * mk, { kind: 'auto', tick: true });
          this.knock(foe, foe.x - r.x, foe.z - r.z, w.kb, r);
        }
      }
    } else if (w.id === 'rockets') {
      if (inp.topPressed && r.ammo > 0 && r.topCd <= 0) {
        r.topCd = 1 / w.rate;
        r.ammo--;
        this.projectiles.push({ kind: 'rocket', owner: r.idx, x: r.x, z: r.z, y: 0.9, h: r.h, speed: w.speed, dmg: w.damage * mk, splash: w.splash, kb: w.kb, life: 3.5, id: this.tick });
        this.emit({ type: 'rocket', r: r.idx });
      }
    } else if (w.id === 'mines') {
      if (inp.topPressed && r.ammo > 0 && r.topCd <= 0) {
        r.topCd = 1 / w.rate;
        r.ammo--;
        const back = r.stats.radius + 0.5;
        const m = { owner: r.idx, x: r.x - Math.sin(r.h) * back, z: r.z - Math.cos(r.h) * back, arm: w.arm, dmg: w.damage * mk, kb: w.kb, trigger: w.trigger, id: this.tick, dead: false };
        this.mines.push(m);
        this.emit({ type: 'mine', r: r.idx, m });
      }
    }
  }

  // ---- power ----------------------------------------------------------
  powerId(r) { return r.powerOverride || (r.build.power && r.build.power.id); }
  updatePower(r, foe, inp) {
    const id = this.powerId(r);
    if (!id || !inp.powerPressed) return;
    const w = PARTS[id];
    if (r.pCd > 0 || r.energy < w.energy) { this.emit({ type: 'nopower', r: r.idx }); return; }
    const mk = r.powerOverride ? MK.power[3] : MK.power[r.build.power.mk];
    if (id === 'repair' && r.repairUses <= 0) return;
    if (id === 'jets' && r.y > 0.1) return;
    r.energy -= w.energy;
    r.pCd = w.cooldown;
    this.emit({ type: 'power', r: r.idx, id });
    if (id === 'shield') r.shieldT = w.duration * mk;
    else if (id === 'overdrive') r.odT = w.duration * mk;
    else if (id === 'repair') {
      r.repairUses--;
      r.repairT = w.duration;
      r.repairRate = r.stats.maxHp * w.heal * mk / w.duration;
    } else if (id === 'emp') {
      const d = hyp(foe.x - r.x, foe.z - r.z);
      if (d < w.radius + foe.stats.radius) {
        this.knock(foe, foe.x - r.x, foe.z - r.z, w.kb, r);
        if (this.applyStun(foe, w.stun * mk)) this.emit({ type: 'linklost', r: foe.idx, t: w.stun * mk });
      }
    } else if (id === 'jets') {
      r.vy = Math.sqrt(2 * G * w.height);
      r.y = 0.02;
      r.jetT = w.air;
      r.pendStomp = true;
    }
  }

  // ---- projectiles and mines ------------------------------------------
  updateProjectiles() {
    for (const p of this.projectiles) {
      const foe = this.robots[1 - p.owner];
      const want = Math.atan2(foe.x - p.x, foe.z - p.z);
      const d = angleDiff(p.h, want);
      const maxT = PARTS.rockets.homing * Math.PI / 180 * DT;
      p.h += Math.max(-maxT, Math.min(maxT, d));
      p.x += Math.sin(p.h) * p.speed * DT;
      p.z += Math.cos(p.h) * p.speed * DT;
      p.life -= DT;
      let boom = p.life <= 0;
      if (hyp(foe.x - p.x, foe.z - p.z) < foe.stats.radius + 0.2) boom = true;
      for (const q of this.hz.pylons) if (hyp(q.x - p.x, q.z - p.z) < q.r) boom = true;
      if (this.outOfBounds(p.x, p.z, 0.1)) boom = true;
      if (boom) {
        p.dead = true;
        this.emit({ type: 'explode', x: p.x, z: p.z, big: true });
        const dist = hyp(foe.x - p.x, foe.z - p.z);
        if (dist < p.splash + foe.stats.radius) {
          const f = dist <= foe.stats.radius ? 1 : Math.max(0.5, 1 - 0.5 * (dist - foe.stats.radius) / p.splash);
          this.damage(this.robots[p.owner], foe, p.dmg * f, { kind: 'rocket' });
          this.knock(foe, foe.x - p.x, foe.z - p.z, p.kb * f, this.robots[p.owner]);
        }
      }
    }
    if (this.projectiles.length) this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const m of this.mines) {
      if (m.arm > 0) { m.arm -= DT; continue; }
      const foe = this.robots[1 - m.owner];
      if (foe.y < 0.6 && hyp(foe.x - m.x, foe.z - m.z) < m.trigger + 0.1) {
        m.dead = true;
        this.emit({ type: 'explode', x: m.x, z: m.z, big: true, mine: m.id });
        this.damage(this.robots[m.owner], foe, m.dmg, { kind: 'mine', noFacing: true });
        this.knock(foe, foe.x - m.x, foe.z - m.z, m.kb, this.robots[m.owner]);
      }
    }
    if (this.mines.some((m) => m.dead)) this.mines = this.mines.filter((m) => !m.dead);
  }

  outOfBounds(x, z, r) {
    if (this.circleR) return hyp(x, z) > this.circleR - r;
    for (const p of this.planes) if (p.nx * x + p.nz * z > p.d - r) return true;
    return false;
  }

  // ---- robot vs robot -------------------------------------------------
  collideRobots(a, b) {
    if (a.y > 0.8 || b.y > 0.8 || a.falling || b.falling) return;
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = hyp(dx, dz) || 0.001;
    const min = a.stats.radius + b.stats.radius;
    if (d >= min) return;
    const nx = dx / d, nz = dz / d;
    const overlap = min - d;
    const pa = a.stats.push * a.stats.mass, pb = b.stats.push * b.stats.mass;
    const fa = pb / (pa + pb), fb = pa / (pa + pb);
    a.x -= nx * overlap * fa; a.z -= nz * overlap * fa;
    b.x += nx * overlap * fb; b.z += nz * overlap * fb;
    // Drive velocities into each other are absorbed.
    const va = a.vx * nx + a.vz * nz, vb = b.vx * nx + b.vz * nz;
    if (va - vb > 0) {
      const closing = va - vb;
      a.vx -= nx * closing * fa; a.vz -= nz * closing * fa;
      b.vx += nx * closing * fb; b.vz += nz * closing * fb;
      if (closing > 3 && !this.bumpCool) {
        this.emit({ type: 'bump', x: a.x + nx * a.stats.radius, z: a.z + nz * a.stats.radius, v: closing });
        this.bumpCool = 0.3;
      }
    }
    if (this.bumpCool) this.bumpCool = Math.max(0, this.bumpCool - DT);
    // Spike skirts bite.
    if (a.stats.contact) this.damage(a, b, a.stats.contact * DT, { kind: 'spike', tick: true, noFacing: true });
    if (b.stats.contact) this.damage(b, a, b.stats.contact * DT, { kind: 'spike', tick: true, noFacing: true });
  }

  // ---- walls ----------------------------------------------------------
  constrain(r) {
    if (r.falling) return;
    const rad = r.stats.radius;
    const hitWall = (nx, nz, depth, soft) => {
      r.x -= nx * depth; r.z -= nz * depth;
      const vn = (r.vx + r.kbx) * nx + (r.vz + r.kbz) * nz;
      if (vn > 0) {
        const hard = vn >= 7 && !soft;
        // Bounce the knockback part, stop the driving part.
        const kbn = r.kbx * nx + r.kbz * nz;
        if (kbn > 0) { r.kbx -= nx * kbn * 1.5; r.kbz -= nz * kbn * 1.5; }
        const dn = r.vx * nx + r.vz * nz;
        if (dn > 0) { r.vx -= nx * dn; r.vz -= nz * dn; }
        if (vn > 2.5) this.emit({ type: 'wall', r: r.idx, x: r.x + nx * rad, z: r.z + nz * rad, v: vn, hard });
        if (hard) this.damage(null, r, 10, { kind: 'wall', noFacing: true, noMult: true, noCredit: true, wall: true });
      }
    };
    if (this.circleR) {
      const d = hyp(r.x, r.z);
      if (d + rad > this.circleR) hitWall(r.x / (d || 1), r.z / (d || 1), d + rad - this.circleR);
    } else {
      for (const p of this.planes) {
        const depth = p.nx * r.x + p.nz * r.z + rad - p.d;
        if (depth > 0) hitWall(p.nx, p.nz, depth);
      }
    }
    if (this.edgeZ) this.constrainEdge(r);
    for (const p of this.hz.pylons) this.pushOffCircle(r, p, hitWall);
    for (const j of this.hz.junk) {
      const dx = r.x - j.x, dz = r.z - j.z;
      const d = hyp(dx, dz) || 0.001;
      const min = rad + j.r;
      if (d < min && r.y < 0.5) {
        const nx = dx / d, nz = dz / d, ov = min - d;
        const mj = j.mass, mr = r.stats.mass * r.stats.push;
        r.x += nx * ov * mj / (mj + mr); r.z += nz * ov * mj / (mj + mr);
        j.x -= nx * ov * mr / (mj + mr); j.z -= nz * ov * mr / (mj + mr);
        const push = (r.vx * -nx + r.vz * -nz);
        if (push > 0) { j.vx += -nx * push * 0.15; j.vz += -nz * push * 0.15; r.vx *= 0.97; r.vz *= 0.97; }
      }
    }
    for (const c of this.hz.tires) {
      const ex = c.bx - c.ax, ez = c.bz - c.az;
      const t = Math.max(0, Math.min(1, ((r.x - c.ax) * ex + (r.z - c.az) * ez) / (ex * ex + ez * ez)));
      const px = c.ax + ex * t, pz = c.az + ez * t;
      const dx = r.x - px, dz = r.z - pz;
      const d = hyp(dx, dz) || 0.001;
      if (d < rad + c.r) hitWall(-dx / d, -dz / d, rad + c.r - d, true);
    }
  }

  pushOffCircle(r, p, hitWall) {
    const dx = r.x - p.x, dz = r.z - p.z;
    const d = hyp(dx, dz) || 0.001;
    if (d < r.stats.radius + p.r) hitWall(-dx / d, -dz / d, r.stats.radius + p.r - d);
  }

  constrainEdge(r) {
    const E = this.edgeZ;
    const rad = r.stats.radius * 0.5;
    const az = Math.abs(r.z);
    const side = Math.sign(r.z) || 1;
    const canFall = r.hp / r.stats.maxHp < 0.15;
    // A flipper launch can't throw you out by itself: you stop at the kerb, and the
    // edge rules start again once you're back on your wheels and can answer them.
    if (!r.overEdge && (r.flipPending || r.flipped > 0)) {
      if (az + rad >= E) {
        r.z = side * (E - rad);
        if (r.vz * side > 0) r.vz = 0;
        if (r.kbz * side > 0) r.kbz = 0;
      }
      r.teeter = 0;
      return;
    }
    if (r.overEdge || (r.y > 0.25 && canFall)) {
      if (az > E + 0.6) this.ringOut(r);
      return;
    }
    if (az + rad < E) {
      if (r.teeter > 0) { r.teeter = 0; r.teeterCool = 0.3; }
      return;
    }
    if (r.teeter > 0) {
      r.z = side * (E - rad);
      if (r.vz * side > 0) r.vz = 0;
      if (r.kbz * side > 0) r.kbz = 0;
      r.teeter -= DT;
      if (r.vz * side < -0.5) r.teeterRev += DT;
      if (r.teeterRev >= 0.6 || r.teeter <= 0) {
        r.teeter = 0; r.teeterCool = 0.8; r.teeterRev = 0;
        r.z = side * (E - rad - 0.3);
      }
      return;
    }
    const vout = (r.vz + r.kbz) * side;
    if (r.hp / r.stats.maxHp < 0.15 && vout > 1) { r.overEdge = true; return; }
    r.z = side * (E - rad);
    if (r.vz * side > 0) r.vz = 0;
    if (r.kbz * side > 0) r.kbz = 0;
    if (r.teeterCool <= 0 && vout > 1.5) {
      r.teeter = 1.2; r.teeterRev = 0;
      this.emit({ type: 'teeter', r: r.idx });
    }
  }

  goOver(r) {
    if (!this.edgeZ || r.hp / r.stats.maxHp >= 0.5 || r.flipPending || r.flipped > 0) return;
    r.overEdge = true; r.teeter = 0;
    const side = Math.sign(r.z) || 1;
    r.kbz = side * 3;
  }

  ringOut(r) {
    if (this.over) return;
    r.falling = true;
    r.hp = 0;
    this.finish(1 - r.idx, 'ringout');
  }

  updateJunk() {
    for (const j of this.hz.junk) {
      j.x += j.vx * DT; j.z += j.vz * DT;
      j.vx *= 0.94; j.vz *= 0.94;
      const lim = this.arena.w / 2 - j.r - 0.1;
      j.x = Math.max(-lim, Math.min(lim, j.x));
      j.z = Math.max(-lim, Math.min(lim, j.z));
    }
  }

  // ---- hazards --------------------------------------------------------
  hazardDamage(r, amt, kind, o = {}) {
    this.damage(null, r, amt * 2.5, { hazard: true, kind, noFacing: true, noMult: true, noCredit: true, ...o });
  }

  updateHazards() {
    const hz = this.hz;
    const t = this.t;
    if (hz.lava) {
      for (const r of this.robots) {
        if (r.stats.floorImmune || r.y > 0.3) continue;
        if (this.onLava(r.x, r.z)) {
          this.hazardDamage(r, 8 * DT, 'lava', { tick: true });
          r.slow = 0.6;
          r.burn = 3; r.burnDps = 3 * r.stats.hazardMult;
        }
      }
    }
    if (hz.jets) {
      for (const j of hz.jets) {
        const ph = (t + j.phase) % 9;
        const st = ph < 1.5 ? 'glow' : ph < 3.5 ? 'fire' : 'off';
        if (st !== j.st) { j.st = st; this.emit({ type: 'jet', jet: j, state: st }); }
        if (st === 'fire') for (const r of this.robots) {
          const dx = (r.x - j.x) * j.dx;
          if (dx > 0 && dx < 3 + r.stats.radius && Math.abs(r.z - j.z) < 1 + r.stats.radius * 0.6 && r.y < 1) {
            this.hazardDamage(r, 12 * DT, 'flame', { tick: true });
          }
        }
      }
    }
    if (hz.piston) {
      const p = hz.piston;
      p.t -= DT;
      if (p.t <= 0) {
        if (p.state === 'idle') {
          const ang = this.rng.next() * TAU, rad = Math.sqrt(this.rng.next()) * 7;
          p.x = Math.sin(ang) * rad; p.z = Math.cos(ang) * rad;
          // Half the drops home in on a robot's position when warned.
          if (this.rng.next() < 0.5) {
            const r = this.robots[this.rng.next() < 0.5 ? 0 : 1];
            const d = hyp(r.x, r.z);
            const lim = Math.min(d, 7.5) / (d || 1);
            p.x = r.x * lim; p.z = r.z * lim;
          }
          p.state = 'warn'; p.t = 1.5;
          this.emit({ type: 'piston', state: 'warn', x: p.x, z: p.z, r: 1.8, t: 1.5 });
        } else if (p.state === 'warn') {
          p.state = 'down'; p.t = 1;
          this.emit({ type: 'piston', state: 'slam', x: p.x, z: p.z, r: 1.8 });
          for (const r of this.robots) {
            if (hyp(r.x - p.x, r.z - p.z) < 1.8 + r.stats.radius * 0.5 && r.y < 1.5) {
              this.hazardDamage(r, 22, 'piston', { big: true });
              this.applyStun(r, 0.5);
              this.knock(r, r.x - p.x + 0.01, r.z - p.z, 4);
            }
          }
        } else {
          p.state = 'idle'; p.t = 6 - 2.5;
          this.emit({ type: 'piston', state: 'up', x: p.x, z: p.z, r: 1.8 });
        }
      }
    }
    if (hz.grid) {
      const g = hz.grid;
      const ph = t % 5;
      const st = ph < 2.75 ? 'idle' : ph < 4 ? 'warn' : 'live';
      if (st !== g.state) {
        g.state = st;
        if (st === 'warn') { g.pat = Math.floor(t / 5) % 4; g.hitDone = [false, false]; }
        this.emit({ type: 'grid', state: st, pat: g.pat });
      }
      if (st === 'live') {
        for (const r of this.robots) {
          if (r.stats.floorImmune || r.y > 0.3 || g.hitDone[r.idx]) continue;
          if (this.tileLive(r.x, r.z, g.pat)) {
            g.hitDone[r.idx] = true;
            this.hazardDamage(r, 14, 'tile', { big: false });
            this.applyStun(r, 0.4);
          }
        }
      }
    }
    if (hz.wind) {
      const w = hz.wind;
      w.t -= DT;
      if (w.t <= 0) {
        if (w.state === 'idle') { w.state = 'warn'; w.t = 1; w.dir = this.rng.next() < 0.5 ? -1 : 1; this.emit({ type: 'wind', state: 'warn', dir: w.dir }); }
        else if (w.state === 'warn') { w.state = 'gust'; w.t = 2.5; this.emit({ type: 'wind', state: 'gust', dir: w.dir }); }
        else { w.state = 'idle'; w.t = 6.5; this.emit({ type: 'wind', state: 'calm' }); }
      }
      if (w.state === 'gust') for (const r of this.robots) {
        if (r.y > 2) continue;
        r.kbz += w.dir * 3.5 * r.stats.windMult * DT;
      }
    }
    if (hz.saws) {
      const cycle = t % 8;
      for (const s of hz.saws) {
        s.a += (2 / 7) * DT;
        s.x = Math.sin(s.a) * 7; s.z = Math.cos(s.a) * 7;
        s.up = cycle < 6;
        if (s.up) for (const r of this.robots) {
          if (r.y > 0.4) continue;
          if (hyp(r.x - s.x, r.z - s.z) < s.r + r.stats.radius * 0.8) {
            this.hazardDamage(r, 15 * DT, 'saw', { tick: true });
            this.knock(r, r.x - s.x, r.z - s.z, 3 * DT * 4);
          }
        }
      }
      const sw = hz.swing;
      const ph = t % 8;
      const st = ph < 6 ? 'idle' : ph < 7 ? 'warn' : 'swing';
      if (st !== sw.state) {
        sw.state = st;
        sw.hit = [false, false];
        sw.dir = Math.floor(t / 8) % 2 ? 1 : -1;
        this.emit({ type: 'swinghammer', state: st, dir: sw.dir });
      }
      if (st === 'swing') {
        sw.x = sw.dir * ((ph - 7) * 2 - 1) * 10; // sweeps across along x
        for (const r of this.robots) {
          if (sw.hit[r.idx] || r.y > 1.2) continue;
          if (Math.abs(r.x - sw.x) < 1 + r.stats.radius * 0.6 && Math.abs(r.z) < 1.3) {
            sw.hit[r.idx] = true;
            this.hazardDamage(r, 30, 'hammer', { big: true });
            this.knock(r, sw.dir, 0.01, 10);
          }
        }
      }
      const pit = hz.pit;
      const rem = this.timer - t;
      if (!pit.warn && t >= pit.at - 3) { pit.warn = true; this.emit({ type: 'pit', state: 'warn' }); }
      if (!pit.open && t >= pit.at) { pit.open = true; this.emit({ type: 'pit', state: 'open' }); }
      if (pit.open) for (const r of this.robots) {
        if (r.y > 0.15) continue;
        const inside = hyp(r.x, r.z) < pit.r - r.stats.radius * 0.35;
        if (inside) {
          r.pitT = (r.pitT || 0) + DT;
          if (r.pitT > r.stats.pitGrace) {
            r.falling = true; r.hp = 0;
            this.finish(1 - r.idx, 'pit');
            return;
          }
        } else r.pitT = 0;
      }
      if (rem < 0) { /* the horn handles this */ }
    }
    if (this.boss && !this.phase2) {
      const s = this.robots[1];
      if (t >= 75 || s.hp / s.stats.maxHp <= 0.5) this.startPhase2(s);
    }
  }

  startPhase2(s) {
    this.phase2 = true;
    if (this.hz.pit) this.hz.pit.at = Math.min(this.hz.pit.at, this.t + 3);
    s.stats.armor = 0.05;
    s.stats.mass -= 10;
    s.topOverride = 'rail';
    s.topCd = 1;
    s.powerOverride = 'overdrive';
    s.pCd = 1;
    s.ammo = 0;
    this.emit({ type: 'phase2', r: s.idx });
  }

  onLava(x, z) {
    if (Math.abs(z) > 6 || Math.abs(z) < 1.2) return false;
    return Math.abs(Math.abs(x) - 4.5) < 0.8;
  }

  tileLive(x, z, pat) {
    const ix = Math.floor((x + 10) / 2), iz = Math.floor((z + 10) / 2);
    return tilePattern(ix, iz, pat);
  }

  // What's dangerous here soon? Used by the rival AI and the test bot.
  dangerAt(x, z, r, seeWarned) {
    let dg = 0;
    const hz = this.hz;
    const immune = r.stats.floorImmune;
    if (hz.lava && !immune && this.onLava(x, z)) dg += 2;
    if (hz.jets) for (const j of hz.jets) {
      if (j.st === 'fire' || (seeWarned && j.st === 'glow')) {
        const dx = (x - j.x) * j.dx;
        if (dx > 0 && dx < 3.6 && Math.abs(z - j.z) < 1.5) dg += 2;
      }
    }
    if (hz.piston && hz.piston.state === 'warn' && seeWarned && hyp(x - hz.piston.x, z - hz.piston.z) < 2.5) dg += 3;
    if (hz.grid && !immune && hz.grid.state !== 'idle' && (seeWarned || hz.grid.state === 'live')) {
      if (this.tileLive(x, z, hz.grid.pat)) dg += 2;
    }
    if (this.edgeZ && !r.overEdge) {
      const az = Math.abs(z);
      if (az > this.edgeZ - 1.6) dg += (az - (this.edgeZ - 1.6)) * 2;
    }
    if (hz.saws) {
      for (const s of hz.saws) if (s.up && hyp(x - s.x, z - s.z) < 1.8) dg += 2;
      if ((hz.swing.state === 'warn' || hz.swing.state === 'swing') && seeWarned && Math.abs(z) < 2) dg += 2;
      if ((hz.pit.open || (hz.pit.warn && seeWarned)) && hyp(x, z) < hz.pit.r + 0.6) dg += 5;
    }
    return dg;
  }

  // ---- housekeeping ---------------------------------------------------
  updateImmobile(r) {
    const moved = hyp(r.x - r.anchorX, r.z - r.anchorZ);
    if (moved > 0.3 || r.dealtMark !== r.dealt) {
      r.anchorX = r.x; r.anchorZ = r.z; r.anchorT = this.t; r.nudged = false; r.dealtMark = r.dealt;
    }
    const held = this.t - r.anchorT;
    r.immobileIn = 10 - held;
    if (held > 6 && !r.nudged) {
      r.nudged = true;
      const d = hyp(r.x, r.z) || 1;
      r.kbx -= r.x / d * 2; r.kbz -= r.z / d * 2;
    }
    if (held >= 10 && !this.over) {
      this.finish(1 - r.idx, 'immobile');
    }
  }

  updateStalemate() {
    this.noDamageT += DT;
    if (this.noDamageT > 20 && !this.stalemateWarned) { this.stalemateWarned = true; this.emit({ type: 'stalemate' }); }
    if (this.noDamageT > 25) {
      if (this.versus) {
        // Whoever's ahead can't just run out the clock: the leader drains.
        const [a, b] = this.robots;
        const fa = a.hp / a.stats.maxHp, fb = b.hp / b.stats.maxHp;
        if (fa >= fb) a.hp -= 6 * DT;
        if (fb >= fa) b.hp -= 6 * DT;
      } else for (const r of this.robots) { r.hp -= 6 * DT; r.taken += 0; }
    }
  }

  checkEnd() {
    if (this.over) return;
    const [a, b] = this.robots;
    if (a.hp <= 0 || b.hp <= 0) {
      if (a.hp <= 0 && b.hp <= 0 && this.versus) { this.finish(-1, 'draw'); return; }
      if (a.hp <= 0 && b.hp <= 0) { this.finish(a.dealt >= b.dealt ? 0 : 1, 'ko'); return; }
      const loser = a.hp <= 0 ? a : b;
      const cause = loser.lastHazard ? 'hazard' : 'ko';
      this.finish(1 - loser.idx, cause);
      return;
    }
    if (this.t >= this.timer) {
      if (this.versus) {
        // Decided by what the HUD shows: health left. Dead level is a draw.
        const fa = a.hp / a.stats.maxHp, fb = b.hp / b.stats.maxHp;
        if (Math.abs(fa - fb) < 0.005) this.finish(-1, 'draw');
        else this.finish(fa > fb ? 0 : 1, 'decision');
        return;
      }
      this.finish(a.dealt >= b.dealt ? 0 : 1, 'decision');
    }
  }

  finish(winner, cause) {
    if (this.over) return;
    this.over = true;
    this.result = { winner, cause, time: this.t, dealt: [this.robots[0].dealt, this.robots[1].dealt], taken: [this.robots[0].taken, this.robots[1].taken] };
    this.emit({ type: 'end', winner, cause });
  }

  // A short fingerprint of the fight, to prove a replay is the same fight.
  hash() {
    let h = 0x811c9dc5;
    const mix = (v) => { h ^= Math.round(v * 1000) | 0; h = Math.imul(h, 16777619) >>> 0; };
    for (const r of this.robots) { mix(r.x); mix(r.z); mix(r.h); mix(r.hp); mix(r.energy); }
    mix(this.tick);
    return h >>> 0;
  }
}

export function tilePattern(ix, iz, pat) {
  if (pat === 0) return iz % 2 === 0;
  if (pat === 1) return ix % 2 === 0;
  if (pat === 2) return (ix + iz) % 2 === 0;
  const dx = Math.abs(ix - 4.5), dz = Math.abs(iz - 4.5);
  const ring = Math.max(dx, dz);
  return ring > 1.5 && ring < 3.5;
}
