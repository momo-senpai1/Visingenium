/**
 * Network reduction: equivalent resistance/impedance between two nodes,
 * found the way it is done by hand — series and parallel combinations and
 * star–delta transformations — with every step recorded. Sources are set to
 * zero (voltage sources short, current sources open). At a frequency f > 0
 * capacitors and inductors become complex impedances.
 */

import { pinsOf, type CComponent } from './devices';
import type { CCircuit } from './solver';

export interface Cx {
  re: number;
  im: number;
}
const c = (re: number, im = 0): Cx => ({ re, im });
const cadd = (a: Cx, b: Cx): Cx => c(a.re + b.re, a.im + b.im);
const cmul = (a: Cx, b: Cx): Cx => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const cabs = (a: Cx) => Math.hypot(a.re, a.im);

interface El {
  id: string;
  a: number;
  b: number;
  Z: Cx;
  /** LaTeX symbol, e.g. R_{1} or R_{12} */
  sym: string;
}

export type RStep =
  | { kind: 'short'; text: string }
  | { kind: 'remove'; text: string }
  | { kind: 'series'; sym: string; parts: string[]; Zs: Cx[]; Z: Cx }
  | { kind: 'parallel'; sym: string; parts: string[]; Zs: Cx[]; Z: Cx }
  | { kind: 'stardelta'; center: string; star: { sym: string; Z: Cx }[]; delta: { sym: string; Z: Cx }[] }
  | { kind: 'dead'; sym: string };

export interface ReduceResult {
  ok: boolean;
  error?: 'nonlinear' | 'stuck' | 'open' | 'terminals';
  Z: Cx | null;
  steps: RStep[];
  /** check by nodal analysis (1 A injected) */
  check: Cx | null;
  unsupported: string[];
}

const IMPEDANCE_KINDS = ['resistor', 'lamp', 'speaker', 'ldr', 'thermistor', 'fuse', 'capacitor', 'inductor', 'pot'];

