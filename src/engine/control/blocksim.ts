/**
 * Block-diagram simulator: sources, summing junctions, gains, transfer-function blocks
 * (controllers, plants, dead time), saturation and scopes, wired freely.
 *
 * Time domain: every linear block is realised in controllable canonical form and
 * discretised exactly for a held input (zero-order hold, matrix exponential), so stiff
 * plants and long dead times stay stable at any step size. Blocks with direct feed-through
 * are evaluated in dependency order; algebraic loops are solved by fixed-point iteration.
 *
 * Frequency domain: the linear part of the diagram is solved symbolically (Gaussian
 * elimination over rational functions) for the transfer function from a source to a signal.
 */

import { designFilter, type Approx, type FType } from './filters';
import { blockTF, type BlockSpec } from './loop';
import { add, cabs, fromRoots, mul, normalize, pade, roots, scale, series, tf, tfTex, trim, type C, type Poly, type TF } from './poly';

export type SimKind = 'source' | 'sum' | 'gain' | 'tf' | 'filter' | 'sat' | 'scope';
export type SrcWave = 'step' | 'ramp' | 'sine' | 'square' | 'pulse' | 'const' | 'noise';

export interface SimBlockData {
  kind: SimKind;
  name: string;
  /** source */
  wave?: SrcWave;
  amp?: number;
  t0?: number;
  f?: number;
  width?: number;
  /** sum: one sign per input, e.g. "+-" */
  signs?: string;
  /** gain */
  K?: number;
  /** transfer-function block */
  spec?: BlockSpec;
  /** filter: approximation, type, order, cut-off / centre frequency [Hz], bandwidth [Hz], ripple [dB] */
  approx?: Approx;
  ftype?: FType;
  order?: number;
  fc?: number;
  bw?: number;
  ripple?: number;
  /** saturation */
  lo?: number;
  hi?: number;
  /** scope: number of inputs */
  inputs?: number;
  /** drawn mirrored (input on the right) — for blocks in a feedback path */
  flip?: boolean;
}

export interface SimBlock {
  id: string;
  data: SimBlockData;
}
export interface SimWire {
  source: string;
  target: string;
  /** "in0", "in1", … */
  targetHandle: string;
}

export const nInputs = (d: SimBlockData) =>
  d.kind === 'source' ? 0 : d.kind === 'sum' ? Math.max(1, (d.signs ?? '+-').length) : d.kind === 'scope' ? Math.min(4, Math.max(1, Math.round(d.inputs ?? 1))) : 1;
/** Blocks with internal states (transfer functions and filters). */
export const isDyn = (d: SimBlockData) => d.kind === 'tf' || d.kind === 'filter';
export const hasOutput = (d: SimBlockData) => d.kind !== 'scope';

/** Value of a source at time t. */
export function sourceValue(d: SimBlockData, t: number, rnd = Math.random): number {
  const A = d.amp ?? 1;
  const t0 = d.t0 ?? 0;
  const f = Math.max(d.f ?? 1, 1e-9);
  switch (d.wave ?? 'step') {
    case 'step':
      return t >= t0 ? A : 0;
    case 'ramp':
      return t >= t0 ? A * (t - t0) : 0;
    case 'sine':
      return t >= t0 ? A * Math.sin(2 * Math.PI * f * (t - t0)) : 0;
    case 'square':
      return t >= t0 ? ((((t - t0) * f) % 1) < 0.5 ? A : -A) : 0;
    case 'pulse':
      return t >= t0 && t < t0 + (d.width ?? 1) ? A : 0;
    case 'const':
      return A;
    case 'noise':
      return t >= t0 ? A * (2 * rnd() - 1) : 0;
  }
}

/** The block's transfer function (gain and saturation as their small-signal gain). */
export function blockG(d: SimBlockData): TF {
  if (d.kind === 'gain') return tf([d.K ?? 1], [1]);
  if (d.kind === 'sat') return tf([1], [1]);
  if (d.kind === 'tf') return blockTF(d.spec ?? { kind: 'PT1', K: 1, T: 1 });
  if (d.kind === 'filter') return filterTF(d);
  return tf([1], [1]);
}

