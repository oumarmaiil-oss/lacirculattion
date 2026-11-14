import { SITES } from '../data/medicalContent';
import { C, stenosePct } from '../engine/physiology';
import { pressures, type CardiacClockState } from '../engine/clock';
import { clamp, fmt, lerp } from '../engine/geometry2d';
import type {
  ComputedResult,
  SceneLesionId,
  SimParams,
  ViewLevel,
  VisualStoryOverlay,
} from '../engine/types';
import { hiDPI } from './charts';

export interface VaisseauRuntimeState {
  scroll: number;
  lastT: number;
}

export function createVaisseauState(): VaisseauRuntimeState {
  return {
    scroll: 0,
    lastT: 0,
  };
}

export function vaisseauLesionHit(
  x: number,
  y: number,
  p: SimParams,
  story?: VisualStoryOverlay
): SceneLesionId | null {
  const st = p.plaque;
  if (st <= 0) return null;
  const showClot = st === 6 || (story !== undefined && story.clotProgress > 0.25 && st >= 4);
  if (showClot && Math.hypot((x - 440) / 1.8, y - 270) < 55) {
    return 'vessel-thrombus';
  }
  if (x >= 260 && x <= 620 && y >= 215 && y <= 385) {
    return 'vessel-plaque';
  }
  return null;
}

export interface DrawVaisseauArgs {
  cv: HTMLCanvasElement;
  clk: CardiacClockState;
  p: SimParams;
  r: ComputedResult;
  state: VaisseauRuntimeState;
  level: ViewLevel;
  showLabels: boolean;
  story?: VisualStoryOverlay;
}

