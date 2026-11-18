// util.js — small shared helpers: seeded random numbers, clamps and angles.
// Every procedural part of Sunset Harbor (buildings, traffic, pedestrians) draws
// from one seeded generator so the city looks the same on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Shortest signed difference between two headings, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Shortest-path interpolation between two headings (radians).
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Circle (x, z, r) pushed out of an axis-aligned box; returns the corrected
// position or null when there is no overlap. Used for players, cars and NPCs.
export function collideCircleBox(x, z, r, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r, hit: true };
  }
  // Centre inside the box: shove out along the smallest penetration axis.
  const pl = x - box.minX, pr = box.maxX - x, pt = z - box.minZ, pb = box.maxZ - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - r, z, hit: true };
  if (m === pr) return { x: box.maxX + r, z, hit: true };
  if (m === pt) return { x, z: box.minZ - r, hit: true };
  return { x, z: box.maxZ + r, hit: true };
}
