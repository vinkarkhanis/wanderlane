// Original generative ambient score: no recordings, samples or network requests.
const moods = {
  chill: { roots: [48, 53, 45, 55], intervals: [0, 7, 14, 16], seconds: 10 },
  ambient: { roots: [45, 48, 41, 43], intervals: [0, 7, 12, 19], seconds: 16 },
  night: { roots: [45, 41, 48, 43], intervals: [0, 7, 10, 14], seconds: 12 },
};

export class DriveRadio {
  constructor(context, destination) {
    this.ctx = context;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
    this.voices = Array.from({ length: 4 }, (_, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      gain.gain.value = 0;
      oscillator.connect(gain).connect(this.gain);
      oscillator.start();
      return { oscillator, gain, i };
    });
    this.nodes = [
      this.gain,
      ...this.voices.flatMap((v) => [v.oscillator, v.gain]),
    ];
    this.elapsed = 0;
    this.lastTime = context.currentTime;
  }
  update(mood, volume, active) {
    const t = this.ctx.currentTime;
    const dt = Math.min(0.25, Math.max(0, t - this.lastTime));
    this.lastTime = t;
    const score = moods[mood];
    this.gain.gain.setTargetAtTime(
      active && score ? volume * 0.24 : 0,
      t,
      0.35,
    );
    if (!active || !score) return;
    this.elapsed += dt;
    const chord = Math.floor(this.elapsed / score.seconds) % score.roots.length;
    this.voices.forEach(({ oscillator, gain, i }) => {
      const note = score.roots[chord] + score.intervals[i];
      oscillator.frequency.setTargetAtTime(
        440 * 2 ** ((note - 69) / 12),
        t,
        0.8,
      );
      // Slow independent swells give long recordings movement without a short loop.
      gain.gain.setTargetAtTime(
        (i ? 0.28 : 0.4) *
          (0.72 + 0.28 * Math.sin(this.elapsed * (0.13 + i * 0.037) + i)),
        t,
        0.6,
      );
    });
  }
}
