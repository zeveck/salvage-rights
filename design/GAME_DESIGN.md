# Salvage Rights

*Beat them. Strip them. Bolt it on.*

## Pitch

You are a rookie driver with a junk-box robot and a remote control. Win a fight in the arena and the rulebook's "salvage rights" clause lets you unbolt one part from the wreck and keep it. Eighteen fights, six leagues and six very different arenas later, your robot is a personal trophy case of everyone you beat, painted your way, and you are the champion.

## Settings

- Platform: both (desktop; phones in landscape)
- Target: web (plain HTML and JS modules, vendored three.js, no build step)
- Scope: medium, from the request: a full ladder and garage, about 30-40 minutes
- Budget: $25 for generated art and audio ($0.63 spent)
- Tools: imagegen2, nanogen, audiogen, meshgen; playwright-cli for play-testing; Pillow and Node for asset and sim tools
- Credit: Rich Conlan
- Decisions made on the player's behalf: the name; a booth camera by default (it suits "remote control" and is stable on a phone), chase cam optional; six part slots plus two chip slots; the parts are real separate 3D models so every robot is built from the same kit and can be stripped.
- Everything is original: no names, designs or text from any real robot-combat show or game.

## The player's fantasy

A cocky garage tinkerer whose robot starts as a crate on wheels and ends as a chrome-and-fire monster wearing the spoils of every rival.

## Core loop

- **10 seconds:** line your weapon up, close in, hit, feel the crunch, dodge the counter or the hazard, get round the back.
- **1 minute:** a fight with one rival: learn their weapon, exploit the arena, KO them, or out-damage them on the clock.
- **Session:** win, pick one part from the wreck, go to the garage, rebuild, retrofit, repaint, buy and sell, take the next fight, climb the league.
- **The make-or-break mechanic:** the impact. Driving a weapon into a robot must feel heavy and physical. Second to it: the Salvage pick, which must always be a real, exciting decision.

## Controls

The robot steers itself toward the direction you push and drives there. It has real turning, so aiming the weapon means driving well.

| Action | Keyboard | Touch (see layout) | Gamepad (nice) |
|---|---|---|---|
| Drive | WASD or arrows (relative to the screen; relative to the robot in chase cam) | Floating stick, left thumb | Left stick |
| Main weapon | Space or J | Main button | A |
| Top mount | K, E or F | Button at 9 o'clock | X |
| Power | L or R | Button at 12 o'clock | B |
| Target Lock (toggle) | Q or Tab (preventDefault) | Button at 10:30 | LB |
| Change camera | C | Top-bar icon | - |
| Pause | Esc or P | Top-bar icon | Start |
| Mute | M | Pause and Settings | - |

Shift is not bound (Sticky Keys).

**Target Lock:** always face the rival; move in any direction. Rotation is limited to the drive's turn rate. Speed while locked: wheels 80%, legs 80%, hover 70%, treads 60%.

**Touch layout.** Phones play in landscape: the arena is wide and two thumbs are needed; a "turn your phone" overlay shows in portrait. Offsets are button centers in CSS px from the bottom-right corner, inside `env(safe-area-inset-*)`. It fits the shortest target, 375 px tall.

| Control | Visual size | Hit area | Center (right, bottom) | Notes |
|---|---|---|---|---|
| Main weapon | 96 px | 96 px | 76, 76 | Hold weapons latch: tap on, tap off, ring lit while on |
| Top mount | 72 px | 72 px | 176, 76 | 9 o'clock on main. Hidden if slot is empty |
| Lock | 64 px | 64 px | 147, 147 | 10:30 on main. Lit when on |
| Power | 72 px | 72 px | 76, 176 | 12 o'clock on main. Hidden if slot is empty |
| Stick | 130 px base, 56 px knob | Left 40% of screen, floating | Where the thumb lands | Fades to 25% when idle |
| Pause, Camera | 44 px | 64 px | Top right: 38, 38 from top right; 102, 38 | Never under a thumb |

All controls are 45% opaque. The right-hand arc stays within 212 px of the bottom and right edges, clear of the top HUD at 375 px, so it never hides the upper-middle where the action is framed. Focus is blurred on fight start. Test at 667x375 and 844x390.

## Camera

- **Booth cam (default):** fixed direction, from the driver's booth: high, slightly behind one side, tilted about 50 degrees down. It never rotates, so controls never drift. It sits above and outside the walls. Pans and zooms to keep both robots in frame.
- **Framing numbers:** visible floor width = rival distance + 8 m, clamped to 13 m minimum on desktop, 12 m minimum on phones, and the arena's width + 2 m maximum. A 2 m robot is therefore 15-17% of the screen width in melee. Push-in reaches minimum when robots are within 4 m. Zoom punch on hits of 20 damage or more: 4% in over 60 ms, back over 180 ms. On phones the camera center is offset so the action sits in the upper-middle, above the thumbs.
- **Close-ups:** pre-fight orbit of both robots (close, 40 degrees); slow pan up to the stands in pre-fight and KO, so the arena's surround is shown.
- **Chase cam (C):** behind and above, follows heading with a lag; rival shown by an edge marker when off-screen. Up is throttle, left/right steers.

**Floor aids (code, every fight):** player ring hazard yellow with a facing wedge; rival ring red with a facing wedge; danger arc in red on the floor from the start of every windup or charge; off-screen rival arrow.

## Scale in meters

Robots are 1.2-2.0 m long and 0.6-1.5 m tall (fictional super-heavyweights). Arenas are 16-22 m across. Hit circles are 0.75-1.1 m radius. Walls are 1.5 m tall. Fully built weapons and mounts reach 25-40% beyond the chassis outline, so each slot changes the silhouette from above.

## What moves how

No rigged humanoids: all are machines, animated in code. Each robot is a tree of separate GLB parts assembled in code at chassis sockets.
- Wheels spin by speed and steer. Treads: code-built instanced links around a loop, reused wheel models as sprockets, one tread side frame model. Legs swing in a gait from the hip pivot. Hover pods bob and glow.
- Drum, saw, drill and turret turn about their axle; hammer and flipper rotate about a hinge; the drill also extends. Flame, arcs, rail beams, rockets, mines' blink and shields are code effects.
- Only the moving piece is a generated model. All brackets, hinges, axle blocks and turret rings are code-built.
- On a KO the parts come apart and bounce as physics chunks (view only, not the sim).

## Robots: slots and parts

Every robot is built from the same catalog, which is what makes salvage work. Yours starts as Crate Mule, Scrap Wheels, Bumper Ram, nothing else.

**Slots:** chassis, drive, main weapon, top mount, power, armor, plus 2 chip slots (3 on Sovereign) and non-stat trophy mounts.

**Load:** the sum of the weights of all parts except the chassis. Each point over capacity costs 1.5% top speed and 2% acceleration, down to at most 50% off. Never blocked, so no build is illegal.

**Mk tiers**

