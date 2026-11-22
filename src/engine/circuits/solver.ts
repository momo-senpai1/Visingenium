/**
 * Circuit solver: modified nodal analysis over the device library.
 *
 * - DC operating point: capacitors open, inductors and transformer windings
 *   short; Newton–Raphson for nonlinear devices; an outer fixed-point loop
 *   re-evaluates behavioural parts (logic gates, flip-flops, relays, fuses,
 *   555) until their states settle. Device states persist between solves, so
 *   toggling a logic input that drives a clock pin clocks a flip-flop.
 * - Transient: backward-Euler companion models for C, L and the coupled
 *   transformer; Newton at every step; behavioural parts read the previous
 *   step (one-step delay), which is how real gate propagation behaves.
 */

import { deviceOf, pinsOf, type CComponent, type CKind, type CParams, type Env, type Stamper } from './devices';
import { solveC } from './reduce';

export * from './devices';

export interface CWire {
  id: string;
  a: string; // "<component>:<pin>"
  b: string;
}
export interface CCircuit {
  components: CComponent[];
  wires: CWire[];
}

/** Pins per kind for the default parameters (gates may have 3 inputs: use pinsOf). */
export const PINS = new Proxy({} as Record<CKind, string[]>, { get: (_t, k: string) => pinsOf({ kind: k as CKind, params: {} }) });

export interface CompResult {
  id: string;
  V: number;
  I: number;
  P: number;
  pinI: number[];
  level?: number;
  warn?: 'overload' | 'reverse' | 'short' | 'blown';
  info?: string;
  logic?: boolean;
}

export type DeviceStates = Record<string, Record<string, number | boolean>>;

export interface CircuitResult {
  ok: boolean;
  error?: 'empty' | 'singular' | 'noconverge';
  netOf: Map<string, number>;
  nets: number;
  ground: number;
  groundAssumed: boolean;
  potentials: number[];
  comps: Map<string, CompResult>;
  floating: number[];
  iterations: number;
  powerBalance: number;
  kclResidual: number;
  /** behavioural parts did not settle (e.g. ring oscillator) */
  oscillating?: boolean;
  usedGmin?: boolean;
  states: DeviceStates;
  system?: { labels: string[]; G: number[][]; rhs: number[] };
}

interface Model {
  comps: CComponent[];
  netOf: Map<string, number>;
  nets: number;
  ground: number;
  groundAssumed: boolean;
  nodeIdx: number[]; // net → matrix index (−1 for ground)
  nNodes: number;
  branchBase: Map<string, number>;
  N: number;
  floating: number[];
}

function build(c: CCircuit): Model {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let x = k;
    while (parent.get(x) !== r) {
      const nx = parent.get(x)!;
      parent.set(x, r);
      x = nx;
    }
    return r;
  };
  for (const comp of c.components) for (const p of pinsOf(comp)) parent.set(`${comp.id}:${p}`, `${comp.id}:${p}`);
  for (const w of c.wires) {
    if (!parent.has(w.a) || !parent.has(w.b)) continue;
    const ra = find(w.a);
    const rb = find(w.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  // every ground symbol is the same node
  const grounds = c.components.filter((x) => x.kind === 'ground');
  for (let i = 1; i < grounds.length; i++) {
    const ra = find(`${grounds[0]!.id}:a`);
    const rb = find(`${grounds[i]!.id}:a`);
    if (ra !== rb) parent.set(ra, rb);
  }
  const idx = new Map<string, number>();
  const netOf = new Map<string, number>();
  const count = new Map<number, number>();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!idx.has(r)) idx.set(r, idx.size);
    netOf.set(k, idx.get(r)!);
    count.set(idx.get(r)!, (count.get(idx.get(r)!) ?? 0) + 1);
  }
  const nets = idx.size;
  const comps = c.components.filter((x) => x.kind !== 'ground');
  const gnd = c.components.find((x) => x.kind === 'ground');
  let ground = gnd ? netOf.get(`${gnd.id}:a`)! : -1;
  const groundAssumed = !gnd;
  if (ground < 0) {
    const src = c.components.find((x) => ['vsource', 'isource', 'battery', 'acsource'].includes(x.kind));
    // with a source, its minus terminal is the reference; otherwise (pure logic) a virtual reference node
    ground = src ? netOf.get(`${src.id}:b`)! : -1;
  }
  const nodeIdx: number[] = [];
  let n = 0;
  for (let k = 0; k < nets; k++) nodeIdx.push(k === ground ? -1 : n++);
  const branchBase = new Map<string, number>();
  let N = n;
  for (const comp of comps) {
    const b = deviceOf(comp).branches?.(comp.params) ?? 0;
    if (b) {
      branchBase.set(comp.id, N);
      N += b;
    }
  }
  const floating = [...count.entries()].filter(([net, k]) => k === 1 && net !== ground).map(([net]) => net);
  return { comps, netOf, nets, ground, groundAssumed, nodeIdx, nNodes: n, branchBase, N, floating };
}

