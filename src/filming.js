import * as THREE from "three";

// Camera-only presentation: physics and journey progress keep their normal clock.
export class Filming {
  constructor(renderer, rig, audio) {
    Object.assign(this, {
      renderer,
      rig,
      audio,
      shot: "drive",
      format: "screen",
      clean: false,
      elapsed: 0,
      limit: 60,
    });
    this.target = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.roadside = new THREE.Vector3();
    this.panel = document.createElement("section");
    this.panel.id = "filmingPanel";
    this.panel.hidden = true;
    this.panel.setAttribute("aria-label", "Film your drive");
    this.panel.innerHTML = `<strong>Film your drive</strong>
      <label>Camera<select id="filmShot"><option value="drive">Driving camera</option><option value="tracking">Side tracking</option><option value="roadside">Roadside pass</option><option value="cockpit">Cockpit</option><option value="story">Journey moments</option></select></label>
      <label>Frame<select id="filmFormat"><option value="screen">Screen</option><option value="portrait">Portrait · 9:16</option><option value="landscape">Landscape · 16:9</option></select></label>
      <label><input id="filmClean" type="checkbox"> Hide driving interface</label>
      <label>Length<select id="filmLength"><option value="30">30 seconds</option><option value="60" selected>60 seconds</option><option value="600">10 minutes</option></select></label>
      <label><input id="filmCaptions" type="checkbox"> Journey captions</label>
      <button id="filmRecord" type="button">Record clip</button><button id="filmClose" type="button">Close</button>
      <span id="filmStatus" role="status">Game sound included · I hides controls · Esc restores interface</span>
      <a id="filmDownload" hidden>Save recording</a>`;
    document.body.append(this.panel);
    this.status = this.panel.querySelector("#filmStatus");
    this.recordButton = this.panel.querySelector("#filmRecord");
    this.panel.querySelector("#filmShot").onchange = (e) => {
      this.shot = e.target.value;
      this.cut = true;
      this.roadAnchor = null;
      this.rig.mode = this.shot === "cockpit" ? 3 : this.originalMode;
      this.rig.passengerLook = false;
      this.rig.snap = true;
    };
    this.panel.querySelector("#filmFormat").onchange = (e) => {
      this.format = e.target.value;
      this.resize();
    };
    this.panel.querySelector("#filmClean").onchange = (e) =>
      this.setClean(e.target.checked);
    this.panel.querySelector("#filmLength").onchange = (e) => {
      this.limit = Number(e.target.value);
    };
    this.panel.querySelector("#filmCaptions").onchange = (e) => {
      this.captions = e.target.checked;
    };
    this.panel.querySelector("#filmClose").onclick = () => this.close();
    this.recordButton.onclick = () =>
      this.recorder?.state === "recording" ? this.stop() : this.record();
    addEventListener("keydown", (e) => {
      if (
        /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.code === "KeyI" && !e.repeat && !this.panel.hidden) {
        document.body.classList.toggle("filming-controls-hidden");
      }
    });
  }
  toggle() {
    this.panel.hidden ? this.open() : this.close();
  }
  open() {
    this.originalMode = this.rig.mode;
    this.panel.hidden = false;
    document.getElementById("filmBtn").setAttribute("aria-pressed", "true");
  }
  close() {
    this.stop();
    this.setClean(false);
    this.panel.hidden = true;
    this.format = "screen";
    this.shot = "drive";
    this.roadAnchor = null;
    this.rig.mode = this.originalMode ?? this.rig.mode;
    this.panel.querySelector("#filmShot").value = "drive";
    this.panel.querySelector("#filmFormat").value = "screen";
    document.body.classList.remove("filming-controls-hidden");
    document.getElementById("filmBtn").setAttribute("aria-pressed", "false");
    this.rig.snap = true;
    this.resize();
  }
  setClean(value) {
    this.clean = value;
    document.body.classList.toggle("filming-clean", value);
    this.panel.querySelector("#filmClean").checked = value;
  }
  resize() {
    const aspect =
      this.format === "portrait"
        ? 9 / 16
        : this.format === "landscape"
          ? 16 / 9
          : innerWidth / innerHeight;
    const width = Math.round(Math.min(innerWidth, innerHeight * aspect));
    const height = Math.round(width / aspect);
    if (this.format === "screen") this.renderer.setSize(width, height);
    else {
      const nativeWidth = this.format === "portrait" ? 720 : 1280;
      const nativeHeight = this.format === "portrait" ? 1280 : 720;
      const dpr = this.renderer.getPixelRatio();
      this.renderer.setSize(nativeWidth / dpr, nativeHeight / dpr, false);
      this.renderer.domElement.style.width = `${width}px`;
      this.renderer.domElement.style.height = `${height}px`;
    }
    this.rig.cam.aspect = width / height;
    this.rig.cam.updateProjectionMatrix();
    const canvas = this.renderer.domElement;
    canvas.style.left = `${(innerWidth - width) / 2}px`;
    canvas.style.top = `${(innerHeight - height) / 2}px`;
  }
  update(v, dt, paused, reduced, story, view) {
    if (
      this.recorder?.state === "recording" &&
      !this.preparing &&
      (paused || (performance.now() - this.recordStarted) / 1000 >= this.limit)
    )
      this.stop();
    this.elapsed =
      this.recorder?.state === "recording" && !this.preparing
        ? (performance.now() - this.recordStarted) / 1000
        : this.elapsed;
    if (
      this.recorder?.state === "recording" &&
      !this.preparing &&
      Math.floor(this.elapsed) !== this.displayedSecond
    ) {
      this.displayedSecond = Math.floor(this.elapsed);
      this.status.textContent = `Recording ${this.displayedSecond} / ${this.limit} s · ${Math.round((this.frames ?? 0) / Math.max(1, this.elapsed))} fps · game sound`;
    }
    const scene =
      story?.tripId === "flower-delivery"
        ? story.cargo === "delivered"
          ? "Flowers delivered. A rainy evening, brightened."
          : story.pickup
            ? "A bouquet for a rainy evening"
            : story.cargo === "onboard"
              ? "The long way to the courtyard"
              : "Flowers in the rain · a Pune-inspired journey"
        : "Wanderlane · Take the long way";
    if (scene !== this.caption) {
      this.caption = scene;
      this.captionChanged = performance.now();
    }
    if (
      this.panel.hidden ||
      this.shot === "drive" ||
      this.shot === "cockpit" ||
      reduced ||
      paused
    )
      return;
    const camera = this.rig.cam;
    // Actual cockpit framing remains available through the normal F key.
    const sin = Math.sin(v.heading),
      cos = Math.cos(v.heading);
    const arrival =
      this.shot === "story" &&
      story?.cargo === "delivered" &&
      view.destination.visible &&
      Math.abs(v.speed) < 0.5;
    if (this.shot === "story" && !arrival) return;
    if (arrival) {
      this.target.set(0.2, 1.1, 1.3).applyMatrix4(view.destination.matrixWorld);
      this.eye.set(6.5, 3.8, -7.5).applyMatrix4(view.destination.matrixWorld);
    } else if (this.shot === "roadside") {
      if (
        !this.roadAnchor ||
        Math.hypot(this.roadAnchor.x - v.x, this.roadAnchor.z - v.z) > 65
      ) {
        this.roadAnchor = new THREE.Vector3(v.x, v.y, v.z);
        this.roadside.set(
          v.x + sin * 24 + cos * 8,
          v.y + 1.7,
          v.z + cos * 24 - sin * 8,
        );
        this.cut = true;
      }
      this.eye.copy(this.roadside);
      this.target.set(v.x, v.y + 1, v.z);
    } else {
      // Close enough to read the vehicle in a vertical frame; no time-based orbit.
      this.eye.set(v.x - sin * 7 + cos * 5, v.y + 2.3, v.z - cos * 7 - sin * 5);
      this.target.set(v.x + sin * 2, v.y + 1, v.z + cos * 2);
    }
    this.smoothEye ??= this.eye.clone();
    this.smoothTarget ??= this.target.clone();
    if (this.cut) {
      this.smoothEye.copy(this.eye);
      this.smoothTarget.copy(this.target);
      this.cut = false;
    }
    const alpha = 1 - Math.exp(-dt * 5);
    this.smoothEye.lerp(this.eye, alpha);
    this.smoothTarget.lerp(this.target, alpha);
    camera.position.copy(this.smoothEye);
    camera.up.set(0, 1, 0);
    camera.fov = 52;
    camera.updateProjectionMatrix();
    camera.lookAt(this.smoothTarget);
  }
  async record() {
    if (!globalThis.MediaRecorder || !this.renderer.domElement.captureStream) {
      this.status.textContent = "Recording is unavailable in this browser.";
      return;
    }
    try {
      await this.audio.start();
      if (!this.audio.ctx || this.audio.muted)
        throw Error("Turn sound on before recording.");
      this.audio.capture ??= this.audio.ctx.createMediaStreamDestination();
      if (!this.audio.captureConnected) {
        this.audio.gain.connect(this.audio.capture);
        this.audio.captureConnected = true;
      }
      const source = this.renderer.domElement;
      this.recordCanvas = document.createElement("canvas");
      const scale = Math.min(1, 1920 / Math.max(source.width, source.height));
      this.recordCanvas.width = Math.round(source.width * scale);
      this.recordCanvas.height = Math.round(source.height * scale);
      this.recordContext = this.recordCanvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
      // Explicit framebuffer readback avoids deferred WebGL-to-2D copies that
      // some Chromium drivers retain as a stale GPU texture during recording.
      this.readWidth = source.width;
      this.readHeight = source.height;
      this.readPixels = new Uint8Array(source.width * source.height * 4);
      this.readImage = new ImageData(source.width, source.height);
      this.readCanvas = document.createElement("canvas");
      this.readCanvas.width = source.width;
      this.readCanvas.height = source.height;
      this.readContext = this.readCanvas.getContext("2d");
      this.stream = this.recordCanvas.captureStream(30);
      this.videoTrack = this.stream.getVideoTracks()[0];
      for (const track of this.audio.capture.stream.getAudioTracks())
        this.stream.addTrack(track.clone());
      const mimeType = [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const chunks = [];
      this.recorder = new MediaRecorder(this.stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 8000000,
      });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      this.recorder.onerror = () => {
        this.status.textContent =
          "Recording failed. Try a lower graphics quality.";
        this.stop();
      };
      this.recorder.onstop = () => {
        clearTimeout(this.warmPause);
        clearTimeout(this.warmReady);
        this.preparing = false;
        const type = this.recorder.mimeType;
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = URL.createObjectURL(new Blob(chunks, { type }));
        const link = this.panel.querySelector("#filmDownload");
        link.href = this.downloadUrl;
        link.download = `wanderlane-${this.recordFormat}-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`;
        link.hidden = false;
        this.status.textContent =
          "Clip ready. Save it before leaving this page.";
        this.recordButton.textContent = "Record clip";
        this.recordButton.disabled = false;
        this.panel.querySelector("#filmFormat").disabled = false;
        this.panel.querySelector("#filmLength").disabled = false;
        this.stream.getTracks().forEach((t) => t.stop());
      };
      this.recordFormat = this.format;
      this.elapsed = 0;
      this.frames = 0;
      this.nextFrame = performance.now();
      this.recordStarted = this.captionChanged = performance.now();
      this.panel.querySelector("#filmDownload").hidden = true;
      this.panel.querySelector("#filmFormat").disabled = true;
      this.panel.querySelector("#filmLength").disabled = true;
      this.recorder.start(1000);
      if (!this.warmed) {
        // Let the first encoder initialise outside the take. MediaRecorder pause
        // excludes this preparation interval from the exported video timeline.
        this.preparing = true;
        this.warmPause = setTimeout(() => {
          if (this.recorder.state === "recording") this.recorder.pause();
        }, 150);
        this.warmReady = setTimeout(() => {
          if (this.recorder.state !== "paused") return;
          this.recorder.resume();
          this.warmed = true;
          this.preparing = false;
          this.recordStarted = this.captionChanged = performance.now();
          this.elapsed = 0;
          this.frames = 0;
        }, 3150);
        this.status.textContent =
          "Preparing recorder · recording starts in 3 seconds";
      }
      this.recordButton.textContent = "Stop recording";
      if (!this.preparing)
        this.status.textContent = `Recording with game sound · up to ${this.limit < 60 ? this.limit + " seconds" : this.limit / 60 + " minutes"}`;
    } catch (error) {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.status.textContent = error.message;
    }
  }
  draw(city) {
    if (this.recorder?.state !== "recording") return;
    const now = performance.now();
    if (now + 0.5 < this.nextFrame) return;
    this.nextFrame += 1000 / 30;
    if (this.nextFrame < now) this.nextFrame = now + 1000 / 30;
    const c = this.recordContext,
      w = this.recordCanvas.width,
      h = this.recordCanvas.height;
    const gl = this.renderer.getContext();
    gl.readPixels(
      0,
      0,
      this.readWidth,
      this.readHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.readPixels,
    );
    const stride = this.readWidth * 4;
    for (let row = 0; row < this.readHeight; row++)
      this.readImage.data.set(
        this.readPixels.subarray(
          (this.readHeight - row - 1) * stride,
          (this.readHeight - row) * stride,
        ),
        row * stride,
      );
    if (w === this.readWidth && h === this.readHeight)
      c.putImageData(this.readImage, 0, 0);
    else {
      this.readContext.putImageData(this.readImage, 0, 0);
      c.drawImage(this.readCanvas, 0, 0, w, h);
    }
    if (this.captions && now - this.captionChanged < 4000) {
      const size = Math.round(w / 30);
      c.font = `${size}px Georgia, serif`;
      c.textAlign = "center";
      c.fillStyle = "rgba(12,28,30,.75)";
      c.fillRect(w * 0.045, h * 0.13 - size * 1.3, w * 0.91, size * 2.2);
      c.fillStyle = "#fff0ce";
      c.fillText(this.caption, w / 2, h * 0.13, w * 0.85);
      c.textAlign = "left";
    }
    if (city) {
      const fontSize = Math.max(10, Math.round(w / 65));
      c.font = `${fontSize}px sans-serif`;
      const text = "Map data © OpenStreetMap contributors · ODbL 1.0";
      const x = w * 0.045,
        y = h * 0.92;
      c.fillStyle = "rgba(12,28,30,.7)";
      c.fillRect(
        x - 6,
        y - fontSize - 4,
        c.measureText(text).width + 12,
        fontSize + 10,
      );
      c.fillStyle = "#eeeade";
      c.fillText(text, x, y);
    }
    this.frames++;
  }
  stop() {
    if (this.recorder && this.recorder.state !== "inactive") {
      clearTimeout(this.warmPause);
      clearTimeout(this.warmReady);
      this.recordButton.disabled = true;
      this.recorder.stop();
    }
  }
  get snapshot() {
    return {
      open: !this.panel.hidden,
      shot: this.shot,
      format: this.format,
      clean: this.clean,
      recording: this.recorder?.state === "recording" && !this.preparing,
      seconds: this.elapsed,
      frames: this.frames ?? 0,
      capturedFps: this.elapsed > 0 ? (this.frames ?? 0) / this.elapsed : 0,
    };
  }
}
