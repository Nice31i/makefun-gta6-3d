// missions.js — the story of Sunset Harbor: three jobs for Jay, given by
// fixer Lao K, each with briefing dialogue, an on-screen objective, a glowing
// beacon marker in the world and a cash reward. Completing all three ends
// the story with a "story complete" screen.
import * as THREE from 'three';
import { createPersonMesh, Thug } from './actors.js';
import { createCarMesh, Car } from './vehicles.js';
import { dist2, clamp } from './util.js';

function makeBeacon(scene, color) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9, 0),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 5;
  g.add(cyl, ring, diamond);
  g.userData.diamond = diamond;
  g.visible = false;
  scene.add(g);
  return g;
}

export const MISSIONS = [
  {
    id: 1,
    title: '第一单：落日港的包裹',
    giver: '老K',
    reward: 300,
    briefing: [
      '老K：阿杰，刚到落日港就想混出名堂？先帮我跑一腿。',
      '老K：码头仓库有个包裹，送到城东的霓虹招牌下。别惹条子。',
      '阿杰：放心，落日港的路，我闭着眼都认得。',
    ],
    objective: '把包裹送到城东霓虹招牌处（粉色光柱）',
  },
  {
    id: 2,
    title: '第二单：夺回货车',
    giver: '老K',
    reward: 500,
    briefing: [
      '老K：出事了！一伙小贼抢了我的货车，正在城里乱窜。',
      '老K：追上它，贴住它别让它甩掉。车抢回来，500块就是你的。',
      '阿杰：抢老K的车？这帮人不长眼，我去会会他们。',
    ],
    objective: '追上逃窜的货车，贴住它 3 秒',
  },
  {
    id: 3,
    title: '最后一单：仓库清场',
    giver: '老K',
    reward: 800,
    briefing: [
      '老K：最后一步。黑鲨的人占了西区仓库，今晚必须清场。',
      '老K：带上家伙，小心他们的拳头。干完这票，落日港就是你的了。',
      '阿杰：今晚之后，没人再敢小看阿杰。',
    ],
    objective: '到西区仓库，击败 3 名黑鲨打手',
  },
];

