# Design review log

## Round 1 findings (condensed)

### Player
P1 must: first salvage is a dud; League 1 rivals only have rams. Specify League 1 loadouts part by part, each with desirable non-ram parts; every Salvage screen offers at least 2 parts the player doesn't own.
P2 must: screen flow undefined. New Game: short signing beat then straight to fight 1 vs passive Rustbucket with contextual prompts (Drive, Tap to lunge, Hit it at speed). After first Salvage part is equipped on the spot, Garage opens with Build highlighted; Exchange and Paint introduced over next wins. Back to Garage on Pre-fight; NEXT FIGHT button shows next rival and arena.
P3 must: finished robot won't be "everyone I beat": Mk scaling obsoletes early parts. Add Retrofit scrap sink at the bench (raise any owned part's Mk). One non-stat trophy mount per league champion bolted visibly to the chassis. Visible Mk tiers in code (Mk II trim glow, Mk III chrome). Exchange never sells the top Mk; say where chips come from.
P4 must: right thumb overloaded; stack too tall on a 360-390 px phone; Hold weapons occupy the only right thumb. Quarter-circle arc around main; Lock reachable; on touch hold weapons latch (tap on, tap off) or slide; hide or dim empty slots.
P5 should: robots small in booth cam at 2 m of 22 m. Specify framing: robot at least 12-15% of screen width when close, hard push-in in melee, zoom punch on big hits. Floor aids: facing wedge, danger arc during windups, player and rival ring colors.
P6 should: Target Lock best play, position doesn't matter. Rear hits +25-30%, side +10%, BACKSTAB callout. Lock rotation limited to drive's turn rate; less speed for treads; AI flanks from League 3.
P7 should: stun chains and one-hit ring-outs. 1.5 s stun immunity after any stun or flip. Skyline edges have warning stripe, low kerb: only knockback above threshold or low HP clears; "teeter" with chance to recover. Telegraph wind gusts 1 s ahead.
P8 should: finale thin. Define Sovereign fully: multi-weapon kit, phase change at half time when pit opens, taunt referencing player's stolen parts. Sovereign chassis attainable before last fight (Duchess or Nemesis wreck, or League 5 promotion). Nemesis reward: one owned part raised a Mk plus black Nemesis finish; lock mirror to the build at first attempt of fight 17. After Victory a free "champion's lap" exhibition.
P9 should: juice written only for hammers. Continuous weapons: no hit-stop; steady shudder, spark fountain, rising grind, payoff tick every 10 HP. Mid-fight breakage: at about 66% and 33% HP a visible piece shears off as a chunk. navigator.vibrate on Android with a setting.
P10 nice: keyboard: left-hand alias for top mount (E or F), Power on R avoiding Shift Sticky Keys; preventDefault Tab.

### Art and sound director
A1 must: asset list omits garage (floor/wall tile, back wall), turntable, podium, tread side frame model; saw and hammer reused as League 6 hazards; rank badges as inline SVG.
A2 must: budget undercounts: 54+ images, 34 SFX; plan is $25.39 before additions. Re-baseline: add 6 SFX, garage textures, tread frame; spot-light, pylon and tire stack to code; voice is really about $0.02; sting 15 s. Margin needed.
A3 must: paint trick unproven; gate on Crate Mule through real recompress and shader with 3 schemes before ordering other models. Style line: "wear shows bare grey steel, no rust, no brown"; pass same as --texture-prompt. 4:4:4 JPEG. Every part including drive parts must show an orange panel. Name a fallback.
A4 must: part spec table: height in meters, forward axis, pivot location, concept rule. Moving parts: moving piece only, no bracket, axle centered, side view as second image. Chassis: body only, empty mount sockets. Static brackets in code.
A5 must: sounds missing: link-lost static, floor saw, pit rumble, tread loop, leg stomp, hover hum. Mark --loop items. Sting 15 s, ceremony reuses League 6 anthem with crowd. Crossfade in audio plan; garage track 90 s+.
A6 must: trophy robot won't read at phone size: each slot changes silhouette from above (oversized weapons and mounts 25-40% beyond chassis); floors in mid-value range, contact shadow and rim light; min zoom on phones; close-ups for KO and pre-fight; phone-size screenshot in first asset check.
A7 should: style line only covers parts. Add environment line and portrait line; first portrait and backdrop are sub-anchors. Crate Mule is the anchor; chip icons reference it.
A8 should: drafts mismatched: all drafts from picture with --pbr (still 15 credits); compare one draft and one full before batching.
A9 should: 12 of 18 rivals have no face. 4-6 generic helmeted driver portraits at 512 ($0.022) tinted in CSS. Move champion portraits off the cut list.
A10 should: backdrops barely visible from the booth cam. Low band of stands or skyline inside frame, slow pan in pre-fight and KO, High Rise shows street far below, unique lighting and a signature prop visible from above per arena.

