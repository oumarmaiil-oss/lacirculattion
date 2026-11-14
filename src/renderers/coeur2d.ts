import { COMP, CORO, HG, NODAL, VESSELS } from '../data/medicalContent';
import { DC_N, actOf } from '../engine/physiology';
import {
  atriumContraction,
  beat,
  ecg,
  lastBefore,
  pressures,
  valves,
  ventContraction,
  type CardiacClockState,
} from '../engine/clock';
import {
  centroid2D,
  clamp,
  distPoly,
  lerp,
  path2D,
  pointInPoly,
  polyAt,
  polyLen,
  type Point2D,
} from '../engine/geometry2d';
import type {
  ComponentId,
  ComputedResult,
  DynamicState,
  SceneLesionId,
  SimParams,
  ViewLevel,
  VisualStoryOverlay,
} from '../engine/types';
import { hiDPI } from './charts';

export interface CoeurRuntimeState {
  flow: number[];
  lastT: number;
}

export function createCoeurState(): CoeurRuntimeState {
  return {
    flow: [],
    lastT: 0,
  };
}

function scalePoly(pts: Point2D[], c: Point2D, s: number): Point2D[] {
  return pts.map((p) => [lerp(c[0], p[0], s), lerp(c[1], p[1], s)]);
}

function smoothClosedPath(c: CanvasRenderingContext2D, pts: Point2D[]): void {
  const n = pts.length;
  if (n < 3) return;
  c.beginPath();
  const mx0 = (pts[n - 1][0] + pts[0][0]) / 2;
  const my0 = (pts[n - 1][1] + pts[0][1]) / 2;
  c.moveTo(mx0, my0);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nx = pts[(i + 1) % n];
    const mx = (p[0] + nx[0]) / 2;
    const my = (p[1] + nx[1]) / 2;
    c.quadraticCurveTo(p[0], p[1], mx, my);
  }
  c.closePath();
}

function flowDraw(
  c: CanvasRenderingContext2D,
  arr: number[],
  idx: number,
  pts: Point2D[],
  n: number,
  dt: number,
  speedPx: number,
  col: string,
  rad = 3.2
): void {
  const L = polyLen(pts);
  if (L < 1) return;
  if (arr[idx] === undefined) arr[idx] = 0;
  arr[idx] = (((arr[idx] + dt * speedPx) % L) + L) % L;
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const p = polyAt(pts, (arr[idx] + (L * i) / n) % L);
    c.beginPath();
    c.arc(p[0], p[1], rad, 0, Math.PI * 2);
    c.fill();
  }
}

export function coeurLesionHit(
  x: number,
  y: number,
  p: SimParams,
  r: ComputedResult,
  story?: VisualStoryOverlay
): SceneLesionId | null {
  const showFaClot = p.mal.fa && (!r.tr.anticoagulant || (story?.clotProgress ?? 0.5) > 0.14);
  if (showFaClot && Math.hypot(x - 718, y - 224) < 22) return 'fa-clot';
  if (r.pulmEmb && Math.hypot(x - 620, y - 134) < 24) return 'pulm-emb';
  if (r.ivcBlock && Math.hypot(x - 215, y - 520) < 24) return 'ivc-clot';

  for (const k of ['iva', 'cx', 'cd'] as const) {
    if (r.zoneIDM === k || actOf(k, p) === 'bouche') {
      const pt = CORO[k].pts[1];
      if (Math.hypot(x - pt[0], y - pt[1]) < 18) return `coro-${k}` as SceneLesionId;
    }
  }

  if ((r.surfAo < 1.5 || actOf('aortique', p) === 'stenose') && Math.hypot(x - 528, y - 325) < 20) {
    return 'calc-aortique';
  }
  if (actOf('mitrale', p) === 'stenose' && Math.hypot(x - 641, y - 360) < 26) {
    return 'calc-mitrale';
  }
  if (actOf('tricuspide', p) === 'stenose' && Math.hypot(x - 385, y - 355) < 26) {
    return 'calc-tricuspide';
  }
  if (actOf('pulmonaire', p) === 'stenose' && Math.hypot(x - 476, y - 313) < 18) {
    return 'calc-pulmonaire';
  }
  return null;
}

