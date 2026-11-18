// actors.js — people on foot: the player (Jay), pedestrians and the thugs
// of mission 3. Everyone is a low-poly figure of boxes with a walk cycle;
// pedestrians wander the sidewalks and flee from gunfire.
import * as THREE from 'three';
import { clamp, angleLerp, dist2, collideCircleBox, makeRng } from './util.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// A simple humanoid: legs, torso, arms, head. Returns { group, parts }.
export function createPersonMesh(shirt, pants, skin = 0xd9a077) {
  const g = new THREE.Group();
  const legL = box(0.22, 0.8, 0.26, pants, -0.14, 0.4, 0);
  const legR = box(0.22, 0.8, 0.26, pants, 0.14, 0.4, 0);
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.16, 0);
  const armL = box(0.18, 0.66, 0.2, shirt, -0.42, 1.18, 0);
  const armR = box(0.18, 0.66, 0.2, shirt, 0.42, 1.18, 0);
  const head = box(0.36, 0.36, 0.34, skin, 0, 1.72, 0);
  const cap = box(0.4, 0.1, 0.38, 0x222222, 0, 1.94, 0);
  g.add(legL, legR, torso, armL, armR, head, cap);
  g.userData.parts = { legL, legR, armL, armR, torso, head };
  return g;
}

export function animateWalk(mesh, phase, amount) {
  const p = mesh.userData.parts;
  if (!p) return;
  const s = Math.sin(phase) * amount;
  p.legL.rotation.x = s;
  p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8;
  p.armR.rotation.x = s * 0.8;
  p.torso.position.y = 1.16 + Math.abs(Math.cos(phase)) * 0.05 * amount;
}

export class Player {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.angle = Math.PI; // facing the camera start
    this.health = 100;
    this.walkPhase = 0;
    this.moving = false;
    this.speed = 0;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  // WASD moves relative to the camera yaw; Shift runs. Buildings block.
  update(input, cameraYaw, dt, city, others) {
    const axes = input.moveAxes();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 8.5 : 4.6;
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    // Forward is away from the camera: camera sits behind at yaw.
    let mx = 0, mz = 0;
    if (axes.y !== 0 || axes.x !== 0) {
      const fx = -sin, fz = -cos; // camera forward on the ground
      const rx = cos, rz = -sin;  // camera right (forward rotated -90 deg)
      mx = fx * axes.y + rx * axes.x;
      mz = fz * axes.y + rz * axes.x;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
    }
    this.moving = axes.x !== 0 || axes.y !== 0;
    this.speed = this.moving ? speed : 0;
    if (this.moving) {
      const targetAngle = Math.atan2(mx, mz);
      this.angle = angleLerp(this.angle, targetAngle, Math.min(1, dt * 12));
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      let bx = nx, bz = nz;
      for (const b of city.colliders) {
        const res = collideCircleBox(bx, bz, 0.55, b);
        if (res) { bx = res.x; bz = res.z; }
      }
      this.x = clamp(bx, -city.bounds + 2, city.bounds - 2);
      this.z = clamp(bz, -city.bounds + 2, city.bounds - 2);
      // Soft push against cars and NPCs.
      for (const o of others) {
        if (!o || o.dead) continue;
        const d = dist2(this.x, this.z, o.x, o.z);
        if (d < 1.6 && d > 0.01) {
          this.x += ((this.x - o.x) / d) * (1.6 - d);
          this.z += ((this.z - o.z) / d) * (1.6 - d);
        }
      }
      this.walkPhase += dt * speed * 1.6;
    }
    animateWalk(this.mesh, this.walkPhase, this.moving ? 0.7 : 0);
    this.syncMesh();
  }
}

export class Pedestrian {
  constructor(mesh, x, z, rng) {
    this.mesh = mesh;
    this.kind = 'ped';
    mesh.userData.owner = this;
    this.x = x; this.z = z;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.2, 2.2);
    this.target = null;
    this.flee = 0; // seconds of fleeing left
    this.walkPhase = rng.range(0, 6);
    this.dead = false;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  update(dt, city, rng, threat) {
    if (this.dead) return;
    if (threat && dist2(this.x, this.z, threat.x, threat.z) < 14) this.flee = 2.5;
    if (this.flee > 0) this.flee -= dt;
    if (!this.target || dist2(this.x, this.z, this.target.x, this.target.z) < 2) {
      this.target = {
        x: clamp(this.x + rng.range(-50, 50), -city.bounds + 5, city.bounds - 5),
        z: clamp(this.z + rng.range(-50, 50), -city.bounds + 5, city.bounds - 5),
      };
    }
    const dx = this.target.x - this.x, dz = this.target.z - this.z;
    const want = Math.atan2(dx, dz);
    this.angle = angleLerp(this.angle, want, Math.min(1, dt * 4));
    const sp = this.flee > 0 ? this.speed * 2.6 : this.speed;
    let nx = this.x + Math.sin(this.angle) * sp * dt;
    let nz = this.z + Math.cos(this.angle) * sp * dt;
    for (const b of city.colliders) {
      const res = collideCircleBox(nx, nz, 0.45, b);
      if (res) { nx = res.x; nz = res.z; this.target = null; }
    }
    this.x = clamp(nx, -city.bounds + 2, city.bounds - 2);
    this.z = clamp(nz, -city.bounds + 2, city.bounds - 2);
    this.walkPhase += dt * sp * 2.2;
    animateWalk(this.mesh, this.walkPhase, 0.6);
    this.syncMesh();
  }
}

// A mission-3 thug: chases the player on foot and punches when close.
export class Thug {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.kind = 'thug';
    mesh.userData.owner = this;
    this.x = x; this.z = z;
    this.angle = 0;
    this.health = 100;
    this.dead = false;
    this.attackCd = 0;
    this.walkPhase = 0;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  update(dt, city, player) {
    if (this.dead) return;
    this.attackCd -= dt;
    const d = dist2(this.x, this.z, player.x, player.z);
    if (d > 2.1) {
      const want = Math.atan2(player.x - this.x, player.z - this.z);
      this.angle = angleLerp(this.angle, want, Math.min(1, dt * 5));
      let nx = this.x + Math.sin(this.angle) * 3.4 * dt;
      let nz = this.z + Math.cos(this.angle) * 3.4 * dt;
      for (const b of city.colliders) {
        const res = collideCircleBox(nx, nz, 0.5, b);
        if (res) { nx = res.x; nz = res.z; }
      }
      this.x = nx; this.z = nz;
      this.walkPhase += dt * 7;
      animateWalk(this.mesh, this.walkPhase, 0.7);
    } else if (this.attackCd <= 0) {
      this.attackCd = 1.1;
      animateWalk(this.mesh, this.walkPhase, 0.2);
      return 'hit'; // main loop applies the damage
    }
    this.syncMesh();
    return null;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      // Fall over: lying flat reads as defeated at a glance.
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.25;
    }
  }
}

export function spawnPedestrians(scene, city, count, seed) {
  const rng = makeRng(seed);
  const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x2ecc71];
  const pants = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x1a1a1a, 0x5d4037];
  const list = [];
  for (let i = 0; i < count; i++) {
    const mesh = createPersonMesh(rng.pick(shirts), rng.pick(pants));
    scene.add(mesh);
    const x = rng.range(-city.bounds + 15, city.bounds - 15);
    const z = rng.range(-city.bounds + 15, city.bounds - 15);
    list.push(new Pedestrian(mesh, x, z, rng));
  }
  return list;
}
