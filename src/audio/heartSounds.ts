import { C, actOf } from '../engine/physiology';
import { beat, type CardiacClockState } from '../engine/clock';
import { clamp, seededRng } from '../engine/geometry2d';
import type { ComputedResult, SimParams } from '../engine/types';

export interface HeartAudioEngine {
  ctx: AudioContext | null;
  noise: AudioBuffer | null;
  out: AudioNode | null;
  streamDest: MediaStreamAudioDestinationNode | null;
  buf: Partial<Record<'b1' | 'b2', AudioBuffer>>;
  lastT: number;
}

export function createAudioEngine(): HeartAudioEngine {
  return {
    ctx: null,
    noise: null,
    out: null,
    streamDest: null,
    buf: {},
    lastT: 0,
  };
}

export function initAudio(snd: HeartAudioEngine): AudioContext | null {
  if (snd.ctx) return snd.ctx;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    snd.ctx = new AudioCtx();
  } catch {
    return null;
  }
  const n = snd.ctx.sampleRate;
  const buf = snd.ctx.createBuffer(1, n, snd.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  snd.noise = buf;
  const comp = snd.ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(snd.ctx.destination);
  if (typeof snd.ctx.createMediaStreamDestination === 'function') {
    const streamDest = snd.ctx.createMediaStreamDestination();
    comp.connect(streamDest);
    snd.streamDest = streamDest;
  }
  snd.out = comp;
  return snd.ctx;
}

export function getAudioCaptureTracks(snd: HeartAudioEngine): MediaStreamTrack[] {
  const ctx = initAudio(snd);
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return snd.streamDest ? snd.streamDest.stream.getAudioTracks() : [];
}

function hsBuffer(ac: AudioContext, kind: 'b1' | 'b2'): AudioBuffer {
  const sr = ac.sampleRate;
  const dur = kind === 'b1' ? 0.16 : 0.12;
  const n = Math.round(sr * dur);
  const buf = ac.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const spec =
    kind === 'b1'
      ? { f: [46, 70, 104, 150], a: [1, 0.75, 0.42, 0.2], tau: 0.028, split: 0.024, k2: 0.7 }
      : { f: [68, 102, 148, 215], a: [1, 0.7, 0.45, 0.25], tau: 0.019, split: 0.032, k2: 0.55 };
  const r = seededRng(kind === 'b1' ? 11 : 23);
  let lp = 0;
  const comp = (t: number, amp: number) => {
    if (t < 0) return 0;
    const env = (1 - Math.exp(-t / 0.0035)) * Math.exp(-t / spec.tau);
    let v = 0;
    spec.f.forEach((f, i) => {
      const fg = f * (1 - 0.18 * Math.min(1, t / 0.06));
      v += spec.a[i] * Math.sin(2 * Math.PI * fg * t + i);
    });
    return amp * env * v;
  };
  let mx = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp += (r() * 2 - 1 - lp) * 0.08;
    const envN = (1 - Math.exp(-t / 0.003)) * Math.exp(-t / (spec.tau * 0.8));
    let v = comp(t, 1) + comp(t - spec.split, spec.k2) + 1.6 * lp * envN;
    v = Math.tanh(1.5 * v);
    d[i] = v;
    mx = Math.max(mx, Math.abs(v));
  }
  for (let i = 0; i < n; i++) d[i] /= mx || 1;
  return buf;
}

function thump(snd: HeartAudioEngine, kind: 'b1' | 'b2', gainMul: number): void {
  const ac = snd.ctx;
  if (!ac) return;
  const spec = kind === 'b1' ? C.sons.b1 : C.sons.b2;
  const t0 = ac.currentTime + 0.005;
  const vol = spec.volume * gainMul;
  if (!snd.buf[kind]) snd.buf[kind] = hsBuffer(ac, kind);
  const src = ac.createBufferSource();
  src.buffer = snd.buf[kind]!;
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 700;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(lpf);
  lpf.connect(g);
  g.connect(snd.out || ac.destination);
  src.start(t0);
}