export function coeurHit(
  x: number,
  y: number,
  level: ViewLevel = 3,
  p?: SimParams
): ComponentId | null {
  const order: ComponentId[] = [
    'sinusal',
    'nav',
    'his',
    'mitrale',
    'tricuspide',
    'aortique',
    'pulmonaire',
    'iva',
    'cx',
    'cd',
    'od',
    'og',
    'vd',
    'vg',
    'aorte',
    'ap',
    'vcaves',
    'vpulm',
  ];
  for (const id of order) {
    if (
      level === 1 &&
      (id === 'sinusal' || id === 'nav' || id === 'his') &&
      (!p || !actOf(id, p))
    ) {
      continue;
    }
    const h = COMP[id].hit;
    if (h.pt && Math.hypot(x - h.pt[0], y - h.pt[1]) < (h.r || 18)) return id;
    if (h.seg && distPoly([x, y], h.seg) < (h.w || 12)) return id;
    if (h.poly && pointInPoly([x, y], HG[h.poly].pts)) return id;
  }
  return null;
}

function drawLeaf(
  c: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  ang: number,
  len: number,
  thick = 5
): void {
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(ax + Math.cos(ang) * len, ay + Math.sin(ang) * len);
  c.lineWidth = thick;
  c.stroke();
}

export interface DrawCoeurArgs {
  cv: HTMLCanvasElement;
  clk: CardiacClockState;
  p: SimParams;
  d: DynamicState;
  r: ComputedResult;
  state: CoeurRuntimeState;
  level: ViewLevel;
  showLabels: boolean;
  isLightParticles: boolean;
  hoverId: ComponentId | null;
  story?: VisualStoryOverlay;
}

