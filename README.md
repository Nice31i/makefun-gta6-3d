# 落日港霓虹 · Sunset Neon City 3D

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Nice31i/makefun-gta6-3d/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Nice31i/makefun-gta6-3d/reward.svg)](https://make.fun/bounty/gta6-01)

A complete 3D open-world crime game in the browser, built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01). Explore Sunset Harbor — a sun-soaked, neon-lit harbour city — on foot and by car, steal cars, outrun the police, and run three story jobs for the fixer Lao K.

## Play it

Run it locally:

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — every file the game loads lives under `game/`, including the vendored three.js.

## The game

- **Open world**: a seeded procedural 3D city — 8×8 blocks of varied buildings with lit windows, neon signs, street lamps, palm trees, parks and a harbour skyline, all in three.js.
- **On foot and by car**: third-person chase camera with mouse orbit (pointer lock), WASD walking and running, E to steal and enter cars, arcade driving with handbrake.
- **Traffic and pedestrians**: AI cars follow the street grid, pedestrians wander the sidewalks and flee from gunfire.
- **Wanted 0–5 stars**: stealing cars, hurting pedestrians and shooting raise the heat; police cars spawn, chase and ram you, sirens wailing. Stay clean and the heat cools off.
- **3 story missions**: briefing dialogue with Lao K, beacon markers, objectives and cash rewards — a delivery, a van chase, and a warehouse clear-out against three thugs.
- **Combat**: punch (F) and hitscan shooting (mouse click) with tracers.
- **Pickups, HUD and save**: cash stacks and health kits, cash/health/wanted/speed HUD with a live 2D minimap, start/pause/death/story-complete screens, localStorage autosave.
- **Sound**: all effects synthesized with WebAudio — engine hum, gunshots, sirens, cash chimes. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Camera orbit (click to lock) |
| E | Enter / exit car (steal it) |
| Left click | Shoot |
| F | Punch |
| Shift | Run |
| Space | Handbrake |
| M | Start next mission |
| P | Pause |

## Screenshots

`?shot=start` title screen, `?shot=drive` driving, `?shot=police` 3-star chase, `?shot=mission` mission 1 in progress — staged renders used for `screenshots/`.

## Known limits

- Shooting is on foot only (no drive-by shooting); police ram rather than arrest.
- The city is procedural and seeded, so every player gets the same Sunset Harbor.
- Sound is synthesized WebAudio and starts on the first click/keypress, per browser autoplay rules.

## Files

- `game/index.html` — page, HUD and menus
- `game/src/main.js` — bootstrap, game loop, camera, combat, pickups
- `game/src/city.js` — procedural city generation
- `game/src/vehicles.js` — car meshes, driving physics, traffic AI
- `game/src/actors.js` — player, pedestrians, thugs
- `game/src/police.js` — wanted system and police chases
- `game/src/missions.js` — the three story jobs
- `game/src/hud.js` — HUD, minimap, screens
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js`, `game/src/save.js`, `game/src/shots.js`, `game/src/util.js`
- `game/vendor/three.module.min.js` — three.js 0.160.0, vendored
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

All city, character, vehicle, story, art and sound in this game is original — nothing from any commercial game.