export class MissionManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.index = 0;           // next mission to start (0-based)
    this.active = null;       // active mission state or null
    this.completedCount = 0;
    this.storyDone = false;
    this.beacon = makeBeacon(scene, 0xff2e88);
    this.van = null;
    this.thugs = [];
    this.holdTimer = 0;
    this.dialogue = null;     // { lines, at, onDone } or null
  }

  currentDef() { return MISSIONS[this.index] || null; }

  hasNext() { return this.index < MISSIONS.length; }

  startMission(game) {
    const def = this.currentDef();
    if (!def || this.active || this.dialogue) return false;
    this.dialogue = {
      lines: def.briefing,
      at: 0,
      onDone: () => this.beginObjective(game, def),
    };
    game.showDialogue(def.giver, def.briefing[0]);
    return true;
  }

  advanceDialogue(game) {
    if (!this.dialogue) return false;
    const d = this.dialogue;
    d.at += 1;
    if (d.at >= d.lines.length) {
      const done = d.onDone;
      this.dialogue = null;
      game.hideDialogue();
      if (done) done();
    } else {
      game.showDialogue(MISSIONS[this.index].giver, d.lines[d.at]);
    }
    return true;
  }

  beginObjective(game, def) {
    this.active = { def, stage: 0 };
    game.setObjective(def.objective);
    game.toast(`任务开始：${def.title}`);
    if (def.id === 1) {
      this.beacon.position.set(150, 0, 150);
      this.beacon.visible = true;
    } else if (def.id === 2) {
      const mesh = createCarMesh(0x8a5a2a);
      this.scene.add(mesh);
      this.van = new Car(mesh, -120, 30, Math.PI / 2, { color: 0x8a5a2a, kind: 'van' });
      this.van.speed = 13;
      this.van.target = { x: 150, z: 30 };
      this.holdTimer = 0;
    } else if (def.id === 3) {
      this.beacon.position.set(-150, 0, -150);
      this.beacon.visible = true;
      // Thugs appear once the player reaches the warehouse.
    }
  }

  spawnThugs(game) {
    const spots = [[-146, -146], [-154, -142], [-142, -156]];
    for (const [x, z] of spots) {
      const mesh = createPersonMesh(0x1a1a1a, 0x1a1a1a, 0xc98d64);
      this.scene.add(mesh);
      this.thugs.push(new Thug(mesh, x, z));
    }
    game.toast('黑鲨打手出现了！击败他们！');
  }

  update(dt, game, time) {
    if (this.beacon.visible) {
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.diamond.position.y = 5 + Math.sin(time * 2.5) * 0.5;
    }
    if (!this.active) return;
    const def = this.active.def;
    const px = game.playerCar ? game.playerCar.x : game.player.x;
    const pz = game.playerCar ? game.playerCar.z : game.player.z;
    if (def.id === 1) {
      if (dist2(px, pz, 150, 150) < 6) this.complete(game);
    } else if (def.id === 2 && this.van) {
      // The van flees along the grid away from the player (Manhattan moves,
      // so it stays on the streets instead of cutting through buildings).
      const van = this.van;
      const dx = van.target.x - van.x, dz = van.target.z - van.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) {
        const awayX = van.x - px, awayZ = van.z - pz;
        const road = this.city.roadCenters;
        const pickRoad = (v) => road.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
        if (Math.abs(awayX) > Math.abs(awayZ)) {
          van.target = { x: clamp(van.x + Math.sign(awayX || 1) * 120, -210, 210), z: pickRoad(van.z) };
        } else {
          van.target = { x: pickRoad(van.x), z: clamp(van.z + Math.sign(awayZ || 1) * 120, -210, 210) };
        }
      }
      const tdx = van.target.x - van.x, tdz = van.target.z - van.z;
      let wantAngle;
      if (Math.abs(tdx) > Math.abs(tdz)) wantAngle = tdx > 0 ? Math.PI / 2 : -Math.PI / 2;
      else wantAngle = tdz > 0 ? 0 : Math.PI;
      van.angle = wantAngle;
      van.x += Math.sin(van.angle) * van.speed * dt;
      van.z += Math.cos(van.angle) * van.speed * dt;
      van.syncMesh();
      const pd = dist2(px, pz, van.x, van.z);
      if (pd < 7) {
        this.holdTimer += dt;
        game.setObjective(`贴住货车！${Math.max(0, 3 - this.holdTimer).toFixed(1)} 秒`);
        if (this.holdTimer >= 3) this.complete(game);
      } else {
        this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
        game.setObjective(def.objective);
      }
    } else if (def.id === 3) {
      if (this.thugs.length === 0 && dist2(px, pz, -150, -150) < 14) {
        this.spawnThugs(game);
        game.setObjective('击败 3 名黑鲨打手（左键射击 / F 拳击）');
      }
      if (this.thugs.length > 0) {
        const left = this.thugs.filter((t) => !t.dead).length;
        game.setObjective(`击败黑鲨打手：还剩 ${left} 名`);
        if (left === 0) this.complete(game);
      }
    }
  }

  complete(game) {
    const def = this.active.def;
    this.active = null;
    this.beacon.visible = false;
    if (this.van) { this.scene.remove(this.van.mesh); this.van = null; }
    for (const t of this.thugs) this.scene.remove(t.mesh);
    this.thugs = [];
    game.cash += def.reward;
    this.completedCount += 1;
    this.index += 1;
    game.audio.jingle();
    game.audio.cash();
    game.toast(`任务完成！+ $${def.reward}（${this.completedCount}/3）`);
    game.setObjective(this.index < MISSIONS.length ? '按 M 开始下一个任务' : '故事完成！');
    if (this.index >= MISSIONS.length) {
      this.storyDone = true;
      game.onStoryComplete();
    }
    game.saveGame();
  }

  // Rebuild thugs/van after loading a save mid-mission: missions restart clean.
  resetForLoad() {
    this.active = null;
    this.dialogue = null;
    this.beacon.visible = false;
    if (this.van) { this.scene.remove(this.van.mesh); this.van = null; }
    for (const t of this.thugs) this.scene.remove(t.mesh);
    this.thugs = [];
  }
}
