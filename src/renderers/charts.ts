import { clamp, fmt } from '../engine/geometry2d';
import {
  beat,
  ecg,
  lastBefore,
  pressures,
  samplePVLoop,
  type CardiacClockState,
} from '../engine/clock';
import type { ComputedResult, DynamicState, SimParams } from '../engine/types';

export function hiDPI(
  cv: HTMLCanvasElement,
  w: number,
  h: number
): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr;
    cv.height = h * dpr;
  }
  const c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

export function drawWiggers(
  cv: HTMLCanvasElement,
  clk: CardiacClockState,
  r: ComputedResult,
  d: DynamicState
): void {
  const W = 500;
  const H = 190;
  const c = hiDPI(cv, W, H);
  if (!c) return;

  c.clearRect(0, 0, W, H);
  c.fillStyle = '#070b14';
  c.fillRect(0, 0, W, H);

  const ml = 34;
  const mr = 8;
  const mt = 10;
  const mb = 14;
  const pw = W - ml - mr;
  const phP = 110;
  const ey = mt + phP + 28;
  const dur = 1.6;
  const t0 = clk.t - dur * 0.78;
  const t1 = t0 + dur;
  const tx = (t: number) => ml + ((t - t0) / dur) * pw;
  const py = (p: number) => mt + phP - (clamp(p, 0, 190) / 190) * phP;

  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  c.fillStyle = '#8b9db8';
  c.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  [0, 50, 100, 150].forEach((v) => {
    const y = py(v);
    c.beginPath();
    c.moveTo(ml, y);
    c.lineTo(W - mr, y);
    c.stroke();
    c.fillText(String(v), 6, y + 3);
  });

  const N = 160;
  const pAo: [number, number][] = [];
  const pLv: [number, number][] = [];
  const pLa: [number, number][] = [];
  const ePts: [number, number][] = [];

  for (let i = 0; i <= N; i++) {
    const t = t0 + (dur * i) / N;
    const x = ml + (pw * i) / N;
    const pr = pressures(clk, r, t);
    pAo.push([x, py(pr.ao)]);
    pLv.push([x, py(pr.lv)]);
    pLa.push([x, py(pr.la)]);
    ePts.push([x, ey - ecg(clk, r, d, t) * 24]);
  }

  const line = (pts: [number, number][], col: string, w: number) => {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
  };

  line(pLa, '#fb923c', 1.4);
  line(pAo, '#f87171', 2);
  line(pLv, '#e879f9', 2);
  line(ePts, '#34d399', 1.7);

  const ia0 = lastBefore(clk.vEv, t0);
  c.fillStyle = '#9db0cc';
  c.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  for (let i = Math.max(0, ia0); i < clk.vEv.length; i++) {
    const e = clk.vEv[i];
    if (e.t > t1) break;
    const b = beat(clk, r, e.t + 0.001);
    if (b.sys >= t0 && b.sys <= t1) c.fillText('B1', tx(b.sys) - 6, H - mb + 10);
    if (b.ej1 >= t0 && b.ej1 <= t1) c.fillText('B2', tx(b.ej1) - 6, H - mb + 10);
  }

  const cx = tx(clk.t);
  c.strokeStyle = 'rgba(56,189,248,0.65)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx, mt);
  c.lineTo(cx, H - mb);
  c.stroke();

  c.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
  c.fillStyle = '#e879f9';
  c.fillText('VG', ml + 4, mt + 11);
  c.fillStyle = '#f87171';
  c.fillText('Aorte', ml + 26, mt + 11);
  c.fillStyle = '#fb923c';
  c.fillText('OG', ml + 62, mt + 11);
  c.fillStyle = '#34d399';
  c.fillText('ECG', ml + 86, ey - 18);

  if (r.surfAo < 1.5) {
    c.fillStyle = '#fbbf24';
    c.fillText(
      `Gradient VG–aorte ≈ ${fmt(r.grad)} mmHg`,
      ml + 124,
      mt + 11
    );
  }
}

