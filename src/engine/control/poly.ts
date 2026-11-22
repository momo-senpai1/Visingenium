/**
 * Polynomials and rational transfer functions in s.
 * Polynomials are coefficient arrays in ascending powers: [a0, a1, a2] = a0 + a1·s + a2·s².
 */

export type Poly = number[];
export interface C {
  re: number;
  im: number;
}

export const trim = (p: Poly): Poly => {
  const q = [...p];
  const scale = Math.max(1e-300, ...q.map(Math.abs));
  // only drop numerically vanished leading terms (wide coefficient ranges such as 1 … 1e15 must survive)
  while (q.length > 1 && Math.abs(q.at(-1)!) <= 1e-25 * scale) q.pop();
  return q.length ? q : [0];
};
export const deg = (p: Poly) => trim(p).length - 1;
export const add = (a: Poly, b: Poly): Poly => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0)));
export const scale = (a: Poly, k: number): Poly => trim(a.map((v) => v * k));
export const sub = (a: Poly, b: Poly) => add(a, scale(b, -1));
export function mul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return trim(out);
}
export const pow = (a: Poly, n: number): Poly => (n <= 0 ? [1] : mul(a, pow(a, n - 1)));

export const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cdiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cabs = (a: C) => Math.hypot(a.re, a.im);

/** Horner evaluation at a complex point. */
export function evalC(p: Poly, s: C): C {
  let r: C = { re: 0, im: 0 };
  for (let i = p.length - 1; i >= 0; i--) r = { re: r.re * s.re - r.im * s.im + p[i]!, im: r.re * s.im + r.im * s.re };
  return r;
}

/** All roots (Durand–Kerner / Weierstrass iteration). */
export function roots(p0: Poly): C[] {
  const p = trim(p0);
  const n = p.length - 1;
  if (n < 1) return [];
  const lead = p[n]!;
  const a = p.map((v) => v / lead);
  // zero roots first
  let z = 0;
  while (z < n && Math.abs(a[z]!) < 1e-14) z++;
  const q = a.slice(z);
  const m = q.length - 1;
  const out: C[] = Array.from({ length: z }, () => ({ re: 0, im: 0 }));
  if (m < 1) return out;
  if (m === 1) return [...out, { re: -q[0]! / q[1]!, im: 0 }];
  const R = 1 + Math.max(...q.slice(0, m).map(Math.abs));
  let x: C[] = Array.from({ length: m }, (_, k) => ({ re: R * 0.6 * Math.cos((2 * Math.PI * k) / m + 0.4), im: R * 0.6 * Math.sin((2 * Math.PI * k) / m + 0.4) }));
  for (let it = 0; it < 500; it++) {
    let delta = 0;
    const nx = x.map((xi, i) => {
      let den: C = { re: 1, im: 0 };
      x.forEach((xj, j) => {
        if (j !== i) den = cmul(den, { re: xi.re - xj.re, im: xi.im - xj.im });
      });
      const f = evalC(q, xi);
      const d = cdiv(f, den);
      delta = Math.max(delta, cabs(d));
      return { re: xi.re - d.re, im: xi.im - d.im };
    });
    x = nx;
    if (delta < 1e-13 * R) break;
  }
  // polish tiny imaginary parts
  return [...out, ...x.map((r) => ({ re: Math.abs(r.re) < 1e-12 * R ? 0 : r.re, im: Math.abs(r.im) < 1e-9 * R ? 0 : r.im }))].sort((u, v) => u.re - v.re || v.im - u.im);
}

/** Polynomial with the given roots (conjugate pairs must both be given). */
export function fromRoots(rs: C[], k = 1): Poly {
  let re: Poly = [1];
  let im: Poly = [0];
  for (const r of rs) {
    // (s − r) = (−r.re − j r.im) + s
    const nre = add(mul(re, [-r.re, 1]), scale(mul(im, [r.im]), 1));
    const nim = add(mul(im, [-r.re, 1]), scale(mul(re, [-r.im]), 1));
    re = nre;
    im = nim;
  }
  return scale(re, k);
}

export interface TF {
  num: Poly;
  den: Poly;
  /** dead time [s] */
  delay?: number;
}

export const tf = (num: Poly, den: Poly, delay = 0): TF => ({ num: trim(num), den: trim(den), delay });

/** Cancel the common leading factor so the denominator's highest coefficient is 1. */
export function normalize(g: TF): TF {
  const d = trim(g.den);
  const lead = d.at(-1)!;
  return { num: scale(g.num, 1 / lead), den: scale(d, 1 / lead), delay: g.delay };
}

