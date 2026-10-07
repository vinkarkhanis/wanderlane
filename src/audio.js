import { DriveRadio } from "./driveRadio.js";
// Original Web Audio synthesis. No external sound files.
export class AudioSystem {
  constructor() {
    this.master = 0.55;
    this.engine = 0.6;
    this.ambience = 0.5;
    this.muted = false;
    this.music = 0.45;
    this.musicMood = "off";
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
        this.motorBody = c.createOscillator();
        this.motorBody.type = "triangle";
        this.motorBodyGain = c.createGain();
        this.motorBodyGain.gain.value = 0;
        this.motorBody.connect(this.motorBodyGain).connect(this.gain);
        this.motorBody.start();
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
        this.windFilter = c.createBiquadFilter();
        this.windFilter.type = "lowpass";
        this.windGain = c.createGain();
        this.windGain.gain.value = 0;
        this.noise
          .connect(this.windFilter)
          .connect(this.windGain)
          .connect(this.gain);
        this.radio = new DriveRadio(c, this.gain);
        this.ambient = c.createOscillator();
        this.ambient.type = "sine";
        this.ambientGain = c.createGain();
        this.ambient.connect(this.ambientGain).connect(this.gain);
        this.ambient.start();
        // A fixed city graph, reused across mode switches. Sources are created
        // only here, after the existing user-gesture unlock.
        this.cityFilter = c.createBiquadFilter();
        this.cityFilter.type = "bandpass";
        this.cityNoiseGain = c.createGain();
        this.cityNoiseGain.gain.value = 0;
        this.noise
          .connect(this.cityFilter)
          .connect(this.cityNoiseGain)
          .connect(this.gain);
        this.cityVoices = [70, 145, 320].map((frequency, i) => {
          const oscillator = c.createOscillator(),
            gain = c.createGain();
          oscillator.type = i === 1 ? "triangle" : "sine";
          oscillator.frequency.value = frequency;
          gain.gain.value = 0;
          oscillator.connect(gain).connect(this.gain);
          oscillator.start();
          return { oscillator, gain };
        });
        this.arrivalVoices = [1, 2.01].map((ratio) => {
          const oscillator = c.createOscillator(),
            gain = c.createGain();
          oscillator.type = "sine";
          gain.gain.value = 0;
          oscillator.connect(gain).connect(this.gain);
          oscillator.start();
          return { oscillator, gain, ratio };
        });
        this.nodes = [
          this.gain,
          this.motorBody,
          this.motorBodyGain,
          this.windFilter,
          this.windGain,
          ...this.radio.nodes,
          this.motor,
          this.motorGain,
          this.noise,
          this.filter,
          this.noiseGain,
          this.ambient,
          this.ambientGain,
          this.cityFilter,
          this.cityNoiseGain,
          ...this.cityVoices.flatMap((v) => [v.oscillator, v.gain]),
          ...this.arrivalVoices.flatMap((v) => [v.oscillator, v.gain]),
        ];
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
      this.status = "Sound enabled";
    } catch {
      this.ctx?.close().catch(() => {});
      this.ctx = null;
      this.nodes = [];
      this.status = "Sound unavailable";
    }
  }
  playArrival() {
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
    const t = this.ctx.currentTime + 0.03;
    this.arrivalCueCount = (this.arrivalCueCount ?? 0) + 1;
    for (const { oscillator, gain, ratio } of this.arrivalVoices) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0, t);
      for (const [i, note] of [523.25, 659.25, 783.99].entries()) {
        const start = t + i * 0.23;
        oscillator.frequency.setValueAtTime(note * ratio, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(
          this.ambience * (ratio === 1 ? 0.09 : 0.025),
          start + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(0.00001, start + 0.22);
      }
      gain.gain.setValueAtTime(0, t + 0.7);
    }
  }
  update(v, night, paused, city = null) {
    if (!this.ctx || !this.nodes?.length) return;
    const t = this.ctx.currentTime,
      ramp = (param, value) => param.setTargetAtTime(value, t, 0.12);
    ramp(this.gain.gain, this.muted || paused ? 0 : this.master);
    this.radio.update(this.musicMood, this.music, !paused && !this.muted);
    ramp(this.motor.frequency, 38 + Math.abs(v.speed) * 2.7 + v.throttle * 12);
    ramp(
      this.motorBody.frequency,
      76 + Math.abs(v.speed) * 5.4 + v.throttle * 24,
    );
    ramp(this.motorBodyGain.gain, this.engine * (0.018 + v.throttle * 0.045));
    ramp(this.motorGain.gain, this.engine * (0.08 + v.throttle * 0.22));
    ramp(this.filter.frequency, 180 + Math.abs(v.speed) * 24);
    ramp(this.windFilter.frequency, 350 + Math.abs(v.speed) * 18);
    ramp(
      this.windGain.gain,
      this.ambience * Math.min(0.22, (Math.abs(v.speed) / 30) ** 2 * 0.12),
    );
    ramp(
      this.noiseGain.gain,
      Math.min(0.25, Math.abs(v.speed) * 0.005) *
        (v.surface === "Asphalt" ? 1 : 1.25) *
        this.ambience,
    );
    ramp(this.ambient.frequency, night > 0.5 ? 620 : 390);
    ramp(
      this.ambientGain.gain,
      this.ambience * 0.018 * (0.7 + 0.3 * Math.sin(t * 0.4)),
    );
    const urban = !!city,
      quiet = city?.district === "Pashan approach",
      phase = (city?.time ?? 0) % 29;
    ramp(
      this.cityFilter.frequency,
      city?.season === "Monsoon" ? 1100 : quiet ? 460 : 650,
    );
    ramp(this.cityFilter.Q, 0.7);
    ramp(
      this.cityNoiseGain.gain,
      urban
        ? this.ambience *
            (quiet ? 0.025 : 0.065) *
            (city?.season === "Monsoon" ? 1.7 : 1) *
            (1 + night * 0.2)
        : 0,
    );
    this.cityVoices.forEach(({ oscillator, gain }, i) => {
      const frequency =
        i === 0
          ? 62 + Math.abs(v.speed) * 0.8
          : i === 1
            ? 125 + Math.sin((city?.time ?? 0) * 0.6) * 20
            : 310;
      ramp(oscillator.frequency, frequency);
      const horn =
        phase > 12 && phase < 12.25
          ? Math.sin(((phase - 12) * Math.PI) / 0.25)
          : 0;
      ramp(
        gain.gain,
        urban
          ? this.ambience *
              (i === 0
                ? quiet
                  ? 0.006
                  : 0.018
                : i === 1
                  ? quiet
                    ? 0.002
                    : 0.009
                  : quiet
                    ? 0
                    : horn * 0.025)
          : 0,
      );
    });
    if (urban) {
      ramp(
        this.ambient.frequency,
        quiet ? 860 + Math.sin((city.time % 13) * 4) * 180 : 240,
      );
      ramp(
        this.ambientGain.gain,
        this.ambience * (quiet && city.time % 13 < 0.7 ? 0.013 : 0.002),
      );
    }
  }
}
