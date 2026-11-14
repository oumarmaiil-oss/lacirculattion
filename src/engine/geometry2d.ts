export type Point2D = [number, number];

export function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function seededRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function fmt(x: number, d = 0): string {
  return (Math.abs(x) < 1e-9 ? 0 : x).toLocaleString('fr-FR', {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
}

export function path2D(ctx: CanvasRenderingContext2D, pts: Point2D[], close = false): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  if (close) ctx.closePath();
}

export function centroid2D(pts: Point2D[]): Point2D {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < pts.length; i++) {
    sx += pts[i][0];
    sy += pts[i][1];
  }
  return [sx / pts.length, sy / pts.length];
}

export function polyLen(pts: Point2D[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

export function polyAt(pts: Point2D[], d: number): Point2D {
  let rem = d;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (rem <= l) {
      const u = rem / Math.max(l, 1e-9);
      return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
    }
    rem -= l;
  }
  return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
}

export function distSeg(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const u = clamp(l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0, 0, 1);
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

export function distPoly(p: Point2D, pts: Point2D[]): number {
  let d = 1e9;
  for (let i = 1; i < pts.length; i++) {
    d = Math.min(d, distSeg(p, pts[i - 1], pts[i]));
  }
  return d;
}

export function pointInPoly(p: Point2D, pts: Point2D[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      c = !c;
    }
  }
  return c;
}
