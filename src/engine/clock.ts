import { CONFIG_COEUR } from '../config/physiologie';
import { clamp, lerp, seededRng, smooth } from './geometry2d';
import type {
  AtrialEvent,
  BeatTiming,
  ComputedResult,
  DynamicState,
  VentricularEvent,
} from './types';

const CY = CONFIG_COEUR.cycle;

export interface CardiacClockState {
  t: number;
  playing: boolean;
  speed: number;
  aEv: AtrialEvent[];
  vEv: VentricularEvent[];
  rnd: () => number;
}

export function createClock(): CardiacClockState {
  return {
    t: 0,
    playing: true,
    speed: 1,
    aEv: [],
    vEv: [],
    rnd: seededRng(7),
  };
}

export function lastBefore<T extends { t: number }>(arr: T[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let r = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) {
      r = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return r;
}

export function clkExtend(clk: CardiacClockState, r: ComputedResult, until: number): void {
  const sinusPer = 60 / Math.max(20, r.rythme === 'bav3' ? r.fcA : r.fcEff);
  let guard = 0;
  while (guard++ < 400) {
    const lv = clk.vEv[clk.vEv.length - 1];
    const la = clk.aEv[clk.aEv.length - 1];
    if (lv && lv.t > until) break;
    if (r.rythme === 'sinus') {
      const tp = la ? la.t + sinusPer : lv ? lv.t + sinusPer - 0.16 : -4.3;
      const pr = clamp(CY.intervallePR * Math.pow(sinusPer / 0.857, 0.3), 0.12, 0.2);
      clk.aEv.push({ t: tp });
      clk.vEv.push({ t: tp + pr, wide: false, svf: 1 });
    } else if (r.rythme === 'esv') {
      const baseT = lv ? lv.t : -4.3;
      const isPremature = clk.vEv.length % 4 === 3;
      if (isPremature) {
        clk.vEv.push({
          t: baseT + sinusPer * 0.58,
          wide: true,
          svf: 0.62,
          isEsv: true,
        });
      } else {
        const afterEsv = Boolean(lv?.isEsv);
        const step = afterEsv ? sinusPer * 1.38 : sinusPer;
        const tp = (lv ? lv.t + step : -4.3) - 0.16;
        const pr = clamp(CY.intervallePR * Math.pow(sinusPer / 0.857, 0.3), 0.12, 0.2);
        clk.aEv.push({ t: tp });
        clk.vEv.push({ t: tp + pr, wide: false, svf: afterEsv ? 1.12 : 1 });
      }
    } else if (r.rythme === 'flutter') {
      const tv = lv ? lv.t + 60 / Math.max(25, r.fcEff) : -4;
      let l2 = clk.aEv[clk.aEv.length - 1];
      const fPer = 60 / 275; // ~275 bpm sawtooth flutter waves
      while (!l2 || l2.t < tv + 1.5) {
        clk.aEv.push({ t: l2 ? l2.t + fPer : tv - 1.0, isFlutter: true });
        l2 = clk.aEv[clk.aEv.length - 1];
      }
      clk.vEv.push({ t: tv, wide: false, svf: 0.94 });
    } else if (r.rythme === 'fa') {
      const mean = 60 / Math.max(20, r.fcEff);
      const rr = Math.max(0.33, mean * (1 + CY.faIrregularite * (clk.rnd() * 2 - 1)));
      const t = lv ? lv.t + rr : -4;
      clk.vEv.push({ t, wide: false, svf: clamp(Math.pow(rr / mean, 0.5), 0.6, 1.3) });
    } else if (r.rythme === 'jonctionnel') {
      const t = lv ? lv.t + 60 / r.fcEff : -4;
      clk.vEv.push({ t, wide: false, svf: 1 });
    } else {
      const tv = lv ? lv.t + 60 / r.fcEff : -4;
      let l2 = clk.aEv[clk.aEv.length - 1];
      while (r.fcA > 0 && (!l2 || l2.t < tv + 2)) {
        clk.aEv.push({ t: l2 ? l2.t + sinusPer : tv - 0.2 });
        l2 = clk.aEv[clk.aEv.length - 1];
      }
      clk.vEv.push({ t: tv, wide: r.heartBlock === 'his', svf: 1 });
    }
  }
}

export function clkRegen(clk: CardiacClockState, r: ComputedResult): void {
  const t = clk.t;
  const iv = lastBefore(clk.vEv, t);
  clk.vEv = iv >= 0 ? clk.vEv.slice(Math.max(0, iv - 10), iv + 1) : [];
  const ia = lastBefore(clk.aEv, t);
  clk.aEv =
    r.rythme === 'sinus' || r.rythme === 'bav3' || r.rythme === 'esv' || r.rythme === 'flutter'
      ? ia >= 0
        ? clk.aEv.slice(Math.max(0, ia - 12), ia + 1)
        : []
      : clk.aEv.filter((a) => a.t <= t).slice(-10);

  const rrBack = 60 / Math.max(25, r.fcEff);
  if (!clk.vEv.length) {
    clk.vEv.push({ t: t - 4.5, wide: r.heartBlock === 'his', svf: 1 });
    if (r.rythme === 'sinus' || r.rythme === 'bav3' || r.rythme === 'esv') {
      clk.aEv.push({ t: t - 4.5 - 0.16 });
    }
  } else {
    while (clk.vEv[0].t > t - 4.2 && clk.vEv.length < 24) {
      const prevT = clk.vEv[0].t - rrBack;
      clk.vEv.unshift({ t: prevT, wide: r.heartBlock === 'his', svf: 1 });
      if (r.rythme === 'sinus' || r.rythme === 'esv') {
        clk.aEv.unshift({ t: prevT - 0.16 });
      }
    }
  }

  if ((r.rythme === 'sinus' || r.rythme === 'esv') && clk.vEv.length && clk.aEv.length) {
    const lv = clk.vEv[clk.vEv.length - 1];
    if (!lv.isEsv && clk.aEv[clk.aEv.length - 1].t < lv.t - 0.25) {
      clk.aEv.push({ t: lv.t - 0.16 });
    }
  }
  clkExtend(clk, r, t + 6);
}

export function clkTrim(clk: CardiacClockState): void {
  const t = clk.t;
  while (clk.vEv.length > 40 && clk.vEv[1].t < t - 8) clk.vEv.shift();
  while (clk.aEv.length > 40 && clk.aEv[1].t < t - 8) clk.aEv.shift();
}

export function beat(clk: CardiacClockState, r: ComputedResult, t: number): BeatTiming {
  let i = lastBefore(clk.vEv, t);
  if (i < 0) i = 0;
  const v = clk.vEv[i] || { t: t - 0.1, wide: false, svf: 1 };
  const nx = clk.vEv[i + 1] || { t: v.t + 60 / r.fcEff, wide: v.wide, svf: 1 };
  const rr = Math.max(0.25, nx.t - v.t);
  let qt = CY.qtc * Math.sqrt(rr) + (v.wide ? 0.06 : 0);
  qt = Math.min(qt, rr * 0.62);
  const sys = v.t + (v.wide ? 0.06 : 0.03);
  const ej0 = sys + CY.contractionIsovolumique;
  const ej1 = Math.max(ej0 + 0.1, v.t + qt);
  const ivr = Math.min(ej1 + CY.relaxationIsovolumique, v.t + rr * 0.9);
  const ia = lastBefore(clk.aEv, t);
  const a = ia >= 0 ? clk.aEv[ia] : null;
  return { v, nx, rr, qt, sys, ej0, ej1, ivr, a, svf: v.svf || 1, i };
}

export function lvVolume(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b?: BeatTiming
): number {
  const cur = b || beat(clk, r, t);
  const sv = r.svtot * cur.svf;
  const vtd = r.vts + sv;
  const vts = r.vts;
  if (t < cur.sys) return vtd;
  if (t < cur.ej0) return vtd;
  if (t < cur.ej1) {
    const x = (t - cur.ej0) / (cur.ej1 - cur.ej0);
    return vtd - sv * (1 - Math.pow(1 - x, 1.8));
  }
  if (t < cur.ivr) return vts;
  const pf =
    r.atriaOK && r.rythme !== 'bav3'
      ? 1 - r.kick
      : r.rythme === 'bav3'
        ? 1 - r.kick * 0.5
        : 1;
  let v = vts + sv * pf * (1 - Math.exp(-(t - cur.ivr) / 0.085));
  if (r.atriaOK) {
    const a = cur.a;
    const nsys = cur.nx.t + 0.03;
    if (a && a.t > cur.ivr - 0.05 && a.t < nsys) {
      v += sv * (1 - pf) * smooth(a.t + 0.05, a.t + 0.17, t);
    }
  }
  return Math.min(vtd, v);
}

export function atriumContraction(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b?: BeatTiming
): number {
  if (!r.atriaOK) return 0;
  const a = b ? b.a : clk.aEv[lastBefore(clk.aEv, t)];
  if (!a) return 0;
  const x = (t - a.t - 0.05) / 0.13;
  return x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0;
}

export function valves(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b?: BeatTiming
) {
  const cur = b || beat(clk, r, t);
  const nsys = cur.nx.t + (cur.nx.wide ? 0.06 : 0.03);
  const av =
    t < cur.sys
      ? 1 - smooth(cur.sys - 0.02, cur.sys, t)
      : t < cur.ivr
        ? 0
        : smooth(cur.ivr, cur.ivr + 0.04, t) * (1 - smooth(nsys - 0.02, nsys, t));
  const sl =
    t < cur.ej0 || t > cur.ej1 + 0.02
      ? 0
      : smooth(cur.ej0, cur.ej0 + 0.03, t) * (1 - smooth(cur.ej1 - 0.01, cur.ej1 + 0.01, t));
  return { mitrale: av, tricuspide: av, aortique: sl, pulmonaire: sl };
}

export function ventContraction(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b?: BeatTiming
): number {
  const cur = b || beat(clk, r, t);
  const v = lvVolume(clk, r, t, cur);
  const vtd = r.vts + r.svtot * cur.svf;
  return clamp((vtd - v) / Math.max(1, r.svtot), 0, 1.1);
}

export function pressures(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b?: BeatTiming
): { lv: number; ao: number; la: number } {
  const cur = b || beat(clk, r, t);
  const pad = r.pad;
  const pas = r.pas;
  const lvs = r.lvSys;
  const edp = r.ptdvg;
  let lv = edp;
  let ao = pad;
  let la = r.pog;

  const nb = beat(clk, r, cur.nx.t + 0.001);
  const eEnd = 0.6;
  if (t >= cur.ej0 && t <= cur.ej1) {
    const x = (t - cur.ej0) / (cur.ej1 - cur.ej0);
    const base =
      x < 0.35
        ? Math.sin((Math.PI / 2) * (x / 0.35))
        : 1 - (1 - eEnd) * Math.pow((x - 0.35) / 0.65, 1.5);
    const aug = r.rig * 0.3 * Math.exp(-Math.pow((x - 0.7) / 0.18, 2));
    ao = pad + (pas - pad) * clamp(base * (1 - 0.22 * r.rig) + aug, 0, 1.05);
  } else {
    const t0 = t < cur.ej0 ? beat(clk, r, cur.v.t - 0.01).ej1 : cur.ej1;
    const t1 = t < cur.ej0 ? cur.ej0 : nb.ej0;
    const pn =
      pad +
      (pas - pad) *
        eEnd *
        (1 - 0.22 * r.rig + r.rig * 0.3 * Math.exp(-Math.pow(0.3 / 0.18, 2)));
    const k = (t - t0) / Math.max(0.05, t1 - t0);
    const tau = 0.55 + 0.6 * (1 - r.rig);
    const e = Math.exp(-k / tau);
    const e1 = Math.exp(-1 / tau);
    ao = pad + ((pn - pad) * (e - e1)) / Math.max(1e-5, 1 - e1);
    ao +=
      3.5 *
      (Math.exp(-Math.pow((t - t0 - 0.035) / 0.014, 2)) -
        0.9 * Math.exp(-Math.pow((t - t0 - 0.008) / 0.008, 2)));
  }

  if (t >= cur.sys && t < cur.ej0) {
    const x = (t - cur.sys) / (cur.ej0 - cur.sys);
    lv = edp + (pad - edp) * x * x;
  } else if (t >= cur.ej0 && t <= cur.ej1) {
    const x = (t - cur.ej0) / (cur.ej1 - cur.ej0);
    lv = Math.max(
      ao,
      pad +
        (lvs - pad) *
          Math.sin(Math.PI * Math.pow(x, 0.7)) *
          (x > 0.85 ? 1 - (x - 0.85) * 2 : 1)
    );
  } else if (t > cur.ej1 && t < cur.ivr) {
    const x = (t - cur.ej1) / (cur.ivr - cur.ej1);
    lv = lerp(ao, 3, 1 - Math.pow(1 - x, 2.2));
  } else {
    const fillx = clamp(
      (lvVolume(clk, r, t, cur) - r.vts) / Math.max(1, r.svtot * cur.svf),
      0,
      1
    );
    lv = 2 + (edp - 2) * Math.pow(fillx, 2);
  }

  const ac = atriumContraction(clk, r, t, cur);
  la = r.pog - 2 + 4 * ac;
  if (t >= cur.sys && t <= cur.ivr) {
    const x = (t - cur.sys) / (cur.ivr - cur.sys);
    la += (2 + (r.rf > 0 ? 14 : 4)) * Math.pow(x, 1.5);
  } else if (t > cur.ivr) {
    la += (r.rf > 0 ? 16 : 6) * Math.exp(-(t - cur.ivr) / 0.06);
  }
  return { lv, ao, la };
}

const gauss = (t: number, c: number, s: number) =>
  Math.exp(-0.5 * Math.pow((t - c) / s, 2));

export function ecg(
  clk: CardiacClockState,
  r: ComputedResult,
  d: DynamicState,
  t: number
): number {
  let v = 0;
  const ia = lastBefore(clk.aEv, t);
  for (let k = Math.max(0, ia - 2); k <= ia + 2 && k < clk.aEv.length; k++) {
    if (k < 0) continue;
    const a = clk.aEv[k];
    if (a.isFlutter) {
      v += -0.11 * gauss(t, a.t + 0.04, 0.025) + 0.09 * gauss(t, a.t + 0.11, 0.032);
    } else {
      v += CY.ampP * gauss(t, a.t + CY.dureeP / 2, 0.022);
    }
  }
  const iv = lastBefore(clk.vEv, t);
  for (let k = Math.max(0, iv - 1); k <= iv + 1 && k < clk.vEv.length; k++) {
    if (k < 0) continue;
    const e = clk.vEv[k];
    const nx = clk.vEv[k + 1];
    const rr = nx ? nx.t - e.t : 60 / r.fcEff;
    const w = e.wide ? 2.4 : 1;
    const q0 = e.t;
    const hv = d.hvg;
    const qt = Math.min(CY.qtc * Math.sqrt(rr) + (e.wide ? 0.06 : 0), rr * 0.62);
    v += CY.ampQ * gauss(t, q0 + 0.012 * w, 0.007 * w);
    v += CY.ampR * (1 + 0.55 * hv) * (e.wide ? 0.8 : 1) * gauss(t, q0 + 0.035 * w, 0.009 * w);
    v += CY.ampS * (1 + 0.5 * hv) * gauss(t, q0 + 0.058 * w, 0.009 * w);
    const tc = q0 + qt - 0.085;
    const tAmp = CY.ampT * (e.wide ? -1.3 : 1) * (hv > 0.75 ? 1 - (hv - 0.75) * 5 : 1);
    v += tAmp * gauss(t, tc, 0.042);
    if (r.zoneIDM) {
      const st = CONFIG_COEUR.maladies.idm.susDecalageST * (r.zoneIDM === 'iva' ? 1 : 0.7);
      v += st * smooth(q0 + 0.07 * w, q0 + 0.1 * w, t) * (1 - smooth(tc, tc + 0.07, t));
    }
  }
  if (r.rythme === 'fa') {
    v +=
      0.045 * Math.sin(2 * Math.PI * 6.1 * t) +
      0.03 * Math.sin(2 * Math.PI * 7.7 * t + 1) +
      0.025 * Math.sin(2 * Math.PI * 5.3 * t + 2);
  }
  return v;
}

export function rythmeName(r: ComputedResult): string {
  return {
    sinus: 'rythme sinusal',
    fa: 'fibrillation auriculaire',
    jonctionnel: 'rythme jonctionnel',
    bav3: 'BAV complet',
    esv: 'sinusal + extrasystoles (ESV)',
    flutter: 'flutter auriculaire',
  }[r.rythme];
}

export function phaseName(
  clk: CardiacClockState,
  r: ComputedResult,
  t: number,
  b: BeatTiming
): string {
  if (t >= b.sys && t < b.ej0) return 'Contraction isovolumique (B1)';
  if (t >= b.ej0 && t < b.ej1) return 'Éjection';
  if (t >= b.ej1 && t < b.ivr) return 'Relaxation isovolumique (B2)';
  if (r.atriaOK && atriumContraction(clk, r, t, b) > 0.05) return 'Contraction des oreillettes';
  return 'Remplissage des ventricules';
}

export function tlInfo(clk: CardiacClockState, r: ComputedResult) {
  let b = beat(clk, r, clk.t);
  let w0 = b.v.t - 0.18;
  if (clk.t < w0) {
    b = beat(clk, r, b.v.t - 0.02);
    w0 = b.v.t - 0.18;
  }
  const w1 = b.nx.t - 0.18;
  const keys: (number | null)[] = [
    b.a && b.a.t >= w0 && b.a.t < w1 && r.atriaOK && r.rythme !== 'fa' && r.rythme !== 'flutter'
      ? b.a.t + 0.02
      : null,
    b.sys,
    b.ej0,
    b.ej1,
    b.ivr,
  ];
  return { w0, w1, keys };
}

export interface PVLoopSample {
  pts: { v: number; p: number }[];
  curV: number;
  curP: number;
  vtd: number;
  vts: number;
  pMax: number;
}

export function samplePVLoop(clk: CardiacClockState, r: ComputedResult): PVLoopSample {
  const cur = beat(clk, r, clk.t);
  const tStart = cur.v.t;
  const tEnd = cur.nx.t;
  const steps = 64;
  const pts: { v: number; p: number }[] = [];
  let pMax = 0;
  for (let i = 0; i <= steps; i++) {
    const ti = tStart + ((tEnd - tStart) * i) / steps;
    const bi = beat(clk, r, ti);
    const v = lvVolume(clk, r, ti, bi);
    const pr = pressures(clk, r, ti, bi).lv;
    pMax = Math.max(pMax, pr);
    pts.push({ v, p: pr });
  }
  const curV = lvVolume(clk, r, clk.t, cur);
  const curP = pressures(clk, r, clk.t, cur).lv;
  return {
    pts,
    curV,
    curP,
    vtd: r.vts + r.svtot * cur.svf,
    vts: r.vts,
    pMax,
  };
}
