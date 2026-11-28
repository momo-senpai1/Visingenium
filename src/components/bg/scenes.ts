/**
 * Animated subject backgrounds. Every scene is a pure function of time t [s] (plus the pointer),
 * so the global clock can pause and scrub them. Coordinates are CSS pixels.
 */

export interface Env {
  w: number;
  h: number;
  t: number;
  /** pointer in CSS px, or null when it is not over the canvas */
  px: number | null;
  py: number | null;
  dark: boolean;
  /** CSS colour from a theme variable holding an RGB triplet */
  c: (name: string, a?: number) => string;
}
export type Scene = (ctx: CanvasRenderingContext2D, e: Env) => void;
export type SceneId = 'smoke' | 'separation' | 'heat' | 'circuits' | 'mechanics' | 'control' | 'thermo' | 'fluid';

// ---------------------------------------------------------------- helpers

/** deterministic pseudo-random number in [0, 1) */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
/** triangle wave in [0, 1] (bouncing between two walls) */
const tri = (u: number) => 1 - Math.abs((((u % 2) + 2) % 2) - 1);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** FEA-style colour map: blue → cyan → green → yellow → red */
export function jet(v: number, a = 1): string {
  const x = clamp01(v);
  const r = clamp01(1.5 - Math.abs(4 * x - 3));
  const g = clamp01(1.5 - Math.abs(4 * x - 2));
  const b = clamp01(1.5 - Math.abs(4 * x - 1));
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}
/** heat colour map: dark violet → red → orange → pale yellow */
export function inferno(v: number, a = 1): [number, number, number, number] {
  const x = clamp01(v);
  const stops = [
    [12, 8, 38],
    [90, 20, 110],
    [190, 40, 80],
    [245, 120, 30],
    [252, 230, 150],
  ];
  const p = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const s0 = stops[i]!;
  const s1 = stops[i + 1]!;
  return [lerp(s0[0]!, s1[0]!, f), lerp(s0[1]!, s1[1]!, f), lerp(s0[2]!, s1[2]!, f), a];
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (v: number) => v * v * (3 - 2 * v);
  const h = (i: number, j: number) => hash(i * 57.13 + j * 113.7 + seed * 19.31);
  const a = lerp(h(xi, yi), h(xi + 1, yi), s(xf));
  const b = lerp(h(xi, yi + 1), h(xi + 1, yi + 1), s(xf));
  return lerp(a, b, s(yf));
}
const fbm = (x: number, y: number, seed: number) => valueNoise(x, y, seed) * 0.55 + valueNoise(x * 2.03, y * 2.03, seed + 7) * 0.3 + valueNoise(x * 4.1, y * 4.1, seed + 13) * 0.15;