### Builder
B1 must: moving weapons fused; generate only the moving piece (drum rotor, saw disc, hammer arm and head from the hinge end, flipper plate, drill bit, turret only). Brackets and hinges are code-built. Thin things need a 3/4 view or second image. GLB origin is at ground: compute pivots.
B2 must: assembly needs part-side anchors: parts manifest per part: scale in meters, attachOffset, rotFix, pivot, axis; per chassis named sockets with position, normal, max size. Chassis concepts bare. Bare-part style reference, not assembled robot. Shared code-built adapter hides joins. Skirts hang from per-chassis code rails. Automated contact sheet chassis x slot at 2 angles.
B3 must: hue paint at runtime will misfire. Bake masks at asset time with Pillow: HSV thresholds in sRGB per model, median filter, dilate, small mask (R=paint 1, G=paint 2); runtime samples mask, multiplies base luminance by paint. Acceptance gate with mask preview and min coverage. 4:4:4 or WebP. Patterns in chassis coordinates with a world-scale factor. One customProgramCacheKey; precompile before fight.
B4 must: one recorded timeline per fight proves nothing. Sim, robot, ai, catalog free of DOM, three.js and assets, runs in Node. tools/simtest.mjs: scripted bot through input interface with human limits (250 ms reaction, imperfect aim). One canonical run in a file (per fight: build, picks, purchases) plus a minimal-build variant. N seeds, win-rate table with floors per league on Normal (League 1 >90%, champions >40%). Solutions generated from bot with fixed seed and replayed in browser; goToLevel(n) loads canonical build. Nemesis tested with several builds. Sim-state hash at replay end. Separate RNG streams sim vs FX. Hit-stop and slow motion view-only or defined in ticks. step() loops 1/60.
B5 must: download 65-75 MB; SW pulls all. Hard ceiling about 35 MB, under 5 MB before title. Local Python recompress (already written: tools/optimize_glb.py; gives 9.47 -> 1.18 MB for 1024/512). 1024 only for chassis, 512 weapons, 256-512 small; drop normal maps on small parts. Part thumbnails rendered at build time to one WebP atlas. Change sw.js: install pre-caches core only, rest filled in background file by file, failures tolerated, "offline ready" state. Pre-fight load gate waits for both robots, arena, audio.
B6 must: phones: state budgets: 60k tris per robot, 120k in view, 150 MB textures, 60 draw calls. Legs 2.5k, wheels 2k, skirts 1.5k, shared geometry or InstancedMesh. Blob shadow or proxy on phones. Dispose prior arena and rival textures. Phones pixel ratio cap 1.5, lower texture tier if needed. Cheaper floor material. Test scene with two worst-case robots.
B7 must: no numbers. Table of starting numbers for every part per Mk; scrap economy (income per league vs price); AI spec: state machine (approach, attack window per weapon profile (range, arc, charge, hold), retreat, recover, hazard avoid via danger grid, stuck detection), per-rival personality (reaction, aim error, aggression, hazard use). Height states: grounded, airborne, flipped, and what happens at wall or edge crossing. Define immobile; stalemate rule.
B8 should: budget has little retry room; compare draft and full; cut list needs model drops in catalog fallback order (mines, one power, spike skirt); stop and reassess after first 6 models.
B9 should: booth cam never sees horizon: raked stand planes with crowd past walls; High Rise street image below with parallax; one 1K backdrop per arena for pre-fight and chase cam; verify with framing mock-up.
B10 should: touch: Lock under 64 px; thumb arc around main at 9, 10, 12 o'clock; pause and camera 44 px visual with 64 px hit area; camera center offset on phones; test 667x375 and 844x390; blur focus on fight start.

## Round 1 outcomes