function solveDense(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    if (Math.abs(M[piv]![col]!) < 1e-18) return null;
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    const p = M[col]![col]!;
    for (let r = col + 1; r < n; r++) {
      const f = M[r]![col]! / p;
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i]![n]!;
    for (let k = i + 1; k < n; k++) s -= M[i]![k]! * x[k]!;
    x[i] = s / M[i]![i]!;
  }
  return x;
}

interface SolveCtx {
  mode: 'dc' | 'tran';
  t: number;
  h: number;
  xPrev: number[];
  states: DeviceStates;
  lim: Map<string, number>;
}

function envFor(m: Model, comp: CComponent, x: number[], ctx: SolveCtx): Env {
  const node = (pin: string) => (pin === '' ? -1 : m.nodeIdx[m.netOf.get(`${comp.id}:${pin}`) ?? -1] ?? -1);
  const base = m.branchBase.get(comp.id) ?? 0;
  if (!ctx.states[comp.id]) ctx.states[comp.id] = {};
  return {
    mode: ctx.mode,
    t: ctx.t,
    h: ctx.h,
    v: (p) => {
      const i = node(p);
      return i < 0 ? 0 : x[i]!;
    },
    vp: (p) => {
      const i = node(p);
      return i < 0 ? 0 : ctx.xPrev[i] ?? 0;
    },
    br: (k) => x[base + k] ?? 0,
    brp: (k) => ctx.xPrev[base + k] ?? 0,
    state: ctx.states[comp.id]!,
    lim: ctx.lim,
  };
}

function assemble(m: Model, x: number[], ctx: SolveCtx, gmin: boolean) {
  const N = m.N;
  const G = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const rhs = new Array<number>(N).fill(0);
  for (const comp of m.comps) {
    const node = (pin: string) => (pin === '' ? -1 : m.nodeIdx[m.netOf.get(`${comp.id}:${pin}`) ?? -1] ?? -1);
    const base = m.branchBase.get(comp.id) ?? 0;
    const add = (i: number, j: number, v: number) => {
      if (i >= 0 && j >= 0) G[i]![j]! += v;
    };
    const s: Stamper = {
      g: (a, b, g) => {
        const i = node(a);
        const j = node(b);
        add(i, i, g);
        add(j, j, g);
        add(i, j, -g);
        add(j, i, -g);
      },
      i: (a, b, J) => {
        const i = node(a);
        const j = node(b);
        if (i >= 0) rhs[i]! -= J;
        if (j >= 0) rhs[j]! += J;
      },
      gm: (a, b, cp, cn, g) => {
        const i = node(a);
        const j = node(b);
        const p = node(cp);
        const q = node(cn);
        add(i, p, g);
        add(i, q, -g);
        add(j, p, -g);
        add(j, q, g);
      },
      branch: (k, a, b) => {
        const i = node(a);
        const j = node(b);
        add(i, base + k, 1);
        add(j, base + k, -1);
      },
      rowV: (k, pin, coeff) => add(base + k, node(pin), coeff),
      rowB: (k, k2, coeff) => add(base + k, base + k2, coeff),
      rowRhs: (k, v) => {
        rhs[base + k]! += v;
      },
    };
    deviceOf(comp).stamp(s, comp, envFor(m, comp, x, ctx));
  }
  if (gmin) for (let i = 0; i < m.nNodes; i++) G[i]![i]! += 1e-9;
  return { G, rhs };
}

