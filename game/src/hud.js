// hud.js — the 2D overlay: cash, health, wanted stars, speed, objective,
// dialogue box, toasts, the canvas minimap and the menu / pause / death /
// complete screens. All DOM; the 3D canvas underneath never draws the HUD.
export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.cashEl = this.el('cash');
    this.healthFill = this.el('health-fill');
    this.starsEl = this.el('stars');
    this.speedEl = this.el('speed');
    this.objectiveEl = this.el('objective');
    this.objectiveBox = this.el('objective-box');
    this.toastEl = this.el('toast');
    this.dialogueEl = this.el('dialogue');
    this.dialogueName = this.el('dialogue-name');
    this.dialogueText = this.el('dialogue-text');
    this.crosshair = this.el('crosshair');
    this.damageEl = this.el('damage');
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.damageTimer = null;
  }

  setCash(v) { this.cashEl.textContent = `$${v.toLocaleString('en-US')}`; }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    this.healthFill.style.width = `${pct}%`;
    this.healthFill.style.background = pct > 50 ? '#39d353' : pct > 25 ? '#ffb020' : '#ff4444';
  }

  setWanted(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    this.starsEl.textContent = s;
    this.starsEl.style.color = n > 0 ? '#ffd21a' : 'rgba(255,255,255,0.55)';
    this.starsEl.style.textShadow = n > 0 ? '0 0 8px rgba(255,210,26,0.8)' : 'none';
  }

  setSpeed(kmh, inCar) {
    this.speedEl.textContent = inCar ? `${Math.round(Math.abs(kmh))} km/h` : '';
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
    this.objectiveBox.style.display = text ? 'block' : 'none';
  }

  toast(text, ms = 3200) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, ms);
  }

  showDialogue(name, text) {
    this.dialogueName.textContent = name;
    this.dialogueText.textContent = text;
    this.dialogueEl.style.display = 'block';
  }

  hideDialogue() { this.dialogueEl.style.display = 'none'; }

  showCrosshair(show) { this.crosshair.style.display = show ? 'block' : 'none'; }

  flashDamage() {
    this.damageEl.style.opacity = '0.55';
    clearTimeout(this.damageTimer);
    this.damageTimer = setTimeout(() => { this.damageEl.style.opacity = '0'; }, 180);
  }

  // Top-down minimap: streets, buildings, player arrow, traffic dots,
  // police dots, pickups and the mission beacon.
  drawMinimap(city, player, playerCar, traffic, policeCars, pickups, beacon) {
    const ctx = this.mapCtx;
    const S = this.minimap.width;
    const half = city.bounds;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12,16,26,0.85)';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = 'rgba(140,150,170,0.7)';
    ctx.lineWidth = 4;
    for (const c of city.roadCenters) {
      const [x] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      const [, z] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = 'rgba(90,100,125,0.9)';
    for (const b of city.colliders) {
      const [x0, z0] = toMap(b.minX, b.minZ);
      const [x1, z1] = toMap(b.maxX, b.maxZ);
      ctx.fillRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
    }
    // Pickups.
    for (const p of pickups) {
      if (p.taken) continue;
      const [x, z] = toMap(p.x, p.z);
      ctx.fillStyle = p.kind === 'cash' ? '#39d353' : '#ff5a5a';
      ctx.beginPath(); ctx.arc(x, z, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Mission beacon.
    if (beacon && beacon.visible) {
      const [x, z] = toMap(beacon.position.x, beacon.position.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(x, z, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, z, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Traffic (yellow) and police (blue).
    for (const c of traffic) {
      if (c.dead) continue;
      const [x, z] = toMap(c.x, c.z);
      ctx.fillStyle = '#ffd21a';
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    for (const c of policeCars) {
      const [x, z] = toMap(c.x, c.z);
      ctx.fillStyle = '#3aa0ff';
      ctx.beginPath(); ctx.arc(x, z, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow (white, rotated to heading).
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    const heading = playerCar ? playerCar.angle : player.angle;
    const [mx, mz] = toMap(px, pz);
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // North marker so the map reads at a glance.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 14, 14);
  }
}