| Finding | Severity | Evidence | Outcome |
|---|---|---|---|
| P1 first salvage dud | must | Verified: old table gives League 1 only rams | Fixed: League 1 loadouts part by part (saw, spike wheels, plates; flipper, Doorstop, skirt; hammer, autocannon); guarantee of 2 unowned cards, with a spare added if short |
| P2 screen flow undefined | must | Verified: design had no flow | Fixed: Flow section: Contract, fight 1 prompts, equip on the spot, Build highlighted, Exchange after win 2, Paint after win 3, Back to Garage on Pre-fight, NEXT FIGHT names rival and arena |
| P3 finished robot not 'everyone I beat' | must | Judgment | Fixed: Retrofit at the bench with prices; code-built trophy per champion; Mk II trim glow, Mk III chrome; Mk III never sold; chip table with sources |
| P4 right thumb overloaded | must | Verified: old stack is 96+72+56 px plus gaps, tall for 360-390 px | Fixed: arc at 9, 10:30, 12 o'clock with exact offsets; hold weapons latch on touch (latch chosen over slide); empty slots hidden |
| P5 robots small in booth cam | should | Verified: 2 m of a 22 m view is 9% | Fixed: framing formula, 12-13 m minimum view (15-17% in melee), push-in within 4 m, zoom punch, facing wedge, danger arc, ring colors |
| P6 Target Lock best play | should | Judgment | Fixed: rear x1.25, side x1.1, BACKSTAB; Lock limited to turn rate; 60-80% speed by drive; AI flanks from League 3 |
| P7 stun chains, one-hit ring-outs | should | Judgment | Fixed: 1.5 s stun immunity; High Rise stripe, kerb, 8 m/s or under 30% HP threshold, teeter; wind telegraphed 1 s |
| P8 finale thin | should | Judgment | Fixed: Sovereign in full with two phases at pit opening; dynamic taunt on stolen part; chassis from League 6 Exchange or Duchess wreck; Dead Ringer locked build, free Mk and black finish; champion's lap |
| P9 juice only for hammers | should | Judgment | Fixed: continuous-weapon rules (no hit-stop, shudder, fountain, grind, tick every 10 HP); shear-off at 66% and 33%; vibrate with a setting |
| P10 keyboard aliases | nice | Judgment | Fixed: top mount K/E/F; Power L/R; Shift unbound; Tab preventDefault |
| A1 asset list gaps | must | Verified: garage, turntable, podium, tread frame absent from old list | Fixed: garage textures and wall; tread frame; turntable, podium, lift in code; saw and hammer reused as League 6 hazards; badges inline SVG |
| A2 budget undercounted | must | Verified: recount gives 54 images, 34 SFX, about $25.4 plan; voice cost per director's price | Fixed: re-baselined to $21.06 + $3.50 margin = $24.56; props in code; thruster reused for jets; 4 sounds in code; voice $0.05; sting 15 s; 6 sounds added |
| A3 paint trick unproven | must | Verified: .gamegen/gate.png, 6 schemes on real recompressed Crate Mule | Fixed: gate already passed; part line has no rust, no brown and is also --texture-prompt; 4:4:4 (optimize_glb.py line 46); orange panel on every part; fallback named |
| A4 part spec table | must | Verified: Crate Mule faces +X, per test | Fixed: Part specs table: height, forward, pivot, axis, concept rule for all 28; side views as second image; bare chassis; brackets in code |
| A5 sounds missing | must | Verified: 6 absent from old list; asset-guide: --loop for SFX, none for music | Fixed: tread, hover, leg, pit generated; static and floor saw in code; loops marked; sting 15 s; ceremony reuses anthem; crossfades; garage track 90 s |
| A6 trophy robot won't read at phone size | must | Judgment | Fixed: weapons and mounts 25-40% past chassis in heights; mid-value floors; contact shadow, rim light; phone minimum zoom; close-ups; phone screenshot in asset checks and framing mock-up |
| A7 style line covers only parts | should | Judgment | Fixed: environment and portrait lines; first backdrop and portrait are sub-anchors; Crate Mule is the anchor, chips reference it |
| A8 drafts mismatched | should | Verified: meshgen --dry-run: --draft --pbr with 2 images is 15 credits | Fixed: all from picture with --pbr; drum draft vs full test before batching, with decision rule |
| A9 12 rivals with no face | should | Verified: old list had 6 portraits for 18 drivers | Fixed: 5 generic portraits at 512, tinted in CSS; champion portraits moved off the cut list |
| A10 backdrops barely visible | should | Judgment | Fixed: surround column per arena, low band in frame, slow pan in Pre-fight and KO, High Rise street, lighting and signature per arena |
| B1 moving weapons fused | must | Verified: meshgen SKILL: models stand on y = 0 | Fixed: moving piece only; brackets and hinges in code; thin things get 3/4 or side view; pivots in bounding-box fractions |
| B2 assembly anchors | must | Judgment; bare-chassis concept verified faithful | Fixed: manifest fields, named sockets, shared adapters, skirts on rails, contact sheet tool in Definition of done; anchor is bare part, not assembled |
| B3 runtime hue paint | must | Verified: tools/bake_mask.py and game/src/paint.js work on Crate Mule | Fixed: baked masks with per-model acceptance, threshold then regenerate fallback, chassis-coordinate patterns, single cache key, precompile |
| B4 one timeline proves nothing | must | Judgment | Fixed: Node sim free of DOM and three.js, simtest bot, canonical and minimal run files, floors table, generated replays, sim hash, separate RNG, view-only hit-stop, step at 1/60, Dead Ringer with 4 builds |
| B5 download size, SW pulls all | must | Verified: optimize_glb.py 9.47 to 1.18 MB; web-target.md sw.js uses cache.addAll. 65-75 MB not reproduced as such: depends on per-model size | Fixed: 35 MB ceiling (estimate 34), 5 MB before title, tiered textures, thumbnail atlas, sw.js core then background fill with Offline ready, load gate |
| B6 phone budgets | must | Judgment; tri sums worked out in design | Fixed: budget table, 56k worst-case robot, instancing, blob shadow, pixel ratio 1.5, disposal, cheaper floor, worst-case test scene |
| B7 no numbers | must | Verified: old design lacked them | Fixed: full part tables with Mk triples, economy, AI states and profiles, personality per rival, height states, immobile and stalemate rules |
| B8 budget and cut order | should | Verified by recount | Fixed: margin $3.50 (above $2.50 floor) plus $0.44; model drops in fallback order; stop after six models. Numbers are estimates until the simtest tunes them |
| B9 booth cam never sees horizon | should | Judgment | Fixed: raked crowd planes, band in frame, street parallax, framing mock-up step. Changed: one 2K 21:9 per arena serves both band and Pre-fight, instead of an extra 1K |
| B10 touch details | should | Judgment | Fixed: Lock 64 px; arc at 9, 10:30, 12; pause and camera 44 px with 64 px hit; camera offset; test at 667x375 and 844x390; focus blurred |
| Director: originality | - | Judgment: Lockjaw and Nemesis match or may match real robot names; Rustbucket conflicts with no-rust; Hot Rod is a toy-line name | Fixed: renamed to Mabel's Mallet, Dead Ringer, Bent Fender, Hotfoot; Skidmark to Sideslip as a precaution. Other names not searched against a database |

