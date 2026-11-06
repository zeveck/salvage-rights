// All the game's data. No DOM, three.js or assets here: the fight sim and the
// test bot run on this in Node as well as in the browser.

// Robots are tough: fights should last a minute or two, not seconds.
export const HP_SCALE = 4;
export const SLOTS = ['chassis', 'drive', 'main', 'top', 'power', 'armor'];
export const SLOT_NAMES = {
  chassis: 'Chassis', drive: 'Drive', main: 'Main weapon', top: 'Top mount', power: 'Power', armor: 'Armor',
};

// Mk scaling. Index is Mk (1, 2, 3).
export const MK = { chassis: [0, 1, 1.1, 1.2], drive: [0, 1, 1.06, 1.12], main: [0, 1, 1.2, 1.4], top: [0, 1, 1.2, 1.4], power: [0, 1, 1.2, 1.4], armor: [0, 1, 1.2, 1.4] };
export const MK_NAMES = ['', 'Mk I', 'Mk II', 'Mk III'];
export const VALUE_FACTOR = [0, 1, 1.6, 2.0];

export const PARTS = {
  // Chassis
  crate: { slot: 'chassis', name: 'Crate Mule', hp: 100, cap: 30, armor: 0, weight: 20, radius: 0.75, price: 60, desc: 'A steel crate with ideas above its station.', accel: 1, speedF: 1, chips: 2 },
  wedge: { slot: 'chassis', name: 'Doorstop', hp: 110, cap: 35, speedF: 1.05, armor: 0, weight: 22, radius: 0.80, price: 220, desc: 'Low wedge. Hits on its front do 15% less.', frontGuard: 0.15, accel: 1, chips: 2 },
  scarab: { slot: 'chassis', name: 'Scarab', hp: 130, cap: 42, speedF: 0.97, armor: 10, weight: 28, radius: 0.85, price: 520, desc: 'Domed shell that shrugs off glancing blows.', accel: 1, chips: 2 },
  bulwark: { slot: 'chassis', name: 'Bulwark', hp: 170, cap: 50, speedF: 0.88, armor: 5, weight: 40, radius: 1.0, price: 980, desc: 'A rolling slab. Slow to get going.', accel: 0.85, chips: 2 },
  sovereign: { slot: 'chassis', name: 'Sovereign', hp: 200, cap: 60, speedF: 0.92, armor: 5, weight: 45, radius: 1.1, price: 1900, desc: "The champion's frame. Has a third chip slot.", accel: 1, chips: 3 },
  // Drive
  scrapwheels: { slot: 'drive', name: 'Scrap Wheels', speed: 5, turn: 200, accel: 7, grip: 0.6, kbResist: 0, weight: 8, price: 40, iceGrip: 0.35, desc: 'Four wheels of doubtful origin.' },
  spikewheels: { slot: 'drive', name: 'Spike Wheels', speed: 6, turn: 220, accel: 9, grip: 0.85, kbResist: 0, weight: 9, price: 260, iceGrip: 0.8, ramBonus: 1.2, desc: 'Fast, and they bite on ice. Ram damage +20%.' },
  treads: { slot: 'drive', name: 'Grinder Treads', speed: 3.8, turn: 130, accel: 8, grip: 1, kbResist: 0.4, weight: 16, price: 640, iceGrip: 0.6, pivots: true, push: 1.6, lockSpeed: 0.6, desc: 'Slow, pivots on the spot, shoves hard.' },
  legs: { slot: 'drive', name: 'Strider Legs', speed: 4.5, turn: 300, accel: 7, grip: 0.9, kbResist: 0.1, weight: 12, price: 900, iceGrip: 0.7, floorImmune: true, desc: 'Four legs. Steps over lava and charged tiles.' },
  hover: { slot: 'drive', name: 'Hover Pods', speed: 7, turn: 180, accel: 6, grip: 0.25, kbResist: -0.3, weight: 6, price: 1100, iceGrip: 1, floorImmune: true, pitGrace: 1, windMult: 1.5, lockSpeed: 0.7, desc: 'Fastest there is, drifts, floats over the floor.' },
  // Main weapons
  ram: { slot: 'main', name: 'Bumper Ram', use: 'tap', damage: 11, speedDamage: 2.2, range: 1.0, arc: 70, windup: 0, cooldown: 0.9, kb: 5, weight: 6, price: 40, lunge: 4, lungeTime: 0.25, desc: 'Tap to lunge. Harder at speed.' },
  drum: { slot: 'main', name: 'Drum Spinner', use: 'hold', damage: 30, range: 0.75, arc: 50, spinup: 1.2, minRpm: 0.3, rpmCost: 0.6, kb: 7, pop: 0.35, recoil: 4, weight: 14, price: 700, desc: 'Hold to spin up. Each hit throws them and costs you RPM.' },
  saw: { slot: 'main', name: 'Buzz Saw', use: 'hold', dps: 34, range: 0.85, arc: 60, windup: 0.2, kbTick: 0.3, selfSpeed: 0.9, weight: 8, price: 300, desc: 'Hold and grind. Showers of sparks.' },
  hammer: { slot: 'main', name: 'Sledge', use: 'tap', damage: 42, range: 1.6, arc: 50, windup: 0.4, cooldown: 1.1, kb: 3, weight: 12, price: 420, desc: 'A long overhead swing that really lands.' },
  flipper: { slot: 'main', name: 'Lift Flipper', use: 'tap', damage: 26, range: 1.1, arc: 60, windup: 0.15, cooldown: 1.8, kb: 7, launch: 6, landing: 18, weight: 10, price: 480, desc: 'Launches them high and lands them on their back.' },
  drill: { slot: 'main', name: 'Drill Lance', use: 'hold', dps: 30, range: 1.5, arc: 18, windup: 0.3, ignoreArmor: true, selfSpeed: 0.7, kb: 0, weight: 9, price: 560, desc: 'Hold to extend. Narrow, but ignores armor.' },
  flame: { slot: 'main', name: 'Flame Projector', use: 'hold', dps: 18, burn: 10, burnTime: 3, range: 3.0, arc: 35, heat: 4, lockout: 2, cool: 0.25, weight: 7, price: 520, desc: 'Hold to burn. Watch the heat gauge.' },
  arc: { slot: 'main', name: 'Arc Coil', use: 'tap', damage: 26, range: 3.0, arc: 120, windup: 0, cooldown: 1.4, kb: 2, stun: 0.4, weight: 7, price: 620, desc: 'Lightning that barely needs aiming. Stuns briefly.' },
  rail: { slot: 'main', name: 'Rail Cannon', use: 'tap', damage: 46, range: 14, beam: 0.3, windup: 0.6, cooldown: 2.6, kb: 8, recoil: 6, weight: 15, price: 1200, desc: 'Charge, then one long straight shot.' },
  // Top mounts
  autocannon: { slot: 'top', name: 'Autocannon', hold: true, damage: 2.5, ammo: 60, rate: 5, range: 9, arc: 90, kb: 0.2, weight: 8, price: 540, desc: 'Turret that aims itself. Hold to fire.' },
  rockets: { slot: 'top', name: 'Rocket Pod', damage: 18, ammo: 4, rate: 1, speed: 9, homing: 60, splash: 2, kb: 6, weight: 9, price: 640, desc: 'Four homing rockets with splash.' },
  mines: { slot: 'top', name: 'Mine Rack', damage: 20, ammo: 5, rate: 1, trigger: 1.2, arm: 1, kb: 7, weight: 7, price: 380, desc: 'Drops five mines behind you.' },
  // Powers
  shield: { slot: 'power', name: 'Aegis Field', energy: 35, cooldown: 4, duration: 1.5, block: 0.8, weight: 4, price: 500, desc: 'A bubble that blocks most damage and throws back knockback.' },
  overdrive: { slot: 'power', name: 'Overdrive', energy: 45, cooldown: 6, duration: 3, speed: 1.5, damage: 1.25, weight: 5, price: 460, desc: 'Thrusters on: +50% speed, +25% damage.' },
  emp: { slot: 'power', name: 'Pulse EMP', energy: 60, cooldown: 8, radius: 4, kb: 8, stun: 1, weight: 4, price: 720, desc: 'A shove and a stun in a wide ring.' },
  repair: { slot: 'power', name: 'Nanite Tank', energy: 70, cooldown: 12, heal: 0.15, duration: 3, uses: 3, weight: 5, price: 640, desc: 'Restores health over 3 seconds. Three uses a fight.' },
  jets: { slot: 'power', name: 'Jump Jets', energy: 30, cooldown: 3, height: 2, air: 0.9, damage: 18, stompRadius: 1.2, weight: 6, price: 420, desc: 'Hop over trouble, and land on the rival for damage.' },
  // Armor
  plates: { slot: 'armor', name: 'Riveted Plates', reduce: 0.15, weight: 10, price: 360, desc: 'Plain heavy steel. 15% less damage.' },
  spikes: { slot: 'armor', name: 'Spike Skirt', reduce: 0.08, contact: 6, weight: 6, price: 440, desc: '8% less damage, and it hurts to touch.' },
};
for (const id in PARTS) PARTS[id].id = id;