/** Transfer function of a filter block (frequencies given in Hz). */
export function filterTF(d: SimBlockData): TF {
  const n = Math.max(1, Math.min(d.approx === 'bessel' ? 6 : 10, Math.round(d.order ?? 2)));
  const w = 2 * Math.PI * Math.max(d.fc ?? 1, 1e-6);
  const bw = 2 * Math.PI * Math.max(d.bw ?? 0.5, 1e-6);
  return designFilter(d.approx ?? 'butterworth', d.ftype ?? 'lowpass', n, w, bw, d.ripple ?? 1).tf;
}

// ---------------------------------------------------------------------------
// state-space realisation and exact discretisation

type Mat = number[][];
const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0));
function matMul(a: Mat, b: Mat): Mat {
  const n = a.length;
  const m = b[0]!.length;
  const k = b.length;
  const o = zeros(n, m);
  for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) {
    const v = a[i]![p]!;
    if (v) for (let j = 0; j < m; j++) o[i]![j]! += v * b[p]![j]!;
  }
  return o;
}
/** Matrix exponential by scaling and squaring with a Taylor series. */
export function expm(A: Mat): Mat {
  const n = A.length;
  const norm = Math.max(...A.map((r) => r.reduce((s, v) => s + Math.abs(v), 0)), 0);
  const sq = Math.max(0, Math.ceil(Math.log2(norm || 1)) + 2);
  const As = A.map((r) => r.map((v) => v / 2 ** sq));
  let term: Mat = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  let E = term.map((r) => [...r]);
  for (let k = 1; k <= 18; k++) {
    term = matMul(term, As).map((r) => r.map((v) => v / k));
    E = E.map((r, i) => r.map((v, j) => v + term[i]![j]!));
  }
  for (let i = 0; i < sq; i++) E = matMul(E, E);
  return E;
}

/** Solve an augmented system [A | b] by Gaussian elimination with partial pivoting. */
function gauss(Ab: Mat): number[] | null {
  const n = Ab.length;
  const a = Ab.map((r) => [...r]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i]![c]!) > Math.abs(a[p]![c]!)) p = i;
    if (Math.abs(a[p]![c]!) < 1e-12) return null;
    [a[c], a[p]] = [a[p]!, a[c]!];
    for (let i = c + 1; i < n; i++) {
      const f = a[i]![c]! / a[c]![c]!;
      if (f) for (let j = c; j <= n; j++) a[i]![j]! -= f * a[c]![j]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = a[i]![n]!;
    for (let j = i + 1; j < n; j++) s -= a[i]![j]! * x[j]!;
    x[i] = s / a[i]![i]!;
  }
  return x;
}

interface Disc {
  Ad: Mat;
  Bd: number[];
  C: number[];
  D: number;
  x: number[];
  delay: number;
  buf: number[];
}

/** Controllable canonical form of a proper TF, discretised with step h (input held constant). */
function discretise(g0: TF, h: number): Disc | null {
  const g = normalize(tf(g0.num, g0.den));
  const den = g.den;
  const N = den.length - 1;
  const num = [...g.num];
  if (num.length - 1 > N) return null;
  while (num.length < N + 1) num.push(0);
  const D = num[N]!;
  const C = Array.from({ length: N }, (_, k) => num[k]! - D * den[k]!);
  const M = zeros(N + 1, N + 1);
  for (let i = 0; i < N - 1; i++) M[i]![i + 1] = h;
  if (N > 0) {
    for (let k = 0; k < N; k++) M[N - 1]![k] = -den[k]! * h;
    M[N - 1]![N] = h;
  }
  const E = expm(M);
  const delay = Math.max(0, Math.round((g0.delay ?? 0) / h));
  return {
    Ad: E.slice(0, N).map((r) => r.slice(0, N)),
    Bd: E.slice(0, N).map((r) => r[N]!),
    C,
    D,
    x: new Array<number>(N).fill(0),
    delay,
    buf: new Array<number>(delay).fill(0),
  };
}

export interface SimResult {
  t: number[];
  /** output signal of every block */
  y: Map<string, number[]>;
  scopes: { id: string; name: string; traces: { name: string; from: string; data: number[] }[] }[];
  warnings: { key: string; vars?: Record<string, string | number> }[];
  ok: boolean;
}