## Round 2 findings and outcomes

Reviewers found no new structural problems; they found numeric and coverage gaps. The director applied these directly as "Round 2 amendments" at the end of GAME_DESIGN.md rather than through a further full rewrite, since the sim's numbers are checked by tools/simtest.mjs anyway. Arithmetic claims are verified in simtest where they depend on play.

| Finding | Severity | Evidence | Outcome |
|---|---|---|---|
| Saw dominates; load rarely matters; chassis have no trade-off | must | Arithmetic, verified by reading the table | Fixed: saw 18 DPS and self-slow, hammer, drum, drill, rail raised, capacity cut, chassis speed factor |
| League 6 hazards break tris budget | must | Arithmetic verified | Fixed: floor saws code-built, perf scene is the Bowl with all hazards |
| Economy never forces a choice; Exhibition too rich | should | Arithmetic | Fixed: Exhibition one pick at one Mk below, no payout; Mk III sells at 2.0x |
| Can't circle to the rear | should | Arithmetic | Fixed: treads turn 130; rivals aim at stale positions from reaction time; simtest reports backstabs |
| Fights too short; boss pit may never open | should | Arithmetic | Fixed: rival HP scales by league; pit opens 3 s after Phase 2 starts; simtest reports median length |
| Hover one-hit ring-out | should | Arithmetic | Fixed: knockback decay floor, kerb stops all but under 30% HP or a hit while teetering |
| Framing only covers floor width | should | Arithmetic | Fixed: fit both robots to both axes by projection; off-screen arrow for the extreme; test renamed |
| Weapon ranges vs model sizes | should | Table check | Fixed: ranges match reach; oversized parts overhang |
| Salvage guarantee undefined | should | Table check | Fixed: pool and "Fully stocked" fallback |
| Chip stock vs drops | should | Table check | Fixed: one copy each, duplicate drop pays scrap, chips can't be sold, Sovereign no chip |
| Music not assigned per screen; no sound on loss | should | Design check | Fixed: screen-to-audio table |
| Hazards and finishes silent | should | Design check | Fixed: 2 more SFX and stated reuses |
| Weapon state silent | should | Design check | Fixed: code-made SFX |
| Lava and code props have no surface art | should | Design check | Fixed: steel trim sheet, lava tile |
| Sovereign rail on top not on contact sheet | should | Design check | Fixed: per-chassis override and a contact sheet row |
