// vehicles.js — cars: mesh factory, arcade driving physics for the player,
// grid-following AI traffic, and the chase van used by mission 2.
// Cars are built from boxes and cylinders only — no imported models.
import * as THREE from 'three';
import { clamp, lerp, angleLerp, dist2, collideCircleBox } from './util.js';

const bodyGeo = new THREE.BoxGeometry(2, 0.62, 4.3);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
const lightGeo = new THREE.BoxGeometry(0.42, 0.18, 0.1);
const barGeo = new THREE.BoxGeometry(0.5, 0.16, 0.5);

export function createCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  g.name = opts.police ? 'PoliceCar' : 'Car';
  const paint = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.55,
  });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.8 });
  const cabin = new THREE.Mesh(cabinGeo, glass);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const tire = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Group();
    const tireMesh = new THREE.Mesh(wheelGeo, tire);
    tireMesh.rotation.z = Math.PI / 2;
    const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.37, 8), hub);
    hubMesh.rotation.z = Math.PI / 2;
    w.add(tireMesh); w.add(hubMesh);
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 2.4 });
  for (const hx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(hx, 0.72, 2.16);
    g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2222, emissiveIntensity: 2 });
  for (const hx of [-0.62, 0.62]) {
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(hx, 0.72, -2.16);
    g.add(t);
  }
  let beaconL = null, beaconR = null;
  if (opts.police) {
    beaconL = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2020, emissiveIntensity: 3 }));
    beaconL.position.set(-0.4, 1.55, -0.25);
    beaconR = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2266ff, emissiveIntensity: 3 }));
    beaconR.position.set(0.4, 1.55, -0.25);
    g.add(beaconL); g.add(beaconR);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.32),
      new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5 }));
    stripe.position.y = 0.85;
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  g.userData.beaconL = beaconL;
  g.userData.beaconR = beaconR;
  return g;
}

export class Car {
  constructor(mesh, x, z, angle, opts = {}) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.color = opts.color || 0x888888;
    this.kind = opts.kind || 'traffic'; // traffic | player | police | van
    this.target = null;      // traffic: {x,z} waypoint
    this.stuck = 0;
    this.flashT = 0;
    this.health = 100;
    this.dead = false;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  forward() { return { x: Math.sin(this.angle), z: Math.cos(this.angle) }; }
}

export function makeTrafficCar(scene, city, rng, colors) {
  const color = rng.pick(colors);
  const mesh = createCarMesh(color);
  scene.add(mesh);
  const p = { x: rng.pick(city.roadCenters), z: rng.range(-city.bounds + 20, city.bounds - 20) };
  const car = new Car(mesh, p.x, p.z, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), { color, kind: 'traffic' });
  car.speed = rng.range(7, 11);
  car.target = pickTrafficTarget(city, rng, car);
  return car;
}

function pickTrafficTarget(city, rng, car) {
  // Next intersection along the grid, Manhattan-style.
  const c = rng.pick(city.roadCenters);
  if (rng.next() < 0.5) return { x: c, z: car.z };
  return { x: car.x, z: c };
}

// One traffic car step: drive Manhattan-style along the street grid toward
// its waypoint (never cutting across blocks), turning at intersections, and
// slowing down when another car is right ahead.
export function updateTrafficCar(car, dt, city, rng, others) {
  if (!car.target) car.target = pickTrafficTarget(city, rng, car);
  const dx = car.target.x - car.x, dz = car.target.z - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 4) { car.target = pickTrafficTarget(city, rng, car); return; }
  // Axis-aligned heading: follow the street grid instead of driving diagonal.
  let wantAngle;
  if (Math.abs(dx) > Math.abs(dz)) wantAngle = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  else wantAngle = dz > 0 ? 0 : Math.PI;
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 5));
  let desired = 9;
  for (const o of others) {
    if (o === car || o.dead) continue;
    const od = dist2(car.x, car.z, o.x, o.z);
    if (od < 9) {
      const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
      const dot = (o.x - car.x) * fx + (o.z - car.z) * fz;
      if (dot > 0 && od < 9) desired = 0;
    }
  }
  car.speed = clamp(car.speed + (desired - car.speed) * dt * 1.5, 0, 12);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  // Stay inside the city; bounce back at the edge.
  if (Math.abs(car.x) > city.bounds - 6 || Math.abs(car.z) > city.bounds - 6) {
    car.target = { x: 0, z: 0 };
  }
  car.syncMesh();
  spinWheels(car, dt);
}

