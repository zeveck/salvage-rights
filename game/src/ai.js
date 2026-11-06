// Rival drivers. They use the same input a player does, delayed by reaction
// time and with aim error. The test bot in tools/ uses this too, with human
// limits, so it proves what a person could do.
import { PARTS } from './catalog.js';
import { DT, angleDiff, Rng, hyp } from './sim.js';


// How to use each main weapon.
const PROFILE = {
  ram: { approach: 2.5, tap: true, charge: true },
  drum: { approach: 0.5, hold: true, spin: true },
  saw: { approach: 0.4, hold: true },
  hammer: { approach: 1.5, tap: true },
  flipper: { approach: 0.7, tap: true },
  drill: { approach: 1.0, hold: true },
  flame: { approach: 2.2, hold: true, heat: true },
  arc: { approach: 2.2, tap: true },
  rail: { approach: 7, tap: true, far: true },
};

export class Driver {
  constructor(fight, idx, persona, seed) {
    this.f = fight; this.idx = idx; this.p = persona;
    this.rng = new Rng(seed);
    this.state = 'approach';
    this.nextThink = 0;
    this.input = { mx: 0, mz: 0, fire: false, firePressed: false, top: false, topPressed: false, powerPressed: false, lock: false };
    this.desired = { x: 0, z: 0 };
    this.aimErr = 0;
    this.flank = false;
    this.flankSide = 1;
    this.retreatUntil = 0;
    this.stuckT = 0; this.reverseT = 0;
    this.lastX = 0; this.lastZ = 0; this.moveCheck = 0;
    this.hazardPush = false;
    this.fireLatched = false;
    this.lastHp = Infinity;
  }

  // Read the situation at reaction speed, drive every tick.
  update() {
    const f = this.f;
    const me = f.robots[this.idx], foe = f.robots[1 - this.idx];
    const inp = this.input;
    inp.firePressed = false; inp.topPressed = false; inp.powerPressed = false;
    if (f.t >= this.nextThink) {
      this.think(me, foe);
      this.nextThink = f.t + (this.p.react / 1000) * (0.8 + this.rng.next() * 0.4);
    }
    this.steer(me, foe);
    this.useWeapons(me, foe);
    return inp;
  }

  mainId(me) { return me.build.main ? me.build.main.id : null; }

  think(me, foe) {
    const f = this.f;
    this.aimErr = (this.rng.next() - 0.5) * 2 * this.p.aim * Math.PI / 180;
    const pid = this.mainId(me);
    const prof = PROFILE[pid] || PROFILE.ram;
    const d = hyp(foe.x - me.x, foe.z - me.z) - me.stats.radius - foe.stats.radius;

    if (this.rng.next() < 0.35 && f.hazardLeague >= 3 && this.p.aggr > 0.5) {
      this.flank = this.rng.next() < 0.5;
      this.flankSide = this.rng.next() < 0.5 ? -1 : 1;
    }
    // Retreat after being hit hard, or to wait for a cooldown, or to spin back up.
    const wantRetreat = (me.wCd > 1 && d < 2.5 && this.rng.next() > this.p.aggr * 0.8)
      || (pid === 'drum' && me.rpm < 0.45 && d < 2.5)
      || (pid === 'flame' && me.lockout > 0)
      || (prof.far && d < 4);
    if (wantRetreat) { this.state = 'retreat'; this.retreatUntil = f.t + 0.6 + this.rng.next() * 0.8; }
    else if (f.t >= this.retreatUntil) this.state = 'approach';

    // Hazard use: if the rival is near a hazard or edge, push them at it.
    this.hazardPush = false;
    if (this.p.hazard > 0 && this.rng.next() < this.p.hazard) {
      if (f.edgeZ && Math.abs(foe.z) > f.edgeZ - 4) this.hazardPush = true;
      if (f.hz.pit && f.hz.pit.open && hyp(foe.x, foe.z) < f.hz.pit.r + 4) this.hazardPush = true;
    }

    // Choose a place to go.
    let tx = foe.x, tz = foe.z;
    const dx = me.x - foe.x, dz = me.z - foe.z;
    const dist = hyp(dx, dz) || 1;
    if (this.state === 'retreat') {
      const want = 4 + this.rng.next();
      tx = foe.x + dx / dist * (want + me.stats.radius + foe.stats.radius);
      tz = foe.z + dz / dist * (want + me.stats.radius + foe.stats.radius);
    } else if (this.flank) {
      // Aim behind them, and curve round the side.
      const bx = foe.x - Math.sin(foe.h) * 1.5, bz = foe.z - Math.cos(foe.h) * 1.5;
      const sx = -dz / dist * this.flankSide * 1.5, sz = dx / dist * this.flankSide * 1.5;
      tx = bx + sx; tz = bz + sz;
      if (d < 1) { tx = foe.x; tz = foe.z; }
    } else if (this.hazardPush) {
      // Come from the far side so hits drive them toward the hazard.
      let hx = 0, hz = 0;
      if (f.edgeZ) hz = Math.sign(foe.z) * f.edgeZ;
      const hl = hyp(hx - foe.x, hz - foe.z) || 1;
      if (!f.hz.pit) {
        tx = foe.x - (hx - foe.x) / hl * 1.5; tz = foe.z - (hz - foe.z) / hl * 1.5;
        if (d < 1) { tx = foe.x; tz = foe.z; }
      }
    } else if (prof.charge && d < 3 && me.wCd > 0.2) {
      // Rams back off to take a run at it.
      tx = foe.x + dx / dist * 5; tz = foe.z + dz / dist * 5;
    } else if (prof.far) {
      // Hold at range and strafe a bit.
      const want = prof.approach;
      const side = Math.sin(f.t * 0.7 + this.idx) * 3;
      tx = foe.x + dx / dist * want - dz / dist * side;
      tz = foe.z + dz / dist * want + dx / dist * side;
    }
    this.desired.x = tx; this.desired.z = tz;
  }