| Slot | What scales | Mk II | Mk III |
|---|---|---|---|
| Chassis | HP and capacity (armor doesn't) | +10% | +20% |
| Drive | Speed and acceleration (turn, grip don't) | +6% | +12% |
| Main, top mount | Damage (range, cooldown don't) | +20% | +40% |
| Power | Duration or effect (energy cost doesn't) | +20% | +40% |
| Armor | Reduction and contact damage | +20% | +40% |
| Look (code) | | Trim glow: thin emissive line on the code-built collar, Paint 2 color | Chrome finish on all painted pixels of the part, chrome collar |
| Buy price | | 2x | Never sold |

Triples below read Mk I / II / III.

**Chassis** (armor is % less damage; crate's and other chassis' weights are not part of load)

| ID | Name | HP | Capacity | Armor | Weight | Hit radius | Length x height | Price | Notes |
|---|---|---|---|---|---|---|---|---|---|
| crate | Crate Mule | 100/110/120 | 40/44/48 | 0 | 20 | 0.75 | 1.3 x 0.7 | 60 | Starter |
| wedge | Doorstop | 110/121/132 | 45/50/54 | 0 | 22 | 0.80 | 1.5 x 0.5 | 220 | Hits on its front do 15% less |
| scarab | Scarab | 130/143/156 | 55/61/66 | 10 | 28 | 0.85 | 1.6 x 0.7 | 520 | Domed shell |
| bulwark | Bulwark | 170/187/204 | 70/77/84 | 5 | 40 | 1.00 | 1.8 x 0.85 | 980 | Acceleration x0.85 |
| sovereign | Sovereign | 200/220/240 | 85/94/102 | 5 | 45 | 1.10 | 2.0 x 1.0 | 1900 | Third chip slot |

**Drive**

| ID | Name | Speed m/s | Turn deg/s | Accel m/s2 | Grip | KB resist | Weight | Price | Notes |
|---|---|---|---|---|---|---|---|---|---|
| scrapwheels | Scrap Wheels | 5.0/5.3/5.6 | 200 | 7 | 0.60 | 0 | 8 | 40 | Starter |
| spikewheels | Spike Wheels | 6.0/6.4/6.7 | 220 | 9 | 0.85 | 0 | 9 | 260 | Ram damage +20%. Ice grip x0.8 instead of x0.35 |
| treads | Grinder Treads | 3.8/4.0/4.3 | 260, pivots on the spot | 8 | 1.00 | 40% | 16 | 640 | Push x1.6. Ice grip x0.6 |
| legs | Strider Legs | 4.5/4.8/5.0 | 300 | 7 | 0.90 | 10% | 12 | 900 | Six legs. Ignores lava and charged tiles. Ice grip x0.7 |
| hover | Hover Pods | 7.0/7.4/7.8 | 180 | 6 | 0.25 | -30% | 6 | 1100 | Immune to floor effects. 1 s grace over a pit. Wind x1.5 |

**Main weapon** (no energy use; range from hull edge; KB is knockback)

| ID | Name | Use | Damage | Range m | Arc deg | Windup or charge | Cooldown s | KB | Weight | Price | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ram | Bumper Ram | Tap: lunge | (6 + 1.2 x speed) x Mk: 12/14/17 at 5 m/s | 1.0 | 60 | 0 | 1.2 | 5 | 6 | 40 | Starter. Lunge +4 m/s for 0.25 s |
| drum | Drum Spinner | Hold | 26/31/36 at full RPM, linear | 0.9 | 50 | 1.2 s to full; min 30% RPM to hit | - | 9 | 14 | 700 | Each hit spends 60% RPM. Pops rival airborne 0.35 s. Recoil 4 on self |
| saw | Buzz Saw | Hold | 28/34/39 per s (ticks of 0.1 s) | 0.8 | 40 | 0.2 | - | 0.5 per tick | 8 | 300 | Showers sparks |
| hammer | Sledge | Tap | 24/29/34 | 2.0 | 40 | 0.4 | 1.4 | 3 | 12 | 420 | Danger arc during windup |
| flipper | Lift Flipper | Tap | 8/10/11 | 1.1 | 50 | 0.15 | 2.5 | 7 | 10 | 480 | Launches 6 m/s up; flips on landing |
| drill | Drill Lance | Hold | 20/24/28 per s, ignores armor | 1.5 | 18 | 0.3 extend | - | 0 | 9 | 560 | Own speed -30% while out |
| flame | Flame Projector | Hold | 10/12/14 per s + burn 6/7/8 per s for 3 s (refreshes, no stack) | 3.0 | 35 | 0 | Heat: 4 s, 2 s lockout if full, cools 25%/s | 0 | 7 | 520 | |
| arc | Arc Coil | Tap | 14/17/20 | 3.0 | 120 | 0 | 1.6 | 2 | 7 | 620 | Stun 0.4 s |
| rail | Rail Cannon | Tap | 40/48/56 | 14 | beam, 0.3 m wide | 0.6 | 3.0 | 8 | 15 | 1200 | Recoil 6 on self. Blocked by pylons |

**Top mount** (ammo per fight)

| ID | Name | Damage | Ammo | Rate | Range | KB | Weight | Price | Notes |
|---|---|---|---|---|---|---|---|---|---|
| autocannon | Autocannon | 2.5/3/3.5 per round | 60 | 5 per s, hold | 9 m, 90 deg cone | 0.2 | 8 | 540 | Turret auto-aims |
| rockets | Rocket Pod | 18/22/25; splash radius 2 m, half at edge | 4 | 1 per s | 9 m/s, homing 60 deg/s | 6 | 9 | 640 | |
| mines | Mine Rack | 20/24/28 | 5 | 1 per s | Trigger 1.2 m, arm 1 s | 7 | 7 | 380 | Dropped behind. Last the fight |

**Power** (Energy bar 100; recharges 8 per s)

| ID | Name | Effect | Energy | Cooldown s | Weight | Price |
|---|---|---|---|---|---|---|
| shield | Aegis Field | 1.5/1.8/2.1 s bubble: blocks 80% damage, reflects knockback | 35 | 4 | 4 | 500 |
| overdrive | Overdrive | 3/3.6/4.2 s: +50% speed, +25% damage | 45 | 6 | 5 | 460 |
| emp | Pulse EMP | Radius 4 m, shove KB 8, stun 1/1.2/1.4 s ("LINK LOST" static when it hits you) | 60 | 8 | 4 | 720 |
| repair | Nanite Tank | 15/18/21% max HP over 3 s; 3 uses a fight | 70 | 12 | 5 | 640 |
| jets | Jump Jets | Hop 2 m, 0.9 s airborne, steer in air; landing on a rival 18/22/25 within 1.2 m | 30 | 3 | 6 | 420 |

**Armor**

| ID | Name | Reduction | Extra | Weight | Price |
|---|---|---|---|---|---|
| plates | Riveted Plates | 15/18/21% | | 10 | 360 |
| spikes | Spike Skirt | 8/10/11% | Touching rivals take 6/7/8 per s | 6 | 440 |
| none | Bare | 0 | | 0 | - |

Chassis and armor reduction add, capped at 45%. Shield applies after that.

**Chips** (buffs, no 3D model, an icon, no Mk)

| Chip | Effect | Exchange (from league, price) | Champion drop |
|---|---|---|---|
| Scavenger | +25% scrap | 2, 300 | - |
| Coolant Loop | Energy recharge +30% | 3, 450 | Lady Faraday |
| Reinforced Frame | +15% HP | 3, 600 | Big Mabel |
| Overclock | Weapon cooldown -15% | 4, 700 | - |
| Hazard Plating | Hazard damage -50% | 4, 500 | Forgemaster |
| Gyro Stabilizer | Flip recovery 50% faster, knockback -20% | 5, 500 | Glacier |
| Ammo Feed | +50% top mount ammo | 5, 450 | - |
| Momentum Driver | Damage +20% above 60% speed | 6, 900 | The Foreman |

A dropped chip comes once. Rivals carry no chips except Sovereign. Chips can't be salvaged.

**Trophy mounts** (one per league champion beaten, non-stat, bolted to `trophy_1..6` sockets, always shown. Code-built, under 600 tris each, merged per robot, in that champion's paint scheme. No new models.)

| Champion | Trophy |
|---|---|
| Big Mabel | Small sledge head on a post |
| Forgemaster | Tilted ladle cup |
| Glacier | Cluster of frosted shards |
| Lady Faraday | Copper coil on a post |
| The Foreman | Striped arm with a yellow beacon |
| Sovereign | Spiked crown ring on the chassis top |

**Impact rules**

| Rule | Value |
|---|---|
| Hit direction | Front within 45 deg of target's facing: x1. Rear within 45 deg of its back: x1.25, "BACKSTAB" callout and bark. Sides: x1.1 |
| Knockback | Delta-V = KB x 100 / (chassis weight + load + 40) x (1 - KB resist). Decays at 10 m/s2 x grip |
| Wall hit | At 7 m/s or more: 4 damage, bounce 0.5 |
| Height states | **Grounded.** **Airborne** (height above 0.1 m, gravity 12 m/s2, no drive except jets): melee only connects if target is below 0.6 m; shots, arc and splash always connect. **Flipped** (on its back after a flipper landing; drive and weapons off, self-rights in 1.5 s, 0.75 s with Gyro) |
| Walls and edges | Walls act as a 3 m cage at any height. Open edge (High Rise): see the arena. Airborne over a pit doesn't fall; landing inside it falls |
| Stun immunity | 1.5 s after any stun or flip ends: can't be stunned or flipped again. Damage and knockback still apply |
| Immobile | Less than 0.3 m moved and no damage dealt for 10 s. At 6 s the sim gives one 2 m/s nudge toward the center to free a wedged robot. A countdown shows from 5 s |
| Stalemate | No damage by either for 20 s: announcer warning. From 25 s, both lose 2 HP per s, ignoring armor, until a hit lands. It counts as nobody's damage |
| Timer | 2:00; Sovereign 2:30. At the horn the judges pick most damage dealt; a tie goes to the player |
| Mid-fight breakage | At 66% and 33% HP one code-built breakaway panel shears off as a chunk (visual only) |

## Structure and difficulty

Each league has three fights in its own arena. The third is the league champion, with a portrait, a taunt and a bigger prize. Every rival has a driver, a line of trash talk and a scouting hint on Pre-fight.

### Arenas

| League | Arena | Size and shape | Lighting | Signature element (from booth cam) | Around the floor (from booth cam) |
|---|---|---|---|---|---|
| 1 Junkyard | The Scrap Pit | 16 x 16 m, rounded square | Warm sodium #ffb066 | Scrapyard crane with a big magnet over one corner, swinging slowly | Stacked crushed cars in raked tiers, chain-link, crowd on truck beds |
| 2 Foundry | The Crucible | 18 x 16 m, rectangle | Orange #ff5a1f from below, cool #8fb0d0 above | Giant tilted ladle pouring a molten stream at the far wall | Catwalks, furnace stacks, crowd on steel stands |
| 3 Cryo | The Deep Freeze | 20 m circle | Cold #9fd8ff | Frozen turbine fan, slowly turning, in the far wall | Frosted pipe racks, low fog, crowd behind iced glass |
| 4 Voltage | The Arc Dome | 20 m octagon | Violet #b88cff, white flashes on charge | Hanging central coil throwing arcs to the pylons | Lattice dome base, cable trunks, crowd silhouettes |
| 5 Skyline | The High Rise | 22 x 14 m rectangle, walls only on short sides | Sunset #ffd9a8, rim #ff7a59 | Water tower and rooftop crane in silhouette | Street far below, moving at parallax with tiny lights; other towers' tops |
| 6 Grand Circuit | The Sovereign Bowl | 22 m circle, sloped lip | Gold #ffd166 with sweeping white spots | Four crown towers with rotating spots, the giant swinging hammer | Full bowl of stands in a crowd strip, pyro stacks |

### Hazards (exact)

| Arena | Hazard | Timing | Damage and effect |
|---|---|---|---|
| Scrap Pit | 6 junk piles, radius 0.8 m | Static, shoved around | None; block and slow |
| Scrap Pit | 2 tire walls, 4 m long | Static | Soft: bounce 0.5, no wall damage |
| Crucible | 2 lava trenches, 12 x 1.6 m, at x = +/-4.5, each with a center bridge | Always | 8 per s, speed x0.6, then burn 3 per s for 3 s |
| Crucible | 4 wall flame jets, cone 3 x 1 m | Every 9 s, staggered 2.25 s: glow 1.5 s, fire 2 s | 12 per s |
| Deep Freeze | Ice floor | Always | Grip x0.35 (see drives) |
| Deep Freeze | 3 crusher pistons, radius 1.8 m, seeded spots | One every 6 s: red ring 1.5 s, slam, up in 1 s | 35, stun 0.5 s, hits everything |
| Arc Dome | 10 x 10 grid of 2 m tiles | Every 5 s: warn 1.25 s (yellow crackle), live 1 s. Sequence: rows, columns, checker, ring, then repeat | 14 once per live, stun 0.4 s |
| Arc Dome | 4 pylons, radius 0.7 m, at (+/-5, +/-5) | Static | Block shots and rail |
| High Rise | Open long sides, kerb 0.25 m, 1 m warning stripe | Always | See below |
| High Rise | Wind | Every 10 s: 1 s telegraph (streamers and arrows), gust 2.5 s toward a named open side | Push 3.5 m/s2 |
| Sovereign Bowl | 4 floor saws on tracks | Follow tracks at 2 m/s, retract 2 s every 8 s | 15 per s, KB 3 |
| Sovereign Bowl | Swinging hammer (Sledge model x3) | Passes center every 8 s; danger arc 1 s before | 30, KB 10 |
| Sovereign Bowl | Center pit, radius 3.5 m | Opens at half time: rumble and ring 3 s before | Fall is a KO (hover 1 s grace) |

**High Rise edge:** the kerb stops a robot unless it arrives at 8 m/s or more, or under 30% HP. At the kerb it teeters: tilts for 1.2 s; 0.6 s of reverse recovers; another hit in that time sends it over. Past the kerb by 0.6 m is ring-out, at any height.

### Rivals (loadouts)

Chassis and parts at Mk I unless marked II or III. Reaction in ms; aim error in degrees; aggression and hazard use 0-1. Fight 1 only: Bent Fender has HP x0.6 and damage x0.5.

| # | Robot (driver) | Chassis | Drive | Main | Top | Power | Armor | React | Aim | Aggr | Hazard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bent Fender (Wes Tolliver) | crate | spikewheels | saw | - | - | plates | 900 | 25 | 0.15 | 0 |
| 2 | Tin Terror (Posy Okafor) | wedge | scrapwheels | flipper | - | - | spikes | 650 | 18 | 0.40 | 0 |
| 3 | Mabel's Mallet (Big Mabel Dunn), champion | wedge | spikewheels | hammer | autocannon | - | plates | 500 | 14 | 0.55 | 0.1 |
| 4 | Slagheap (Ivo Brandt) | crate | treads | saw | mines | - | spikes | 500 | 14 | 0.50 | 0.1 |
| 5 | Hotfoot (Reina Salas) | wedge | spikewheels | flame | rockets | overdrive | spikes | 450 | 12 | 0.60 | 0.2 |
| 6 | Forgemaster (Otto Kessler), champion | scarab | treads | drum II | autocannon | repair | plates | 420 | 10 | 0.55 | 0.3 |
| 7 | Sideslip (Juno Park) | wedge | spikewheels II | flipper II | mines | jets | plates | 400 | 10 | 0.60 | 0.5 |
| 8 | Permafrost (Sten Aalto) | scarab | legs | arc II | autocannon | shield | spikes | 380 | 9 | 0.55 | 0.4 |
| 9 | Glacier (Hilde Varg), champion | bulwark | treads II | hammer II | rockets II | repair | plates II | 350 | 8 | 0.60 | 0.5 |
| 10 | Static (Tomas Reyes) | scarab | spikewheels II | saw II | autocannon II | overdrive | plates | 340 | 8 | 0.65 | 0.5 |
| 11 | Ampere (Wen Liu) | bulwark | legs II | arc II | rockets | emp | spikes II | 320 | 7 | 0.60 | 0.6 |
| 12 | Lady Faraday (Irina Faraday), champion | scarab II | hover II | drill III | autocannon II | shield II | plates II | 300 | 6 | 0.70 | 0.6 |
| 13 | Updraft (Kai Moreno) | wedge II | hover II | flipper III | rockets II | jets II | spikes II | 290 | 6 | 0.70 | 0.8 |
| 14 | Vertigo (Anya Petrov) | scarab II | legs II | drum III | mines II | jets II | plates II | 280 | 5 | 0.75 | 0.7 |
| 15 | The Foreman (Gus Hale), champion | bulwark II | treads III | rail III | rockets III | shield II | plates III | 260 | 4 | 0.65 | 0.7 |
| 16 | Duchess (Amara Voss) | sovereign II | legs III | flame III | mines III | overdrive III | spikes III | 250 | 4 | 0.80 | 0.8 |
| 17 | Dead Ringer (unnamed) | Your build, as locked at your first attempt, same Mks | | | | | | 260 | 6 | 0.60 | 0.6 |
| 18 | Sovereign (Maximilian Crowe), champion | sovereign III | treads III | drum III | see below | see below | plates III | 220 | 3 | 0.75 | 0.9 |

### Rivals (lines and paint)

| # | Paint 1, Paint 2, pattern | Trash talk | Scouting hint |
|---|---|---|---|
| 1 | #8a6d4f, #d9d2c3, solid | "Go easy, she only turns left." | Its saw barely spins. Get up to speed and ram it. |
| 2 | #c9ced6, #e0483e, stripes | "I flip burgers on weekends. You're lighter." | Long flipper reload. Hit just after it fires. |
| 3 | #d94f8a, #2b2b33, solid | "Sit still, sweetheart. This'll only dent." | Watch the red arc, step aside, then hit back. |
| 4 | #5a5f52, #d58a1d, camo | "Slow's fine. You still have to come to me." | Treads are slow. Circle it and hit the rear. |
| 5 | #e0301e, #ffc21a, flames | "Hope your paint's fireproof." | The flame overheats after 4 s. Back off, then pounce. |
| 6 | #3c3f46, #ff7a1a, solid | "I've melted better than you for scrap." | Hit it right after its big hit, while the drum is slow. |
| 7 | #3ac0e8, #f2f6fa, stripes | "Ice is only slippery if you're bad at it." | It wants to flip you under a piston. Watch the rings. |
| 8 | #e8f4ff, #4a8fd6, checker | "Stand still. For science." | Its arc reaches only 3 m. Stay out or rush it after a zap. |
| 9 | #6fb7dd, #17324d, camo | "Nobody has ever hurried me." | Too heavy to stop on ice. Let it slide past; strike the rear. |
| 10 | #2f2a4a, #f5e642, carbon | "You'll hear me coming. Then nothing." | 60 rounds, then it's dry. Hide behind pylons until then. |
| 11 | #1e6f5c, #b6ff4d, stripes | "I did the math. You lose by a lot." | EMP drains it. Close in right after it fires. |
| 12 | #7a2bbf, #e6c15a, solid | "Do try to keep up, darling." | The drill is narrow. Hit from the side. |
| 13 | #f07a5f, #fbe9d0, stripes | "Nice view from up here. Last one you'll get." | Stay off the stripes. Don't let it get under you. |
| 14 | #22303f, #ff4d6d, flames | "Look down. Everyone does." | It jumps before it hits. Move on the hop, catch it landing. |
| 15 | #f2b705, #1c1c1c, stripes | "Shift's over, kid. Clock out." | The rail fires straight. Never drive straight at it. |
| 16 | #5b1a6e, #d9b44a, carbon | "You may kneel. The mines are behind you." | Don't chase it. Cut it off. |
| 17 | Your paint in black, #0c0c10, red trim | "Nice robot. I'll take it from here." | It's your build, in black. You know its weak spot. |
| 18 | #f4f4f6, #c9a227, solid, Mk III chrome | "That {part}? I sold it to {owner} years ago. I want it back." With no salvaged part: "Starter parts? Brave." | When the pit opens he sheds his armor: weaker, and furious. |

### League 6 final boss: Sovereign

| Item | Detail |
|---|---|
| Base | Sovereign III (240 HP, x1.15 Reinforced Frame = 276), Treads III, Plates III, chips Reinforced Frame and Overclock |
| Phase 1, "The Reign" (from 2:30) | Drum III, Autocannon III, Aegis Field III. Patient: shields at every windup in range, flanks, only spins up close |
| Phase 2, "The Overthrow" | Starts when the pit opens at 1:15 on the clock, or at 50% HP, whichever is first. Plate skirts blow off as chunks (armor 26% to 5%, load -10). Rail III replaces the autocannon on the top socket, same profile with a 0.4 s longer aim line. Overdrive III replaces Aegis. Tries to knock you into the pit |
| Beats | At Phase 2: slow motion 0.5 s, on-screen line "You want it? Come and take it." Pit fall also ends him: Hazard KO |
| Reward | Two picks from all eight parts (chassis, treads, drum, plates, autocannon, Aegis, rail, Overdrive), at Mk III. Then rank ceremony, Victory and a free champion's lap |

**Sovereign is attainable before him:** Exchange sells Sovereign Mk I from League 6, and Duchess's wreck offers Sovereign Mk II.

**Dead Ringer:** build locked at first attempt and saved. No Salvage cards: reward is one owned part raised one Mk for free, plus the black Ringer finish in Paint.

### AI (same input interface as the player)

| State | Enters when | Does |
|---|---|---|
| Approach | Default | Steers to the attack point at the weapon's range. From League 3, aggression above 0.5: 30% of approaches aim 1.5 m behind the rival (flank) |
| Attack | Target in the weapon's profile: range, arc, charge, hold | Fires per profile. Aim error added, rerolled each attack |
| Retreat | After a big hit or while cooldown is above 1 s; drum under 60% RPM | Backs off to 3-5 m, keeps facing, spins up |
| Recover | Flipped, stunned, or stuck | Waits; if stuck (moved under 0.2 m in 1 s while driving): reverse 0.6 s and turn |
| Hazard avoid | Own cell or next 1 s of path in danger | Path to the nearest safe cell. Grid: 0.5 m cells, rebuilt every 0.25 s, live hazards, plus warned ones from League 3 |
| Hazard use | Chance per decision = hazard use, when the rival is within 4 m of a hazard or edge | Drives to push the rival toward it; times attacks to its warning |

Reaction delays every state change. Top mount: fires if in range, duty 25% + aggression x 50%. Power: shield at a windup in range; overdrive when closing from 6 m or more; EMP within 4 m; repair under 40% HP; jets at a flipper windup or to land on a rival within 3 m.

**Driver Assist:** Easy: rival damage x0.75, reaction x1.4, aim error x1.3. Normal: x1. Hard: damage x1.2, reaction x0.8, aim error x0.8. Easy is offered once, after 3 straight losses. Rivals don't scale beyond their tables.

### Avoiding frustration and dead ends

- A loss costs nothing but pride: instant retry, free repair, 15% of the prize as consolation.
- **Exhibition** re-fights beaten rivals from the Ladder for 50% prize and another pick, so a part or scrap can always be farmed. Dead Ringer gives scrap only there.
- No part is ever lost: selling is a choice. Equipped parts can't be sold, and starter parts can always be rebought.

## Economy

**Prizes**

| League | Win | Champion | Prize total | Salvage payout (est.) | Bonuses (est.) | Income in the league | Cumulative |
|---|---|---|---|---|---|---|---|
| 1 | 120 | 240 | 480 | 280 | 120 | 880 | 880 |
| 2 | 180 | 360 | 720 | 420 | 180 | 1320 | 2200 |
| 3 | 260 | 520 | 1040 | 660 | 260 | 1960 | 4160 |
| 4 | 360 | 720 | 1440 | 900 | 360 | 2700 | 6860 |
| 5 | 480 | 960 | 1920 | 1260 | 480 | 3660 | 10520 |
| 6 (before Sovereign) | 650 | 1300 | 1300 | 1100 | 325 | 2725 | 13245 |

Bonuses add a share of the prize: KO +25%, Flawless +30%, Hazard KO +20%, Ring-out +20%, Fast (under 45 s) +15%.

| Action | Price |
|---|---|
| Buy Mk I / Mk II | 1x / 2x the table price |
| Retrofit at the Bench | Mk I to II: 0.6x. Mk II to III: 1.2x |
| Sell | 40% of table price x (Mk I 1, Mk II 1.6, Mk III 2.8) |
| Salvage payout, per part not picked | 10% of table price x the same Mk factor |

**Sinks vs income:** a full Mk III end build (Sovereign from Mk II, legs, drum, rockets, shield, plates) costs about 7900 in Retrofit. With Exchange buys and builds tried along the way, that's one finished build by late League 6, not two, so the player has to choose. Retrofit makes a stolen early part a lasting choice: buying Mk II costs more than retrofitting a part you took.

**Exchange stock:**
- A part goes on sale at the promotion after the league where it first appears on a wreck, so Salvage always gets there first. Sovereign is the one exception: on sale from League 6.
- Mk II of anything on sale appears from League 4. Mk III is never sold. It only comes from wrecks and Retrofit.

| On sale from | Parts added |
|---|---|
| Always | crate, scrapwheels, ram |
| League 2 | wedge, spikewheels, saw, hammer, flipper, autocannon, plates, spikes |
| League 3 | scarab, treads, drum, flame, mines, rockets, overdrive, repair |
| League 4 | bulwark, legs, arc, shield, jets |
| League 5 | hover, drill, emp |
| League 6 | sovereign, rail |

## Win, lose and progress

- **Win a fight:** rival's HP at 0, rival rung out or in a pit, rival immobile, or judges' decision at the horn.
- **Lose:** the same, reversed. Choices: Retry, Garage.
- **Salvage:** after every win the wreck is on a turntable in exploded view. Cards list each part with stat changes against yours, and a NEW tag. Pick **one**; the rest go for scrap. Champion wins give **two** picks and a chip drop. A part can be equipped right there.
- **Salvage guarantee:** at least 2 cards offer something you don't own (a new part, or a higher Mk than yours). If a wreck falls short (you bought them all), it adds a spare from the league's pool.
- **Win the game:** beat Sovereign: rank ceremony, Victory, credits, a free **champion's lap** (exhibition in the Bowl, nothing at stake, your pick of rival), and a New Game+ prompt (keep the garage; rival parts one Mk higher, up to III; reaction x0.85; prize x1.25).
- **Save:** localStorage `salvage-rights-save-v1`: league position, garage inventory with Mks, chips, trophies, paint, name, scrap, Dead Ringer's locked build, settings. Try/catch; a broken save falls back to a fresh one.

## Flow

| Step | What happens |
|---|---|
| New Game | **Contract** screen: three short lines on salvage rights, a name field (default ROOKIE), SIGN. One tap |
| Fight 1 | Straight in, vs Bent Fender, with prompts one at a time: "Drive" until moved; "Tap to lunge" within 4 m; "Hit it at speed" after a slow hit. No countdown wait over 2 s. Can't feel hopeless: rival is at HP x0.6, damage x0.5 |
| First Salvage | "Pick one. It's yours." Picked part is equipped on the spot, with bolt-on animation and ratchet |
| Garage opens | Build tab with new part highlighted and stat bars showing the gain. Big NEXT FIGHT button names next rival and arena. Only Build and Ladder tabs at first |
| After win 2 | Exchange tab appears with a pulse: "Sell spares here. New stock with every promotion." Salvage payout explained once |
| After win 3 (first champion) | Paint tab appears with a pulse, Retrofit appears on the Build bench, first trophy bolts on, chip drop, promotion screen |
| NEXT FIGHT | Pre-fight (with Back to Garage), then a load gate, then 3-2-1-FIGHT |
| Win | Salvage, League Promotion if champion, Garage |
| Loss | Result: cause, tip, Retry or Garage |

## Screens

- **Loading:** progress bar, then the title without jumps.
- **Title:** 3D scene with your current robot on a code-built turntable under spotlights; New Game / Continue, How to Play, Settings, Credits. New Game with a save asks to confirm.
- **How to Play:** controls for your device, what salvage is, front/side/rear hits.
- **Contract:** see Flow.
- **Garage hub:** 3D garage with your robot on a lift (orbitable). Tabs: **Build** (slots, inventory, stat bars with +/- preview, Retrofit), **Exchange** (buy, sell, chips), **Paint** (colors, finish, pattern, name), **Ladder** (next fight, league standing, Exhibition). NEXT FIGHT.
- **Pre-fight:** arena name, the two robots in close-up, driver portrait, taunt, scouting hint, FIGHT, Back to Garage.
- **Fight HUD:** your name and HP (left), rival's (right), timer top-center; energy, weapon state (cooldown, RPM, heat), ammo. Remote-link styling, "signal" bars. 3-2-1-FIGHT, announcer. Compact on phones, in the top 56 px.
- **Pause:** resume, retry, garage, mute, camera, how to play.
- **Result (lose):** cause, retry, garage, a tip.
- **Salvage (win):** described above; scrap total.
- **League promotion:** rank badge (inline SVG), new exchange stock listed.
- **Victory:** ceremony with pyro, your robot on a code-built podium, the parts you took and who from; credits; champion's lap.
- **Settings:** music, sound, Driver Assist, camera default, vibration, reset save (confirm), offline status ("Offline ready" or percent).
- **Credits.**

## Juice

**Must-haves:**
- Burst hits: hit-stop 40-120 ms by weight; screen shake and zoom punch by size; sparks; debris chunks; damage numbers that don't stack; recoil.
- Continuous weapons (saw, drill, flame, autocannon): no hit-stop. Steady camera shudder, spark or flame fountain, rising grind pitch, a payoff tick with a number every 10 HP.
- Smoke then flames on low-HP robots; body darkens; loose jitter; panels shear at 66% and 33% HP.
- KO: slow motion, robot flies apart into its real parts, close-up. Announcer barks; crowd roar on big hits; weapon-state visuals (spinner blur, saw glow). BACKSTAB callout.
- `navigator.vibrate` on Android: 15-40 ms by hit size, with a setting.

**Nice:** tread dust and ice spray; scorch marks and skid decals; spotlights swinging to the winner; pyro on win; part flying from wreck to your robot at Salvage; "LINK LOST" static.

## Art direction

- **Part line (all concepts, and the same as `--texture-prompt`):** "Stylized industrial sci-fi battle robot part, hand-painted PBR look, chunky believable mechanical forms with bolts, hydraulics and panel seams, dark gunmetal structure with solid safety-orange painted armor panels and small teal accent parts, worn chipped edges, wear shows bare grey steel, no rust, no brown, even studio lighting, plain white background, no text, no logos, no people."
- **Environment line:** "Stylized industrial sci-fi combat arena, hand-painted PBR look, chunky believable steel construction with bolts and seams, wear shows bare grey steel, mid-value tones, dramatic but readable light, no text, no logos."
- **Portrait line:** "Stylized hand-painted bust portrait of a battle-robot driver in a padded helmet and headset, three-quarter view, confident expression, plain dark steel background, warm rim light, chunky simple shapes, no text, no logos."
- **Style anchor:** the bare Crate Mule concept (`.gamegen/candidates/concepts/chassis-crate.jpg`), which already exists. Every part concept uses it as a reference; chip icons too. The first backdrop anchors the others, and the first portrait anchors the portraits. No assembled robot is used as a reference.
- **Readability from above:** floors in the mid-value range; contact shadow under each robot; one rim light on robots; oversized weapons and mounts. Every asset check includes a screenshot at phone size (844x390).
- **Palette for UI:** near-black garage steel (#14171c), hazard yellow (#ffc21a), signal orange (#ff6a13), teal (#1fd6c2), warning red (#ff3b30), off-white (#eef2f5).
- **Consistency:** the anchors, the fixed lines, one lighting rig in code, one paint shader. Text is all HTML with two bundled OFL fonts (Teko for headlines, Rajdhani for body).
- **Icons:** part icons pre-rendered at build time into one WebP atlas; chip icons from one imagegen2 set; UI icons inline SVG in one style.

### Paint (proven on Crate Mule: `.gamegen/gate.png`, 6 schemes)

| Stage | Detail |
|---|---|
| Bake, per model | `tools/bake_mask.py`, Pillow: from the base color, hue 8-45 is R (Paint 1), hue 165-205 is G (Paint 2), saturation and value from 0.30 and 0.18; median, dilate, soft edge. Chassis mask 512 px, other parts 256 px PNG |
| Acceptance | Look at the `--preview`. Coverage at least 12% Paint 1 on a chassis, 5% on any other part. Every part shows an orange panel, including drive parts |
| Fallback | Hand-tune this model's thresholds, then regenerate it |
| Runtime | `game/src/paint.js`: shader samples the mask and multiplies base luminance by the paint, so wear and steel stay. One `customProgramCacheKey`; precompile before a fight |
| Patterns | stripes, camo, carbon, checker, flames, in chassis coordinates with a world-scale factor, so they run across parts. Moving parts use their rest position, so patterns don't swim |
| Finishes | Matte, gloss, metallic. Chrome is earned: code applies it to Mk III parts. Black Ringer finish after Dead Ringer |
| Rivals | Same system, schemes in the table |

### Part specs

Forward: all models are rotated to face the chassis's +Z by per-part `rotFix`, read from each preview sheet; Crate Mule came out facing +X, so never assume. Pivot is in bounding-box fractions (x, y, z) because a GLB's origin is on the ground. Height is `--height`; a part is modeled in the pose given.

| ID | Model of | Tier | Tris | Height m | Generated pose and forward | Pivot, axis | Concept rule |
|---|---|---|---|---|---|---|---|
| crate | Chassis | Full (done) | 12k | 0.7 | Front is +X as made | Socket-based | Body only, empty sockets |
| wedge | Chassis | Full | 12k | 0.5 | Front view, nose forward | Socket-based | Body only, empty sockets |
| scarab | Chassis | Full | 12k | 0.7 | Front view | Socket-based | Body only, empty sockets |
| bulwark | Chassis | Full | 12k | 0.85 | Front view | Socket-based | Body only, empty sockets |
| sovereign | Chassis | Full | 12k | 1.0 | Front view | Socket-based | Body only, empty sockets, elaborate |
| scrapwheel | One wheel | Draft | 2k | 0.55 | Upright, axle sideways | 0.5, 0.5, 0.5; axle | Wheel only, orange hub, plus side view |
| spikewheel | One wheel | Draft | 2k | 0.6 | Upright, axle sideways | 0.5, 0.5, 0.5; axle | Wheel only, orange hub, plus side view |
| leg | One leg | Draft | 2.5k | 0.9 | Hip on top, foot down | Hip top center; X | Leg only, orange panel, plus side view |
| hoverpod | One pod | Draft | 3k | 0.35 | Flat disc | Center | Pod only, orange shell, no mount |
| treadframe | Side frame | Draft | 2k | 0.45 | Side view, long axis forward | Static | Frame only, no tread links, orange panel |
| ram | Bumper | Draft | 6k | 0.45 | Face forward | Static, tween | No bracket, orange face |
| drum | Rotor | Full | 8k | 0.5 | Barrel lying, axle sideways | 0.5, 0.5, 0.5; axle | Rotor only, axle centered, no frame, plus side view |
| saw | Disc | Full | 8k | 0.95 | Upright, axle sideways | 0.5, 0.5, 0.5; axle | Disc only, axle centered, plus side view |
| hammer | Arm and head | Full | 8k | 1.6 | Upright, hinge end down, head up | 0.5, 0.03, 0.5; X | From hinge end, no base, plus side view |
| flipper | Plate | Full | 8k | 1.0 | Upright, hinge edge down | 0.5, 0.02, 0.5; X | Plate only, 3/4 view, thick edge, plus side view |
| drill | Bit | Draft | 6k | 1.1 | Tip up | 0.5, 0, 0.5; Y | Bit only, orange collar, plus side view |
| flame | Nozzle | Draft | 6k | 0.45 | Muzzle forward | Static | No bracket |
| arc | Coil | Draft | 6k | 0.7 | Upright | Static | No bracket |
| rail | Cannon | Full | 8k | 0.5 | Lying, muzzle forward, about 2 m long | Static, tween | Whole barrel, no bracket |
| autocannon | Turret | Draft | 5k | 0.45 | Muzzle forward | 0.5, 0, 0.5; Y | Turret only, no ring, plus side view |
| rockets | Pod | Draft | 5k | 0.5 | Tubes forward | Static | No bracket |
| mines | Rack | Draft | 5k | 0.35 | Opening back | Static | No bracket |
| shield | Emitter | Draft | 5k | 0.45 | Upright | Static | Dome and base |
| thruster | Overdrive thruster; a pair pointed down is Jump Jets | Draft | 5k | 0.5 | Nozzle back | Static | No bracket |
| emp | Spike | Draft | 5k | 0.8 | Upright | Static | Antenna spike with orange collar |
| nanite | Tank | Draft | 5k | 0.6 | Upright | Static | Glass tank, orange caps |
| plate | Side plate | Draft | 1.5k | 0.5 | Face out | Rail | One plate |
| spikeskirt | Skirt piece | Draft | 1.5k | 0.45 | Face out | Rail | One piece, orange backing |

### Assembly

- **Parts manifest** (`catalog.js`), per part: `file, heightM, rotFix, attachOffset, pivot, axis, slot, mask`.
- **Chassis sockets**, per chassis: `main, top, power, drive_fl..rr (four or six), skirt_l, skirt_r, skirt_f, trophy_1..6`, each with position, normal, max size. Crate Mule's existing axle stubs are its drive sockets.
- **Adapters:** one shared code-built set (collar, bracket block, hinge, turret ring, axle block, skirt rail per chassis) hides the join and shows the Mk tier.
- **Contact sheet:** `tools/contact-sheet.mjs` renders every chassis x every part at 2 angles via `?debug=parts`, one sheet per chassis. It runs after each batch and must be looked at. Definition of done includes it.

## Audio direction

Music: heavy industrial rock instrumentals, no vocals. Tracks crossfade over 2 s; loops crossfade at the seam.
- Title and garage (90 s): laid-back workshop groove (garage rock, wrench-turner).
- Battle A (Leagues 1-2, 75 s): driving garage-punk.
- Battle B (Leagues 3-5, 75 s): faster industrial electronic metal.
- Battle C (League 6, 75 s): huge arena anthem. The Victory ceremony reuses it with the crowd loop.
- Victory sting (15 s).

SFX, generated (36; **L** = `--loop`): spinner whine **L**, saw grind **L**, hammer impact, metal clang x3 sizes, flipper thwack, drill **L**, flame **L**, arc zap, rail charge, rail fire, autocannon, rocket launch, explosion, shield up, overdrive whoosh, EMP pulse, repair hum **L**, jets, motor **L** (pitched by speed), tread **L**, hover hum **L**, leg stomp, part bolt-on (ratchet), cash register, spray can, buzzer horn, crowd roar, crowd **L**, lava sizzle **L**, electric floor, ice crack, wind **L**, crusher slam, pit rumble.

SFX, in code (4): UI click and mine beep (oscillators), link-lost static (filtered noise), floor saw (saw grind pitched down).

Voice (10 barks, about 150 characters): "Three, two, one, fight!", "Knockout!", "Ring out!", "Flawless!", "Backstab!", "Hazard knockout!", "Time! The judges have decided!", "A new champion!", "Salvage rights!", "Keep it moving!" (stalemate).

## Asset list

Models: all from a concept picture with `--pbr`, the part line as `--texture-prompt`, `--height`, `--polycount` per Part specs. Multi-image and draft cost the same as single (dry-run checked). All arena props and furniture are in code.

| ID | What it is | Tool | Size and format | Transparent | Animation | Priority |
|---|---|---|---|---|---|---|
| concept-* | 27 new part concepts | nanogen | 1K JPEG | no | - | must |
| concept-*-side | 9 second views: wheels x2, leg, drum, saw, hammer, flipper, drill, autocannon | nanogen | 1K JPEG | no | - | must |
| chassis x5 | crate (done), wedge, scarab, bulwark, sovereign | meshgen full | see Part specs; 1024 base, 512 others | - | code | must |
| weapons, full x5 | drum, saw, hammer, flipper, rail | meshgen full | 512 | - | code | must |
| weapons, draft x4 | ram, drill, flame, arc | meshgen draft | 512 | - | code | must |
| drive x5 | scrapwheel, spikewheel, leg, hoverpod, treadframe | meshgen draft | 256-512, no normal map | - | code | must |
| top x3 | autocannon, rockets, mines | meshgen draft | 256-512 | - | code | must |
| power x4 | shield, thruster, emp, nanite | meshgen draft | 256-512 | - | code | must |
| armor x2 | plate, spikeskirt | meshgen draft | 256, no normal map | - | - | must |
| masks x28 | Paint masks | Pillow | PNG, 512 chassis, 256 others | - | - | must |
| floor and wall x7 pairs | 6 arenas and the garage, seamless, mid-value | nanogen | 1K JPEG | no | - | must |
| backdrop x6 | Stands or skyline, one per arena: low band and pre-fight background | nanogen | 2K JPEG, 21:9 | no | slow pan | must |
| street | High Rise street far below | nanogen | 1K JPEG | no | parallax | must |
| crowd | Crowd strip, tiled on raked stand planes | nanogen | 1K JPEG | no | scroll wobble | should |
| garage wall | Garage back wall | nanogen | 2K JPEG, 16:9 | no | - | must |
| portraits x6 | League champion drivers | nanogen | 512 | no | - | must |
| generic portraits x5 | Helmeted drivers, tinted in CSS for 12 non-champions | nanogen | 512 | no | - | should |
| title art | Key art for loading and the social card | nanogen | 2K | no | - | must |
| chip icons x8 | Buff chips, reference: anchor | imagegen2 | 256 PNG | yes | - | must |
| app icon | Robot head and salvage wrench | imagegen2 | 1024 | no | - | must |
| part atlas | Part thumbnails | built in code | WebP | yes | - | must |
| rank badges, UI icons | League badges, UI icons | code, inline SVG | - | - | - | must |
| trophies, adapters, turntable, podium, lift, junk piles, tire stacks, spot rigs, pylons, crusher pistons, crane, ladle, turbine, coil, water tower, crown towers | Everything else in the arenas and garage | code | - | - | code | must |
| League 6 hazards | Floor saws and swinging hammer reuse saw and hammer models | reused | - | - | code | must |
| music x5 | See above | audiogen music | 128 kbps mp3 | - | loop | must |
| sfx x36 | See above | audiogen sfx | short mp3 | - | - | must |
| voice x10 | Barks | audiogen voice | short mp3 | - | - | should |
| fonts | Teko, Rajdhani | Google Fonts OFL, bundled | woff2 | - | - | must |
| social card | From title art, per web-target | playwright, Pillow | 1200x630 JPEG | no | - | must |

**Order of work:** (1) done: Crate Mule and paint gate. (2) Framing mock-up: Crate Mule in a textured code arena at 844x390. (3) Draft vs full: drum rotor both ways, compared at phone size. If the draft holds up, the remaining full weapons become drafts, except hammer and rail. If it doesn't, upgrade ram and drill out of margin. (4) Six models: scrapwheel, ram, drum, leg, plate, wedge. **Stop and reassess** spend, faithfulness, masks and contact sheet before ordering the rest.

## Tech plan

- ES modules, three.js r186 from meshgen, already at `game/vendor/`, import map, no build.
- `src/`: `main.js` (boot, loop, screens), `catalog.js` (all data), `state.js` (save, inventory), `assembly.js` (GLB cache, sockets, adapters), `paint.js` (exists), `robot.js`, `sim.js`, `ai.js`, `arena.js`, `fx.js`, `audio.js`, `input.js`, `ui/*.js`.
- **Sim:** fixed 60 Hz, 2D physics on the floor plane with circles, walls and impulses, height and flip states on top. No physics library. `catalog`, `robot`, `sim` and `ai` have no DOM, three.js or assets, and run in Node. The view only reads from the sim.
- **RNG:** two seeded streams. `simRng` per fight seed; `fxRng` for view only. The view never touches `simRng`.
- **Hit-stop and slow motion:** view-only: the loop withholds or slows sim steps. Inputs are per tick, so tick results don't change. Off while `step()` is in charge.
- **Models:** `tools/optimize_glb.py` (exists; 9.47 to 1.18 MB at 1024/512) at build time, 4:4:4 JPEG, with `--base` and `--other` per Part specs; it gains a flag to drop normal maps on small parts. Masks baked before shrinking. Lazy-loaded per robot with a cache.
- **Loading:** Pre-fight load gate waits for both robots, arena, audio and shader precompile. Prior arena and rival textures are disposed.
- **Scaling:** full-window canvas, HTML overlay, safe-area insets. Pixel ratio capped at 2 on desktop, 1.5 on phones, and lowered if frame rate falls.
- **Input:** one layer for keyboard, touch and gamepad, with "just pressed" latches.
- **Audio:** Web Audio AudioBuffers, master/music/sfx gains, duck on pause, mute saved, crossfades. Lazy decode per league's track.
- **Install:** manifest, icons from one image with Pillow.

**Phone budgets** (checked in `?debug=perf` with `renderer.info`, on a test scene of the two worst-case robots)

| Budget | Limit | Note |
|---|---|---|
| Tris per robot | 60k | Worst: legs and Sovereign, about 56k |
| Tris in view | 120k | Arena code geometry about 8k |
| Draw calls | 60 | Instanced or shared legs, wheels, skirts, tread links; adapters and trophies merged |
| Textures in memory | 150 MB | Dispose on leaving a fight |
| Shadows | Blob shadow on phones | One shadow light on desktop |
| Materials | Cheaper floor material on phones | Lower tier skips normal and roughness maps if frame rate falls |

**Size ceilings**

| Item | Estimate | Ceiling |
|---|---|---|
| Models (28) | 15 MB | 18 MB |
| Masks | 1.5 MB | 2 MB |
| Textures and images | 8.5 MB | 9 MB |
| Audio | 6.3 MB | 7 MB |
| Code, three.js, fonts | 2.5 MB | 3 MB |
| **Whole game** | **about 34 MB** | **35 MB** |
| **First visit before title** | **about 4.5 MB** (code, three.js, fonts, title art, starter robot) | **5 MB** |

Starter models: Crate Mule 1.2 MB, wheel, ram. Music decodes after the first tap and isn't counted. A returning player's robot may be bigger but comes from cache.

**sw.js:** template, changed in one way. Install pre-caches core only (page, code, vendor, fonts, UI images, title art, starter robot), so one failed file can't block it. After activation, the rest of `FILES` is fetched one file at a time in the background, failures tolerated and retried on next launch. It posts progress; Settings shows "Offline ready" at 100%. Runtime fetches still cache as they go. Pages workflow unchanged.

**Testing**

| Piece | Detail |
|---|---|
| `tools/simtest.mjs` | Headless Node. Bot drives through the input interface, with human limits: 250 ms reaction, 12 deg aim error. Runs each fight over 200 seeds |
| `design/canonical-run.json` | Per fight: build, picks, purchases, retrofits. One canonical run, plus `minimal-run.json` (only the free picks, nothing bought) |
| Dead Ringer | Tested with canonical, minimal, all-hammer and all-flame builds |
| Solutions | `design/solutions/fight-NN.json`: generated from the bot with a fixed seed: input events with tick counts. Replayed in the browser with real key presses |
| Sim hash | FNV-1a over robots' rounded state at the end of a replay must match the Node run |
| Debug hook | `window.__game`: `state()`, `levels()` = 18, `goToLevel(n)` (loads the canonical build), `step(s)` (loops at 1/60 s), `resume()`, `audioState()`, `simHash()`, helpers to grant parts |

**Win-rate floors, Normal, bot.** Failing a floor means tuning numbers, then rerunning.

| League | Fights 1-2, canonical | Champion, canonical | Any fight, minimal |
|---|---|---|---|
| 1 | 90% | 60% | 40% |
| 2 | 75% | 50% | 25% |
| 3 | 65% | 45% | 15% |
| 4 | 55% | 45% | 15% |
| 5 | 50% | 40% | 10% |
| 6 | 45% | 40% | 5% |

Ceiling: no fight beyond League 1 above 98%, so nothing is trivial.

## Cut list

In order: gamepad; New Game+; voice barks; crowd strip; chase cam; generic portraits (silhouette instead); then model drops, in catalog fallback order, with rivals' loadouts swapped: mines (to autocannon), Nanite Tank (to shield), Spike Skirt (to plates). Champion portraits, fights, salvage, garage, paint and ladder are never cut.

## Budget estimate

| Item | Count | Each | Total |
|---|---|---|---|
| Spent: Crate Mule concept and model | 1 | | $0.63 |
| Full 3D models (4 chassis, 5 weapons) | 9 | $0.60 | $5.40 |
| Draft 3D models | 18 | $0.30 | $5.40 |
| Draft vs full test (extra drum) | 1 | $0.30 | $0.30 |
| Concepts and second views, 1K | 36 | $0.034 | $1.22 |
| Floor and wall textures, 1K | 14 | $0.034 | $0.48 |
| Backdrops, garage wall, title, 2K | 8 | $0.05 | $0.40 |
| Street, crowd, 1K | 2 | $0.034 | $0.07 |
| Portraits, 512 | 11 | $0.022 | $0.24 |
| imagegen2: chip icons, app icon (estimate) | 9 | $0.10 | $0.90 |
| Music (330 s) | 5.5 min | $0.30/min | $1.65 |
| SFX | 36 | $0.12 | $4.32 |
| Voice | about 150 chars | about $0.10 per 1000 | $0.05 |
| **Subtotal** | | | **$21.06** |
| Retry margin (4 full, 2 draft, 14 images) | | | $3.50 |
| **Total** | | | **$24.56** |
| Unallocated | | | $0.44 |

Upgrading ram and drill to full, if the test says so, comes out of the margin ($0.60). If the margin falls under $1, stop retries and work down the cut list's model drops.

## Definition of done

- [ ] Starts with no errors at every targeted size (desktop, 667x375, 844x390).
- [ ] All 18 fights can be won; the game can be won from New Game in one run: solutions replay in the browser with matching sim hashes.
- [ ] `tools/simtest.mjs` meets every win-rate floor.
- [ ] Losing and retrying works, and nothing gets stuck.
- [ ] Every control works on keyboard and touch; thumb arc reachable; hold weapons latch on touch.
- [ ] Every screen looks finished at every targeted size, from the first load.
- [ ] Music and sound play after the first input, and mute works.
- [ ] Progress, garage, trophies and paint are saved and restored.
- [ ] Every part on every chassis looks correctly assembled on the contact sheet.
- [ ] Every Salvage screen offers at least 2 parts the player doesn't own (Dead Ringer excepted); buying, selling and Retrofit change scrap and inventory correctly.
- [ ] Paint changes colors, finish and pattern on every part, including rival parts; Mk II and Mk III look different; trophies show.
- [ ] Phone budgets met in the worst-case test scene; download at or under 35 MB, first visit under 5 MB before title.
- [ ] A robot at minimum zoom is at least 12% of the screen width on a phone.
- [ ] Installs as an app and works offline, with "Offline ready" shown; a failed file doesn't break install.

## Round 2 amendments (these win over anything above)

**Numbers:** saw 18 DPS with own speed x0.8 while cutting, range 0.7. Hammer 32 damage, cooldown 1.2, range 1.6. Drum 30 damage, KB 7, range 0.75. Drill 24 DPS. Rail 52 damage, cooldown 2.6. Flame 12 DPS plus burn 8. Capacity 30/35/42/50/60 for crate, wedge, scarab, bulwark, sovereign. Chassis speed factor: crate 1, wedge 1.05, scarab 0.97, bulwark 0.88, sovereign 0.92. Treads turn 130 deg/s, still pivot. Rivals aim at where the player was at their last reaction tick. Rival HP scales by league; targets a median of 45-90 s in simtest. "Fast" bonus under 40 s.

**Knockback:** decay floor 4 m/s2, 6 for hover. High Rise kerb stops everything except a robot under 30% HP, or one hit while teetering, or one airborne past the edge.

**Boss:** Phase 2 starts at 50% HP or at 1:15; the pit opens 3 s after Phase 2 starts. Sovereign gives no chip.

**Salvage:** pool = all parts on the league's wrecks. A spare is at the wreck's highest Mk + 1, capped at III. If nothing qualifies, a "Fully stocked" card pays scrap (exempt from the guarantee). Exhibition: one pick, one Mk below the rival's (minimum I), no payout for unpicked parts. Mk III sells at 2.0x.

**Chips:** one copy each, can't be sold, owned chips aren't listed, a duplicate drop pays its price in scrap.

**Camera:** fit both robots plus margins in both axes by projecting them into the safe rectangle, up to a maximum zoom out; beyond that the off-screen arrow covers it. Test: Crate Mule fully built, at the tightest zoom, is at least 10% of the screen width on a phone.

**Reach:** a weapon's tip at full extension from the hull edge equals its sim range within 0.1 m. Oversized parts overhang rather than scale. The 25-40% silhouette rule is a guide for small parts only.

**Perf scene:** the Sovereign Bowl with all hazards up, player on legs and Sovereign, Dead Ringer as rival. Floor saws are code-built discs under 500 tris.

**Assets added ($0.31):** SFX: hammer swing whoosh, long fall (38 total). Nanogen 1K: steel trim sheet (used on all code-built props, adapters and trophies), lava tile.

**Code-made sounds added:** denied blip, dry click, ready ping, countdown tick, overheat vent. Reuses: wall jets = flame loop; pyro = explosion pitched up; shield hit = clang filtered; self-right = ratchet; kerb teeter = saw grind pitched down.

**Audio by screen:**

| Screen | Audio |
|---|---|
| Title, Garage, Result (lose), Salvage, Promotion | Garage track |
| Pre-fight | League's battle track, low-pass filtered, with crowd |
| Fight | League's battle track, crowd loop, motors |
| KO win | Horn, sting (first 5 s), crowd |
| Loss | Horn, ducked crowd, then the garage track |
| Victory | Sting, then Battle C with crowd |

**Boss rail:** per-chassis `topRail {attachOffset, scale}` on the top socket; a Phase 2 row on the contact sheet.

## Changes made while building (these win over anything above)

- **Robots are tougher:** chassis health x4, hazards x2.5. Each rival's health and damage multipliers are in `game/src/fightsetup.js`, found by `tools/autotune.mjs` and `tools/floortune.mjs`.
- **Weapons rebalanced** after testing every weapon against each champion (`tools/weapons.mjs`). Numbers are in `game/src/catalog.js`.
- **Aim assist for the player:** steer within about 35 degrees of the rival, within 9 m, and the robot lines up. Added because 8-way keyboard steering missed narrow weapons about half the time.
- **Sponsor deals:** after 2 straight losses the Exchange opens next league's stock. The Exchange opens after the first win. Mk II costs 1.5x.
- **High Rise edge:** a robot must be under 50% health to fall.
- **Strider Legs have four legs** (two twin-leg units), because that's the model that came back.
- **First-time prompts** teach each weapon, top mount and power; a nudge appears if you're up close doing no damage.
- **Rivals circle** while reloading, from League 3.
- **Salvage survives a reload:** the offer, picks and payout are saved until you continue.
- **Test note:** serve tests with `tools/serve.py` (caching off). The plain server let the browser test stale code, which looked like the sim differing between Node and Chrome. With caching off, 17 of 18 replays match Node exactly; fight 14 differs by about one hit near the end, cause unknown. It has been won in the browser during a full playthrough.
- **Text scanner:** it reports items scrolled inside a list (`.tabbody`, `.cards`) as clipped. Those lists really scroll; checked by eye in screenshots at each size.

## Change: Versus, two players on one keyboard

**Pitch:** a couch fight with no career at stake. Two people, one keyboard, pick a robot and an arena, and settle it. Separate from the career: it never reads or changes the save except to offer your garage robot.

**Where:** a **Versus** button on the title screen. Hidden on touch-only devices, which have no keyboard.

**Keys:** chosen so four hands fit on one keyboard and rows don't collide.

| Action | Player 1 | Player 2 |
|---|---|---|
| Drive | W A S D | Arrow keys |
| Main weapon | F | K |
| Top mount | G | L |
| Power | H | ; |
| Lock on | R | I |
| Pause | Esc | Esc |

Screen-relative driving, booth camera only (chase cam follows one robot, so it's off). Both players get aim assist. Many keyboards can't register every key combination at once; the design note on the select screen says so and the layout separates the players' hands to limit it.

**Select screen:** each player cycles robots with their own left and right keys, and readies with their weapon key; the same is clickable. Choices: 8 ready-made robots from the ladder's rivals in their own paint, plus "Your robot" (the garage build). Mirror picks are allowed: Player 2's copy is painted black and red. Either player cycles the arena with W/S or Up/Down, or Random. Both ready: pre-fight, then 3-2-1.

**Fairness:** all robots get the same health budget regardless of chassis (armor still counts), and a test (`tools/versus.mjs`) plays every pairing with bots and reports win rates; no ready-made robot should fall outside 30-70% overall. No Driver Assist, no rival multipliers. Timer 2:00, sudden hazards as usual. "Your robot" is unbalanced on purpose: you earned it.

**Result:** announcer calls the winner, a running score for the session (first-to-whatever), then Rematch, Change robots, Title. No prizes, no salvage, no save changes.

**HUD:** both names with P1/P2, both weapon and energy gauges. Link-lost static is off, because it would blind both players; the stun still applies and the sound plays.

**Assets:** 2 announcer lines, "Player one wins!" and "Player two wins!", same voice as the others. Everything else reuses what exists.

**Not included:** phones, online play, a second controller.

**Definition of done additions:** both players control only their own robot with real key presses at once; result, rematch, change robots and title all work; pausing and retrying work; the career save is byte-for-byte unchanged by a Versus match; every screen passes the scan at 1280x720 and 800x600; all 18 career replays still win.

### Versus: changes after review (these win over the section above)

- **Keys:** Player 2 is arrows with `,` `.` `/` for weapon, top and power, and L for lock. Player 1's R is lock. Versus has its own key map: only the table's keys, Esc and M are live. Hold weapons and the autocannon toggle with a tap, as on touch.
- **Endings:** at the horn, the higher health percentage wins. A dead-level finish or a double KO is a draw with no score. No sudden death: a draw is simple and clear.
- **Stalling:** in Versus the stalemate drain hits only whoever's ahead on health, so a leader can't run out the clock.
- **Select:** the weapon key toggles ready; your own robot locks while ready. Changing arena clears both readies. Esc goes back. Cards list each part, its key, and tap on/off. A live strip lights keys as they're pressed.
- **Telling robots apart:** Player 1 yellow, Player 2 cyan (rings, tags over each robot, HUD, arrows). "LINK LOST" shows in that player's own HUD; the full-screen static stays off.
- **Roster:** Slagheap, Sideslip, Mabel's Mallet, Hotfoot, Forgemaster, Permafrost, Lady Faraday, The Foreman, one of each main weapon, flattened to Mk II, equal base health, with Versus-only multipliers in `game/src/versus.js`. Slagheap gets spike wheels. "Your robot" keeps its real parts and chips and is tagged not balanced.
- **Career separation:** `G.mode` keeps Versus out of `recordWin`, `pending`, `fightSeed`, `seen` and settings. Mute and camera don't write the save during a match. The sim defaults keep career behavior: `versus` off, aim assist for robot 0 only.

## Change: flips are a chance, and Updraft is more forgiving

From the person's own play: Updraft on the High Rise is too hard, and flips land every time with no visible counter.

**Flip rule.** A flipper hit still launches you. On landing, you flip only on a roll against your **Flip risk**; otherwise you land upright, with a "STUCK THE LANDING" callout. Either way you can't be launched again for a few seconds, so nobody gets chain-flipped.

**Flip risk** starts at 50%, and your build lowers it:

| Part | Effect |
|---|---|
| Scarab chassis | -10 points |
| Bulwark, Sovereign chassis | -20 points |
| Grinder Treads | -25 points |
| Riveted Plates | -15 points |
| Gyro Stabilizer chip | Halves the result, and you recover twice as fast |

Risk never goes under 10%. It applies to rivals too, so your own flipper is also weaker against heavy rivals. Everything that was already a counter stays: Aegis Field blocks a launch and Jump Jets dodge it.

**Making it visible.** The garage stats panel shows Flip risk, and it updates when you swap parts. Part descriptions for those parts say so. The Gyro chip goes on sale from League 2, ahead of Sideslip in League 3. (Tin Terror in League 1 also has a flipper, but it's slow and hits lightly.) Scout hints for Sideslip and Updraft name the counters. The garage's Flip risk bar treats lower as better. Order: subtract, halve, floor at 10, whole number.

**The edge.** A flipper launch can't ring you out by itself. While launched or flipped you stop at the kerb, can't start a teeter and can't be knocked over; the normal edge rules return when you're back on your wheels. This replaces "past the kerb by 0.6 m is ring-out, at any height" for flipper launches only. An upright landing does half the landing damage. Landing or recovering gives 6 seconds of launch immunity, so launches are rarer.

**Updraft (fight 13).** Less damage, flipper down from Mk III to Mk II, slower reactions, less inclined to herd you, and it holds its flipper when you're hurt and near an edge. Its scout hint says what to do. Other High Rise fights are unchanged except for the flip rule.

**Done when:** with `tools/updraft.mjs` (slow keyboard bot, build from 4 fights back, 8 weapons), Updraft is at least 75% for every weapon, and under 10% ring-outs; only fights 2, 7 and 13 change, re-recorded singly, and the other 15 match their recordings; `tools/weapons.mjs` shows the player's flipper is still worthwhile; Versus is rechecked, since Sideslip uses a flipper.

### General balance pass (from the person's own play: flips "should probably work less and hurt a bit more", the saw "seemed pretty ineffective")

| Weapon | Before | After | Why |
|---|---|---|---|
| Lift Flipper | 26 hit, 18 landing, 1.8 s reload, shove 7 | 58 hit, 40 landing, 2.0 s reload, shove 4.5 | Rarer launches, each one hurts. The 6 s immunity limits launches, not the reload. |
| Buzz Saw | Reach 0.85, push 0.3 per tick | Reach 1.0, push 0.08 per tick | Its own push shoved the target out of reach. Damage rate unchanged. |
| Bumper Ram | 11 | 13 | Starter was lagging. |
| Sledge | 42 | 50 | Lagging. |
| Rail Cannon | 46 | 54 | Lagging. |
| Arc Coil | 26 | 24 | Had the highest win rate. |

Measured with `tools/balance.mjs`, compared with the published version. All recordings re-made since these weapons appear throughout the career. Versus tuning re-fitted.

**High Rise falls.** A full career run on these numbers then lost 15 straight to Vertigo by ring-out: its drum pops you into the air, and under 50% health any height carried you over the edge. `tools/edge.mjs` showed why: light drives (Hover Pods, Scrap Wheels) lost 80-100% of the time at about 28-30% health, since one pop reached the edge from almost anywhere, which erased the bottom of the health bar. Mid-air falls and sliding straight over the kerb now need under 15% health, on any open-sided arena. Teetering, which you can reverse out of, still applies below 50%. Vertigo's herding drops from 0.7 to 0.4.

Hover Pods take less extra knockback (-0.1, was -0.3), and Vertigo's scout hint names the counter: heavier drives.