export function drawCoeur({
  cv,
  clk,
  p,
  d,
  r,
  state,
  level,
  showLabels,
  isLightParticles,
  hoverId,
  story,
}: DrawCoeurArgs): void {
  const W = 1000;
  const H = 800;
  const c = hiDPI(cv, W, H);
  if (!c) return;

  const t = clk.t;
  const dt = clamp(t - state.lastT, -0.1, 0.1);
  state.lastT = t;

  const b = beat(clk, r, t);
  const vc = ventContraction(clk, r, t, b);
  const ac = atriumContraction(clk, r, t, b);
  const va = valves(clk, r, t, b);
  const pr = pressures(clk, r, t, b);
  const prd = (arr: Point2D[], col: string, w: number) => {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    path2D(c, arr);
    c.stroke();
  };

  c.clearRect(0, 0, W, H);

  const vgWeak = actOf('vg', p) === 'faible' || p.mal.ic;
  const vdWeak = actOf('vd', p) === 'faible';
  const vcLv = vgWeak ? vc * 0.46 : vc;
  const vcRv = vdWeak ? vc * 0.44 : vc;

  // Great vessels (dilate pulmonary veins in congestion, venae cavae in RV failure)
  const aoEx = (1 - 0.8 * r.rig) * clamp((pr.ao - 75) / 60, 0, 1) * 4;
  const vcExtra = r.pvc > 7 ? clamp((r.pvc - 7) * 0.7, 0, 7) : 0;
  const vpExtra = r.congestion > 0.2 ? clamp(r.congestion * 4.5, 0, 6) : 0;
  prd(VESSELS.vcs.pts, r.pvc > 8 ? '#1d4ed8' : '#2563eb', VESSELS.vcs.w + vcExtra);
  prd(VESSELS.vci.pts, r.pvc > 8 ? '#1d4ed8' : '#2563eb', VESSELS.vci.w + vcExtra);
  VESSELS.vp.multi.forEach((pts) =>
    prd(pts, r.congestion > 0.35 ? '#f97316' : '#dc2626', VESSELS.vp.w + vpExtra)
  );
  prd(VESSELS.ap.pts, '#3b82f6', VESSELS.ap.w);
  VESSELS.ap.branches.forEach((pts) => prd(pts, '#3b82f6', 32));
  prd(VESSELS.aorte.pts, '#ef4444', VESSELS.aorte.w + aoEx);
  [
    [590, 48, 578, 6],
    [640, 41, 634, 6],
    [690, 45, 692, 6],
  ].forEach((a) => prd([[a[0], a[1]], [a[2], a[3]]], '#ef4444', 18));

  // Myocardium outer shell (organic smoothed contour; visibly enlarged/pale when weakened)
  const os = (1 - 0.04 * (vgWeak ? vcLv : vc)) * (vgWeak || vdWeak ? 1.04 : 1);
  const oc = centroid2D(HG.outer);
  c.fillStyle = vgWeak ? '#6b2232' : vdWeak ? '#701a3c' : '#881337';
  c.strokeStyle = vgWeak || vdWeak ? '#fdba74' : '#fb7185';
  c.lineWidth = 2.5;
  smoothClosedPath(c, scalePoly(HG.outer, oc, os));
  c.fill();
  c.stroke();

  // Chambers
  const hvgScale = 1 - 0.14 * d.hvg;
  const dilVG = vgWeak ? 1.13 : r.contract < 0.7 ? 1.07 : 1;
  const dilVD = vdWeak || r.pulmEmb ? 1.14 : 1;
  const laDil = actOf('mitrale', p) === 'stenose' || r.rf > 0 ? 1.12 : 1;
  const raDil = actOf('tricuspide', p) === 'stenose' || r.pvc > 10 ? 1.09 : 1;

  const chP = (
    name: 'RA' | 'LA' | 'RV' | 'LV',
    col: string,
    sc: number
  ) => {
    const ch = HG[name];
    const pts = scalePoly(ch.pts, ch.c, sc);
    c.fillStyle = col;
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 2;
    smoothClosedPath(c, pts);
    c.fill();
    c.stroke();
  };

  chP('RA', '#1e3a8a', (1 - 0.07 * ac) * raDil);
  chP('LA', '#991b1b', (1 - 0.07 * ac) * laDil);
  chP('RV', vdWeak ? '#1e40af' : '#1d4ed8', (1 - 0.12 * vcRv) * dilVD);
  chP('LV', vgWeak ? '#7f1d1d' : '#b91c1c', (1 - 0.17 * vcLv) * hvgScale * dilVG);

  // Blood stasis swirl in weakened ventricle(s)
  if (vgWeak) {
    c.save();
    c.strokeStyle = 'rgba(251,146,60,0.48)';
    c.lineWidth = 2;
    c.setLineDash([7, 6]);
    c.beginPath();
    c.arc(632, 540, 34 + 3 * Math.sin(t * 2.5), t * 1.4, t * 1.4 + Math.PI * 1.5);
    c.stroke();
    c.restore();
  }
  if (vdWeak) {
    c.save();
    c.strokeStyle = 'rgba(147,197,253,0.48)';
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    c.beginPath();
    c.arc(402, 470, 26 + 2 * Math.sin(t * 2.5), t * 1.2, t * 1.2 + Math.PI * 1.5);
    c.stroke();
    c.restore();
  }

  // Ischemic zone (IDM)
  if (r.zoneIDM) {
    c.save();
    path2D(c, scalePoly(HG.outer, oc, os), true);
    c.clip();
    const zx = r.zoneIDM === 'iva' ? 580 : r.zoneIDM === 'cx' ? 750 : 340;
    const zy = r.zoneIDM === 'iva' ? 590 : r.zoneIDM === 'cx' ? 450 : 540;
    const gr = c.createRadialGradient(zx, zy, 10, zx, zy, 120);
    gr.addColorStop(0, 'rgba(100,116,139,0.92)');
    gr.addColorStop(1, 'rgba(100,116,139,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.arc(zx, zy, 120, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // FA flutter rings
  if (!r.atriaOK) {
    c.strokeStyle = 'rgba(251,191,36,0.55)';
    c.lineWidth = 1.6;
    [HG.RA.c, HG.LA.c].forEach((pt, idx) => {
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.arc(
          pt[0],
          pt[1],
          18 + 10 * k + 3 * Math.sin(t * 22 + k + idx),
          0,
          Math.PI * 1.4
        );
        c.stroke();
      }
    });
  }

  // Stenotic high-velocity turbulent jets (when valves are obstructed)
  const aoSten = r.surfAo < 1.5 || actOf('aortique', p) === 'stenose';
  const miSten = actOf('mitrale', p) === 'stenose';
  const puSten = actOf('pulmonaire', p) === 'stenose';
  const trSten = actOf('tricuspide', p) === 'stenose';
  const inEjection = t >= b.ej0 && t < b.ej1;
  const inDiastole = t < b.sys || t >= b.ivr;

  if (aoSten && inEjection) {
    const gr = c.createLinearGradient(528, 326, 528, 175);
    gr.addColorStop(0, 'rgba(251,191,36,0.92)');
    gr.addColorStop(0.55, 'rgba(249,115,22,0.55)');
    gr.addColorStop(1, 'rgba(249,115,22,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(523, 326);
    c.lineTo(533, 326);
    c.lineTo(556, 175);
    c.lineTo(502, 175);
    c.closePath();
    c.fill();
  }
  if (puSten && inEjection) {
    const gr = c.createLinearGradient(476, 314, 474, 195);
    gr.addColorStop(0, 'rgba(251,191,36,0.85)');
    gr.addColorStop(1, 'rgba(96,165,250,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(471, 314);
    c.lineTo(481, 314);
    c.lineTo(498, 200);
    c.lineTo(454, 200);
    c.closePath();
    c.fill();
  }
  if (miSten && inDiastole) {
    const gr = c.createLinearGradient(641, 355, 636, 490);
    gr.addColorStop(0, 'rgba(251,191,36,0.88)');
    gr.addColorStop(1, 'rgba(248,113,113,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(632, 354);
    c.lineTo(650, 354);
    c.lineTo(672, 485);
    c.lineTo(605, 485);
    c.closePath();
    c.fill();
  }
  if (trSten && inDiastole) {
    const gr = c.createLinearGradient(385, 348, 396, 465);
    gr.addColorStop(0, 'rgba(251,191,36,0.82)');
    gr.addColorStop(1, 'rgba(96,165,250,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(378, 348);
    c.lineTo(394, 348);
    c.lineTo(416, 462);
    c.lineTo(372, 462);
    c.closePath();
    c.fill();
  }

  // Regurgitation jets (IM & IA)
  if (r.rf > 0 && t >= b.sys && t < b.ivr) {
    const gr = c.createLinearGradient(640, 355, 650, 225);
    gr.addColorStop(0, 'rgba(244,114,182,0.88)');
    gr.addColorStop(1, 'rgba(244,114,182,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(626, 352);
    c.lineTo(656, 352);
    c.lineTo(690, 225);
    c.lineTo(605, 230);
    c.closePath();
    c.fill();
  }
  if (r.rfAo > 0 && t >= b.ej1) {
    const gr = c.createLinearGradient(530, 330, 610, 480);
    gr.addColorStop(0, 'rgba(251,146,60,0.88)');
    gr.addColorStop(1, 'rgba(251,146,60,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(516, 332);
    c.lineTo(542, 332);
    c.lineTo(628, 495);
    c.lineTo(555, 495);
    c.closePath();
    c.fill();
  }

  // Obstruction clots (crimson-amber thrombi with clickable halo)
  const drawThrombus = (cx: number, cy: number, rad: number) => {
    c.save();
    c.fillStyle = '#991b1b';
    c.strokeStyle = '#fbbf24';
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  };
  if (r.pulmEmb) drawThrombus(620, 134, 15);
  if (r.ivcBlock) drawThrombus(215, 520, 15);

  // Blood particles along all routes including BOTH pulmonary artery branches
  const fSpd = 120 * clamp(r.dc / DC_N, 0.25, 2.4);
  const fRoutes: { pts: Point2D[]; n: number; col: string; spd: number }[] = [
    { pts: [[294, 40], [298, 220], [340, 310]], n: 5, col: '#93c5fd', spd: r.ivcBlock ? 0 : fSpd },
    { pts: [[214, 720], [220, 420], [285, 310]], n: 6, col: '#93c5fd', spd: r.ivcBlock ? 0 : fSpd },
    { pts: [[370, 340], [410, 450], [472, 315], [474, 180]], n: 6, col: '#93c5fd', spd: r.pulmEmb ? 0 : fSpd },
    { pts: [[474, 180], [380, 168], [280, 160], [175, 170]], n: 4, col: '#93c5fd', spd: r.pulmEmb ? 0 : fSpd },
    { pts: [[474, 180], [560, 140], [690, 128], [795, 150]], n: 4, col: '#93c5fd', spd: r.pulmEmb ? 0 : fSpd },
    { pts: [[920, 210], [740, 238], [645, 310]], n: 5, col: '#fca5a5', spd: fSpd },
    {
      pts: [[635, 345], [640, 480], [540, 360], [528, 180], [575, 62], [700, 46], [820, 120], [846, 360], [846, 720]],
      n: 12,
      col: '#fca5a5',
      spd: fSpd,
    },
  ];

  fRoutes.forEach((rt, idx) => {
    const n = isLightParticles ? Math.max(2, Math.round(rt.n / 2)) : rt.n;
    flowDraw(c, state.flow, idx, rt.pts, n, dt, rt.spd, rt.col, 3.8);
  });

  // 4 valves + calcified nodules when stenotic
  const drawCalcNodes = (pts: Point2D[]) => {
    c.fillStyle = '#fef08a';
    c.strokeStyle = '#d97706';
    c.lineWidth = 1.5;
    pts.forEach((pt) => {
      c.beginPath();
      c.arc(pt[0], pt[1], 5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
  };

  c.strokeStyle = '#fde68a';
  c.lineCap = 'round';
  const avAng = (o: number) => lerp(0.18, 1.05, o);

  // Tricuspid
  const to = trSten ? 0.14 : va.tricuspide;
  c.strokeStyle = trSten ? '#f59e0b' : '#fde68a';
  drawLeaf(c, 326, 344, avAng(to), 56, trSten ? 7 : 5);
  drawLeaf(
    c,
    444,
    344,
    Math.PI - avAng(actOf('tricuspide', p) === 'fuite' ? 0.5 : to),
    56,
    trSten ? 7 : 5
  );
  if (trSten) drawCalcNodes([[365, 354], [385, 356], [405, 354]]);

  // Mitral
  const mo = miSten ? 0.14 : va.mitrale;
  c.strokeStyle = miSten ? '#f59e0b' : '#fde68a';
  drawLeaf(c, 578, 350, avAng(mo), 62, miSten ? 7.5 : 5);
  drawLeaf(c, 704, 350, Math.PI - avAng(r.rf > 0 ? 0.55 : mo), 62, miSten ? 7.5 : 5);
  if (miSten) drawCalcNodes([[616, 360], [641, 362], [666, 360]]);

  // Pulmonary
  const po = puSten ? 0.14 : va.pulmonaire;
  c.strokeStyle = puSten ? '#f59e0b' : '#fde68a';
  drawLeaf(c, 456, 318, -0.35 - 0.85 * po, 22, puSten ? 6.5 : 4.5);
  drawLeaf(c, 496, 314, Math.PI + 0.35 + 0.85 * po, 22, puSten ? 6.5 : 4.5);
  if (puSten) drawCalcNodes([[466, 314], [486, 311]]);

  // Aortic
  const ao = aoSten ? va.aortique * 0.22 : va.aortique;
  c.strokeStyle = aoSten ? '#f59e0b' : '#fde68a';
  drawLeaf(c, 506, 330, -0.35 - 0.85 * ao, 24, aoSten ? 7.5 : 5);
  drawLeaf(
    c,
    550,
    328,
    Math.PI + 0.35 + 0.85 * (r.rfAo > 0 ? 0.45 : ao),
    24,
    aoSten ? 7.5 : 5
  );
  if (aoSten) {
    drawCalcNodes([[516, 326], [528, 324], [540, 325]]);
    if (r.grad >= 5) {
      c.save();
      c.font = '700 12px "IBM Plex Mono", ui-monospace, monospace';
      c.textAlign = 'center';
      c.fillStyle = 'rgba(120,53,15,0.9)';
      c.strokeStyle = 'rgba(251,191,36,0.75)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.roundRect(458, 250, 118, 22, 6);
      c.fill();
      c.stroke();
      c.fillStyle = '#fef08a';
      c.fillText(`ΔP +${Math.round(r.grad)} mmHg`, 517, 265);
      c.restore();
    }
  }

  // Coronary arteries (occlusion thrombi shown only when blocked)
  (Object.keys(CORO) as ('cd' | 'iva' | 'cx')[]).forEach((k) => {
    const bl = r.zoneIDM === k || actOf(k, p) === 'bouche';
    prd(CORO[k].pts, bl ? '#64748b' : '#f43f5e', 5.5);
    if (bl) {
      const pt = CORO[k].pts[1];
      c.save();
      c.fillStyle = '#991b1b';
      c.strokeStyle = '#fbbf24';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(pt[0], pt[1], 8.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
  });

  // Nodal conduction system: hidden in level 1 (Découvrir) unless actively blocked;
  // rendered in electric cyan in levels 2 & 3 so it never mimics yellow clots/calcifications.
  const ia = lastBefore(clk.aEv, t);
  const la = ia >= 0 ? clk.aEv[ia] : null;
  const iv = lastBefore(clk.vEv, t);
  const lv = iv >= 0 ? clk.vEv[iv] : null;
  const pAge = la ? t - la.t : 9;
  const vAge = lv ? t - lv.t : 9;
  const nsBl = !!actOf('sinusal', p);
  const navBl = !!actOf('nav', p);
  const hisBl = !!actOf('his', p);

  const nod = (pt: Point2D, rad: number, lit: boolean, bl: boolean) => {
    c.save();
    c.fillStyle = bl ? '#64748b' : lit ? '#cffafe' : '#06b6d4';
    c.strokeStyle = bl ? '#f87171' : lit ? '#22d3ee' : 'rgba(103,232,249,0.75)';
    c.lineWidth = bl ? 2 : 1.5;
    c.beginPath();
    c.arc(pt[0], pt[1], rad, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  };

  if (level >= 2 || hisBl) {
    c.save();
    c.strokeStyle = hisBl ? '#64748b' : vAge < 0.14 ? '#67e8f9' : 'rgba(34,211,238,0.48)';
    c.lineWidth = 3;
    [NODAL.his.pts, NODAL.his.bd, NODAL.his.bg].forEach((pts) => {
      path2D(c, pts);
      c.stroke();
    });
    c.restore();
  }
  if (level >= 2 || nsBl) {
    nod(NODAL.sinusal.p, 9.5, r.rythme === 'sinus' && pAge < 0.14, nsBl);
  }
  if (level >= 2 || navBl) {
    nod(NODAL.nav.p, 8, pAge >= 0.06 && pAge < 0.18 && !navBl, navBl);
  }

  // Hover outline
  if (hoverId && COMP[hoverId]) {
    const h = COMP[hoverId].hit;
    c.save();
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 2.5;
    c.setLineDash([6, 4]);
    if (h.poly) {
      path2D(c, HG[h.poly].pts, true);
      c.stroke();
    } else if (h.pt) {
      c.beginPath();
      c.arc(h.pt[0], h.pt[1], h.r || 20, 0, Math.PI * 2);
      c.stroke();
    } else if (h.seg) {
      path2D(c, h.seg);
      c.stroke();
    }
    c.restore();
  }

  // Labels with crisp dark halo for legibility over vessels
  if (showLabels) {
    const lbl = (x: number, y: number, txt: string, col = '#e2e8f0') => {
      c.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(7,11,20,0.82)';
      c.strokeText(txt, x, y);
      c.fillStyle = col;
      c.fillText(txt, x, y);
    };
    lbl(315, 256, 'OD', '#bfdbfe');
    lbl(650, 248, 'OG', '#fecaca');
    lbl(395, 465, 'VD', '#bfdbfe');
    lbl(640, 488, 'VG', '#fecaca');
    lbl(528, 28, 'Aorte', '#fca5a5');
    lbl(474, 134, 'Art. pulm.', '#93c5fd');
    lbl(282, 74, 'VCS', '#93c5fd');
    lbl(165, 680, 'VCI', '#93c5fd');
    lbl(895, 246, 'Veines pulm.', '#fca5a5');
    if (level >= 2) {
      lbl(385, 370, 'Tricuspide', '#fde68a');
      lbl(642, 374, 'Mitrale', '#fde68a');
      lbl(525, 308, 'Aortique', '#fde68a');
      lbl(426, 304, 'Pulm.', '#fde68a');
      lbl(266, 198, 'N. sinusal', '#67e8f9');
      lbl(565, 588, 'IVA', '#fda4af');
    }
    if (level === 3) {
      lbl(490, 355, 'NAV', '#67e8f9');
      lbl(516, 435, 'His', '#67e8f9');
    }
  }

  // Monitor-style scrolling ECG strip (bottom right)
  const ex = 430;
  const ey = 675;
  const ew = 550;
  const eh = 110;
  c.save();
  c.fillStyle = 'rgba(7,11,20,0.92)';
  c.strokeStyle = 'rgba(56,189,248,0.32)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.roundRect(ex, ey, ew, eh, 10);
  c.fill();
  c.stroke();

  c.strokeStyle = 'rgba(52,211,153,0.08)';
  c.lineWidth = 1;
  for (let gx = ex + 20; gx < ex + ew; gx += 20) {
    c.beginPath();
    c.moveTo(gx, ey);
    c.lineTo(gx, ey + eh);
    c.stroke();
  }
  for (let gy = ey + 20; gy < ey + eh; gy += 20) {
    c.beginPath();
    c.moveTo(ex, gy);
    c.lineTo(ex + ew, gy);
    c.stroke();
  }

  const dur = 4.2;
  const cy = ey + eh * 0.68;
  const cur = ((t % dur) + dur) % dur;
  const gx = cur / dur;

  c.strokeStyle = '#34d399';
  c.lineWidth = 2.2;
  const seg = (u0: number, u1: number) => {
    if (u1 <= u0) return;
    c.beginPath();
    const N = 110;
    for (let i = 0; i <= N; i++) {
      const u = lerp(u0, u1, i / N);
      const tt = t - ((gx - u + 1) % 1) * dur;
      const x = ex + u * ew;
      const y = cy - ecg(clk, r, d, tt) * 44;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  };
  seg(0, Math.max(0, gx - 0.025));
  seg(Math.min(1, gx + 0.025), 1);

  c.fillStyle = '#a7f3d0';
  c.beginPath();
  c.arc(ex + gx * ew, cy - ecg(clk, r, d, t) * 44, 3.2, 0, Math.PI * 2);
  c.fill();

  c.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
  c.fillStyle = '#34d399';
  c.textAlign = 'left';
  c.fillText('ECG DII', ex + 10, ey + 17);
  if (level >= 2) {
    c.fillStyle = '#94a3b8';
    c.fillText('P : oreillettes · QRS : ventricules · T : repolarisation', ex + 74, ey + 17);
  }
  c.restore();

  // Atrial clot visualization in LA appendage for FA & anticoagulation lysis (sole source of truth)
  const faClotStrength = story ? story.clotProgress * (1 - story.treatmentHeal * 0.85) : r.tr.anticoagulant ? 0.1 : 0.72;
  if (p.mal.fa && (!r.tr.anticoagulant || faClotStrength > 0.14)) {
    const clotR = clamp(15 * (r.tr.anticoagulant ? faClotStrength : Math.max(0.42, faClotStrength)), 4, 17);
    c.save();
    c.fillStyle = r.tr.anticoagulant ? 'rgba(185,28,28,0.45)' : '#991b1b';
    c.strokeStyle = '#fbbf24';
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(718, 224, clotR, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  // Inspection spotlight on heart chamber or valve
  if (story?.inspectionPaused && story.focusZone) {
    const spotMap: Record<string, { x: number; y: number; r: number } | undefined> = {
      og: { x: 676, y: 242, r: 70 },
      vg: { x: 636, y: 500, r: 100 },
      vd: { x: 400, y: 468, r: 90 },
      aortique: { x: 525, y: 312, r: 56 },
    };
    const sp = spotMap[story.focusZone];
    if (sp) {
      c.save();
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 2.2;
      c.setLineDash([7, 5]);
      c.beginPath();
      c.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(15, 23, 42, 0.88)';
      c.beginPath();
      c.roundRect(Math.max(16, sp.x - 115), Math.max(14, sp.y - sp.r - 30), 230, 22, 6);
      c.fill();
      c.strokeStyle = 'rgba(56,189,248,0.65)';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#bae6fd';
      c.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(story.focusLabel, sp.x, Math.max(29, sp.y - sp.r - 15));
      c.restore();
    }
  }

  c.save();
  c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
  c.fillStyle = 'rgba(148, 163, 184, 0.28)';
  c.textAlign = 'left';
  c.fillText('Atelier du Cœur · Dr O. Sow', 14, H - 12);
  c.restore();
}