  // Local planner: try directions round the wanted one; pick the safest good one.
  steer(me, foe) {
    const f = this.f;
    const inp = this.input;
    const seeWarned = f.hazardLeague >= 3 || this.p.seeWarned;
    let ax = this.desired.x - me.x, az = this.desired.z - me.z;
    const dd = hyp(ax, az);
    if (me.flipped > 0 || me.stun > 0) { inp.mx = 0; inp.mz = 0; return; }
    // Stuck?
    this.moveCheck += DT;
    if (this.moveCheck > 1) {
      const moved = hyp(me.x - this.lastX, me.z - this.lastZ);
      if (moved < 0.2 && dd > 0.8) this.reverseT = 0.6;
      this.lastX = me.x; this.lastZ = me.z; this.moveCheck = 0;
    }
    if (this.reverseT > 0) {
      this.reverseT -= DT;
      inp.mx = -Math.sin(me.h + 1.2); inp.mz = -Math.cos(me.h + 1.2);
      inp.lock = false;
      return;
    }
    // Melee: when close, face the rival, with aim error.
    const toFoe = Math.atan2(foe.x - me.x, foe.z - me.z) + this.aimErr;
    const dFoe = hyp(foe.x - me.x, foe.z - me.z) - me.stats.radius - foe.stats.radius;
    let base = dd > 0.05 ? Math.atan2(ax, az) : toFoe;
    const pid = this.mainId(me);
    const prof = PROFILE[pid] || PROFILE.ram;
    const attack = this.state === 'approach' && !this.flank;
    if (attack && dFoe < prof.approach + 1.5) base = toFoe;
    if (this.flank && dFoe < 1) base = toFoe;

    let best = base, bestScore = -Infinity;
    const danger = (a, dist) => {
      const x = me.x + Math.sin(a) * dist, z = me.z + Math.cos(a) * dist;
      let g = f.dangerAt(x, z, me, seeWarned);
      const lim = (f.arena.w / 2) - me.stats.radius;
      if (f.circleR && hyp(x, z) > f.circleR - me.stats.radius - 0.4) g += 1;
      else if (!f.circleR && (Math.abs(x) > lim - 0.4)) g += 1;
      return g;
    };
    const here = f.dangerAt(me.x, me.z, me, seeWarned);
    for (let i = 0; i < 12; i++) {
      const off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6);
      const a = base + off;
      const score = -Math.abs(off) * 0.6 - danger(a, 1.2) * 2 - danger(a, 2.4) * 1.2;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    if (here <= 0 && danger(base, 1.2) + danger(base, 2.4) <= 0) best = base;
    let mag = 1;
    // From league 3: while a weapon reloads, circle the rival instead of trading blows.
    if (f.hazardLeague >= 3 && attack && dFoe < 2.6 && me.wCd > 0.25) {
      best = toFoe + this.flankSide * 1.45;
    }
    // Stop short at the attack range so the weapon can land.
    if (attack && dFoe < prof.approach * 0.5 && !prof.charge && pid !== 'drum' && pid !== 'saw') mag = 0.1;
    inp.mx = Math.sin(best) * mag;
    inp.mz = Math.cos(best) * mag;
    // Hold facing for range and cone weapons.
    inp.lock = (prof.far || pid === 'flame' || pid === 'arc') && dFoe < 8;
  }

