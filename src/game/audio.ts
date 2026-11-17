/**
 * Procedural Web Audio Engine for SON VAZİFE
 * Zero external audio assets — 100% synthesized ambient wind, rain, thunder,
 * footsteps, water pours, knocks, dread drones, and dawn ney chord.
 */

export class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private dreadOsc1: OscillatorNode | null = null;
  private dreadOsc2: OscillatorNode | null = null;
  private dreadGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private initialized = false;
  private lastStepTime = 0;
  private lastHeartbeatTime = 0;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.72;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Shared noise buffer (3 seconds)
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = noiseBuffer;

    // Mountain Wind loop
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 2.6;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.08;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();

    this.windFilter = windFilter;
    this.windGain = windGain;

    // Rain loop
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer;
    rainSrc.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1400;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;

    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();

    this.rainFilter = rainFilter;
    this.rainGain = rainGain;

    // Dread Sub-Bass Drone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 46;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 49.5; // eerie beating interval

    const dreadFilter = ctx.createBiquadFilter();
    dreadFilter.type = 'lowpass';
    dreadFilter.frequency.value = 140;

    const dreadGain = ctx.createGain();
    dreadGain.gain.value = 0.0;

    osc1.connect(dreadFilter);
    osc2.connect(dreadFilter);
    dreadFilter.connect(dreadGain);
    dreadGain.connect(master);
    osc1.start();
    osc2.start();

    this.dreadOsc1 = osc1;
    this.dreadOsc2 = osc2;
    this.dreadGain = dreadGain;

    this.initialized = true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateAmbience(params: {
    time: number;
    isIndoors: boolean;
    rainIntensity: number; // 0..1
    dread: number; // 0..1
    danger: number; // 0..1
  }): void {
    if (!this.ctx || !this.initialized) return;
    const t = this.ctx.currentTime;

    if (this.windGain && this.windFilter) {
      const targetWind = params.isIndoors ? 0.025 : 0.09 + Math.sin(params.time * 0.4) * 0.03;
      const targetFreq = params.isIndoors ? 210 : 340 + Math.sin(params.time * 0.27) * 90;
      this.windGain.gain.setTargetAtTime(targetWind, t, 0.25);
      this.windFilter.frequency.setTargetAtTime(targetFreq, t, 0.25);
    }

    if (this.rainGain && this.rainFilter) {
      const targetRain = params.rainIntensity * (params.isIndoors ? 0.045 : 0.16);
      const targetRainFreq = params.isIndoors ? 700 : 1650;
      this.rainGain.gain.setTargetAtTime(targetRain, t, 0.25);
      this.rainFilter.frequency.setTargetAtTime(targetRainFreq, t, 0.25);
    }

    if (this.dreadGain && this.dreadOsc1 && this.dreadOsc2) {
      const level = Math.max(params.dread * 0.08, params.danger * 0.18);
      this.dreadGain.gain.setTargetAtTime(level, t, 0.2);
      this.dreadOsc2.frequency.setTargetAtTime(49.5 + params.danger * 3.5, t, 0.2);
    }

    // Heartbeat when danger is high
    if (params.danger > 0.32) {
      const interval = Math.max(0.42, 0.95 - params.danger * 0.5);
      if (params.time - this.lastHeartbeatTime > interval) {
        this.lastHeartbeatTime = params.time;
        this.playHeartbeat(0.15 + params.danger * 0.25);
      }
    }
  }

  public playFootstep(indoors: boolean, nowSec: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (nowSec - this.lastStepTime < 0.44) return;
    this.lastStepTime = nowSec;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(indoors ? 130 : 88, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.08);

    gain.gain.setValueAtTime(indoors ? 0.09 : 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playPickup(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playDoorCreak(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.linearRampToValueAtTime(118, t + 0.25);
    osc.frequency.linearRampToValueAtTime(162, t + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  public playWaterPour(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.9);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, t);
    filter.frequency.linearRampToValueAtTime(1100, t + 0.45);
    filter.frequency.linearRampToValueAtTime(520, t + 0.9);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playWindowKnock(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    [0, 0.24, 0.46].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, t);
      osc.frequency.exponentialRampToValueAtTime(65, t + 0.08);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playThunder(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 2.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 1.8);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, t);
    filter.frequency.exponentialRampToValueAtTime(55, t + 2.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playCandleToggle(lit: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.18);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = lit ? 950 : 480;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playViolationSting(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    [110, 116.5, 155.5].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.94, t + 1.1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.25);
    });
  }

  public playDawnSereneChord(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    // Serene Hicaz/Sabah-inspired breathy ney fifths
    [220, 293.66, 329.63, 440].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.25);
      gain.gain.setValueAtTime(0.001, t + idx * 0.25);
      gain.gain.linearRampToValueAtTime(0.07, t + idx * 0.25 + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.25);
      osc.stop(t + 4.6);
    });
  }

  public playPaperFlip(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playWhisper(intensity = 1): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;

    const ctx = this.ctx;
    const baseTime = ctx.currentTime + 0.02;
    const syllableCount = 2 + Math.floor(Math.random() * 3); // 2-4 breathy syllables
    const panVal = (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.45);
    const scale = Math.max(0.35, Math.min(1.4, intensity));

    let outputNode: AudioNode = this.masterGain;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, baseTime);
      panner.connect(this.masterGain);
      outputNode = panner;
    }

    let cursor = 0;
    for (let i = 0; i < syllableCount; i++) {
      const dur = 0.22 + Math.random() * 0.22;
      const gap = 0.05 + Math.random() * 0.14;
      const start = baseTime + cursor;
      const offset = Math.random() * Math.max(0.1, this.noiseBuffer.duration - dur - 0.1);

      // Primary breathy vocal formant
      const breathSrc = ctx.createBufferSource();
      breathSrc.buffer = this.noiseBuffer;

      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      const fStart = 760 + Math.random() * 680;
      const fEnd = fStart * (0.78 + Math.random() * 0.55);
      formant.frequency.setValueAtTime(fStart, start);
      formant.frequency.exponentialRampToValueAtTime(Math.max(320, fEnd), start + dur);
      formant.Q.setValueAtTime(4.5 + Math.random() * 4.5, start);

      const breathGain = ctx.createGain();
      const peak = (0.08 + Math.random() * 0.065) * scale;
      breathGain.gain.setValueAtTime(0.0005, start);
      breathGain.gain.linearRampToValueAtTime(peak, start + dur * 0.28);
      breathGain.gain.exponentialRampToValueAtTime(0.0005, start + dur);

      breathSrc.connect(formant);
      formant.connect(breathGain);
      breathGain.connect(outputNode);
      breathSrc.start(start, offset, dur + 0.02);

      // Subtle sibilant consonant hiss ("ş / s / h")
      const sibSrc = ctx.createBufferSource();
      sibSrc.buffer = this.noiseBuffer;

      const sibFilter = ctx.createBiquadFilter();
      sibFilter.type = 'bandpass';
      sibFilter.frequency.setValueAtTime(2500 + Math.random() * 1400, start);
      sibFilter.Q.setValueAtTime(6.0, start);

      const sibGain = ctx.createGain();
      sibGain.gain.setValueAtTime(0.0005, start);
      sibGain.gain.linearRampToValueAtTime(peak * 0.34, start + dur * 0.18);
      sibGain.gain.exponentialRampToValueAtTime(0.0005, start + dur * 0.85);

      sibSrc.connect(sibFilter);
      sibFilter.connect(sibGain);
      sibGain.connect(outputNode);
      sibSrc.start(start, (offset + 0.4) % (this.noiseBuffer.duration - dur), dur);

      // Faint ghostly throat undertone on one syllable
      if (i === 0 || Math.random() < 0.35) {
        const subOsc = ctx.createOscillator();
        subOsc.type = 'triangle';
        const baseFreq = 165 + Math.random() * 65;
        subOsc.frequency.setValueAtTime(baseFreq, start);
        subOsc.frequency.linearRampToValueAtTime(baseFreq * 0.86, start + dur);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.0005, start);
        subGain.gain.linearRampToValueAtTime(0.016 * scale, start + dur * 0.35);
        subGain.gain.exponentialRampToValueAtTime(0.0005, start + dur);

        subOsc.connect(subGain);
        subGain.connect(outputNode);
        subOsc.start(start);
        subOsc.stop(start + dur + 0.02);
      }

      cursor += dur + gap;
    }
  }

  public playFloorboardCreak(intensity = 1): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;

    const ctx = this.ctx;
    const baseTime = ctx.currentTime + 0.01;
    const scale = Math.max(0.4, Math.min(1.4, intensity));
    const panVal = (Math.random() > 0.5 ? 1 : -1) * (0.28 + Math.random() * 0.5);

    let outputNode: AudioNode = this.masterGain;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, baseTime);
      panner.connect(this.masterGain);
      outputNode = panner;
    }

    // Two-stage timber groan (slow stress bend followed by secondary settle)
    const dur = 0.55 + Math.random() * 0.35;
    const woodFilter = ctx.createBiquadFilter();
    woodFilter.type = 'bandpass';
    woodFilter.frequency.setValueAtTime(360 + Math.random() * 140, baseTime);
    woodFilter.frequency.exponentialRampToValueAtTime(210, baseTime + dur);
    woodFilter.Q.value = 4.6;

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0005, baseTime);
    bodyGain.gain.linearRampToValueAtTime(0.11 * scale, baseTime + dur * 0.16);
    bodyGain.gain.linearRampToValueAtTime(0.055 * scale, baseTime + dur * 0.55);
    bodyGain.gain.linearRampToValueAtTime(0.085 * scale, baseTime + dur * 0.72);
    bodyGain.gain.exponentialRampToValueAtTime(0.0005, baseTime + dur);

    woodFilter.connect(bodyGain);
    bodyGain.connect(outputNode);

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    const baseF = 76 + Math.random() * 26;
    oscA.frequency.setValueAtTime(baseF, baseTime);
    oscA.frequency.linearRampToValueAtTime(baseF * 1.24, baseTime + dur * 0.35);
    oscA.frequency.linearRampToValueAtTime(baseF * 0.84, baseTime + dur);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(baseF * 1.92, baseTime);
    oscB.frequency.linearRampToValueAtTime(baseF * 1.65, baseTime + dur);

    oscA.connect(woodFilter);
    oscB.connect(woodFilter);
    oscA.start(baseTime);
    oscB.start(baseTime);
    oscA.stop(baseTime + dur + 0.03);
    oscB.stop(baseTime + dur + 0.03);

    // Dry timber fiber micro-snaps during the creak
    const snapOffsets = [0.06, 0.22 + Math.random() * 0.08, dur * 0.74];
    for (let i = 0; i < snapOffsets.length; i++) {
      const st = baseTime + snapOffsets[i];
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150 + Math.random() * 650;
      bp.Q.value = 5.5;

      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0005, st);
      sg.gain.linearRampToValueAtTime(0.075 * scale, st + 0.008);
      sg.gain.exponentialRampToValueAtTime(0.0005, st + 0.05);

      src.connect(bp);
      bp.connect(sg);
      sg.connect(outputNode);
      src.start(st, Math.random() * 1.5, 0.06);
    }
  }

  private playHeartbeat(vol: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    [0, 0.18].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 58 : 48, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.12);
      gain.gain.setValueAtTime(vol * (idx === 0 ? 1 : 0.7), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playScalpelCut(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.24);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1950, t);
    filter.frequency.exponentialRampToValueAtTime(980, t + 0.24);
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playForcepsSample(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    [840, 1280].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.09, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.15);
    });
  }

  public playExamineClick(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.07);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playDialogueBlip(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + Math.random() * 45, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playSaveChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    [330, 440].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);
      gain.gain.setValueAtTime(0.05, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.38);
    });
  }

  public playCameraShutter(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;

    // Mechanical shutter click (two crisp transient bursts)
    [0, 0.048].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const len = Math.floor(this.ctx.sampleRate * 0.032);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.exp((-i / len) * 6);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = idx === 0 ? 2800 : 1900;
      filter.Q.value = 2.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(idx === 0 ? 0.24 : 0.16, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.035);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(t + offset);
    });

    // Subtle flash capacitor discharge chirp
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.09);
    oscGain.gain.setValueAtTime(0.035, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