export const CHIPS = {
  scavenger: { name: 'Scavenger', desc: '+25% scrap from fights', league: 2, price: 300 },
  coolant: { name: 'Coolant Loop', desc: 'Energy recharges 30% faster', league: 3, price: 450, drop: 12 },
  frame: { name: 'Reinforced Frame', desc: '+15% health', league: 3, price: 600, drop: 3 },
  overclock: { name: 'Overclock', desc: 'Weapon cooldowns 15% shorter', league: 4, price: 700 },
  hazard: { name: 'Hazard Plating', desc: 'Arena hazards do half damage', league: 4, price: 500, drop: 6 },
  gyro: { name: 'Gyro Stabilizer', desc: 'Recover from flips 50% faster, knockback -20%', league: 5, price: 500, drop: 9 },
  ammo: { name: 'Ammo Feed', desc: '+50% top mount ammo', league: 5, price: 450 },
  momentum: { name: 'Momentum Driver', desc: 'Damage +20% above 60% speed', league: 6, price: 900, drop: 15 },
};
for (const id in CHIPS) CHIPS[id].id = id;

export const STARTER_BUILD = {
  chassis: { id: 'crate', mk: 1 }, drive: { id: 'scrapwheels', mk: 1 }, main: { id: 'ram', mk: 1 },
  top: null, power: null, armor: null, chips: [],
};
export const DEFAULT_PAINT = { c1: '#ff6a13', c2: '#1fd6c2', pattern: 'solid', finish: 'gloss' };

