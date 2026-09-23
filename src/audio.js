// Restrained original Web Audio synthesis. No external sound files.
export class AudioSystem {
  constructor() {
    this.master = 0.55;
    this.engine = 0.6;
    this.ambience = 0.5;
    this.muted = false;
    this.status = "Sound ready";
  }
  async start() {
    try {
      if (!this.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) {
          this.status = "Audio unavailable";
          return;
        }
        this.ctx = new C();
        const c = this.ctx;
        this.gain = c.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(c.destination);
        this.motor = c.createOscillator();
        this.motor.type = "sine";
        this.motorGain = c.createGain();
        this.motor.connect(this.motorGain).connect(this.gain);
        this.motor.start();
        const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
          data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
          data[i] = last * 3;
        }
        this.noise = c.createBufferSource();
        this.noise.buffer = buffer;
        this.noise.loop = true;
        this.filter = c.createBiquadFilter();
        this.filter.type = "lowpass";
        this.noiseGain = c.createGain();
        this.noise
          .connect(this.filter)
          .connect(this.noiseGain)
          .connect(this.gain);
        this.noise.start();
        this.ambient = c.createOscillator();
        this.ambient.type = "sine";
        this.ambientGain = c.createGain();
        this.ambient.connect(this.ambientGain).connect(this.gain);
        this.ambient.start();
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
      this.status = "Sound enabled";
    } catch {
      this.status = "Sound unavailable";
    }
  }
  update(v, night, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime,
      ramp = (param, value) => param.setTargetAtTime(value, t, 0.12);
    ramp(this.gain.gain, this.muted || paused ? 0 : this.master);
    ramp(this.motor.frequency, 38 + Math.abs(v.speed) * 2.7 + v.throttle * 12);
    ramp(this.motorGain.gain, this.engine * (0.08 + v.throttle * 0.22));
    ramp(this.filter.frequency, 180 + Math.abs(v.speed) * 24);
    ramp(
      this.noiseGain.gain,
      (0.035 + Math.abs(v.speed) * 0.005) *
        (v.surface === "Asphalt" ? 1 : 1.25) *
        this.ambience,
    );
    ramp(this.ambient.frequency, night > 0.5 ? 620 : 390);
    ramp(
      this.ambientGain.gain,
      this.ambience * 0.018 * (0.7 + 0.3 * Math.sin(t * 0.4)),
    );
  }
}