export function spinWheels(car, dt) {
  const wheels = car.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.x += car.speed * dt * 1.6;
}

// Arcade player driving: W/S accelerate and brake/reverse, A/D steer,
// Space handbrake. Collisions with buildings push the car out and cut speed.
export function updatePlayerCar(car, input, dt, city, others) {
  const axes = input.moveAxes();
  const accel = axes.y > 0 ? 16 : axes.y < 0 ? -11 : 0;
  const braking = input.down('Space');
  car.speed += accel * dt;
  if (braking) car.speed -= Math.sign(car.speed) * 26 * dt;
  if (axes.y === 0 && !braking) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.15 && axes.y === 0) car.speed = 0;
  car.speed = clamp(car.speed, -11, 33);
  const steerTarget = -axes.x * clamp(Math.abs(car.speed) / 8, 0, 1) * 0.55;
  car.steer = lerp(car.steer, steerTarget, Math.min(1, dt * 7));
  car.angle += car.steer * (car.speed / 9) * dt * (car.speed >= 0 ? 1 : -1);
  const nx0 = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz0 = car.z + Math.cos(car.angle) * car.speed * dt;
  let cx = nx0, cz = nz0;
  let hit = false;
  for (const b of city.colliders) {
    const res = collideCircleBox(cx, cz, 1.9, b);
    if (res) { cx = res.x; cz = res.z; hit = true; }
  }
  car.x = cx; car.z = cz;
  if (hit && Math.abs(car.speed) > 4) {
    car.speed *= 0.45;
    return 'crash';
  }
  car.x = clamp(car.x, -city.bounds + 4, city.bounds - 4);
  car.z = clamp(car.z, -city.bounds + 4, city.bounds - 4);
  // Soft car-to-car bumps.
  for (const o of others) {
    if (o === car || o.dead) continue;
    const d = dist2(car.x, car.z, o.x, o.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const ux = (car.x - o.x) / d, uz = (car.z - o.z) / d;
      car.x += ux * push; car.z += uz * push;
      o.x -= ux * push; o.z -= uz * push;
      car.speed *= 0.7; o.speed *= 0.7;
    }
  }
  car.syncMesh();
  spinWheels(car, dt);
  return null;
}

// Police chase steering: aim at the target, faster than traffic, rams.
export function updatePoliceCar(car, dt, city, target, time) {
  const dx = target.x - car.x, dz = target.z - car.z;
  const wantAngle = Math.atan2(dx, dz);
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 4.5));
  const d = Math.hypot(dx, dz);
  const desired = d > 26 ? 30 : d > 8 ? 24 : 16;
  car.speed = clamp(car.speed + (desired - car.speed) * dt * 1.2, 0, 32);
  let nx = car.x + Math.sin(car.angle) * car.speed * dt;
  let nz = car.z + Math.cos(car.angle) * car.speed * dt;
  for (const b of city.colliders) {
    const res = collideCircleBox(nx, nz, 1.9, b);
    if (res) { nx = res.x; nz = res.z; car.speed *= 0.6; }
  }
  car.x = clamp(nx, -city.bounds + 4, city.bounds - 4);
  car.z = clamp(nz, -city.bounds + 4, city.bounds - 4);
  // Flashing light bar.
  car.flashT += dt;
  const on = Math.sin(car.flashT * 10) > 0;
  const bl = car.mesh.userData.beaconL, br = car.mesh.userData.beaconR;
  if (bl) bl.material.emissiveIntensity = on ? 4 : 0.4;
  if (br) br.material.emissiveIntensity = on ? 0.4 : 4;
  car.syncMesh();
  spinWheels(car, dt);
  return d;
}