export const series = (a: TF, b: TF): TF => tf(mul(a.num, b.num), mul(a.den, b.den), (a.delay ?? 0) + (b.delay ?? 0));
export const parallel = (a: TF, b: TF): TF => tf(add(mul(a.num, b.den), mul(b.num, a.den)), mul(a.den, b.den), Math.max(a.delay ?? 0, b.delay ?? 0));
/** Closed loop G/(1 ∓ G·H); sign = −1 for negative feedback. */
export function feedback(g0: TF, h0: TF, sign = -1): TF {
  // a dead time inside the loop is not rational: approximate it (Padé, 3rd order) for the closed loop
  const g = g0.delay ? series(tf(g0.num, g0.den), pade(g0.delay)) : g0;
  const h = h0.delay ? series(tf(h0.num, h0.den), pade(h0.delay)) : h0;
  const num = mul(g.num, h.den);
  const den = sign < 0 ? add(mul(g.den, h.den), mul(g.num, h.num)) : sub(mul(g.den, h.den), mul(g.num, h.num));
  return tf(num, den);
}

/** Frequency response at ω: magnitude, phase [rad] (delay included exactly). */
export function freq(g: TF, w: number): { mag: number; phase: number; re: number; im: number } {
  const s = { re: 0, im: w };
  const h0 = cdiv(evalC(g.num, s), evalC(g.den, s));
  const d = (g.delay ?? 0) * w;
  const h = cmul(h0, { re: Math.cos(d), im: -Math.sin(d) });
  return { mag: cabs(h), phase: Math.atan2(h.im, h.re), re: h.re, im: h.im };
}

/** Bode data over a log grid, phase unwrapped (degrees). */
export function bode(g: TF, wMin: number, wMax: number, n = 400) {
  const out: { w: number; db: number; deg: number; re: number; im: number }[] = [];
  let prev = 0;
  let offset = 0;
  for (let i = 0; i < n; i++) {
    const w = wMin * (wMax / wMin) ** (i / (n - 1));
    const r = freq(g, w);
    let ph = (r.phase * 180) / Math.PI;
    if (i > 0) {
      while (ph + offset - prev > 180) offset -= 360;
      while (ph + offset - prev < -180) offset += 360;
    }
    ph += offset;
    prev = ph;
    out.push({ w, db: 20 * Math.log10(Math.max(r.mag, 1e-300)), deg: ph, re: r.re, im: r.im });
  }
  // shift by whole turns so the curve starts in (−360°, 180°]
  const shift = 360 * Math.ceil((out[0]!.deg - 180) / 360);
  return out.map((p) => ({ ...p, deg: p.deg - shift }));
}

/** Gain and phase margins of an open loop L. */
export function margins(L: TF, wMin = 1e-4, wMax = 1e5) {
  const data = bode(L, wMin, wMax, 2000);
  let wc: number | null = null;
  let pm: number | null = null;
  let w180: number | null = null;
  let gm: number | null = null;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1]!;
    const b = data[i]!;
    if (wc === null && a.db >= 0 && b.db < 0) {
      const f = a.db / (a.db - b.db);
      wc = a.w * (b.w / a.w) ** f;
      const ph = a.deg + f * (b.deg - a.deg);
      pm = 180 + ph;
    }
    // phase crossover: the unwrapped phase passes −180° (+ k·360°) downwards
    const ka = Math.floor((a.deg + 180) / 360);
    const kb = Math.floor((b.deg + 180) / 360);
    if (w180 === null && kb < ka) {
      const crossing = ka * 360 - 180;
      const f = (a.deg - crossing) / (a.deg - b.deg);
      w180 = a.w * (b.w / a.w) ** f;
      gm = -(a.db + f * (b.db - a.db));
    }
  }
  return { wc, pm, w180, gm };
}

/** Padé approximation of e^{−Ts}. */
export function pade(T: number, order = 3): TF {
  if (T <= 0) return tf([1], [1]);
  const c = order === 1 ? [1, 1 / 2] : order === 2 ? [1, 1 / 2, 1 / 12] : [1, 1 / 2, 1 / 10, 1 / 120];
  const num = c.map((v, k) => v * (-T) ** k);
  const den = c.map((v, k) => v * T ** k);
  return tf(num, den);
}

