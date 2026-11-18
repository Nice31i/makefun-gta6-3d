// police.js — the wanted system (0–5 stars) and the police response.
// Crimes raise the level; police cars spawn, chase and ram the player.
// Stay clean and out of sight and the heat cools off one star at a time.
import { createCarMesh, Car, updatePoliceCar } from './vehicles.js';

export const MAX_WANTED = 5;

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cars = [];
    this.heatTimer = 0;   // time since the last crime
    this.coolTimer = 0;   // cooldown countdown while clean
    this.bustTimer = 0;
  }

  // Any crime: raise to at least `level` and restart the heat timer.
  addCrime(level) {
    this.raiseTo(level);
  }

  raiseTo(level) {
    if (level > this.wanted) {
      this.wanted = Math.min(MAX_WANTED, level);
      this.heatTimer = 0;
      this.coolTimer = 0;
    }
  }

  clear() {
    this.wanted = 0;
    this.heatTimer = 0;
    this.coolTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
  }

  // Spawn one police car at an exact spot (used by the staged chase shot
  // so the pursuit is in frame from the first second).
  spawnAt(x, z, angle) {
    const mesh = createCarMesh(0xf2f2f2, { police: true });
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, angle, { color: 0xf2f2f2, kind: 'police' });
    car.speed = 16;
    this.cars.push(car);
    return car;
  }

  desiredCars() {
    if (this.wanted === 0) return 0;
    return Math.min(1 + this.wanted, 5); // 1 star -> 2 cars, 5 stars -> 5 cars
  }

  update(dt, city, playerPos, inCar, audio, time) {
    this.heatTimer += dt;
    // Cool off: 25 s clean, then lose a star every 8 s.
    if (this.wanted > 0 && this.heatTimer > 25) {
      this.coolTimer += dt;
      if (this.coolTimer > 8) {
        this.coolTimer = 0;
        this.wanted -= 1;
        if (this.wanted === 0) this.clear();
      }
    }
    // Spawn / despawn to match the wanted level.
    const want = this.desiredCars();
    while (this.cars.length < want) {
      const a = Math.random() * Math.PI * 2;
      const d = 40 + Math.random() * 20;
      const mesh = createCarMesh(0xf2f2f2, { police: true });
      this.scene.add(mesh);
      const car = new Car(mesh,
        playerPos.x + Math.sin(a) * d,
        playerPos.z + Math.cos(a) * d,
        a, { color: 0xf2f2f2, kind: 'police' });
      car.speed = 12;
      this.cars.push(car);
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // Chase.
    let nearest = Infinity;
    for (const car of this.cars) {
      const d = updatePoliceCar(car, dt, city, playerPos, time);
      nearest = Math.min(nearest, d);
      // Ram damage when a police car touches the player.
      if (d < 3.6) {
        if (inCar) {
          // Ramming a car the player drives slows it hard.
          car.speed *= 0.4;
        }
        this.bustTimer += dt;
      }
    }
    if (nearest > 4) this.bustTimer = Math.max(0, this.bustTimer - dt);
    // Siren while any police car is active.
    if (this.cars.length > 0) audio.startSiren(); else audio.stopSiren();
    return { nearest, ramming: this.bustTimer > 0.35 };
  }
}