export const LEAGUES = [
  { id: 1, name: 'Junkyard League', arena: 'pit', rank: 'Scrapper', win: 120, champ: 240 },
  { id: 2, name: 'Foundry League', arena: 'crucible', rank: 'Mechanic', win: 180, champ: 360 },
  { id: 3, name: 'Cryo League', arena: 'freeze', rank: 'Operator', win: 260, champ: 520 },
  { id: 4, name: 'Voltage League', arena: 'dome', rank: 'Specialist', win: 360, champ: 720 },
  { id: 5, name: 'Skyline League', arena: 'rise', rank: 'Contender', win: 480, champ: 960 },
  { id: 6, name: 'Grand Circuit', arena: 'bowl', rank: 'Champion', win: 650, champ: 1300 },
];

// League a part goes on sale from.
export const STOCK = {
  crate: 1, scrapwheels: 1, ram: 1, spikewheels: 1, saw: 1, plates: 1,
  wedge: 2, hammer: 2, flipper: 2, autocannon: 2, spikes: 2,
  scarab: 3, treads: 3, drum: 3, flame: 3, mines: 3, rockets: 3, overdrive: 3, repair: 3,
  bulwark: 4, legs: 4, arc: 4, shield: 4, jets: 4,
  hover: 5, drill: 5, emp: 5,
  sovereign: 6, rail: 6,
};