  useWeapons(me, foe) {
    const f = this.f, inp = this.input;
    if (me.flipped > 0 || me.stun > 0) { inp.fire = false; inp.top = false; return; }
    const pid = this.mainId(me);
    const w = pid ? PARTS[pid] : null;
    const d = hyp(foe.x - me.x, foe.z - me.z) - me.stats.radius - foe.stats.radius;
    const a = Math.atan2(foe.x - me.x, foe.z - me.z);
    const off = Math.abs(angleDiff(me.h, a));
    if (w) {
      const inArc = off <= (w.arc || 10) * Math.PI / 360 + 0.25;
      switch (pid) {
        case 'ram': if (me.wCd <= 0 && d < 2.0 && inArc && me.speedNow > 1.5) inp.firePressed = true; break;
        case 'drum': inp.fire = d < 7; break;
        case 'saw': case 'drill': inp.fire = d < w.range + 0.8 && inArc; break;
        case 'hammer': case 'flipper': {
          if (me.wCd <= 0 && me.wWind <= 0 && d < w.range + 0.1 && inArc && foe.y < 0.3) inp.firePressed = true;
          break;
        }
        case 'flame': inp.fire = d < w.range && inArc && me.heat < 0.92 + 0.08 * this.p.aggr; break;
        case 'arc': if (me.wCd <= 0 && d < w.range && inArc) inp.firePressed = true; break;
        case 'rail': if (me.wCd <= 0 && me.wWind <= 0 && off < 0.08 + this.p.aim * Math.PI / 720) inp.firePressed = true; break;
        default: break;
      }
    }
    // Top mount.
    const topId = me.topOverride || (me.build.top && me.build.top.id);
    if (topId) {
      const duty = 0.25 + this.p.aggr * 0.5;
      if (topId === 'autocannon') {
        inp.top = d < 8 && off < 0.8 && me.ammo > 0 && Math.sin(f.t * 1.3 + this.idx) > 1 - duty * 2;
      } else if (topId === 'rockets') {
        if (d < 8 && d > 1 && off < 0.7 && me.topCd <= 0 && me.ammo > 0 && this.rng.next() < duty * 0.05) inp.topPressed = true;
      } else if (topId === 'mines') {
        if (me.topCd <= 0 && me.ammo > 0 && d < 5 && off > 1.2 && this.rng.next() < duty * 0.05) inp.topPressed = true;
      } else if (topId === 'rail') {
        if (me.topCd <= 0 && me.topWind <= 0 && off < 0.2) inp.topPressed = true;
      }
    }
    // Power.
    const pow = f.powerId(me);
    if (pow && me.pCd <= 0 && me.energy >= PARTS[pow].energy) {
      const foeWinding = foe.wWind > 0;
      if (pow === 'shield' && foeWinding && d < 4) inp.powerPressed = true;
      else if (pow === 'overdrive' && this.state === 'approach' && d > 5) inp.powerPressed = true;
      else if (pow === 'emp' && d < 3.5 && foe.stunImmune <= 0) inp.powerPressed = true;
      else if (pow === 'repair' && me.hp / me.stats.maxHp < 0.4 && me.repairUses > 0) inp.powerPressed = true;
      else if (pow === 'jets' && ((foeWinding && foe.build.main && foe.build.main.id === 'flipper' && d < 3) || (d < 3 && d > 1 && this.rng.next() < 0.02 * this.p.aggr))) inp.powerPressed = true;
    }
  }
}