function murmur(
  snd: HeartAudioEngine,
  spec: { frequence: number; volume: number },
  dur: number,
  shape: 'losange' | 'plateau' | 'decroissant' | 'roulement'
): void {
  const ac = snd.ctx;
  if (!ac || !snd.noise || dur <= 0.03) return;
  const t0 = ac.currentTime + 0.01;
  const out = snd.out || ac.destination;
  const ns = ac.createBufferSource();
  ns.buffer = snd.noise;
  ns.loop = true;
  ns.playbackRate.value = 0.9 + Math.random() * 0.2;
  const gg = ac.createGain();
  gg.gain.setValueAtTime(0.0001, t0);
  let chain: AudioNode = ns;
  if (shape === 'roulement') {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = spec.frequence * 1.6;
    lp.Q.value = 2;
    chain.connect(lp);
    chain = lp;
  } else {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = spec.frequence;
    bp.Q.value = shape === 'losange' ? 0.7 : 1.1;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = spec.frequence * 0.45;
    chain.connect(hp);
    hp.connect(bp);
    chain = bp;
  }
  const v = spec.volume;
  if (shape === 'losange') {
    gg.gain.linearRampToValueAtTime(v, t0 + dur * 0.42);
    gg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  } else if (shape === 'decroissant') {
    gg.gain.linearRampToValueAtTime(v, t0 + 0.02);
    gg.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  } else if (shape === 'roulement') {
    gg.gain.linearRampToValueAtTime(v * 0.7, t0 + Math.min(0.05, dur * 0.2));
    gg.gain.linearRampToValueAtTime(v * 0.4, t0 + dur * 0.6);
    gg.gain.linearRampToValueAtTime(v, t0 + dur * 0.95);
    gg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  } else {
    gg.gain.linearRampToValueAtTime(v, t0 + Math.min(0.03, dur * 0.2));
    gg.gain.setValueAtTime(v, t0 + Math.max(0.03, dur - 0.03));
    gg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  }
  chain.connect(gg);
  gg.connect(out);
  ns.start(t0);
  ns.stop(t0 + dur + 0.02);
}

export function sndTick(
  snd: HeartAudioEngine,
  clk: CardiacClockState,
  p: SimParams,
  r: ComputedResult,
  soundEnabled: boolean
): void {
  const t = clk.t;
  if (!soundEnabled || !snd.ctx || !clk.playing) {
    snd.lastT = t;
    return;
  }
  if (t - snd.lastT > 0.5 || t < snd.lastT) {
    snd.lastT = t;
    return;
  }

  let i0 = 0;
  for (let idx = clk.vEv.length - 1; idx >= 0; idx--) {
    if (clk.vEv[idx].t <= snd.lastT) {
      i0 = Math.max(0, idx - 1);
      break;
    }
  }
  let i1 = clk.vEv.length - 1;
  for (let idx = clk.vEv.length - 1; idx >= 0; idx--) {
    if (clk.vEv[idx].t <= t) {
      i1 = idx;
      break;
    }
  }

  for (let i = i0; i <= i1; i++) {
    if (!clk.vEv[i]) continue;
    const b = beat(clk, r, clk.vEv[i].t + 0.0001);
    const spd = clk.speed;
    const vol = clamp(0.6 + 0.4 * r.contract, 0.4, 1.2);
    const ms = actOf('mitrale', p) === 'stenose';
    const leakAo = r.rfAo > 0;
    if (b.sys > snd.lastT && b.sys <= t) {
      thump(
        snd,
        'b1',
        vol * (r.rythme === 'fa' ? 0.7 + 0.6 * clk.rnd() : 1) * (ms ? 1.35 : 1) * (r.rf > 0 ? 0.75 : 1)
      );
      if (r.rf > 0) murmur(snd, C.sons.souffleIM, (b.ej1 - b.sys) / spd, 'plateau');
    }
    if (b.ej0 > snd.lastT && b.ej0 <= t && (r.surfAo < 1.5 || actOf('pulmonaire', p) === 'stenose')) {
      murmur(snd, C.sons.souffleRA, ((b.ej1 - b.ej0) / spd) * 0.95, 'losange');
    }
    if (b.ej1 > snd.lastT && b.ej1 <= t) {
      thump(snd, 'b2', vol * (r.surfAo < 1 ? 0.45 : 1) * (1 + 0.25 * clamp((r.pas - 130) / 40, 0, 1)));
      if (leakAo) murmur(snd, C.sons.souffleIA, ((b.nx.t - b.ej1) * 0.55) / spd, 'decroissant');
    }
    if (ms && b.ivr + 0.04 > snd.lastT && b.ivr + 0.04 <= t) {
      murmur(
        snd,
        C.sons.roulementRM,
        Math.max(0.05, b.nx.t + 0.02 - b.ivr - 0.04) / spd,
        'roulement'
      );
    }
  }
  snd.lastT = t;
}