/** Step (or impulse) response by simulating the controllable canonical form (RK4). */
export function stepResponse(g0: TF, tEnd: number, n = 1000, impulse = false) {
  const g = g0.delay ? series(tf(g0.num, g0.den), pade(g0.delay)) : g0;
  const G = normalize(g);
  const den = G.den;
  const N = den.length - 1;
  const num = [...G.num];
  if (num.length - 1 > N) return { t: [], y: [], improper: true };
  while (num.length < N + 1) num.push(0);
  const D = num[N]!;
  // y = Σ (b_k − D·a_k) x_k + D·u ; ẋ: x_k' = x_{k+1}, x_N' = u − Σ a_k x_{k+1}
  const Cv = Array.from({ length: N }, (_, k) => num[k]! - D * den[k]!);
  const f = (x: number[], u: number) => {
    const dx = new Array<number>(N);
    for (let k = 0; k < N - 1; k++) dx[k] = x[k + 1]!;
    if (N > 0) {
      let s = u;
      for (let k = 0; k < N; k++) s -= den[k]! * x[k]!;
      dx[N - 1] = s;
    }
    return dx;
  };
  const h = tEnd / n;
  let x = new Array<number>(N).fill(0);
  if (impulse && N > 0) x[N - 1] = 1; // δ input: jump of the last state
  const t: number[] = [];
  const y: number[] = [];
  const u = impulse ? 0 : 1;
  for (let i = 0; i <= n; i++) {
    t.push(i * h);
    let yy = D * u;
    for (let k = 0; k < N; k++) yy += Cv[k]! * x[k]!;
    y.push(yy);
    // RK4 with sub-steps for stiff-ish systems
    const sub = 4;
    const hh = h / sub;
    for (let s = 0; s < sub; s++) {
      const k1 = f(x, u);
      const k2 = f(x.map((v, j) => v + (hh / 2) * k1[j]!), u);
      const k3 = f(x.map((v, j) => v + (hh / 2) * k2[j]!), u);
      const k4 = f(x.map((v, j) => v + hh * k3[j]!), u);
      x = x.map((v, j) => v + (hh / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    }
  }
  return { t, y, improper: false };
}

/** Rise time (10–90 %), overshoot, settling time (2 %), final value of a step response. */
export function stepInfo(t: number[], y: number[], final: number) {
  if (!t.length || !Number.isFinite(final) || Math.abs(final) < 1e-12) return null;
  const sgn = Math.sign(final);
  const t10 = t.find((_, i) => sgn * y[i]! >= 0.1 * Math.abs(final));
  const t90 = t.find((_, i) => sgn * y[i]! >= 0.9 * Math.abs(final));
  const peak = Math.max(...y.map((v) => sgn * v)) * sgn;
  let ts = 0;
  for (let i = y.length - 1; i >= 0; i--) {
    if (Math.abs(y[i]! - final) > 0.02 * Math.abs(final)) {
      ts = t[Math.min(i + 1, t.length - 1)]!;
      break;
    }
  }
  return { rise: t10 !== undefined && t90 !== undefined ? t90 - t10 : null, overshoot: Math.max(0, ((peak - final) / final) * 100), settling: ts, peak };
}

/** Routh–Hurwitz table (rows of the array) and number of sign changes in the first column. */
export function routh(p0: Poly) {
  const p = trim(p0);
  const n = p.length - 1;
  const desc = [...p].reverse();
  const width = Math.ceil((n + 1) / 2);
  const rows: number[][] = [desc.filter((_, i) => i % 2 === 0), desc.filter((_, i) => i % 2 === 1)].map((r) => [...r, ...new Array(width - r.length).fill(0)]);
  let special = false;
  for (let k = 2; k <= n; k++) {
    const a = rows[k - 2]!;
    const b = [...rows[k - 1]!];
    if (Math.abs(b[0]!) < 1e-12) {
      special = true;
      b[0] = 1e-9; // ε-method
      rows[k - 1] = b;
    }
    const r = Array.from({ length: width }, (_, j) => (b[0]! * (a[j + 1] ?? 0) - a[0]! * (b[j + 1] ?? 0)) / b[0]!);
    rows.push(r);
  }
  const col = rows.slice(0, n + 1).map((r) => r[0]!);
  let changes = 0;
  for (let i = 1; i < col.length; i++) if (Math.sign(col[i]!) !== Math.sign(col[i - 1]!) && col[i] !== 0) changes++;
  return { rows: rows.slice(0, n + 1), changes, special };
}

/** LaTeX for a polynomial in s (descending powers). */
export function polyTex(p0: Poly, v = 's', digits = 4): string {
  const p = trim(p0);
  const parts: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]!;
    if (Math.abs(c) < 1e-14) continue;
    const ac = Math.abs(c);
    const num = Number(ac.toPrecision(digits));
    const cs = k > 0 && Math.abs(num - 1) < 1e-12 ? '' : fmtNum(num);
    const term = k === 0 ? fmtNum(num) : k === 1 ? `${cs}${v}` : `${cs}${v}^{${k}}`;
    parts.push((c < 0 ? '-' : parts.length ? '+' : '') + term);
  }
  return parts.length ? parts.join(' ').replace(/^\+/, '') : '0';
}
const fmtNum = (v: number) => {
  if (v !== 0 && (Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3)) return v.toExponential(3).replace(/e([+-]?\d+)/, '\\cdot 10^{$1}');
  return String(v);
};
export const tfTex = (g: TF) => `\\frac{${polyTex(g.num)}}{${polyTex(g.den)}}${g.delay ? `\\,e^{-${Number(g.delay.toPrecision(4))}s}` : ''}`;
export const cTex = (c: C, d = 4) => {
  const re = Number(c.re.toPrecision(d));
  const im = Number(Math.abs(c.im).toPrecision(d));
  return im === 0 ? `${re}` : `${re} ${c.im < 0 ? '-' : '+'} ${im}j`;
};