/** Equivalent impedance between nets A and B of the circuit (netOf from the solver). */
export function reduceNetwork(circuit: CCircuit, netOf: Map<string, number>, A: number, B: number, f = 0, value: (cmp: CComponent) => number): ReduceResult {
  const steps: RStep[] = [];
  const unsupported: string[] = [];
  // union-find over nets for shorts
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  const net = (cmp: CComponent, p: string) => netOf.get(`${cmp.id}:${p}`)!;
  const els: El[] = [];
  let extra = 0;
  const w = 2 * Math.PI * f;
  for (const cmp of circuit.components) {
    const k = cmp.kind;
    if (k === 'ground' || k === 'voltmeter' || k === 'probe' || k === 'isource' || k === 'logicOut') {
      if (k === 'isource') steps.push({ kind: 'remove', text: `${cmp.name}` });
      continue;
    }
    if (k === 'vsource' || k === 'acsource' || k === 'ammeter' || (k === 'switch' && cmp.params.closed) || k === 'battery') {
      union(net(cmp, 'a'), net(cmp, 'b'));
      if (k !== 'ammeter' && k !== 'switch') steps.push({ kind: 'short', text: `${cmp.name}` });
      continue;
    }
    if (k === 'switch') continue; // open
    if (k === 'inductor' && f === 0) {
      union(net(cmp, 'a'), net(cmp, 'b'));
      continue;
    }
    if (k === 'capacitor' && f === 0) continue;
    if (!IMPEDANCE_KINDS.includes(k)) {
      unsupported.push(cmp.name);
      continue;
    }
    const sym = symOf(cmp.name);
    if (k === 'pot') {
      const R = cmp.params.R ?? 10000;
      const p = Math.min(Math.max(cmp.params.pos ?? 0.5, 0), 1);
      els.push({ id: `${cmp.id}a`, a: net(cmp, 'a'), b: net(cmp, 'w'), Z: c(Math.max(p * R, 1e-3)), sym: `${sym}'` });
      els.push({ id: `${cmp.id}b`, a: net(cmp, 'w'), b: net(cmp, 'b'), Z: c(Math.max((1 - p) * R, 1e-3)), sym: `${sym}''` });
      continue;
    }
    let Z: Cx;
    if (k === 'capacitor') Z = c(0, -1 / (w * (cmp.params.C ?? 1e-6)));
    else if (k === 'inductor') Z = c(0, w * (cmp.params.L ?? 1e-3));
    else Z = c(value(cmp));
    els.push({ id: cmp.id, a: net(cmp, 'a'), b: net(cmp, 'b'), Z, sym });
  }
  if (unsupported.length) return { ok: false, error: 'nonlinear', Z: null, steps, check: null, unsupported };
  const tA = find(A);
  const tB = find(B);
  if (tA === tB) return { ok: true, Z: c(0), steps, check: c(0), unsupported };
  let list = els.map((e) => ({ ...e, a: find(e.a), b: find(e.b) })).filter((e) => e.a !== e.b);
  const check = nodal(list, tA, tB);
  const isT = (n: number) => n === tA || n === tB;
  for (let guard = 0; guard < 500; guard++) {
    // dead ends: a non-terminal node with a single element carries no current
    const deg = new Map<number, El[]>();
    for (const e of list) {
      deg.set(e.a, [...(deg.get(e.a) ?? []), e]);
      deg.set(e.b, [...(deg.get(e.b) ?? []), e]);
    }
    const dead = [...deg.entries()].find(([n, es]) => !isT(n) && es.length === 1);
    if (dead) {
      steps.push({ kind: 'dead', sym: dead[1][0]!.sym });
      list = list.filter((e) => e !== dead[1][0]);
      continue;
    }
    // parallel: same node pair
    let done = false;
    for (let i = 0; i < list.length && !done; i++) {
      const group = list.filter((e) => (e.a === list[i]!.a && e.b === list[i]!.b) || (e.a === list[i]!.b && e.b === list[i]!.a));
      if (group.length >= 2) {
        let Y = c(0);
        for (const g of group) Y = cadd(Y, cdiv(c(1), g.Z));
        const Z = cdiv(c(1), Y);
        const sym = combo(group.map((g) => g.sym), ++extra);
        steps.push({ kind: 'parallel', sym, parts: group.map((g) => g.sym), Zs: group.map((g) => g.Z), Z });
        list = [...list.filter((e) => !group.includes(e)), { id: `p${extra}`, a: group[0]!.a, b: group[0]!.b, Z, sym }];
        done = true;
      }
    }
    if (done) continue;
    // series: non-terminal node with exactly two elements
    const ser = [...deg.entries()].find(([n, es]) => !isT(n) && es.length === 2);
    if (ser) {
      const [n, [e1, e2]] = ser as [number, [El, El]];
      const o1 = e1.a === n ? e1.b : e1.a;
      const o2 = e2.a === n ? e2.b : e2.a;
      const Z = cadd(e1.Z, e2.Z);
      const sym = combo([e1.sym, e2.sym], ++extra);
      steps.push({ kind: 'series', sym, parts: [e1.sym, e2.sym], Zs: [e1.Z, e2.Z], Z });
      list = [...list.filter((e) => e !== e1 && e !== e2), { id: `s${extra}`, a: o1, b: o2, Z, sym }].filter((e) => e.a !== e.b);
      continue;
    }
    if (list.length === 1 && ((list[0]!.a === tA && list[0]!.b === tB) || (list[0]!.a === tB && list[0]!.b === tA))) {
      return { ok: true, Z: list[0]!.Z, steps, check, unsupported };
    }
    if (!list.length) return { ok: true, error: 'open', Z: null, steps, check, unsupported };
    // star → delta at a non-terminal node with three elements
    const star = [...deg.entries()].find(([n, es]) => !isT(n) && es.length === 3);
    if (star) {
      const [n, es] = star;
      const other = es.map((e) => (e.a === n ? e.b : e.a));
      const Zs = es.map((e) => e.Z);
      const S = cadd(cadd(cmul(Zs[0]!, Zs[1]!), cmul(Zs[1]!, Zs[2]!)), cmul(Zs[2]!, Zs[0]!));
      const pairs: [number, number, number][] = [
        [0, 1, 2],
        [1, 2, 0],
        [2, 0, 1],
      ];
      const delta = pairs.map(([i, j, k]) => ({ a: other[i]!, b: other[j]!, Z: cdiv(S, Zs[k]!), sym: `${es[0]!.sym.charAt(0)}_{${++extra}}`, id: `d${extra}` }));
      steps.push({ kind: 'stardelta', center: `${n}`, star: es.map((e) => ({ sym: e.sym, Z: e.Z })), delta: delta.map((d) => ({ sym: d.sym, Z: d.Z })) });
      list = [...list.filter((e) => !es.includes(e)), ...delta].filter((e) => e.a !== e.b);
      continue;
    }
    // remaining: cannot be reduced with these rules (node with four or more branches) → nodal value
    return { ok: !!check, error: 'stuck', Z: check, steps, check, unsupported };
  }
  return { ok: false, error: 'stuck', Z: check, steps, check, unsupported };
}

