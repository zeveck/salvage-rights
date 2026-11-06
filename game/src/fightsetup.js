// Sets up a Fight and its rival driver for a ladder position. Used by the
// game and by the headless test bot.
import { RIVALS, LEAGUES, computeStats } from './catalog.js';
import { Fight } from './sim.js';
import { Driver } from './ai.js';

// Per-rival tuning, from tools/simtest.mjs: [health x, damage x].
// Found by tools/autotune.mjs.
// Found by tools/autotune.mjs and tools/floortune.mjs, then nudged by hand.
export const TUNE = [null, [0.6, 0.18], [0.884, 0.291], [1.39, 0.255], [2.124, 0.271], [1.888, 0.27], [1.2, 0.182], [1.8, 0.252], [2.1, 0.229], [1.442, 0.452], [1.964, 0.8], [1.442, 0.395], [1.2, 0.36], [2.2, 0.414], [1.775, 0.327], [1.599, 0.432], [1.93, 0.409], [1.15, 0.7], [1.919, 0.275]];

export function rivalSpec(n, playerBuild, ringerBuild, ngBump) {
  const riv = RIVALS[n - 1];
  const build = riv.mirror ? JSON.parse(JSON.stringify(ringerBuild || playerBuild)) : { ...riv.build, chips: riv.chips || [] };
  const [hpMult, dmgMult] = TUNE[n];
  if (ngBump && !riv.mirror) for (const sl of ['chassis', 'drive', 'main', 'top', 'power', 'armor']) if (build[sl]) build[sl] = { id: build[sl].id, mk: Math.min(3, build[sl].mk + 1) };
  return { name: riv.name, build, hpMult, dmgMult };
}

export function setupFight({ n, playerBuild, playerName = 'You', seed, assist = 'normal', ringerBuild, ng = 0 }) {
  const riv = RIVALS[n - 1];
  const league = LEAGUES[riv.league - 1];
  const fight = new Fight({
    player: { name: playerName, build: playerBuild },
    rival: rivalSpec(n, playerBuild, ringerBuild, ng),
    arena: league.arena,
    seed,
    assist,
    timer: riv.timer || 120,
    boss: !!riv.boss,
    hazardLeague: riv.league,
  });
  const persona = { ...riv.ai };
  if (assist === 'easy') { persona.react *= 1.4; persona.aim *= 1.3; }
  if (assist === 'hard') { persona.react *= 0.8; persona.aim *= 0.8; }
  if (ng) persona.react *= 0.85;
  const driver = new Driver(fight, 1, persona, seed ^ 0x5a5a5a);
  return { fight, driver, rival: riv };
}
