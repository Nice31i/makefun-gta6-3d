// shots.js — staged screenshots for the dossier (?shot=...).
// Each shot starts the game (or leaves the title up) and stages one scene:
// start = title screen over the city, drive = Jay driving, police = a 3-star
// chase, mission = mission 1 with its beacon. The game sets
// window.__shotReady once the scene has settled, so the screenshot tool
// knows when to capture. No pointer lock is needed in shot mode.
import { createCarMesh, Car } from './vehicles.js';

export function applyShot(game, shot) {
  game.shotMode = shot;
  const showHud = () => document.getElementById('hud').classList.remove('hidden');

  if (shot === 'start') {
    // Title screen stays up; the menu camera orbits the skyline behind it.
    game.state = 'menu';
    game.showScreen('screen-start');
    return true;
  }

  // Every other shot plays the game with the HUD visible.
  game.state = 'playing';
  game.showScreen(null);
  showHud();
  game.cash = 1250;
  game.hud.setCash(game.cash);
  game.hud.setHealth(100);
  game.input.releaseLock();

  if (shot === 'drive') {
    const mesh = createCarMesh(0xd94f3d);
    game.scene.add(mesh);
    // Angle 0 faces +z, away from the chase camera (camera yaw PI sits at -z).
    const car = new Car(mesh, 30, 90, 0, { color: 0xd94f3d, kind: 'player' });
    car.speed = 20;
    game.playerCar = car;
    game.player.mesh.visible = false;
    game.player.x = car.x; game.player.z = car.z;
    game.cameraYaw = Math.PI;
    game.cameraPitch = 0.28;
    game.hud.setObjective('自由驾驶：按 M 接老K的任务');
    game.hud.toast('落日港 · 自由驾驶');
    return true;
  }

  if (shot === 'police') {
    const mesh = createCarMesh(0x3d7bd9);
    game.scene.add(mesh);
    const car = new Car(mesh, 30, 60, 0, { color: 0x3d7bd9, kind: 'player' });
    car.speed = 24;
    game.playerCar = car;
    game.player.mesh.visible = false;
    game.player.x = car.x; game.player.z = car.z;
    game.cameraYaw = Math.PI;
    game.cameraPitch = 0.28;
    game.police.raiseTo(3);
    // Stage the pursuit in frame ahead of the player car: two police cars
    // closing in from the front-left and front-right, one right alongside.
    // (Anything staged behind the player would sit behind the chase camera.)
    game.cameraYaw = Math.PI;
    game.police.spawnAt(20, 76, Math.PI);
    game.police.spawnAt(40, 76, Math.PI);
    game.police.spawnAt(38, 62, Math.PI);
    game.hud.setWanted(3);
    game.hud.setObjective('甩掉警察！通缉 3 星');
    game.hud.toast('通缉 3 星：警察正在追捕你！');
    return true;
  }

  if (shot === 'mission') {
    game.player.x = 120; game.player.z = 118;
    // Face the beacon at (150, 150): atan2(30, 32) ~ 0.75 rad. The camera
    // sits opposite that heading (yaw 1.25 PI) so the beacon is in frame.
    game.player.angle = 0.75;
    game.player.syncMesh();
    game.cameraYaw = Math.PI * 1.25;
    game.cameraPitch = 0.3;
    // Start mission 1 and skip its dialogue so the beacon + objective show.
    game.missions.index = 0;
    game.missions.dialogue = null;
    game.missions.beginObjective(game, game.missions.currentDef());
    game.hud.toast('任务 1：把包裹送到城东霓虹招牌处');
    return true;
  }

  return false;
}