/** Name of a block output for traces and equations. */
const labelOf = (b: SimBlock) => b.data.name;

export function simulate(blocks: SimBlock[], wires: SimWire[], tEnd: number, n = 2000, seed = 1): SimResult {
  const h = tEnd / n;
  const warnings: SimResult['warnings'] = [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const inp = new Map<string, string>();
  for (const w of wires) if (byId.has(w.source) && byId.has(w.target)) inp.set(`${w.target}:${w.targetHandle}`, w.source);
  const src = (b: SimBlock, k: number) => inp.get(`${b.id}:in${k}`);
  // unconnected inputs
  const open = blocks.filter((b) => b.data.kind !== 'scope' && Array.from({ length: nInputs(b.data) }, (_, k) => src(b, k)).some((s) => !s));
  if (open.length) warnings.push({ key: 'Unconnected inputs count as 0: {list}.', vars: { list: open.map(labelOf).join(', ') } });

  const disc = new Map<string, Disc>();
  for (const b of blocks) {
    if (!isDyn(b.data)) continue;
    const d = discretise(blockG(b.data), h);
    if (!d) {
      warnings.push({ key: '{name}: the transfer function is improper (numerator degree > denominator degree) and cannot be simulated.', vars: { name: b.data.name } });
      return { t: [], y: new Map(), scopes: [], warnings, ok: false };
    }
    disc.set(b.id, d);
  }
  const feed = (b: SimBlock) => b.data.kind === 'sum' || b.data.kind === 'gain' || b.data.kind === 'sat' || (isDyn(b.data) && disc.get(b.id)!.D !== 0 && disc.get(b.id)!.delay === 0);
  // evaluation order of feed-through blocks (depth first; a back edge means an algebraic loop)
  const order: SimBlock[] = [];
  const state = new Map<string, number>();
  let algebraic = false;
  const visit = (b: SimBlock) => {
    const s = state.get(b.id);
    if (s === 2) return;
    if (s === 1) {
      algebraic = true;
      return;
    }
    state.set(b.id, 1);
    for (let k = 0; k < nInputs(b.data); k++) {
      const sId = src(b, k);
      const sb = sId ? byId.get(sId) : undefined;
      if (sb && feed(sb)) visit(sb);
    }
    state.set(b.id, 2);
    order.push(b);
  };
  blocks.filter(feed).forEach(visit);
  if (algebraic) warnings.push({ key: 'Algebraic loop (a closed path without any lag): solved directly at every step.' });

  let s0 = seed >>> 0;
  const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0), s0 / 4294967296);
  const val = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const y = new Map<string, number[]>(blocks.filter((b) => hasOutput(b.data)).map((b) => [b.id, []]));
  const t: number[] = [];
  const inVal = (b: SimBlock, k: number) => {
    const s = src(b, k);
    return s ? (val.get(s) ?? 0) : 0;
  };
  const evalFeed = (b: SimBlock) => {
    const d = b.data;
    if (d.kind === 'sum') {
      const signs = d.signs ?? '+-';
      let v = 0;
      for (let k = 0; k < signs.length; k++) v += (signs[k] === '-' ? -1 : 1) * inVal(b, k);
      return v;
    }
    if (d.kind === 'gain') return (d.K ?? 1) * inVal(b, 0);
    if (d.kind === 'sat') return Math.min(d.hi ?? 1, Math.max(d.lo ?? -1, inVal(b, 0)));
    const q = disc.get(b.id)!;
    let v = q.D * inVal(b, 0);
    for (let i = 0; i < q.x.length; i++) v += q.C[i]! * q.x[i]!;
    return v;
  };
  // algebraic loop: the feed-through outputs satisfy a linear system (saturations piecewise linear)
  const fb = order;
  const fIdx = new Map(fb.map((b, i) => [b.id, i]));
  const satMode = new Map<string, -1 | 0 | 1>(fb.filter((b) => b.data.kind === 'sat').map((b) => [b.id, 0]));
  const solveAlgebraic = () => {
    const m = fb.length;
    for (let pass = 0; pass < 12; pass++) {
      const A = zeros(m, m + 1);
      fb.forEach((b, i) => {
        A[i]![i] = 1;
        const d = b.data;
        const addIn = (k: number, c: number) => {
          const s = src(b, k);
          if (!s) return;
          const j = fIdx.get(s);
          if (j !== undefined) A[i]![j]! -= c;
          else A[i]![m]! += c * (val.get(s) ?? 0);
        };
        if (d.kind === 'sum') {
          const signs = d.signs ?? '+-';
          for (let k = 0; k < signs.length; k++) addIn(k, signs[k] === '-' ? -1 : 1);
        } else if (d.kind === 'gain') addIn(0, d.K ?? 1);
        else if (d.kind === 'sat') {
          const md = satMode.get(b.id)!;
          if (md === 0) addIn(0, 1);
          else A[i]![m] = md > 0 ? (d.hi ?? 1) : (d.lo ?? -1);
        } else {
          const q = disc.get(b.id)!;
          addIn(0, q.D);
          for (let r = 0; r < q.x.length; r++) A[i]![m]! += q.C[r]! * q.x[r]!;
        }
      });
      const v = gauss(A);
      if (!v) {
        diverged = true;
        return;
      }
      fb.forEach((b, i) => val.set(b.id, v[i]!));
      let changed = false;
      for (const [id, md] of satMode) {
        const b = byId.get(id)!;
        const u = inVal(b, 0);
        const nm = u > (b.data.hi ?? 1) ? 1 : u < (b.data.lo ?? -1) ? -1 : 0;
        if (nm !== md) {
          satMode.set(id, nm);
          changed = true;
        }
      }
      if (!changed) return;
    }
  };
  let diverged = false;
  for (let k = 0; k <= n; k++) {
    const tk = k * h;
    t.push(tk);
    // 1. outputs that do not depend on the present input
    for (const b of blocks) {
      if (b.data.kind === 'source') val.set(b.id, sourceValue(b.data, tk, rnd));
      else if (isDyn(b.data) && !feed(b)) {
        const q = disc.get(b.id)!;
        if (q.delay > 0) val.set(b.id, q.buf[0]!);
        else {
          let v = 0;
          for (let i = 0; i < q.x.length; i++) v += q.C[i]! * q.x[i]!;
          val.set(b.id, v);
        }
      }
    }
    // 2. feed-through blocks in dependency order, or solved together when they form an algebraic loop
    if (!algebraic) for (const b of order) val.set(b.id, evalFeed(b));
    else solveAlgebraic();
    for (const [id, arr] of y) arr.push(val.get(id)!);
    // 3. advance the states with the input held over the step
    for (const b of blocks) {
      if (!isDyn(b.data)) continue;
      const q = disc.get(b.id)!;
      const u = inVal(b, 0);
      if (q.delay > 0) {
        let r = q.D * u;
        for (let i = 0; i < q.x.length; i++) r += q.C[i]! * q.x[i]!;
        q.buf.shift();
        q.buf.push(r);
      }
      const nx = q.x.map((_, i) => {
        let v = q.Bd[i]! * u;
        for (let j = 0; j < q.x.length; j++) v += q.Ad[i]![j]! * q.x[j]!;
        return v;
      });
      q.x = nx;
      if (nx.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e150)) diverged = true;
    }
    if (diverged) break;
  }
  if (diverged) warnings.push({ key: 'The signals grow without bound: the system is unstable.' });
  const scopes = blocks
    .filter((b) => b.data.kind === 'scope')
    .map((b) => ({
      id: b.id,
      name: b.data.name,
      traces: Array.from({ length: nInputs(b.data) }, (_, k) => src(b, k))
        .map((s) => (s ? { name: byId.get(s)!.data.name, from: s, data: y.get(s)! } : null))
        .filter((x): x is { name: string; from: string; data: number[] } => !!x),
    }));
  return { t: t.slice(0, y.values().next().value?.length ?? t.length), y, scopes, warnings, ok: true };
}