/** Name of a combined element from its parts: R_{1}, R_{2} → R_{12}; mixed letters → Z; long → R_{e3}. */
function combo(parts: string[], k: number): string {
  const letters = new Set(parts.map((p) => p.replace(/_\{.*$/, '').replace(/'+$/, '')));
  const L = letters.size === 1 ? [...letters][0]! : 'Z';
  const subs = parts.map((p) => /_\{(.*)\}'*$/.exec(p)?.[1] ?? '');
  const joined = subs.every((x) => /^[0-9]$/.test(x)) ? subs.sort().join('') : subs.join('');
  return joined.length && joined.length <= 4 && /^[0-9]+$/.test(joined) ? `${L}_{${joined}}` : `${L}_{\\mathrm{e}${k}}`;
}

const symOf = (name: string) => {
  const m = /^([A-Za-z]+)(.*)$/.exec(name);
  return m ? `${m[1]}_{${m[2] || '0'}}` : name;
};

/** Impedance between A and B by nodal analysis with a 1 A test current (complex Gauss). */
function nodal(list: El[], A: number, B: number): Cx | null {
  const nodes = [...new Set(list.flatMap((e) => [e.a, e.b]))].filter((n) => n !== B);
  if (!nodes.includes(A)) return null;
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const N = nodes.length;
  const M: Cx[][] = Array.from({ length: N }, () => Array.from({ length: N + 1 }, () => c(0)));
  for (const e of list) {
    const Y = cdiv(c(1), e.Z);
    const i = idx.get(e.a);
    const j = idx.get(e.b);
    if (i !== undefined) M[i]![i] = cadd(M[i]![i]!, Y);
    if (j !== undefined) M[j]![j] = cadd(M[j]![j]!, Y);
    if (i !== undefined && j !== undefined) {
      M[i]![j] = cadd(M[i]![j]!, c(-Y.re, -Y.im));
      M[j]![i] = cadd(M[j]![i]!, c(-Y.re, -Y.im));
    }
  }
  for (let i = 0; i < N; i++) M[i]![i] = cadd(M[i]![i]!, c(1e-15));
  M[idx.get(A)!]![N] = c(1);
  const x = solveC(M);
  return x ? x[idx.get(A)!]! : null;
}

export function solveC(M: Cx[][]): Cx[] | null {
  const N = M.length;
  for (let col = 0; col < N; col++) {
    let piv = col;
    for (let r = col + 1; r < N; r++) if (cabs(M[r]![col]!) > cabs(M[piv]![col]!)) piv = r;
    if (cabs(M[piv]![col]!) < 1e-300) return null;
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    for (let r = col + 1; r < N; r++) {
      const f = cdiv(M[r]![col]!, M[col]![col]!);
      if (f.re === 0 && f.im === 0) continue;
      for (let k = col; k <= N; k++) {
        const t = cmul(f, M[col]![k]!);
        M[r]![k] = c(M[r]![k]!.re - t.re, M[r]![k]!.im - t.im);
      }
    }
  }
  const x: Cx[] = new Array(N).fill(null).map(() => c(0));
  for (let i = N - 1; i >= 0; i--) {
    let s = M[i]![N]!;
    for (let k = i + 1; k < N; k++) {
      const t = cmul(M[i]![k]!, x[k]!);
      s = c(s.re - t.re, s.im - t.im);
    }
    x[i] = cdiv(s, M[i]![i]!);
  }
  return x;
}

export { pinsOf };
