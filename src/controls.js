export class Controls {
  constructor(hooks) {
    this.keys = {};
    this.touch = {};
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
    for (const b of document.querySelectorAll("[data-key]")) {
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.touch[b.dataset.key] = true;
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(event, () => delete this.touch[b.dataset.key]);
    }
  }
  clear() {
    this.keys = {};
    this.touch = {};
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
