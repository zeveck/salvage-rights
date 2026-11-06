# Salvage Rights

## Requests
1. A game in which you start with a simple robot and battle other robots in a battle arena, kinda like Battle Bots, but more elaborate robots. When you win you get to take a part from the other
  robot, which upgrades you. You go through a series of battles getting stronger and moving thorugh the ranks to be the battle champion. Between battles there's a "garage" or something where you can change
  out your parts/buffs. You can also sell/buy between things in the garage. There should be a variety of arenas. It should probably be a 3d game. You remote control during the fight. You can have cool
  weapons, powers, etc. You can also redesign/paint your robot. --budget 25 --3d --publish --no-confirm
2. --package steam
3. --change add a two-player mode on one keyboard --publish --no-confirm
4. --change make the High Rise fight against Updraft more forgiving. also, the flip effect seems a bit too effective since it flips you every time (unless there are mods to help, but i didn't see any). --publish --no-confirm
   Note during that change: "I think it's because the flip is very effective but doesn't hurt that much, but it makes it a bit tedious to fight, so it should probably work less and hurt a bit more. Also, the buzz saw seemed pretty ineffective when I used it / had it used against me, which was odd. Not saying to make it super strong though. I think were just need a general play balancing pass maybe."

## Settings
- 3D: yes
- Platform: both (desktop + phone landscape)
- Target: web
- Scope: medium (judged from the request; 6 leagues, 18 fights, 6 arenas, about 30-40 minutes)
- Budget: $25
- Rounds: 2
- Publish: first to github.io; then moved to salvagerights.synapticnoise.com with the gallery and making-of, from .env settings
- Credit: Rich Conlan (from github)
- ElevenLabs tier: creator (reported by the setup check). No credit line needed; selling is allowed.
- Available: imagegen2, nanogen, audiogen, meshgen (2047 credits), playwright-cli, Pillow (installed this run)

- Desktop version: 1.0.0

## Phases
- [x] 1 Brief: written
- [x] 2 Design: first draft written, about $25 asset plan
- [x] 3 Design review: 2 rounds; round 2 applied as amendments in the design
- [x] 4 Assets: 28 models, 38 SFX, 10 voice lines, 5 music tracks, textures, backdrops, portraits, chips
- [x] 5 Build: done
- [x] 6 Play-test: full run from New Game to champion after the last fixes (the bot took the Easy offer partway); no console errors
- [x] 7 Final review: playtester and bug hunter; findings fixed
- [x] 8 Polish pass: findings fixed
- [x] 9 Wrap up: published at https://salvagerights.synapticnoise.com/ (zeveck/salvage-rights), in the synapticnoise.com gallery

## Notes
- Paint gate passed on Crate Mule (baked mask + shader, 6 schemes, screenshot .gamegen/gate.png). tools/optimize_glb.py and tools/bake_mask.py work. game/src/paint.js is real code.
- Spent so far: $0.63 (crate concept + crate model).
- Design review round 1: findings in REVIEW_LOG.md; refiner applying.
- Assets: audio done ($6.23). Draft models need polycount 6000 to keep paint (1500-2000 lost it); leg side view makes a twin-leg unit, which we use (2 units = 4 legs). All remaining parts ordered via tools/make_part.mjs. .gamegen/spend.log tracks credits.

## Where things stand (update with care)
- Build: game runs on desktop and phone. All screens exist. Sim, AI, garage, salvage, paint, ladder, hazards all in.
- Tests: tools/simtest.mjs, tools/autotune.mjs, tools/weapons.mjs, tools/make-solutions.mjs, tools/replay.mjs, tools/contact-sheet.mjs. .gamegen/fullrun.js plays from New Game with real clicks.
- Browser replay of fight 1 matched the Node sim's hash exactly.
- Found by full-run test: a player could get stuck at the first champion (weak ram, weak flipper, nothing to buy). Added sponsor deals (next league's stock after 2 straight losses), Exchange from win 1, stronger ram and flipper. Weapons rebalanced; rivals being retuned against the mean of all nine weapons.
- A full run earlier looped for 45 minutes without anyone noticing. Rule for this project now: every long run writes a progress line per fight, has a time limit, stops after 6 straight losses at one fight, and is watched by a monitor that warns if it stops advancing.
- TODO: retune, re-record solutions, replay all 18 in the browser, full run on desktop, phone pass, first-load film, offline test, final reviews, polish, README, social card, publish to github.io as salvage-rights. Credit: Rich Conlan.
- ElevenLabs plan: creator. Credit line removed.

## Finished
- First live at the github.io address and checked at desktop and phone sizes: no errors, offline cache reports 100%.
- Known: not played by a human; feel and sound unjudged. Fight 14's browser replay differs from Node by about one hit near the end, cause unknown; it has been won in full playthroughs.
- Serve locally with tools/serve.py (caching off).

## Packaged
- Version 1.0.0, Windows and Linux, plus Steam files in dist/steam/ (dist/ is not committed). STEAM_APP_ID, STEAM_DEPOT_WINDOWS and STEAM_DEPOT_LINUX: not set yet.
- Not run: Linux app (no GTK in the container), Windows app. Controller tested with a simulated pad. Desktop buttons tested in a browser with a stand-in bridge.
- The online version doesn't have controller menus or the credit change until the next publish.

## Change: two-player mode (done)
- Versus built as a separate path; 3 announcer lines (under $0.05). Career fights identical: 18/18 by tools/career-unchanged.mjs. Career save byte-for-byte unchanged after matches.
- Roster overall 48-51% with bots; individual pairings still lopsided. Not played by two people.
- Full career run reached the Champion screen after the change; bot took Easy, and lost 12 straight at Updraft before winning.
- The desktop and Steam builds in dist/ are version 1.0.0, from before this change: repackage to include Versus, as version 1.1.0.

## Change: flips, Updraft and a balance pass (done)
- Flip Risk 10-50% by build, launch immunity 6 s, launches can't ring you out, flipper hits harder. Saw no longer pushes targets out of reach; Ram, Sledge, Rail up; Arc down. Updraft eased. No new assets.
- Full career run on the final balance reached the Champion screen with 8 losses (was 20-24), at most 3 in a row. Bot took Easy. Browser replay 17/18, fight 14 still loses in replay only and is won in the full run. Falls on open-sided arenas need under 15% health.
- All 18 recordings re-made on purpose, since weapons changed. Versus retuned. Numbers are from bots, not people.