function newton(m: Model, ctx: SolveCtx, x0: number[]): { x: number[]; it: number; gmin: boolean; sys: { G: number[][]; rhs: number[] } } | null {
  const nonlinear = m.comps.some((c) => deviceOf(c).nonlinear);
  for (const gmin of [false, true]) {
    let x = [...x0];
    let ok = false;
    let sys = { G: [] as number[][], rhs: [] as number[] };
    let it = 0;
    for (; it < 200; it++) {
      const before = new Map(ctx.lim);
      sys = assemble(m, x, ctx, gmin);
      // junction limiting must have settled too, not only the node voltages
      let dl = 0;
      for (const [k, v] of ctx.lim) dl = Math.max(dl, Math.abs(v - (before.get(k) ?? Infinity)));
      const xn = solveDense(sys.G, sys.rhs);
      if (!xn) break;
      const dx = Math.max(0, ...xn.map((v, i) => Math.abs(v - x[i]!)));
      x = xn;
      if (!nonlinear || (it > 0 && dl < 1e-9 && dx < 1e-9 * Math.max(1, ...xn.map(Math.abs)))) {
        ok = true;
        break;
      }
    }
    if (ok) return { x, it: it + 1, gmin, sys };
  }
  return null;
}

function results(m: Model, x: number[], ctx: SolveCtx) {
  const potentials = Array.from({ length: m.nets }, (_, n) => (m.nodeIdx[n]! < 0 ? 0 : x[m.nodeIdx[n]!]!));
  const comps = new Map<string, CompResult>();
  let power = 0;
  const kcl = new Array<number>(m.nets).fill(0);
  for (const comp of m.comps) {
    const e = envFor(m, comp, x, ctx);
    const r = deviceOf(comp).measure(comp, e);
    const pins = pinsOf(comp);
    let P = 0;
    pins.forEach((p, k) => {
      const I = r.pinI[k] ?? 0;
      P += e.v(p) * I;
      const net = m.netOf.get(`${comp.id}:${p}`);
      if (net !== undefined) kcl[net]! += I;
    });
    const V = r.V ?? (pins.length >= 2 ? e.v(pins[0]!) - e.v(pins[1]!) : e.v(pins[0]!));
    const I = r.I ?? (r.pinI[0] ?? 0);
    power += P;
    comps.set(comp.id, { id: comp.id, V, I: Math.abs(I) < 1e-15 ? 0 : I, P: Math.abs(P) < 1e-18 ? 0 : P, pinI: r.pinI, level: r.level, warn: r.warn, info: r.info, logic: r.logic });
  }
  const kclResidual = Math.max(0, ...kcl.map((v, n) => (n === m.ground ? 0 : Math.abs(v))));
  return { potentials, comps, powerBalance: power, kclResidual };
}

function clone(s: DeviceStates): DeviceStates {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v }]));
}

function labels(m: Model) {
  const out: string[] = [];
  for (let n = 0; n < m.nets; n++) if (m.nodeIdx[n]! >= 0) out.push(`φ${n}`);
  for (const comp of m.comps) {
    const b = deviceOf(comp).branches?.(comp.params) ?? 0;
    for (let k = 0; k < b; k++) out.push(`I_${comp.name}${b > 1 ? `,${k + 1}` : ''}`);
  }
  return out;
}

/** DC operating point. `prev` carries device states (flip-flops, relays, fuses) from the last solve. */
export function solveCircuit(c: CCircuit, prev: DeviceStates = {}): CircuitResult {
  const m = build(c);
  const states = clone(prev);
  const base: CircuitResult = {
    ok: false,
    netOf: m.netOf,
    nets: m.nets,
    ground: m.ground,
    groundAssumed: m.groundAssumed,
    potentials: [],
    comps: new Map(),
    floating: m.floating,
    iterations: 0,
    powerBalance: 0,
    kclResidual: 0,
    states,
  };
  if (!m.comps.length) return { ...base, error: 'empty' };
  const behavioural = m.comps.filter((x) => deviceOf(x).behavioural);
  let x = new Array<number>(m.N).fill(0);
  let xPrev = new Array<number>(m.N).fill(0);
  let total = 0;
  let oscillating = false;
  let last: ReturnType<typeof newton> = null;
  for (let outer = 0; outer < (behavioural.length ? 40 : 1); outer++) {
    const ctx: SolveCtx = { mode: 'dc', t: 0, h: 1, xPrev, states, lim: new Map() };
    // first pass: evaluate behavioural states from the initial guess so gates start consistent
    const r = newton(m, ctx, x);
    if (!r) return { ...base, error: 'singular' };
    last = r;
    total += r.it;
    x = r.x;
    if (!behavioural.length) break;
    const uctx: SolveCtx = { ...ctx, xPrev: x };
    let changed = false;
    for (const comp of behavioural) if (deviceOf(comp).update!(comp, envFor(m, comp, x, uctx))) changed = true;
    xPrev = x;
    if (!changed) break;
    if (outer === 39) oscillating = true;
  }
  const ctx: SolveCtx = { mode: 'dc', t: 0, h: 1, xPrev, states, lim: new Map() };
  const res = results(m, x, ctx);
  return {
    ...base,
    ok: true,
    ...res,
    iterations: total,
    oscillating,
    usedGmin: last?.gmin,
    states,
    system: last ? { labels: labels(m), G: last.sys.G, rhs: last.sys.rhs } : undefined,
  };
}