// ---------------------------------------------------------------------------
// symbolic linear analysis

const ZERO: TF = { num: [0], den: [1] };
const isZero = (g: TF) => trim(g.num).every((v) => v === 0);
const sameDen = (a: Poly, b: Poly) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) <= 1e-12 * Math.max(1, Math.abs(v)));
/** Scale so the denominator is monic (keeps the coefficients in range). */
const tidy = (g: TF): TF => {
  if (isZero(g)) return ZERO;
  const lead = trim(g.den).at(-1)!;
  return { num: scale(g.num, 1 / lead), den: scale(g.den, 1 / lead) };
};
const rAdd = (a: TF, b: TF): TF => (isZero(a) ? b : isZero(b) ? a : sameDen(a.den, b.den) ? tidy({ num: add(a.num, b.num), den: a.den }) : tidy({ num: add(mul(a.num, b.den), mul(b.num, a.den)), den: mul(a.den, b.den) }));
const rMul = (a: TF, b: TF): TF => (isZero(a) || isZero(b) ? ZERO : tidy({ num: mul(a.num, b.num), den: mul(a.den, b.den) }));
const rDiv = (a: TF, b: TF): TF => tidy({ num: mul(a.num, b.den), den: mul(a.den, b.num) });
const rNeg = (a: TF): TF => ({ num: scale(a.num, -1), den: a.den });

