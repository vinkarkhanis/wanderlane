// Keyboard + on-screen button input. Exposes a live input state and toggle hooks.
export class Controls {
  constructor(hooks) {
    this.keys = {};
    addEventListener('keydown', e => {
      this.keys[e.code] = 1;
      if (e.code === 'KeyT') hooks.time();
      if (e.code === 'KeyR') hooks.terrain();
      if (e.code === 'KeyC') hooks.cam();
      if (e.code === 'KeyV') hooks.color();
      if (e.code === 'Space') { e.preventDefault(); hooks.auto(); }
    });
    addEventListener('keyup', e => this.keys[e.code] = 0);
    document.getElementById('terrainBtn').onclick = hooks.terrain;
    document.getElementById('timeBtn').onclick = hooks.time;
    document.getElementById('camBtn').onclick = hooks.cam;
    document.getElementById('autoBtn').onclick = hooks.auto;
    document.getElementById('colorBtn').onclick = hooks.color;
  }
  get input() {
    const k = this.keys;
    return { accel:k.KeyW||k.ArrowUp, brake:k.KeyS||k.ArrowDown, left:k.KeyA||k.ArrowLeft, right:k.KeyD||k.ArrowRight };
  }
}