export interface TransientResult {
  ok: boolean;
  error?: 'empty' | 'singular';
  t: number[];
  /** node potentials over time: one array per net */
  nets: number[][];
  /** main current I (a → b) per component over time */
  currents: Map<string, number[]>;
  /** logic level per digital part over time */
  logic: Map<string, number[]>;
  final: CircuitResult | null;
  netOf: Map<string, number>;
  ground: number;
  steps: number;
}

/** Transient analysis from rest (capacitors discharged, inductor currents zero) or from the DC operating point. */
export function simulateTransient(c: CCircuit, tEnd: number, steps = 2000, fromDC = false, prev: DeviceStates = {}): TransientResult {
  const m = build(c);
  const empty: TransientResult = { ok: false, t: [], nets: [], currents: new Map(), logic: new Map(), final: null, netOf: m.netOf, ground: m.ground, steps };
  if (!m.comps.length) return { ...empty, error: 'empty' };
  const states = clone(prev);
  let x = new Array<number>(m.N).fill(0);
  if (fromDC) {
    const dc = solveCircuit(c, prev);
    if (dc.ok) {
      // rebuild x from potentials and branch currents is not exposed; re-run newton in DC mode
      const r = newton(m, { mode: 'dc', t: 0, h: 1, xPrev: x, states: dc.states, lim: new Map() }, x);
      if (r) x = r.x;
      Object.assign(states, clone(dc.states));
    }
  }
  const h = tEnd / steps;
  const behavioural = m.comps.filter((cc) => deviceOf(cc).behavioural);
  const T: number[] = [0];
  const nets: number[][] = Array.from({ length: m.nets }, (_, n) => [m.nodeIdx[n]! < 0 ? 0 : x[m.nodeIdx[n]!]!]);
  const currents = new Map<string, number[]>();
  const logic = new Map<string, number[]>();
  const record = (xx: number[], ctx: SolveCtx) => {
    const res = results(m, xx, ctx);
    for (const [id, r] of res.comps) {
      if (!currents.has(id)) currents.set(id, []);
      currents.get(id)!.push(r.I);
      if (r.logic !== undefined) {
        if (!logic.has(id)) logic.set(id, []);
        logic.get(id)!.push(r.logic ? 1 : 0);
      }
    }
    return res;
  };
  // flip-flops start with their clock input taken as high, so a clock that starts high is not an edge
  for (const comp of behavioural) {
    const st = (states[comp.id] ??= {});
    if (st.clk === undefined) st.clk = true;
  }
  // initial behavioural states from the starting point
  for (const comp of behavioural) deviceOf(comp).update!(comp, envFor(m, comp, x, { mode: 'tran', t: 0, h, xPrev: x, states, lim: new Map() }));
  record(x, { mode: 'tran', t: 0, h, xPrev: x, states, lim: new Map() });
  let lim = new Map<string, number>();
  let lastCtx: SolveCtx = { mode: 'tran', t: 0, h, xPrev: x, states, lim };
  for (let k = 1; k <= steps; k++) {
    const t = k * h;
    const ctx: SolveCtx = { mode: 'tran', t, h, xPrev: x, states, lim };
    const r = newton(m, ctx, x);
    if (!r) return { ...empty, error: 'singular', t: T, nets, currents, logic };
    const xn = r.x;
    lastCtx = ctx;
    record(xn, ctx);
    for (const comp of behavioural) deviceOf(comp).update!(comp, envFor(m, comp, xn, { ...ctx, xPrev: xn }));
    x = xn;
    lim = new Map(lim);
    T.push(t);
    for (let n = 0; n < m.nets; n++) nets[n]!.push(m.nodeIdx[n]! < 0 ? 0 : x[m.nodeIdx[n]!]!);
  }
  const res = results(m, x, lastCtx);
  const final: CircuitResult = {
    ok: true,
    netOf: m.netOf,
    nets: m.nets,
    ground: m.ground,
    groundAssumed: m.groundAssumed,
    floating: m.floating,
    iterations: steps,
    states,
    ...res,
  };
  return { ok: true, t: T, nets, currents, logic, final, netOf: m.netOf, ground: m.ground, steps };
}