export function drawOnde(
  cv: HTMLCanvasElement,
  clk: CardiacClockState,
  p: SimParams,
  r: ComputedResult
): void {
  const W = 500;
  const H = 190;
  const c = hiDPI(cv, W, H);
  if (!c) return;

  c.clearRect(0, 0, W, H);
  c.fillStyle = '#070b14';
  c.fillRect(0, 0, W, H);

  const ml = 34;
  const mr = 8;
  const mt = 14;
  const mb = 18;
  const pw = W - ml - mr;
  const ph = H - mt - mb;
  const dur = 3;
  const t0 = clk.t - dur * 0.85;
  const py = (pr: number) => mt + ph - (clamp(pr, 20, 220) - 20) / 200 * ph;

  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  c.fillStyle = '#8b9db8';
  c.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  [40, 80, 120, 160, 200].forEach((v) => {
    const y = py(v);
    c.beginPath();
    c.moveTo(ml, y);
    c.lineTo(W - mr, y);
    c.stroke();
    c.fillText(String(v), 5, y + 3);
  });

  c.setLineDash([4, 4]);
  c.strokeStyle = 'rgba(52,211,153,0.32)';
  [80, 120].forEach((v) => {
    const y = py(v);
    c.beginPath();
    c.moveTo(ml, y);
    c.lineTo(W - mr, y);
    c.stroke();
  });
  c.setLineDash([]);

  const N = 180;
  c.strokeStyle = '#f87171';
  c.lineWidth = 2.2;
  c.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = t0 + (dur * i) / N;
    const x = ml + (pw * i) / N;
    const y = py(pressures(clk, r, t).ao);
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.stroke();

  const cx = ml + 0.85 * pw;
  c.strokeStyle = 'rgba(56,189,248,0.6)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx, mt);
  c.lineTo(cx, H - mb);
  c.stroke();

  c.fillStyle = '#cbd5e1';
  c.font = '11px "Plus Jakarta Sans", system-ui, sans-serif';
  c.fillText(
    `Onde de pression aortique · PAS ${fmt(r.pas)} / PAD ${fmt(r.pad)} mmHg (PP ${fmt(r.pp)})`,
    ml + 4,
    H - 4
  );

  if (p.site !== 'aorte') {
    c.fillStyle = '#94a3b8';
    c.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
    c.fillText('Référence centrale', W - 108, mt + 10);
  }
}

export function drawPVLoop(
  cv: HTMLCanvasElement,
  clk: CardiacClockState,
  r: ComputedResult
): void {
  const W = 500;
  const H = 190;
  const c = hiDPI(cv, W, H);
  if (!c) return;

  c.clearRect(0, 0, W, H);
  c.fillStyle = '#070b14';
  c.fillRect(0, 0, W, H);

  const ml = 38;
  const mr = 14;
  const mt = 14;
  const mb = 24;
  const pw = W - ml - mr;
  const ph = H - mt - mb;

  const sample = samplePVLoop(clk, r);
  const vMin = 20;
  const vMax = Math.max(180, Math.ceil((sample.vtd + 25) / 20) * 20);
  const pMax = Math.max(180, Math.ceil((sample.pMax + 20) / 20) * 20);

  const vx = (v: number) => ml + (clamp(v - vMin, 0, vMax - vMin) / (vMax - vMin)) * pw;
  const py = (p: number) => mt + ph - (clamp(p, 0, pMax) / pMax) * ph;

  // Grid
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  c.fillStyle = '#8b9db8';
  c.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  [0, 50, 100, 150, 200].forEach((pv) => {
    if (pv > pMax) return;
    const y = py(pv);
    c.beginPath();
    c.moveTo(ml, y);
    c.lineTo(W - mr, y);
    c.stroke();
    c.fillText(String(pv), 6, y + 3);
  });
  [40, 80, 120, 160, 200].forEach((vv) => {
    if (vv > vMax) return;
    const x = vx(vv);
    c.beginPath();
    c.moveTo(x, mt);
    c.lineTo(x, H - mb);
    c.stroke();
    c.fillText(String(vv), x - 8, H - mb + 12);
  });

  // ESPVR contractility slope reference
  c.setLineDash([4, 4]);
  c.strokeStyle = 'rgba(251,191,36,0.35)';
  c.beginPath();
  c.moveTo(vx(12), py(0));
  c.lineTo(vx(sample.vts), py(r.lvSys));
  c.stroke();
  c.setLineDash([]);

  // Loop polygon fill + stroke
  if (sample.pts.length > 2) {
    c.beginPath();
    sample.pts.forEach((pt, idx) => {
      const x = vx(pt.v);
      const y = py(pt.p);
      if (idx === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.closePath();
    c.fillStyle = 'rgba(56,189,248,0.16)';
    c.fill();
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 2;
    c.stroke();
  }

  // Live instantaneous phase dot
  const dx = vx(sample.curV);
  const dy = py(sample.curP);
  c.beginPath();
  c.arc(dx, dy, 5, 0, Math.PI * 2);
  c.fillStyle = '#34d399';
  c.fill();
  c.strokeStyle = '#070b14';
  c.lineWidth = 1.5;
  c.stroke();

  c.fillStyle = '#cbd5e1';
  c.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
  c.fillText('Boucle Pression–Volume VG (mL × mmHg)', ml + 4, mt + 10);
  c.fillStyle = '#fbbf24';
  c.fillText('Contractilité', vx(sample.vts) + 6, py(r.lvSys) + 4);
}