/** Remove pole-zero pairs that cancel (common factors produced by the elimination). */
export function cancel(g: TF): TF {
  if (isZero(g)) return ZERO;
  const zs = roots(g.num);
  const ps = roots(g.den);
  const keepZ: C[] = [];
  const used = new Array<boolean>(ps.length).fill(false);
  for (const z of zs) {
    let hit = -1;
    for (let i = 0; i < ps.length; i++) {
      if (used[i]) continue;
      const p = ps[i]!;
      if (cabs({ re: z.re - p.re, im: z.im - p.im }) <= 1e-5 * (1 + cabs(p))) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) used[hit] = true;
    else keepZ.push(z);
  }
  const keepP = ps.filter((_, i) => !used[i]);
  const kn = trim(g.num).at(-1)!;
  const kd = trim(g.den).at(-1)!;
  return { num: fromRoots(keepZ, kn / kd), den: fromRoots(keepP, 1) };
}

export interface LinearResult {
  ok: boolean;
  error?: string;
  /** transfer function from the source to the chosen signal */
  T: TF | null;
  /** one LaTeX equation per block */
  eqs: string[];
  /** saturations treated as gain 1, dead times approximated (Padé) */
  linearised: string[];
}

const symOf = (name: string) => {
  const m = /^([A-Za-z]+)(\d*)$/.exec(name);
  return m ? (m[2] ? `${m[1]}_{${m[2]}}` : m[1]!) : `\\text{${name.replace(/[{}\\]/g, '')}}`;
};

