// input.js — keyboard + mouse state, pointer lock and the orbit deltas the
// third-person camera consumes each frame. No input is read before the player
// clicks Start, so the browser's pointer-lock gesture rules are respected.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // single taps, queued on keydown so a short
    this.mouseDX = 0;         // press is never lost between slow frames
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.onFirstGesture = null;
    this.onLockLost = null;
    this.onPauseKey = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.onPauseKey) this.onPauseKey();
      }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
      if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.onLockLost) this.onLockLost();
    });
    // Right-click should never open a menu over the game.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock() {
    try {
      if (!this.locked) {
        // Newer Chrome returns a promise that can reject (e.g. no gesture);
        // swallow it — pointer lock is a nicety, never a fatal error.
        const r = this.canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      }
    } catch (e) { /* pointer lock is a nicety, not a requirement */ }
  }

  releaseLock() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  }

  down(code) { return this.keys.has(code); }

  // True once per physical keypress, even if the press fell between frames.
  consumePress(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // WASD / arrows as a -1..1 pair, relative to the camera.
  moveAxes() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, y };
  }

  // Consume this frame's accumulated mouse movement (degrees).
  consumeLook() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }
}