export type { CComponent, CKind, CParams };


// ---------------------------------------------------------------------------
// AC small-signal analysis
// ---------------------------------------------------------------------------

export interface ACResult {
  ok: boolean;
  error?: 'empty' | 'noinput' | 'singular';
  f: number[];
  /** complex node potentials per net: [re[], im[]] */
  nets: { re: number[]; im: number[] }[];
  netOf: Map<string, number>;
  ground: number;
}

/**
 * Frequency response: linearise every device at the DC operating point, add jω·C for capacitors and
 * jω·L for inductors/transformers, drive the chosen source with amplitude 1 (all others zero).
 */
export function acSweep(c: CCircuit, inputId: string, fMin: number, fMax: number, points = 200): ACResult {
  const m = build(c);
  const base: ACResult = { ok: false, f: [], nets: [], netOf: m.netOf, ground: m.ground };
  if (!m.comps.length) return { ...base, error: 'empty' };
  const input = m.comps.find((x) => x.id === inputId);
  if (!input) return { ...base, error: 'noinput' };
  const states: DeviceStates = {};
  const op = newton(m, { mode: 'dc', t: 0, h: 1, xPrev: new Array(m.N).fill(0), states, lim: new Map() }, new Array(m.N).fill(0));
  if (!op) return { ...base, error: 'singular' };
  const G = assemble(m, op.x, { mode: 'dc', t: 0, h: 1, xPrev: op.x, states, lim: new Map() }, false).G;
  const N = m.N;
  const Cm = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const nodeOf = (comp: CComponent, pin: string) => m.nodeIdx[m.netOf.get(`${comp.id}:${pin}`) ?? -1] ?? -1;
  const addC = (i: number, j: number, v: number) => {
    if (i >= 0 && j >= 0) Cm[i]![j]! += v;
  };
  for (const comp of m.comps) {
    const bb = m.branchBase.get(comp.id) ?? 0;
    if (comp.kind === 'capacitor') {
      const i = nodeOf(comp, 'a');
      const j = nodeOf(comp, 'b');
      const C = comp.params.C ?? 1e-6;
      addC(i, i, C);
      addC(j, j, C);
      addC(i, j, -C);
      addC(j, i, -C);
    } else if (comp.kind === 'inductor') {
      addC(bb, bb, -(comp.params.L ?? 1e-3));
    } else if (comp.kind === 'transformer') {
      const L1 = comp.params.L ?? 1;
      const L2 = L1 * (comp.params.ratio ?? 0.1) ** 2;
      const M = (comp.params.k ?? 0.999) * Math.sqrt(L1 * L2);
      addC(bb, bb, -L1);
      addC(bb, bb + 1, -M);
      addC(bb + 1, bb, -M);
      addC(bb + 1, bb + 1, -L2);
    }
  }
  const rhs = new Array<number>(N).fill(0);
  if (input.kind === 'isource') {
    const i = nodeOf(input, 'a');
    const j = nodeOf(input, 'b');
    if (i >= 0) rhs[i] = 1;
    if (j >= 0) rhs[j] = -1;
  } else if (m.branchBase.has(input.id)) rhs[m.branchBase.get(input.id)!] = 1;
  else return { ...base, error: 'noinput' };
  const f: number[] = [];
  const nets = Array.from({ length: m.nets }, () => ({ re: [] as number[], im: [] as number[] }));
  for (let k = 0; k < points; k++) {
    const fr = points > 1 ? fMin * (fMax / fMin) ** (k / (points - 1)) : fMin;
    const w = 2 * Math.PI * fr;
    const M = G.map((row, i) => [...row.map((g, j) => ({ re: g, im: w * Cm[i]![j]! })), { re: rhs[i]!, im: 0 }]);
    const x = solveC(M);
    if (!x) return { ...base, error: 'singular' };
    f.push(fr);
    for (let n = 0; n < m.nets; n++) {
      const idx = m.nodeIdx[n]!;
      nets[n]!.re.push(idx < 0 ? 0 : x[idx]!.re);
      nets[n]!.im.push(idx < 0 ? 0 : x[idx]!.im);
    }
  }
  return { ok: true, f, nets, netOf: m.netOf, ground: m.ground };
}
