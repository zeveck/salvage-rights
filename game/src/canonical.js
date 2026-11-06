// The build a reasonable player has at each fight, for testing (tools/simtest.mjs and
// the debug hook's goToLevel).
export const CANONICAL = [
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "ram"
},
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "saw"
},
{
"chassis": "wedge",
"drive": "scrapwheels",
"main": "saw"
},
{
"chassis": "wedge",
"drive": "spikewheels",
"main": "hammer",
"top": "autocannon"
},
{
"chassis": "wedge",
"drive": "spikewheels",
"main": "hammer",
"top": "autocannon",
"armor": "spikes"
},
{
"chassis": "wedge",
"drive": "spikewheels",
"main": "hammer",
"top": "autocannon",
"power": "overdrive",
"armor": "spikes"
},
{
"chassis": "scarab",
"drive": "spikewheels",
"main": "drum:2",
"top": "autocannon",
"power": "overdrive",
"armor": "spikes"
},
{
"chassis": "scarab",
"drive": "spikewheels:2",
"main": "drum:2",
"top": "autocannon",
"power": "overdrive",
"armor": "plates"
},
{
"chassis": "scarab",
"drive": "legs",
"main": "drum:2",
"top": "autocannon",
"power": "shield",
"armor": "plates"
},
{
"chassis": "bulwark",
"drive": "legs",
"main": "hammer:2",
"top": "rockets:2",
"power": "shield",
"armor": "plates:2"
},
{
"chassis": "bulwark",
"drive": "legs",
"main": "hammer:2",
"top": "rockets:2",
"power": "overdrive",
"armor": "plates:2"
},
{
"chassis": "bulwark",
"drive": "legs:2",
"main": "hammer:2",
"top": "rockets:2",
"power": "emp",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drill:3",
"top": "rockets:2",
"power": "shield:2",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drill:3",
"top": "rockets:2",
"power": "jets:2",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drum:3",
"top": "rockets:2",
"power": "shield:2",
"armor": "plates:2"
},
{
"chassis": "bulwark:2",
"drive": "legs:2",
"main": "drum:3",
"top": "rockets:3",
"power": "shield:2",
"armor": "plates:3",
"chips": [
"frame"
]
},
{
"chassis": "sovereign:2",
"drive": "legs:3",
"main": "drum:3",
"top": "rockets:3",
"power": "shield:2",
"armor": "plates:3",
"chips": [
"frame",
"hazard"
]
},
{
"chassis": "sovereign:2",
"drive": "legs:3",
"main": "drum:3",
"top": "rockets:3",
"power": "overdrive:3",
"armor": "plates:3",
"chips": [
"frame",
"hazard"
]
}
];
export const MINIMAL = [
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "ram"
},
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "saw"
},
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "saw",
"armor": "spikes"
},
{
"chassis": "crate",
"drive": "scrapwheels",
"main": "hammer",
"top": "autocannon",
"armor": "spikes"
},
{
"chassis": "crate",
"drive": "treads",
"main": "hammer",
"top": "autocannon",
"armor": "spikes"
},
{
"chassis": "crate",
"drive": "treads",
"main": "hammer",
"top": "autocannon",
"power": "overdrive",
"armor": "spikes"
},
{
"chassis": "scarab",
"drive": "treads",
"main": "drum:2",
"top": "autocannon",
"power": "overdrive",
"armor": "spikes"
},
{
"chassis": "scarab",
"drive": "treads",
"main": "drum:2",
"top": "autocannon",
"power": "jets",
"armor": "spikes"
},
{
"chassis": "scarab",
"drive": "legs",
"main": "drum:2",
"top": "autocannon",
"power": "jets",
"armor": "spikes"
},
{
"chassis": "bulwark",
"drive": "legs",
"main": "hammer:2",
"top": "rockets:2",
"power": "jets",
"armor": "plates:2"
},
{
"chassis": "bulwark",
"drive": "legs",
"main": "hammer:2",
"top": "autocannon:2",
"power": "jets",
"armor": "plates:2"
},
{
"chassis": "bulwark",
"drive": "legs:2",
"main": "hammer:2",
"top": "autocannon:2",
"power": "jets",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drill:3",
"top": "autocannon:2",
"power": "jets",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drill:3",
"top": "autocannon:2",
"power": "jets:2",
"armor": "plates:2"
},
{
"chassis": "scarab:2",
"drive": "legs:2",
"main": "drum:3",
"top": "autocannon:2",
"power": "jets:2",
"armor": "plates:2"
},
{
"chassis": "bulwark:2",
"drive": "legs:2",
"main": "drum:3",
"top": "autocannon:2",
"power": "jets:2",
"armor": "plates:3"
},
{
"chassis": "sovereign:2",
"drive": "legs:2",
"main": "drum:3",
"top": "autocannon:2",
"power": "jets:2",
"armor": "plates:3"
},
{
"chassis": "sovereign:2",
"drive": "legs:3",
"main": "drum:3",
"top": "autocannon:2",
"power": "jets:2",
"armor": "plates:3"
}
];
export function parseBuild(o) {
  const pt = (v) => { if (!v) return null; const [id, mk] = v.split(':'); return { id, mk: +(mk || 1) }; };
  return { chassis: pt(o.chassis), drive: pt(o.drive), main: pt(o.main), top: pt(o.top), power: pt(o.power), armor: pt(o.armor), chips: o.chips || [] };
}