/** low-resolution buffer that is drawn scaled up (smooth fields: smoke, temperature) */
let buf: { c: HTMLCanvasElement; img: ImageData } | null = null;
function fieldBuffer(w: number, h: number) {
  if (!buf || buf.c.width !== w || buf.c.height !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    buf = { c, img: c.getContext('2d')!.createImageData(w, h) };
  }
  return buf;
}
function drawField(ctx: CanvasRenderingContext2D, e: Env, nx: number, ny: number, f: (u: number, v: number) => [number, number, number, number]) {
  const b = fieldBuffer(nx, ny);
  const d = b.img.data;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const [r, g, bl, a] = f(i / (nx - 1), j / (ny - 1));
      const k = (j * nx + i) * 4;
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = bl;
      d[k + 3] = a * 255;
    }
  b.c.getContext('2d')!.putImageData(b.img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(b.c, 0, 0, e.w, e.h);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, size = 11, align: CanvasTextAlign = 'left') {
  const font = (px: number) => `${px}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillStyle = color;
  if (!/\p{L}_[\p{L}\p{N}]/u.test(s)) {
    ctx.font = font(size);
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    return;
  }
  // symbols with an index (σ_max, f_c): lowered, smaller index instead of a raw underscore
  const runs: { t: string; sub: boolean }[] = [];
  let last = 0;
  for (const m of s.matchAll(/(\p{L})_([\p{L}\p{N}]+)/gu)) {
    runs.push({ t: s.slice(last, m.index! + 1), sub: false }, { t: m[2]!, sub: true });
    last = m.index! + m[0].length;
  }
  runs.push({ t: s.slice(last), sub: false });
  const width = (r: { t: string; sub: boolean }) => {
    ctx.font = font(r.sub ? size * 0.75 : size);
    return ctx.measureText(r.t).width;
  };
  const total = runs.reduce((a, r) => a + width(r), 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
  ctx.textAlign = 'left';
  for (const r of runs) {
    ctx.font = font(r.sub ? size * 0.75 : size);
    ctx.fillText(r.t, cx, r.sub ? y + size * 0.25 : y);
    cx += ctx.measureText(r.t).width;
  }
}

// ---------------------------------------------------------------- smoke (home hero, tools)

export const smoke: Scene = (ctx, e) => {
  const { t, dark } = e;
  const pxn = e.px !== null ? e.px / e.w : 0.5;
  const pyn = e.py !== null ? e.py / e.h : 0.5;
  drawField(ctx, e, 120, 68, (u, v) => {
    const x = u * 3.2;
    const y = v * 1.8;
    // domain warp: the smoke drifts and curls
    const wx = fbm(x + t * 0.05, y - t * 0.03, 1);
    const wy = fbm(x - t * 0.04, y + t * 0.05, 2);
    const n = fbm(x + 1.7 * wx + t * 0.03, y + 1.7 * wy, 3);
    const lift = Math.exp(-((u - pxn) ** 2 + (v - pyn) ** 2) * 6) * (e.px !== null ? 0.25 : 0);
    const k = clamp01(n * 1.25 - 0.18 + lift);
    // red on the left, blue on the right, black core
    const side = clamp01(u * 1.2 - 0.1 + (wx - 0.5) * 0.4);
    const pr = [215, 45, 60];
    const tl = [45, 110, 235];
    const r = lerp(pr[0]!, tl[0]!, side);
    const g = lerp(pr[1]!, tl[1]!, side);
    const b = lerp(pr[2]!, tl[2]!, side);
    const edge = clamp01(Math.abs(u - 0.5) * 2.2 - 0.25) * 0.85 + 0.15;
    const a = k ** 2.2 * edge * (dark ? 0.95 : 0.55);
    return [r, g, b, a];
  });
};

// ---------------------------------------------------------------- mechanics: beam under load, stress colours

export const mechanics: Scene = (ctx, e) => {
  const { w, h, t } = e;
  // faint mesh grid
  ctx.strokeStyle = e.c('--plant-500', 0.12);
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const beams = [
    { y: 0.42, x0: 0.08, x1: 0.92, th: 0.075, phase: 0 },
    { y: 0.78, x0: 0.25, x1: 0.75, th: 0.05, phase: 2.1 },
  ];
  beams.forEach((bm, bi) => {
    const L = (bm.x1 - bm.x0) * w;
    const X0 = bm.x0 * w;
    const Y0 = bm.y * h;
    const H = bm.th * h;
    // load position: pointer over the beam, otherwise it travels back and forth
    const onBeam = bi === 0 && e.px !== null && e.px > X0 && e.px < X0 + L;
    const a = onBeam ? (e.px! - X0) / L : 0.5 + 0.38 * Math.sin(0.35 * t + bm.phase);
    const F = 0.55 + 0.45 * Math.sin(0.8 * t + bm.phase) ** 2;
    const b = 1 - a;
    // simply supported beam, point load at a (unit length): M(x), deflection w(x)
    const M = (x: number) => F * (x < a ? b * x : a * (1 - x));
    const defl = (x: number) => (x < a ? (F * b * x * (1 - b * b - x * x)) / 6 : (F * a * (1 - x) * (1 - a * a - (1 - x) ** 2)) / 6);
    const Mmax = F * a * b;
    const scale = (h * 0.9) / 0.0642; // max deflection of F=1 at mid ≈ 1/48
    const nx = 70;
    const ny = 7;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x1 = i / nx;
        const x2 = (i + 1) / nx;
        const yf = (j + 0.5) / ny - 0.5; // fibre distance (−0.5 top … 0.5 bottom)
        const sig = Math.abs((M((x1 + x2) / 2) * yf * 2) / Math.max(Mmax, 1e-6)) * (0.35 + 0.65 * F);
        const d1 = defl(x1) * scale * 0.02;
        const d2 = defl(x2) * scale * 0.02;
        const ya = Y0 + (j / ny - 0.5) * H;
        const yb = Y0 + ((j + 1) / ny - 0.5) * H;
        ctx.beginPath();
        ctx.moveTo(X0 + x1 * L, ya + d1);
        ctx.lineTo(X0 + x2 * L, ya + d2);
        ctx.lineTo(X0 + x2 * L, yb + d2);
        ctx.lineTo(X0 + x1 * L, yb + d1);
        ctx.closePath();
        ctx.fillStyle = jet(sig, 0.9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.stroke();
      }
    }
    // supports
    ctx.fillStyle = e.c('--plant-300', 0.9);
    for (const sx of [X0, X0 + L]) {
      ctx.beginPath();
      ctx.moveTo(sx, Y0 + H / 2);
      ctx.lineTo(sx - 12, Y0 + H / 2 + 18);
      ctx.lineTo(sx + 12, Y0 + H / 2 + 18);
      ctx.closePath();
      ctx.fill();
    }
    // load arrow
    const lx = X0 + a * L;
    const ly = Y0 - H / 2 + defl(a) * scale * 0.02;
    const len = 30 + 40 * F;
    ctx.strokeStyle = e.c('--sig-alarm', 0.95);
    ctx.fillStyle = e.c('--sig-alarm', 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, ly - len);
    ctx.lineTo(lx, ly - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx, ly - 1);
    ctx.lineTo(lx - 7, ly - 12);
    ctx.lineTo(lx + 7, ly - 12);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    if (bi === 0) text(ctx, `F = ${(F * 10).toFixed(1)} kN`, lx > w * 0.6 ? lx - 10 : lx + 10, ly - len + 4, e.c('--plant-100', 0.8), 11, lx > w * 0.6 ? 'right' : 'left');
  });
  // colour bar (only where there is room for it)
  if (w < 560) return;
  const bx = w - 26;
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = jet(1 - i / 99, 0.9);
    ctx.fillRect(bx, h * 0.12 + i * ((h * 0.4) / 100), 10, (h * 0.4) / 100 + 1);
  }
  text(ctx, 'σ_max', bx + 5, h * 0.1, e.c('--plant-200', 0.8), 10, 'center');
  text(ctx, '0', bx + 5, h * 0.55, e.c('--plant-200', 0.8), 10, 'center');
};

// ---------------------------------------------------------------- thermodynamics: compression heats the gas, boiling vessel

const PERIOD = 8;
const KAPPA = 1.4;
/** piston gap as a fraction of the cylinder length */
const gap = (t: number) => 0.32 + 0.6 * (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / PERIOD));
const temp = (t: number) => (0.92 / gap(t)) ** (KAPPA - 1);
/** travelled "distance" of a particle: ∫ sqrt(T) dt, tabulated over one period (pure function of t) */
const SPEED_TABLE = (() => {
  const n = 400;
  const tab = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const tm = ((i - 0.5) / n) * PERIOD;
    tab[i] = tab[i - 1]! + Math.sqrt(temp(tm)) * (PERIOD / n);
  }
  return tab;
})();
function travelled(t: number): number {
  const n = SPEED_TABLE.length - 1;
  const k = Math.floor(t / PERIOD);
  const r = ((t % PERIOD) + PERIOD) % PERIOD;
  const f = (r / PERIOD) * n;
  const i = Math.floor(f);
  return k * SPEED_TABLE[n]! + SPEED_TABLE[i]! + (SPEED_TABLE[Math.min(n, i + 1)]! - SPEED_TABLE[i]!) * (f - i);
}

export const thermo: Scene = (ctx, e) => {
  const { w, h, t } = e;
  // ---- cylinder with piston (left)
  const cx = w * 0.07;
  const cy = h * 0.2;
  const cw = w * 0.5;
  const ch = h * 0.6;
  const g = gap(t);
  const T = temp(t);
  const Tn = clamp01((T - 1) / 0.6);
  const gx = cx + cw * (1 - g); // piston face (gas on the right side of it)
  // gas tint
  const [r0, g0, b0] = inferno(0.15 + 0.7 * Tn);
  ctx.fillStyle = `rgba(${r0},${g0},${b0},${e.dark ? 0.22 : 0.15})`;
  ctx.fillRect(gx, cy, cx + cw - gx, ch);
  // walls
  ctx.strokeStyle = e.c('--plant-300', 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + cw, cy);
  ctx.lineTo(cx + cw, cy + ch);
  ctx.lineTo(cx - 10, cy + ch);
  ctx.stroke();
  // piston and rod
  ctx.fillStyle = e.c('--plant-400', 0.95);
  ctx.fillRect(gx - 16, cy + 3, 16, ch - 6);
  ctx.fillRect(Math.max(0, gx - 16 - w * 0.25), cy + ch / 2 - 5, w * 0.25, 10);
  ctx.lineWidth = 1;
  // particles: speed ∝ sqrt(T), positions bounce between the walls
  const s = travelled(t);
  const N = 70;
  for (let i = 0; i < N; i++) {
    const ang = hash(i) * Math.PI * 2;
    const sp = 0.08 + 0.12 * hash(i + 100);
    const X = tri(hash(i + 200) * 2 + Math.cos(ang) * sp * s);
    const Y = tri(hash(i + 300) * 2 + Math.sin(ang) * sp * s * 1.4);
    const x = gx + 5 + X * (cx + cw - gx - 10);
    const y = cy + 5 + Y * (ch - 10);
    const [r, gg, b] = inferno(0.5 + 0.48 * Tn * (0.7 + 0.3 * hash(i + 400)));
    ctx.fillStyle = `rgb(${r},${gg},${b})`;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    // short motion streak
    const vx = Math.cos(ang) * Math.sqrt(T) * 6;
    const vy = Math.sin(ang) * Math.sqrt(T) * 6;
    ctx.strokeStyle = `rgba(${r},${gg},${b},0.35)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - vx, y - vy);
    ctx.stroke();
  }
  const p = (0.92 / g) ** KAPPA;
  text(ctx, `T/T₀ = ${T.toFixed(2)}   p/p₀ = ${p.toFixed(2)}   pv^κ = const`, cx, cy - 12, e.c('--plant-100', 0.85), 12);
  // ---- boiling vessel (right)
  const vx0 = w * 0.66;
  const vy0 = h * 0.38;
  const vw = w * 0.26;
  const vh = h * 0.42;
  const level = vy0 + vh * 0.25;
  ctx.fillStyle = e.c('--sig-liquid', 0.22);
  ctx.fillRect(vx0, level, vw, vy0 + vh - level);
  ctx.strokeStyle = e.c('--plant-300', 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(vx0, vy0);
  ctx.lineTo(vx0, vy0 + vh);
  ctx.lineTo(vx0 + vw, vy0 + vh);
  ctx.lineTo(vx0 + vw, vy0);
  ctx.stroke();
  ctx.lineWidth = 1;
  // flame
  for (let k = 0; k < 7; k++) {
    const fx = vx0 + vw * (0.12 + 0.76 * (k / 6));
    const fh = 14 + 10 * (0.5 + 0.5 * Math.sin(t * 9 + k * 1.7));
    ctx.fillStyle = `rgba(249,115,22,${0.55 + 0.3 * hash(k)})`;
    ctx.beginPath();
    ctx.moveTo(fx - 7, vy0 + vh + 22);
    ctx.quadraticCurveTo(fx, vy0 + vh + 22 - fh * 2, fx + 7, vy0 + vh + 22);
    ctx.fill();
  }
  // bubbles rising in the liquid, vapour leaving above
  for (let i = 0; i < 40; i++) {
    const per = 2 + 2 * hash(i + 500);
    const ph = (((t + hash(i + 600) * per) % per) + per) % per / per;
    const bx = vx0 + vw * (0.08 + 0.84 * hash(i + 700)) + Math.sin(t * 3 + i) * 3;
    const by = vy0 + vh - 4 - ph * (vy0 + vh - level - 4);
    ctx.strokeStyle = e.c('--plant-100', 0.65);
    ctx.beginPath();
    ctx.arc(bx, by, 1.5 + ph * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const per = 3 + 2 * hash(i + 800);
    const ph = (((t + hash(i + 900) * per) % per) + per) % per / per;
    const bx = vx0 + vw * (0.1 + 0.8 * hash(i + 1000)) + Math.sin(t + i * 2) * 14 * ph;
    const by = level - ph * h * 0.32;
    ctx.fillStyle = e.c('--plant-200', 0.25 * (1 - ph));
    ctx.beginPath();
    ctx.arc(bx, by, 6 + ph * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, 'vaporisation: q = r · ṁ', vx0, vy0 + vh + 42, e.c('--plant-200', 0.8), 11);
};

// ---------------------------------------------------------------- control engineering: noisy signal through a filter

export const control: Scene = (ctx, e) => {
  const { w, h, t } = e;
  // cut-off frequency from the pointer height (lower = stronger filtering)
  const fc = e.py !== null ? 0.3 + 3 * (1 - e.py / h) : 0.9 + 0.6 * Math.sin(t * 0.25);
  const bx0 = w * 0.43;
  const bx1 = w * 0.57;
  const yMid = h * 0.45;
  const amp = h * 0.13;
  const v = 0.18; // scroll speed (fraction of width per second)
  const comps = [
    { f: 0.6, a: 1, ph: 0 },
    { f: 3.2, a: 0.32, ph: 1.3 },
    { f: 7.5, a: 0.18, ph: 2.2 },
  ];
  const noise = (u: number) => {
    const k = u * 90;
    const i = Math.floor(k);
    const f = k - i;
    return (lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f)) - 0.5) * 0.6;
  };
  // first-order low pass: gain 1/sqrt(1 + (f/fc)²), phase lag atan(f/fc)
  const input = (u: number) => comps.reduce((s, c) => s + c.a * Math.sin(2 * Math.PI * (c.f * (u - v * t)) + c.ph), 0) + noise(u - v * t);
  const output = (u: number) => comps.reduce((s, c) => s + (c.a / Math.sqrt(1 + (c.f / fc) ** 2)) * Math.sin(2 * Math.PI * (c.f * (u - v * t)) + c.ph - Math.atan(c.f / fc)), 0) + noise(u - v * t) / Math.sqrt(1 + (12 / fc) ** 2);
  // background Bode magnitude curve of the filter
  ctx.strokeStyle = e.c('--plant-500', 0.35);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const lf = -1.5 + (3.5 * i) / 200;
    const g = 1 / Math.sqrt(1 + (10 ** lf / fc) ** 2);
    const x = w * 0.05 + (w * 0.9 * i) / 200;
    const y = h * 0.92 - g * h * 0.18;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  text(ctx, `|H(jω)| low-pass, f_c = ${fc.toFixed(2)}`, w * 0.05, h * 0.72, e.c('--plant-300', 0.7), 10);
  // input (noisy) on the left, output (filtered) on the right
  const draw = (u0: number, u1: number, f: (u: number) => number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const u = u0 + ((u1 - u0) * i) / 260;
      const y = yMid - (f(u) / 1.6) * amp;
      if (i) ctx.lineTo(u * w, y);
      else ctx.moveTo(u * w, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  draw(0, bx0 / w, input, e.c('--sig-heat', 0.9), 1.6);
  draw(bx1 / w, 1, output, e.c('--sig-liquid', 0.95), 2.4);
  // the filter block
  ctx.fillStyle = e.c('--plant-900', 0.9);
  ctx.strokeStyle = e.c('--plant-200', 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx0, yMid - amp * 0.9, bx1 - bx0, amp * 1.8, 8);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  const fs = Math.max(8, Math.min(13, (bx1 - bx0) / 8.5));
  text(ctx, 'H(s) =', (bx0 + bx1) / 2, yMid - fs * 0.4, e.c('--plant-100', 0.95), fs, 'center');
  text(ctx, '1/(Ts+1)', (bx0 + bx1) / 2, yMid + fs * 1.2, e.c('--plant-100', 0.95), fs, 'center');
  text(ctx, 'u(t) + noise', w * 0.04, yMid - amp * 1.3, e.c('--sig-heat', 0.9), 11);
  text(ctx, 'y(t) filtered', w * 0.96, yMid - amp * 1.3, e.c('--sig-liquid', 0.95), 11, 'right');
  // a step response that redraws itself every 6 s
  const ph = (t % 6) / 6;
  ctx.strokeStyle = e.c('--sig-vapor', 0.6);
  ctx.beginPath();
  for (let i = 0; i <= 120 * ph; i++) {
    const tt = (i / 120) * 10;
    const y = 1 - Math.exp(-0.45 * tt) * (Math.cos(1.4 * tt) + 0.32 * Math.sin(1.4 * tt));
    const x = w * 0.62 + (w * 0.33 * i) / 120;
    const yy = h * 0.95 - y * h * 0.16;
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  }
  ctx.stroke();
  text(ctx, 'step response', w * 0.62, h * 0.77, e.c('--sig-vapor', 0.7), 10);
};

// ---------------------------------------------------------------- circuits: board traces with travelling charge

interface Trace {
  pts: [number, number][];
  len: number;
}
let traceCache: { key: string; traces: Trace[]; chips: [number, number, number, number][] } | null = null;
function layout(w: number, h: number) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (traceCache?.key === key) return traceCache;
  const traces: Trace[] = [];
  const grid = 28;
  for (let i = 0; i < 26; i++) {
    let x = Math.round((hash(i + 1) * w) / grid) * grid;
    let y = Math.round((hash(i + 50) * h) / grid) * grid;
    const pts: [number, number][] = [[x, y]];
    let horiz = hash(i + 90) > 0.5;
    for (let k = 0; k < 4; k++) {
      const step = Math.round((80 + hash(i * 7 + k) * 220) / grid) * grid * (hash(i * 13 + k) > 0.5 ? 1 : -1);
      if (horiz) x = Math.min(w, Math.max(0, x + step));
      else y = Math.min(h, Math.max(0, y + step));
      pts.push([x, y]);
      horiz = !horiz;
    }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.abs(pts[k]![0] - pts[k - 1]![0]) + Math.abs(pts[k]![1] - pts[k - 1]![1]);
    traces.push({ pts, len });
  }
  const chips: [number, number, number, number][] = Array.from({ length: 5 }, (_, i) => [hash(i + 300) * (w - 120) + 20, hash(i + 400) * (h - 80) + 20, 60 + hash(i + 500) * 60, 34 + hash(i + 600) * 26]);
  traceCache = { key, traces, chips };
  return traceCache;
}
function along(tr: Trace, d: number): [number, number] {
  let rest = ((d % tr.len) + tr.len) % tr.len;
  for (let k = 1; k < tr.pts.length; k++) {
    const [x0, y0] = tr.pts[k - 1]!;
    const [x1, y1] = tr.pts[k]!;
    const l = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (rest <= l) {
      const f = l ? rest / l : 0;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
    rest -= l;
  }
  return tr.pts.at(-1)!;
}
export const circuits: Scene = (ctx, e) => {
  const { w, h, t } = e;
  const L = layout(w, h);
  for (const [i, tr] of L.traces.entries()) {
    const near = e.px !== null && tr.pts.some(([x, y]) => Math.hypot(x - e.px!, y - e.py!) < 140);
    ctx.strokeStyle = near ? e.c('--sig-liquid', 0.55) : e.c('--plant-500', 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    tr.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    for (const [x, y] of [tr.pts[0]!, tr.pts.at(-1)!]) {
      ctx.fillStyle = e.c('--plant-300', 0.7);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // charge pulses (speed ∝ current)
    const speed = 60 + 80 * hash(i + 700);
    for (let k = 0; k < 2; k++) {
      const [x, y] = along(tr, t * speed + k * tr.len * 0.5 + hash(i) * tr.len);
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 12);
      grd.addColorStop(0, e.c('--sig-vapor', 0.95));
      grd.addColorStop(1, e.c('--sig-vapor', 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineWidth = 1;
  // chips with pins
  for (const [x, y, cw, ch] of L.chips) {
    ctx.fillStyle = e.c('--plant-800', 0.95);
    ctx.strokeStyle = e.c('--plant-400', 0.8);
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeRect(x, y, cw, ch);
    for (let p = 6; p < cw - 4; p += 9) {
      ctx.fillStyle = e.c('--plant-300', 0.7);
      ctx.fillRect(x + p, y - 5, 4, 5);
      ctx.fillRect(x + p, y + ch, 4, 5);
    }
  }
  // a resistor and an LED that blinks
  const rx = w * 0.72;
  const ry = h * 0.82;
  ctx.strokeStyle = e.c('--plant-200', 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx - 40, ry);
  for (let k = 0; k < 6; k++) ctx.lineTo(rx - 24 + k * 8, ry + (k % 2 ? 8 : -8));
  ctx.lineTo(rx + 40, ry);
  ctx.stroke();
  ctx.lineWidth = 1;
  const on = Math.sin(t * 3) > 0;
  ctx.fillStyle = on ? 'rgba(244,63,94,0.95)' : 'rgba(244,63,94,0.25)';
  ctx.beginPath();
  ctx.arc(rx + 60, ry, 8, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    const grd = ctx.createRadialGradient(rx + 60, ry, 0, rx + 60, ry, 40);
    grd.addColorStop(0, 'rgba(244,63,94,0.35)');
    grd.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(rx + 60, ry, 40, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ---------------------------------------------------------------- heat transfer: temperature field and fins

export const heat: Scene = (ctx, e) => {
  const { w, h, t } = e;
  const src = [
    { x: 0.25 + 0.12 * Math.sin(t * 0.3), y: 0.4 + 0.1 * Math.cos(t * 0.4), a: 1 },
    { x: 0.7 + 0.1 * Math.cos(t * 0.25), y: 0.55 + 0.12 * Math.sin(t * 0.35), a: 0.8 },
  ];
  if (e.px !== null) src.push({ x: e.px / w, y: e.py! / h, a: 1.1 });
  const breathe = 0.035 + 0.012 * Math.sin(t * 0.6);
  const ar = w / h;
  drawField(ctx, e, 96, 54, (u, v) => {
    let T = 0;
    for (const s of src) T += s.a * Math.exp(-(((u - s.x) * ar) ** 2 + (v - s.y) ** 2) / (breathe * (1 + 2 * s.a)));
    // isotherm bands
    const k = clamp01(T);
    const band = Math.abs(((k * 8) % 1) - 0.5) < 0.04 ? 0.25 : 0;
    const [r, g, b] = inferno(k);
    return [r + band * 255, g + band * 255, b + band * 255, (e.dark ? 0.55 : 0.4) * (0.25 + 0.75 * k)];
  });
  // fin array at the bottom: T(x) = cosh(m(L − x))/cosh(mL)
  const base = h * 0.92;
  const n = 9;
  const mL = 1.6 + 0.6 * Math.sin(t * 0.4);
  for (let i = 0; i < n; i++) {
    const fx = w * (0.15 + (0.7 * i) / (n - 1));
    const fl = h * 0.28;
    const seg = 14;
    for (let k = 0; k < seg; k++) {
      const x = k / seg;
      const th = Math.cosh(mL * (1 - x)) / Math.cosh(mL);
      const [r, g, b] = inferno(0.2 + 0.75 * th);
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.fillRect(fx - 4, base - (k + 1) * (fl / seg), 8, fl / seg + 0.5);
    }
  }
  ctx.fillStyle = 'rgba(245,120,30,0.9)';
  ctx.fillRect(w * 0.12, base, w * 0.76, 10);
  text(ctx, 'θ(x)/θ₀ = cosh(m(L − x)) / cosh(mL)', w * 0.12, base - h * 0.31, e.c('--plant-100', 0.8), 11);
};

// ---------------------------------------------------------------- thermal separation: column with trays, McCabe–Thiele steps

export const separation: Scene = (ctx, e) => {
  const { w, h, t } = e;
  const cx = w * 0.62;
  const cw = Math.min(140, w * 0.14);
  const top = h * 0.08;
  const bot = h * 0.92;
  const trays = 9;
  // body with temperature gradient (cool top, hot bottom)
  const grd = ctx.createLinearGradient(0, top, 0, bot);
  grd.addColorStop(0, e.c('--sig-liquid', 0.25));
  grd.addColorStop(1, e.c('--sig-heat', 0.3));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, top, cw, bot - top, cw / 2);
  ctx.fill();
  ctx.strokeStyle = e.c('--plant-300', 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  const dy = (bot - top - cw) / (trays + 1);
  for (let k = 1; k <= trays; k++) {
    const y = top + cw / 2 + k * dy;
    ctx.strokeStyle = e.c('--plant-300', 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, y);
    ctx.lineTo(cx + cw / 2 - 18, y);
    ctx.stroke();
    // liquid layer on the tray
    ctx.fillStyle = e.c('--sig-liquid', 0.35);
    ctx.fillRect(cx - cw / 2, y - 5, cw - 18, 5);
  }
  // vapour bubbles rising, droplets falling
  for (let i = 0; i < 60; i++) {
    const per = 4 + 3 * hash(i);
    const ph = (((t + hash(i + 10) * per) % per) + per) % per / per;
    const bx = cx - cw / 2 + 10 + hash(i + 20) * (cw - 30) + Math.sin(t * 2 + i) * 3;
    const by = bot - cw / 4 - ph * (bot - top - cw / 2);
    ctx.strokeStyle = e.c('--plant-100', 0.5);
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const per = 2.5 + 2 * hash(i + 40);
    const ph = (((t + hash(i + 50) * per) % per) + per) % per / per;
    const by = top + cw / 2 + ph * (bot - top - cw);
    ctx.fillStyle = e.c('--sig-liquid', 0.8);
    ctx.fillRect(cx + cw / 2 - 12, by, 3, 7);
  }
  // McCabe–Thiele diagram drawing itself on the left
  const ox = w * 0.08;
  const oy = h * 0.88;
  const S = Math.min(w * 0.4, h * 0.72);
  const alpha = 2.5;
  const eq = (x: number) => (alpha * x) / (1 + (alpha - 1) * x);
  ctx.strokeStyle = e.c('--plant-400', 0.6);
  ctx.strokeRect(ox, oy - S, S, S);
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + S, oy - S);
  ctx.stroke();
  ctx.strokeStyle = e.c('--viz-eq-rgb', 0.9);
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = i / 60;
    if (i) ctx.lineTo(ox + x * S, oy - eq(x) * S);
    else ctx.moveTo(ox, oy);
  }
  ctx.stroke();
  // operating lines (feed: boiling liquid at x_F) and the stage steps from x_D down to x_B
  const R = 2;
  const xD = 0.95;
  const xB = 0.06;
  const xF = 0.45;
  const opR = (x: number) => (R / (R + 1)) * x + xD / (R + 1);
  const yF = opR(xF);
  const op = (x: number) => (x >= xF ? opR(x) : xB + ((yF - xB) * (x - xB)) / (xF - xB));
  const xEq = (y: number) => y / (alpha - (alpha - 1) * y);
  ctx.strokeStyle = e.c('--plant-300', 0.6);
  ctx.beginPath();
  ctx.moveTo(ox + xD * S, oy - xD * S);
  ctx.lineTo(ox + xF * S, oy - yF * S);
  ctx.lineTo(ox + xB * S, oy - xB * S);
  ctx.stroke();
  const steps: [number, number][] = [[xD, xD]];
  let y = xD;
  for (let k = 0; k < 14; k++) {
    const xe = xEq(y);
    steps.push([xe, y]);
    if (xe <= xB) break;
    y = op(xe);
    steps.push([xe, y]);
  }
  const shown = Math.floor(((t % 10) / 10) * (steps.length + 4));
  ctx.strokeStyle = e.c('--sig-heat', 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  steps.slice(0, Math.max(1, shown)).forEach(([sx, sy], k) => (k ? ctx.lineTo(ox + sx * S, oy - sy * S) : ctx.moveTo(ox + sx * S, oy - sy * S)));
  ctx.stroke();
  ctx.lineWidth = 1;
  text(ctx, 'y = αx / (1 + (α − 1)x)', ox, oy - S - 10, e.c('--plant-200', 0.75), 11);
};

// ---------------------------------------------------------------- fluid mechanics: flow through a constriction, eddies behind it

export const fluid: Scene = (ctx, e) => {
  const { w, h, t } = e;
  const yc = h * 0.5;
  // half width of the channel along x (constriction in the middle)
  const hw = (u: number) => h * (0.3 - 0.17 * Math.exp(-(((u - 0.42) / 0.09) ** 2)));
  // walls
  ctx.fillStyle = e.c('--plant-700', 0.8);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, sgn < 0 ? 0 : h);
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      ctx.lineTo(u * w, yc + sgn * hw(u));
    }
    ctx.lineTo(w, sgn < 0 ? 0 : h);
    ctx.closePath();
    ctx.fill();
  }
  // travel time along the channel: dτ = dx / u, u ∝ 1 / hw (continuity), tabulated (pure function of t)
  const n = 300;
  const tau = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) tau[i] = tau[i - 1]! + hw((i - 0.5) / n) / (h * 0.3) / n;
  const total = tau[n]!;
  const posAt = (time: number) => {
    const r = ((time % total) + total) % total;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tau[m]! > r) hi = m;
      else lo = m;
    }
    return (lo + (r - tau[lo]!) / Math.max(tau[lo + 1]! - tau[lo]!, 1e-9)) / n;
  };
  const lines = 13;
  const speed = 0.18;
  for (let l = 0; l < lines; l++) {
    const eta = -0.9 + (1.8 * l) / (lines - 1);
    ctx.strokeStyle = e.c('--plant-400', 0.25);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const y = yc + eta * hw(u);
      if (i) ctx.lineTo(u * w, y);
      else ctx.moveTo(0, y);
    }
    ctx.stroke();
    // particles on the streamline; colour = speed
    for (let k = 0; k < 6; k++) {
      const u = posAt(t * speed + k * (total / 6) + hash(l) * total);
      const vel = (h * 0.3) / hw(u);
      const lam = 1 - eta * eta * 0.5; // slower near the wall
      const y = yc + eta * hw(u);
      ctx.fillStyle = jet(0.22 + 0.78 * clamp01((vel * lam - 0.6) / 1.8), 0.95);
      ctx.beginPath();
      ctx.ellipse(u * w, y, 3 + vel * 1.8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // eddies downstream of the constriction
  for (let k = 0; k < 4; k++) {
    const per = 6;
    const ph = (((t + k * 1.5) % per) + per) % per / per;
    const ex = w * (0.55 + 0.4 * ph);
    const ey = yc + (k % 2 ? 1 : -1) * h * 0.16;
    const rad = 14 + 18 * ph;
    ctx.strokeStyle = e.c('--sig-liquid', 0.5 * (1 - ph));
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const rr = (rad * a) / (Math.PI * 4);
      const ang = a + t * 3 * (k % 2 ? -1 : 1);
      const x = ex + rr * Math.cos(ang);
      const y = ey + rr * Math.sin(ang);
      if (a) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  text(ctx, 'w₁A₁ = w₂A₂   p + ρw²/2 = const', w * 0.04, h * 0.12, e.c('--plant-100', 0.8), 12);
};

export const SCENES: Record<SceneId, Scene> = { smoke, separation, heat, circuits, mechanics, control, thermo, fluid };
