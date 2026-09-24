export class Controls {
  constructor(hooks) {
    this.keys = {};
    this.touch = {};
    this.pointers = new Map();
    this.buttons = [...document.querySelectorAll("[data-key]")];
    const binds = {
      KeyT: "time",
      KeyR: "terrain",
      KeyC: "cam",
      KeyF: "cockpit",
      KeyV: "color",
      Space: "auto",
      KeyH: "return",
      KeyG: "traffic",
      KeyM: "mute",
      Escape: "pause",
      KeyP: "pause",
    };
    addEventListener("keydown", (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.target.closest("dialog") && e.code !== "Escape") return;
      if (e.code === "Space" && e.target.tagName === "BUTTON") return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys[e.code] = true;
      if (!e.repeat && binds[e.code]) {
        if (e.code === "Escape") e.preventDefault();
        hooks[binds[e.code]]();
      }
    });
    addEventListener("keyup", (e) => delete this.keys[e.code]);
    addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
    for (const [id, hook] of Object.entries({
      timeBtn: "time",
      terrainBtn: "terrain",
      camBtn: "cam",
      colorBtn: "color",
      autoBtn: "auto",
      returnBtn: "return",
      trafficBtn: "traffic",
      muteBtn: "mute",
      settingsBtn: "pause",
    }))
      document.getElementById(id).addEventListener("click", () => {
        hooks[hook]();
        document.getElementById(id).blur();
      });
    for (const b of this.buttons) {
      const release = (e) => {
        this.pointers.delete(e.pointerId);
        this.syncTouch();
        if (b.hasPointerCapture(e.pointerId))
          b.releasePointerCapture(e.pointerId);
      };
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || document.querySelector("dialog[open]")) return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, b.dataset.key);
        this.syncTouch();
      });
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          release(e);
      });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      for (const event of [
        "pointerup",
        "pointercancel",
        "lostpointercapture",
        "pointerleave",
      ])
        b.addEventListener(event, release);
    }
  }
  syncTouch() {
    this.touch = {};
    for (const key of this.pointers.values()) this.touch[key] = true;
    for (const b of this.buttons) {
      const pressed = !!this.touch[b.dataset.key];
      b.classList.toggle("pressed", pressed);
      b.setAttribute("aria-pressed", String(pressed));
    }
  }
  clear() {
    this.keys = {};
    const pointers = [...this.pointers.keys()];
    this.pointers.clear();
    this.syncTouch();
    for (const b of this.buttons)
      for (const id of pointers)
        if (b.hasPointerCapture(id)) b.releasePointerCapture(id);
  }
  get input() {
    const k = this.keys,
      t = this.touch;
    return {
      accel: k.KeyW || k.ArrowUp || t.accel,
      brake: k.KeyS || k.ArrowDown || t.brake,
      left: k.KeyA || k.ArrowLeft || t.left,
      right: k.KeyD || k.ArrowRight || t.right,
      reverse: k.KeyB,
    };
  }
}
