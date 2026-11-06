// Two players on one keyboard. A separate path from the career: nothing here
// reads the ladder's tuning or writes the save. No DOM or three.js, so the
// balance test runs on it in Node too.
import { PARTS, RIVALS, MK, HP_SCALE, ARENAS } from './catalog.js';
import { Fight } from './sim.js';

// Eight rivals' robots, one of each main weapon, all flattened to Mk II.
export const VS_ROSTER = [4, 7, 3, 5, 6, 8, 12, 15];
export const VS_ARENAS = ['pit', 'crucible', 'freeze', 'dome', 'rise', 'bowl'];
export const VS_BASE_HP = 900;
export const VS_GARAGE_HP = 2.25;

// Each robot's [health x, damage x], found by tools/versus.mjs.
export const VS_TUNE = {"3": [1.057, 0.921], "4": [1.214, 1.057], "5": [1.135, 0.987], "6": [0.811, 0.707], "7": [1.08, 0.939], "8": [1.03, 0.897], "12": [1.019, 0.885], "15": [1.136, 0.989]};

const SLOTS6 = ['chassis', 'drive', 'main', 'top', 'power', 'armor'];

export function rosterBuild(n) {
  const b = { chips: [] };
  for (const sl of SLOTS6) {
    const p = RIVALS[n - 1].build[sl];
    b[sl] = p ? { id: p.id, mk: 2 } : null;
  }
  // Treads and a short saw can't catch anyone in an open fight.
  if (n === 4) b.drive = { id: 'spikewheels', mk: 2 };
  return b;
}

// choice: a rival number, or 'garage'.
export function versusSpec(choice, garageBuild, tag) {
  if (choice === 'garage') {
    return { name: tag, build: garageBuild, hpMult: VS_GARAGE_HP, dmgMult: 1 };
  }
  const build = rosterBuild(choice);
  const ch = PARTS[build.chassis.id];
  const [hp, dmg] = VS_TUNE[choice];
  return { name: RIVALS[choice - 1].name, build, hpMult: (VS_BASE_HP * hp) / (ch.hp * HP_SCALE * MK.chassis[2]), dmgMult: dmg };
}

export function setupVersus({ a, b, arena, seed, garageBuild, garageName = 'Your robot' }) {
  return new Fight({
    player: versusSpec(a, garageBuild, garageName),
    rival: versusSpec(b, garageBuild, garageName),
    arena,
    seed,
    timer: 120,
    hazardLeague: 6,
    versus: true,
    aimAssist: [true, true],
  });
}

export const arenaName = (id) => ARENAS[id].name;
