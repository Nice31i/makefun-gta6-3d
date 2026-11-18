// audio.js — every sound is synthesized with WebAudio, no audio files.
// Engine hum, gunshots, punches, sirens, cash chimes and mission jingles are
// all built from oscillators and filtered noise, so the game stays offline.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenNodes = null;
    this.muted = false;
    // Never leave a siren or engine drone running on a hidden tab.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.stopSiren(); this.setEngine(0, false); }
    });
  }

  // Must be called from a user gesture at least once; later calls are no-ops.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
      return true;
    } catch (e) { return false; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.now();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.now();
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  shot() { this.noise(0.14, 0.5, 2800); this.tone(160, 0.1, 'square', 0.18, 60); }
  punch() { this.noise(0.1, 0.4, 500); this.tone(90, 0.12, 'sine', 0.3, 45); }
  hurt() { this.tone(220, 0.18, 'sawtooth', 0.2, 110); }
  pickup() { this.tone(880, 0.09, 'sine', 0.22); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.22), 70); }
  cash() { this.tone(988, 0.1, 'triangle', 0.25); setTimeout(() => this.tone(1319, 0.1, 'triangle', 0.25), 90); setTimeout(() => this.tone(1760, 0.18, 'triangle', 0.25), 180); }
  click() { this.tone(660, 0.05, 'square', 0.12); }
  denied() { this.tone(180, 0.16, 'square', 0.16, 120); }
  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.26), i * 110));
  }
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.15), i * 140)); }

  startEngineLoop() {
    try {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 55;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 320;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineOsc = o; this.engineGain = g;
    } catch (e) { /* ignore */ }
  }

  // speed01: 0 idle .. 1 flat out. Called every frame while driving.
  setEngine(speed01, on) {
    if (!this.engineOsc || !this.ctx) return;
    const t = this.now();
    const target = on ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
  }

  startSiren() {
    if (!this.ctx || this.sirenNodes) return;
    try {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 750;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenNodes = { o, lfo, g };
    } catch (e) { /* ignore */ }
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch (e) {}
    this.sirenNodes = null;
  }
}