/** Transfer function from source `srcId` to the output of block `outId`, all other sources set to zero. */
export function linearTF(blocks: SimBlock[], wires: SimWire[], srcId: string, outId: string): LinearResult {
  const sig = blocks.filter((b) => hasOutput(b.data));
  const idx = new Map(sig.map((b, i) => [b.id, i]));
  const inp = new Map<string, string>();
  for (const w of wires) inp.set(`${w.target}:${w.targetHandle}`, w.source);
  const n = sig.length;
  const M: TF[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? tf([1], [1]) : ZERO)));
  const r: TF[] = new Array<TF>(n).fill(ZERO);
  const eqs: string[] = [];
  const linearised: string[] = [];
  const ySym = (b: SimBlock) => `y_{${symOf(b.data.name)}}`;
  for (const b of sig) {
    const i = idx.get(b.id)!;
    const d = b.data;
    if (d.kind === 'source') {
      if (b.id === srcId) r[i] = tf([1], [1]);
      eqs.push(`${ySym(b)} = ${b.id === srcId ? `U(s)` : '0'}`);
      continue;
    }
    const ins = Array.from({ length: nInputs(d) }, (_, k) => inp.get(`${b.id}:in${k}`));
    let g = blockG(d);
    if (d.kind === 'sat') linearised.push(d.name);
    if (g.delay) {
      linearised.push(d.name);
      g = series(tf(g.num, g.den), pade(g.delay));
    }
    const signs = d.kind === 'sum' ? (d.signs ?? '+-') : '+';
    const terms: string[] = [];
    ins.forEach((s, k) => {
      if (!s || !idx.has(s)) return;
      const j = idx.get(s)!;
      const c = signs[k] === '-' ? rNeg(g) : g;
      M[i]![j] = rAdd(M[i]![j]!, rNeg(c));
      const sb = sig[j]!;
      terms.push(`${signs[k] === '-' ? '-' : terms.length ? '+' : ''} ${ySym(sb)}`);
    });
    const inner = terms.join(' ') || '0';
    if (d.kind === 'sum') eqs.push(`${ySym(b)} = ${inner}`);
    else if (d.kind === 'gain') eqs.push(`${ySym(b)} = ${Number((d.K ?? 1).toPrecision(4))}\\,${inner}`);
    else if (d.kind === 'sat') eqs.push(`${ySym(b)} \\approx ${inner}\\quad(\\text{lin.})`);
    else eqs.push(`${ySym(b)} = G_{${symOf(d.name)}}(s)\\,${terms.length > 1 ? `(${inner})` : inner},\\quad G_{${symOf(d.name)}} = ${tfTex(normalize(g))}`);
  }
  if (!idx.has(srcId) || !idx.has(outId)) return { ok: false, error: 'missing', T: null, eqs, linearised };
  // Gaussian elimination with rational entries
  const A = M.map((row) => [...row]);
  const b = [...r];
  for (let c = 0; c < n; c++) {
    let p = -1;
    let best = -1;
    for (let i = c; i < n; i++) {
      if (isZero(A[i]![c]!)) continue;
      const sc = Math.max(...A[i]![c]!.num.map(Math.abs));
      if (sc > best) {
        best = sc;
        p = i;
      }
    }
    if (p < 0) return { ok: false, error: 'singular', T: null, eqs, linearised };
    [A[c], A[p]] = [A[p]!, A[c]!];
    [b[c], b[p]] = [b[p]!, b[c]!];
    for (let i = c + 1; i < n; i++) {
      if (isZero(A[i]![c]!)) continue;
      const f = rDiv(A[i]![c]!, A[c]![c]!);
      for (let j = c; j < n; j++) if (!isZero(A[c]![j]!)) A[i]![j] = rAdd(A[i]![j]!, rNeg(rMul(f, A[c]![j]!)));
      b[i] = rAdd(b[i]!, rNeg(rMul(f, b[c]!)));
    }
  }
  const x = new Array<TF>(n).fill(ZERO);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let j = i + 1; j < n; j++) if (!isZero(A[i]![j]!)) s = rAdd(s, rNeg(rMul(A[i]![j]!, x[j]!)));
    x[i] = rDiv(s, A[i]![i]!);
  }
  // rows were swapped, but the unknowns (columns) were not: x[j] is the signal of column j
  const T = x[idx.get(outId)!]!;
  if (trim(T.den).every((v) => Math.abs(v) < 1e-300)) return { ok: false, error: 'singular', T: null, eqs, linearised };
  const Tc = isZero(T) ? ZERO : normalize(cancel(T));
  return { ok: true, T: Tc, eqs, linearised: [...new Set(linearised)] };
}

/**
 * Open loop L(s) cut at a summing point: its output e is replaced by a test signal and the signal
 * that comes back at its first negative input is measured (negative feedback convention: T = L/(1 + L)).
 */
export function openLoopTF(blocks: SimBlock[], wires: SimWire[], sumId: string): LinearResult & { back?: string } {
  const sum = blocks.find((b) => b.id === sumId);
  const signs = sum?.data.signs ?? '+-';
  const k = signs.indexOf('-');
  const back = k >= 0 ? wires.find((w) => w.target === sumId && w.targetHandle === `in${k}`)?.source : undefined;
  if (!sum || sum.data.kind !== 'sum' || !back || blocks.find((b) => b.id === back)?.data.kind === 'source') return { ok: false, error: 'noloop', T: null, eqs: [], linearised: [] };
  const cut = blocks.map((b) => (b.id === sumId ? { id: b.id, data: { ...b.data, kind: 'source' as const } } : b));
  return { ...linearTF(cut, wires, sumId, back), back };
}