export function drawVaisseau({
  cv,
  clk,
  p,
  r,
  state,
  level,
  showLabels,
  story,
}: DrawVaisseauArgs): void {
  const W = 880;
  const H = 560;
  const c = hiDPI(cv, W, H);
  if (!c) return;

  const t = clk.t;
  const dt = clamp(t - state.lastT, -0.1, 0.1);
  state.lastT = t;

  c.clearRect(0, 0, W, H);

  const pr = pressures(clk, r, t).ao;
  const dist = clamp((pr - 75) / 60, 0, 1.3) * 14 * (1 - 0.85 * r.rig);
  const st = p.plaque;
  const sten = stenosePct(st, p) / 100;
  const cy = 285;
  const vasodil = r.tr.ica || r.raa > 0;
  const toneOffset = vasodil ? 10 : r.resist > 1.2 ? -8 : 0;
  const half = 115 + dist + toneOffset;
  const tAdv = 16;
  const tMed = p.mal.hta ? 44 : 32;
  const tInt = 10;
  const lumenT = cy - half + tAdv + tMed + tInt;
  const lumenB = cy + half - tAdv - tMed - tInt;

  // Adventitia & Media
  c.fillStyle = '#3f2e3e';
  c.fillRect(0, cy - half, W, 2 * half);
  c.fillStyle = r.rig > 0.55 ? '#7c3a44' : '#9f1239';
  c.fillRect(0, cy - half + tAdv, W, 2 * half - 2 * tAdv);

  // Elastic lamellae
  const nLam = SITES[p.site].lam;
  c.strokeStyle = r.rig > 0.55 ? 'rgba(253,224,71,0.28)' : 'rgba(253,224,71,0.52)';
  c.lineWidth = r.rig > 0.55 ? 1.5 : 2;
  for (let side of [-1, 1]) {
    for (let k = 0; k < nLam; k++) {
      const y = cy + side * (half - tAdv - 4 - k * ((tMed - 8) / Math.max(1, nLam)));
      c.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const wav = Math.sin(x * 0.05 + k) * (r.rig > 0.55 ? 0.5 : 2);
        if (r.rig > 0.55 && x % 48 < 14) {
          c.moveTo(x + 12, y + wav);
          continue;
        }
        if (x === 0) c.moveTo(x, y + wav);
        else c.lineTo(x, y + wav);
      }
      c.stroke();
    }
  }

  // Calcification plaques when arterial stiffness is high
  if (r.rig > 0.55) {
    c.fillStyle = 'rgba(226,232,240,0.45)';
    [130, 310, 560, 750].forEach((x) => {
      c.fillRect(x, cy - half + tAdv + 8, 28, 7);
      c.fillRect(x + 40, cy + half - tAdv - 15, 24, 7);
    });
  }

  // Intima & Lumen
  c.fillStyle = '#e11d48';
  c.fillRect(0, lumenT - tInt, W, tInt);
  c.fillRect(0, lumenB, W, tInt);
  c.fillStyle = '#3b0712';
  c.fillRect(0, lumenT, W, lumenB - lumenT);

  // Endothelium & NO
  const dys = r.dysEndo;
  c.strokeStyle = dys ? '#fb923c' : '#34d399';
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(0, lumenT);
  c.lineTo(W, lumenT);
  c.moveTo(0, lumenB);
  c.lineTo(W, lumenB);
  c.stroke();

  const noN = Math.round(r.no * 18);
  c.fillStyle = '#34d399';
  for (let i = 0; i < noN; i++) {
    const x = (i * 53 + 20) % W;
    const ph = (t * 0.7 + i * 0.3) % 1;
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.arc(x, lumenT - ph * tMed * 0.8, 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // Plaque & thrombus (progressively heals/lyses under statin/antiagregant or detaches embolus when untreated)
  const heal = clamp(story?.treatmentHeal ?? 0, 0, 1);
  const px0 = 260;
  const px1 = 620;
  const baseFrac =
    st === 0 ? 0 : st === 1 ? 0.08 : st === 2 ? 0.14 : st === 3 ? 0.22 : st === 4 ? 0.36 : 0.62;
  const ph = (lumenB - lumenT) * baseFrac * (1 - heal * 0.34);

  if (st > 0) {
    const capT = r.tr.statine ? lerp(14, 24, Math.max(0.4, heal)) : st >= 5 ? 6 : 12;
    c.save();
    c.beginPath();
    c.moveTo(px0, lumenB);
    c.bezierCurveTo(px0 + 90, lumenB, px0 + 110, lumenB - ph, (px0 + px1) / 2, lumenB - ph);
    c.bezierCurveTo(px1 - 110, lumenB - ph, px1 - 90, lumenB, px1, lumenB);
    c.closePath();
    c.fillStyle = r.tr.statine && heal > 0.5 ? '#ca8a04' : st >= 4 ? '#facc15' : '#fde047';
    c.fill();
    c.strokeStyle = r.tr.statine ? '#34d399' : '#fef3c7';
    c.lineWidth = capT / 2;
    c.stroke();

    if (st >= 1) {
      c.fillStyle = '#fef08a';
      const ldlCoreN = Math.max(3, Math.round((r.tr.statine ? 8 : 16) * (1 - heal * 0.55)));
      for (let i = 0; i < ldlCoreN; i++) {
        c.beginPath();
        c.arc(px0 + 80 + ((i * 23) % 200), lumenB - 6 - ((i * 7) % Math.max(8, ph - 12)), 3, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (st >= 2) {
      c.fillStyle = '#fb923c';
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.arc(px0 + 95 + ((i * 29) % 170), lumenB - 10 - ((i * 11) % Math.max(10, ph - 16)), 4.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (st >= 3) {
      c.fillStyle = '#a855f7';
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(
          px0 + 90 + i * 32,
          lumenB - 14 - ((i * 13) % Math.max(12, ph - 18)),
          6,
          0,
          Math.PI * 2
        );
        c.fill();
      }
    }
    if (st >= 4) {
      c.fillStyle = '#7dd3fc';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(
          px0 + 100 + ((i * 25) % 160),
          lumenB - 10 - ((i * 9) % Math.max(10, ph - 20)),
          5.5,
          0,
          Math.PI * 2
        );
        c.fill();
      }
    }
    const showClot = st === 6 || (story && story.clotProgress > 0.25 && st >= 4);
    if (showClot) {
      const clotMag = clamp(
        (st === 6 ? 1 : story?.clotProgress ?? 0) * (r.tr.antiagregant ? 0.52 : 1) * (1 - heal * 0.78),
        0.12,
        1
      );
      c.fillStyle = '#991b1b';
      c.strokeStyle = '#fbbf24';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(
        (px0 + px1) / 2,
        lumenB - ph - 14 * clotMag,
        75 * clotMag,
        Math.max(8, (lumenB - lumenT - ph) * 0.55 * clotMag),
        0,
        0,
        Math.PI * 2
      );
      c.fill();
      c.stroke();

      // Detaching clot fragment (embole) drifting downstream when untreated complication advances
      if (story?.embolDetached && !r.tr.statine) {
        const embU = (t * 0.42) % 1;
        const ex = lerp((px0 + px1) / 2 + 40, W - 36, embU);
        const ey = lumenB - ph - 16 - Math.sin(embU * Math.PI) * 18;
        c.fillStyle = '#b91c1c';
        c.strokeStyle = '#fbbf24';
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(ex, ey, 16, 11, 0.15, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#fde68a';
        c.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText('Embole détaché →', ex, ey - 16);
      }
    }
    c.restore();
  }

  // Flowing RBCs and platelets (using dt-integrated scroll & continuity acceleration)
  const flowMul = st === 6 ? (r.tr.antiagregant || heal > 0.6 ? 0.62 : 0.14) : 1;
  state.scroll = (((state.scroll + dt * 155 * flowMul) % W) + W) % W;

  for (let i = 0; i < 24; i++) {
    const x = (state.scroll + i * 39) % W;
    const inP = x > px0 && x < px1 ? Math.sin((Math.PI * (x - px0)) / (px1 - px0)) : 0;
    const yb = lumenB - ph * inP;
    const h = Math.max(12, yb - lumenT - 14);
    const y = lumenT + 8 + ((i * 37) % Math.max(12, Math.floor(h)));
    c.fillStyle = '#ef4444';
    c.beginPath();
    c.ellipse(x, y, 7, 4.5, 0, 0, Math.PI * 2);
    c.fill();
  }

  // LDL particles in lumen: only render when dyslipidemia/plaque is active (never clutter normal healthy arteries)
  if (p.mal.dyslipidemie || r.ldl > 1.15 || (level >= 3 && st > 0)) {
    const nLdl = Math.round((r.ldl / 2) * 14);
    c.fillStyle = '#fde047';
    for (let i = 0; i < nLdl; i++) {
      const x = (state.scroll * 0.72 + i * 67) % W;
      const y = lumenT + 12 + ((i * 41) % Math.max(12, Math.floor(lumenB - lumenT - ph - 18)));
      c.beginPath();
      c.arc(x, y, 3, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Labels & readout
  if (showLabels) {
    const lbl = (
      x: number,
      y: number,
      txt: string,
      col = '#e2e8f0',
      align: CanvasTextAlign = 'left'
    ) => {
      c.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
      c.textAlign = align;
      c.fillStyle = col;
      c.fillText(txt, x, y);
    };
    lbl(18, cy - half + 12, 'Adventice (enveloppe externe)', '#cbd5e1');
    lbl(18, cy - half + tAdv + 20, `Média (muscle + lames élastiques)${p.mal.hta ? ' · épaissie' : ''}`, '#fda4af');
    lbl(18, lumenT - 14, 'Intima', '#fda4af');
    lbl(
      18,
      lumenT + 18,
      dys ? 'Endothélium abîmé (moins de NO)' : 'Endothélium intact (libère du NO)',
      dys ? '#fb923c' : '#34d399'
    );
    lbl(W - 18, cy + 4, 'Lumière (sang)', '#fca5a5', 'right');

    if (st >= 1) lbl(px0 + 60, lumenB + 22, 'LDL infiltré & oxydé', '#fde047');
    if (st >= 3 && level >= 2) lbl((px0 + px1) / 2, lumenB + 38, 'Macrophages & cellules spumeuses', '#7dd3fc', 'center');
    if (st >= 5) {
      lbl(
        (px0 + px1) / 2,
        st === 6 ? lumenB - Math.max(24, ph - 18) : lumenB - ph - 12,
        r.tr.statine ? 'Chape fibreuse épaissie (statine)' : 'Chape fibreuse fine (fragile)',
        r.tr.statine ? '#34d399' : '#fef08a',
        'center'
      );
    }
    if (st === 6) {
      lbl(
        (px0 + px1) / 2,
        lumenT + 26,
        r.tr.antiagregant ? 'Caillot réduit (aspirine)' : 'Caillot obstruant l’artère',
        '#fbbf24',
        'center'
      );
    }
  }

  c.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
  c.fillStyle = '#e2e8f0';
  c.textAlign = 'left';
  c.fillText(
    `${SITES[p.site].nom} (${SITES[p.site].diam}, ${SITES[p.site].type}) · sténose ${fmt(
      sten * 100
    )} % · étape ${st}/6`,
    18,
    H - 16
  );

  // Subtle bar comparing systolic/diastolic wall excursion
  const distPct = Math.round((1 - 0.85 * r.rig) * 100);
  c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
  c.fillStyle = '#94a3b8';
  c.textAlign = 'right';
  c.fillText(`Souplesse pariétale ${distPct} %`, W - 18, H - 16);

  // Inspection focus reticle when paused at key moment
  if (story?.inspectionPaused && (story.focusZone === 'plaque' || story.focusZone === 'embole')) {
    c.save();
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 2;
    c.setLineDash([7, 5]);
    c.beginPath();
    c.roundRect(px0 - 20, lumenT - 12, px1 - px0 + 40, lumenB - lumenT + 42, 14);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(15, 23, 42, 0.88)';
    c.beginPath();
    c.roundRect(px0 - 16, lumenT - 40, 260, 22, 6);
    c.fill();
    c.strokeStyle = 'rgba(56,189,248,0.65)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#bae6fd';
    c.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(`Inspection · ${story.focusLabel}`, px0 - 6, lumenT - 25);
    c.restore();
  }

  c.save();
  c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
  c.fillStyle = 'rgba(148, 163, 184, 0.28)';
  c.textAlign = 'right';
  c.fillText('Atelier du Cœur · Dr O. Sow', W - 16, 18);
  c.restore();
}