export const ARENAS = {
  pit: { name: 'The Scrap Pit', shape: 'roundsquare', w: 16, d: 16, color: '#ffb066', ambient: '#a08270', sky: '#2c2118' },
  crucible: { name: 'The Crucible', shape: 'rect', w: 18, d: 16, color: '#ff5a1f', ambient: '#8fb0d0', sky: '#1d0f0a' },
  freeze: { name: 'The Deep Freeze', shape: 'circle', w: 20, d: 20, color: '#9fd8ff', ambient: '#7f9fb8', sky: '#0d1a24', ice: true },
  dome: { name: 'The Arc Dome', shape: 'octagon', w: 20, d: 20, color: '#b88cff', ambient: '#6f6a92', sky: '#120c22' },
  rise: { name: 'The High Rise', shape: 'rect', w: 22, d: 14, color: '#ffd9a8', ambient: '#c7a58e', sky: '#3a2738', openSides: true },
  bowl: { name: 'The Sovereign Bowl', shape: 'circle', w: 22, d: 22, color: '#ffd166', ambient: '#a59a78', sky: '#141014' },
};

// r(id, mk): shorthand for a rival's part.
const r = (id, mk = 1) => (id ? { id, mk } : null);
const rival = (o) => o;

export const RIVALS = [
  rival({ n: 1, name: 'Bent Fender', driver: 'Wes Tolliver', league: 1, build: { chassis: r('crate'), drive: r('spikewheels'), main: r('saw'), top: null, power: null, armor: r('plates') }, ai: { react: 900, aim: 25, aggr: 0.15, hazard: 0 }, paint: { c1: '#8a6d4f', c2: '#d9d2c3', pattern: 'solid', finish: 'matte' }, talk: 'Go easy, she only turns left.', hint: 'Its saw barely spins. Get up to speed and ram it.', tip: 'Build speed before you hit.' }),
  rival({ n: 2, name: 'Tin Terror', driver: 'Posy Okafor', league: 1, build: { chassis: r('wedge'), drive: r('scrapwheels'), main: r('flipper'), top: null, power: null, armor: r('spikes') }, ai: { react: 650, aim: 18, aggr: 0.4, hazard: 0 }, paint: { c1: '#c9ced6', c2: '#e0483e', pattern: 'stripes', finish: 'metallic' }, talk: "I flip burgers on weekends. You're lighter.", hint: 'Long flipper reload. Hit just after it fires.', tip: 'Wait for the flip, then go.' }),
  rival({ n: 3, name: "Mabel's Mallet", driver: 'Big Mabel Dunn', league: 1, champ: true, portrait: 'mabel', build: { chassis: r('wedge'), drive: r('spikewheels'), main: r('hammer'), top: r('autocannon'), power: null, armor: r('plates') }, ai: { react: 500, aim: 14, aggr: 0.55, hazard: 0.1 }, paint: { c1: '#d94f8a', c2: '#2b2b33', pattern: 'solid', finish: 'gloss' }, talk: "Sit still, sweetheart. This'll only dent.", hint: 'Watch the red arc, step aside, then hit back.', tip: 'Dodge the red arc on the floor, then punish.' }),
  rival({ n: 4, name: 'Slagheap', driver: 'Ivo Brandt', league: 2, build: { chassis: r('crate'), drive: r('treads'), main: r('saw'), top: r('mines'), power: null, armor: r('spikes') }, ai: { react: 500, aim: 14, aggr: 0.5, hazard: 0.1 }, paint: { c1: '#5a5f52', c2: '#d58a1d', pattern: 'camo', finish: 'matte' }, talk: "Slow's fine. You still have to come to me.", hint: 'Treads are slow. Circle it and hit the rear.', tip: 'Hits on the rear do 25% more.' }),
  rival({ n: 5, name: 'Hotfoot', driver: 'Reina Salas', league: 2, build: { chassis: r('wedge'), drive: r('spikewheels'), main: r('flame'), top: r('rockets'), power: r('overdrive'), armor: r('spikes') }, ai: { react: 450, aim: 12, aggr: 0.6, hazard: 0.2 }, paint: { c1: '#e0301e', c2: '#ffc21a', pattern: 'flames', finish: 'gloss' }, talk: "Hope your paint's fireproof.", hint: 'The flame overheats after 4 s. Back off, then pounce.', tip: 'Stay out of the flame until it overheats.' }),
  rival({ n: 6, name: 'Forgemaster', driver: 'Otto Kessler', league: 2, champ: true, portrait: 'otto', build: { chassis: r('scarab'), drive: r('treads'), main: r('drum', 2), top: r('autocannon'), power: r('repair'), armor: r('plates') }, ai: { react: 420, aim: 10, aggr: 0.55, hazard: 0.3 }, paint: { c1: '#3c3f46', c2: '#ff7a1a', pattern: 'solid', finish: 'metallic' }, talk: "I've melted better than you for scrap.", hint: 'Hit it right after its big hit, while the drum is slow.', tip: 'A drum is weak just after it lands a hit.' }),
  rival({ n: 7, name: 'Sideslip', driver: 'Juno Park', league: 3, build: { chassis: r('wedge'), drive: r('spikewheels', 2), main: r('flipper', 2), top: r('mines'), power: r('jets'), armor: r('plates') }, ai: { react: 400, aim: 10, aggr: 0.6, hazard: 0.5 }, paint: { c1: '#3ac0e8', c2: '#f2f6fa', pattern: 'stripes', finish: 'gloss' }, talk: "Ice is only slippery if you're bad at it.", hint: 'It wants to flip you under a piston. Watch the rings.', tip: 'Red rings mean a piston is about to drop.' }),
  rival({ n: 8, name: 'Permafrost', driver: 'Sten Aalto', league: 3, build: { chassis: r('scarab'), drive: r('legs'), main: r('arc', 2), top: r('autocannon'), power: r('shield'), armor: r('spikes') }, ai: { react: 380, aim: 9, aggr: 0.55, hazard: 0.4 }, paint: { c1: '#e8f4ff', c2: '#4a8fd6', pattern: 'checker', finish: 'gloss' }, talk: 'Stand still. For science.', hint: 'Its arc reaches only 3 m. Stay out or rush it after a zap.', tip: 'Rush in right after a zap.' }),
  rival({ n: 9, name: 'Glacier', driver: 'Hilde Varg', league: 3, champ: true, portrait: 'hilde', build: { chassis: r('bulwark'), drive: r('treads', 2), main: r('hammer', 2), top: r('rockets', 2), power: r('repair'), armor: r('plates', 2) }, ai: { react: 350, aim: 8, aggr: 0.6, hazard: 0.5 }, paint: { c1: '#6fb7dd', c2: '#17324d', pattern: 'camo', finish: 'matte' }, talk: 'Nobody has ever hurried me.', hint: 'Too heavy to stop on ice. Let it slide past; strike the rear.', tip: 'Get behind it while it is sliding.' }),
  rival({ n: 10, name: 'Static', driver: 'Tomas Reyes', league: 4, build: { chassis: r('scarab'), drive: r('spikewheels', 2), main: r('saw', 2), top: r('autocannon', 2), power: r('overdrive'), armor: r('plates') }, ai: { react: 340, aim: 8, aggr: 0.65, hazard: 0.5 }, paint: { c1: '#2f2a4a', c2: '#f5e642', pattern: 'carbon', finish: 'gloss' }, talk: "You'll hear me coming. Then nothing.", hint: "60 rounds, then it's dry. Hide behind pylons until then.", tip: 'Pylons block its shots.' }),
  rival({ n: 11, name: 'Ampere', driver: 'Wen Liu', league: 4, build: { chassis: r('bulwark'), drive: r('legs', 2), main: r('arc', 2), top: r('rockets'), power: r('emp'), armor: r('spikes', 2) }, ai: { react: 320, aim: 7, aggr: 0.6, hazard: 0.6 }, paint: { c1: '#1e6f5c', c2: '#b6ff4d', pattern: 'stripes', finish: 'gloss' }, talk: 'I did the math. You lose by a lot.', hint: 'EMP drains it. Close in right after it fires.', tip: 'After its EMP it has no energy left.' }),
  rival({ n: 12, name: 'Lady Faraday', driver: 'Irina Faraday', league: 4, champ: true, portrait: 'irina', build: { chassis: r('scarab', 2), drive: r('hover', 2), main: r('drill', 3), top: r('autocannon', 2), power: r('shield', 2), armor: r('plates', 2) }, ai: { react: 300, aim: 6, aggr: 0.7, hazard: 0.6 }, paint: { c1: '#7a2bbf', c2: '#e6c15a', pattern: 'solid', finish: 'metallic' }, talk: 'Do try to keep up, darling.', hint: 'The drill is narrow. Hit from the side.', tip: 'Move sideways out of the drill.' }),
  rival({ n: 13, name: 'Updraft', driver: 'Kai Moreno', league: 5, build: { chassis: r('wedge', 2), drive: r('hover', 2), main: r('flipper', 3), top: r('rockets', 2), power: r('jets', 2), armor: r('spikes', 2) }, ai: { react: 290, aim: 6, aggr: 0.7, hazard: 0.8 }, paint: { c1: '#f07a5f', c2: '#fbe9d0', pattern: 'stripes', finish: 'gloss' }, talk: "Nice view from up here. Last one you'll get.", hint: "Stay off the stripes. Don't let it get under you.", tip: 'Keep away from the open edges.' }),
  rival({ n: 14, name: 'Vertigo', driver: 'Anya Petrov', league: 5, build: { chassis: r('scarab', 2), drive: r('legs', 2), main: r('drum', 3), top: r('mines', 2), power: r('jets', 2), armor: r('plates', 2) }, ai: { react: 280, aim: 5, aggr: 0.75, hazard: 0.7 }, paint: { c1: '#22303f', c2: '#ff4d6d', pattern: 'flames', finish: 'gloss' }, talk: 'Look down. Everyone does.', hint: 'It jumps before it hits. Move on the hop, catch it landing.', tip: 'Move when it hops, hit when it lands.' }),
  rival({ n: 15, name: 'The Foreman', driver: 'Gus Hale', league: 5, champ: true, portrait: 'gus', build: { chassis: r('bulwark', 2), drive: r('treads', 3), main: r('rail', 3), top: r('rockets', 3), power: r('shield', 2), armor: r('plates', 3) }, ai: { react: 260, aim: 4, aggr: 0.65, hazard: 0.7 }, paint: { c1: '#f2b705', c2: '#1c1c1c', pattern: 'stripes', finish: 'matte' }, talk: "Shift's over, kid. Clock out.", hint: 'The rail fires straight. Never drive straight at it.', tip: 'Never drive straight at the rail.' }),
  rival({ n: 16, name: 'Duchess', driver: 'Amara Voss', league: 6, build: { chassis: r('sovereign', 2), drive: r('legs', 3), main: r('flame', 3), top: r('mines', 3), power: r('overdrive', 3), armor: r('spikes', 3) }, ai: { react: 250, aim: 4, aggr: 0.8, hazard: 0.8 }, paint: { c1: '#5b1a6e', c2: '#d9b44a', pattern: 'carbon', finish: 'gloss' }, talk: 'You may kneel. The mines are behind you.', hint: "Don't chase it. Cut it off.", tip: 'Cut off its path rather than chase it.' }),
  rival({ n: 17, name: 'Dead Ringer', driver: 'Unnamed', league: 6, mirror: true, build: null, ai: { react: 260, aim: 6, aggr: 0.6, hazard: 0.6 }, paint: { c1: '#0c0c10', c2: '#d81e2c', pattern: 'solid', finish: 'gloss' }, talk: "Nice robot. I'll take it from here.", hint: "It's your build, in black. You know its weak spot.", tip: 'It fights the way your robot fights. Find the gap.' }),
  rival({ n: 18, name: 'Sovereign', driver: 'Maximilian Crowe', league: 6, champ: true, portrait: 'max', boss: true, timer: 150, chips: ['frame', 'overclock'], build: { chassis: r('sovereign', 3), drive: r('treads', 3), main: r('drum', 3), top: r('autocannon', 3), power: r('shield', 3), armor: r('plates', 3) }, ai: { react: 220, aim: 3, aggr: 0.75, hazard: 0.9 }, paint: { c1: '#f4f4f6', c2: '#c9a227', pattern: 'solid', finish: 'chrome' }, talk: 'That {part}? I sold it to {owner} years ago. I want it back.', talkPlain: 'Starter parts? Brave.', hint: 'When the pit opens he sheds his armor: weaker, and furious.', tip: 'When the pit opens, stay near a wall until it settles.' }),
];

export const TROPHIES = { 3: 'Sledge head', 6: 'Ladle cup', 9: 'Frosted shards', 12: 'Copper coil', 15: 'Beacon arm', 18: 'Crown ring' };

export function partValue(part, mk) { return PARTS[part].price; }
export const buyPrice = (id, mk) => Math.round(PARTS[id].price * (mk === 2 ? 1.5 : 1));
export const sellPrice = (id, mk) => Math.round(PARTS[id].price * 0.4 * VALUE_FACTOR[mk]);
export const scrapValue = (id, mk) => Math.round(PARTS[id].price * 0.1 * VALUE_FACTOR[mk]);
export const retrofitPrice = (id, mk) => Math.round(PARTS[id].price * (mk === 1 ? 0.6 : 1.2));

// Turn a build into the numbers the sim uses.
export function computeStats(build, opts = {}) {
  const ch = PARTS[build.chassis.id];
  const chMk = MK.chassis[build.chassis.mk];
  const dr = PARTS[build.drive.id];
  const drMk = MK.drive[build.drive.mk];
  const chips = build.chips || [];
  let load = 0;
  for (const s of SLOTS) if (s !== 'chassis' && build[s]) load += PARTS[build[s].id].weight;
  const cap = ch.cap * chMk;
  const over = Math.max(0, load - cap);
  const speedPenalty = Math.max(0.5, 1 - over * 0.015);
  const accelPenalty = Math.max(0.5, 1 - over * 0.02);
  const armorPart = build.armor ? PARTS[build.armor.id] : null;
  const armorMk = build.armor ? MK.armor[build.armor.mk] : 1;
  const armorRed = Math.min(0.45, ch.armor / 100 + (armorPart ? armorPart.reduce * armorMk : 0));
  return {
    maxHp: ch.hp * HP_SCALE * chMk * (chips.includes('frame') ? 1.15 : 1) * (opts.hpMult || 1),
    cap, load, over,
    armor: armorRed,
    contact: armorPart && armorPart.contact ? armorPart.contact * armorMk : 0,
    radius: ch.radius,
    mass: ch.weight + load + 40,
    speed: dr.speed * drMk * speedPenalty * (ch.speedF || 1),
    accel: dr.accel * drMk * accelPenalty * ch.accel,
    turn: dr.turn * Math.PI / 180,
    grip: dr.grip,
    iceGrip: dr.iceGrip,
    kbResist: dr.kbResist + (chips.includes('gyro') ? 0.2 : 0),
    pivots: !!dr.pivots,
    push: dr.push || 1,
    floorImmune: !!dr.floorImmune,
    pitGrace: dr.pitGrace || 0,
    windMult: dr.windMult || 1,
    lockSpeed: dr.lockSpeed || 0.8,
    ramBonus: dr.ramBonus || 1,
    frontGuard: ch.frontGuard || 0,
    energyRegen: 8 * (chips.includes('coolant') ? 1.3 : 1),
    cooldownMult: chips.includes('overclock') ? 0.85 : 1,
    hazardMult: chips.includes('hazard') ? 0.5 : 1,
    flipTime: chips.includes('gyro') ? 0.75 : 1.5,
    ammoMult: chips.includes('ammo') ? 1.5 : 1,
    momentum: chips.includes('momentum'),
  };
}

// The six numbers the garage shows, 0-100ish.
export function garageStats(build) {
  const s = computeStats(build);
  const m = build.main ? PARTS[build.main.id] : null;
  const mMk = build.main ? MK.main[build.main.mk] : 1;
  let dps = 0;
  if (m) {
    if (m.dps) dps = m.dps * mMk;
    else if (m.id === 'ram') dps = (m.damage + m.speedDamage * s.speed) * mMk / (m.cooldown);
    else if (m.id === 'drum') dps = m.damage * mMk / 1.0;
    else dps = m.damage * mMk / (m.cooldown + (m.windup || 0));
  }
  return {
    health: Math.round(s.maxHp),
    armor: Math.round(s.armor * 100),
    speed: +s.speed.toFixed(1),
    damage: Math.round(dps),
    load: s.load,
    cap: Math.round(s.cap),
    over: s.over,
  };
}
