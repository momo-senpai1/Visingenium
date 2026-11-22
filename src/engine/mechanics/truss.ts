/**
 * Plane pin-jointed truss (x right, y up). Bars carry axial force only.
 * Direct stiffness method: works for statically determinate and indeterminate
 * trusses; a mechanism shows up as a singular stiffness matrix.
 */

export type TSupport = 'none' | 'pinned' | 'rollerX' | 'rollerY';

export interface TNode {
  id: string;
  name: string;
  x: number;
  y: number;
  support: TSupport;
  /** applied load [kN] */
  Fx: number;
  Fy: number;
}
export interface TBar {
  id: string;
  a: string;
  b: string;
}
export interface TrussModel {
  nodes: TNode[];
  bars: TBar[];
  /** axial stiffness EA [kN], same for all bars */
  EA: number;
}

export interface TrussResult {
  ok: boolean;
  error?: 'empty' | 'mechanism';
  /** bar force [kN], tension positive */
  N: Map<string, number>;
  /** support reactions [kN] */
  R: Map<string, { Rx: number; Ry: number }>;
  /** nodal displacements [m] */
  u: Map<string, { ux: number; uy: number }>;
  /** k nodes, s bars, r reaction components: determinate if 2k = s + r */
  k: number;
  s: number;
  r: number;
  degree: number;
}

/** Roller "rollerX" rolls along x (only y is held); "rollerY" rolls along y (only x is held). */
export const held = (s: TSupport) => ({ x: s === 'pinned' || s === 'rollerY', y: s === 'pinned' || s === 'rollerX' });

export function geometry(m: TrussModel, bar: TBar) {
  const a = m.nodes.find((n) => n.id === bar.a)!;
  const b = m.nodes.find((n) => n.id === bar.b)!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  return { a, b, L, c: dx / L, s: dy / L };
}

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  const scale = Math.max(1e-300, ...A.map((r, i) => Math.abs(r[i]!)));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-10 * scale) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / M[c]![c]!;
      if (f) for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
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

export function solveTruss(m: TrussModel): TrussResult {
  const bars = m.bars.filter((b) => b.a !== b.b && m.nodes.some((n) => n.id === b.a) && m.nodes.some((n) => n.id === b.b));
  const k = m.nodes.length;
  const s = bars.length;
  const r = m.nodes.reduce((acc, n) => acc + (held(n.support).x ? 1 : 0) + (held(n.support).y ? 1 : 0), 0);
  const base = { N: new Map(), R: new Map(), u: new Map(), k, s, r, degree: s + r - 2 * k };
  if (!k || !s) return { ok: false, error: 'empty', ...base };

  const idx = new Map(m.nodes.map((n, i) => [n.id, i]));
  const nd = 2 * k;
  const K = Array.from({ length: nd }, () => new Array<number>(nd).fill(0));
  const F = new Array<number>(nd).fill(0);
  for (const bar of bars) {
    const { L, c, s: sn } = geometry(m, bar);
    if (L < 1e-12) continue;
    const kk = m.EA / L;
    const d = [2 * idx.get(bar.a)!, 2 * idx.get(bar.a)! + 1, 2 * idx.get(bar.b)!, 2 * idx.get(bar.b)! + 1];
    const t = [-c, -sn, c, sn];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[d[i]!]![d[j]!]! += kk * t[i]! * t[j]!;
  }
  m.nodes.forEach((n, i) => {
    F[2 * i] = n.Fx;
    F[2 * i + 1] = n.Fy;
  });
  const fixed = new Set<number>();
  m.nodes.forEach((n, i) => {
    if (held(n.support).x) fixed.add(2 * i);
    if (held(n.support).y) fixed.add(2 * i + 1);
  });
  const free = [...Array(nd).keys()].filter((d) => !fixed.has(d));
  const sol = solve(
    free.map((i) => free.map((j) => K[i]![j]!)),
    free.map((i) => F[i]!),
  );
  if (!sol) return { ok: false, error: 'mechanism', ...base };
  const D = new Array<number>(nd).fill(0);
  free.forEach((d, i) => (D[d] = sol[i]!));
  const clean = (v: number) => {
    const r2 = Number(v.toPrecision(10));
    return Math.abs(r2) < 1e-9 ? 0 : r2;
  };
  const N = new Map<string, number>();
  for (const bar of bars) {
    const { L, c, s: sn } = geometry(m, bar);
    const ia = idx.get(bar.a)!;
    const ib = idx.get(bar.b)!;
    const elong = (D[2 * ib]! - D[2 * ia]!) * c + (D[2 * ib + 1]! - D[2 * ia + 1]!) * sn;
    N.set(bar.id, clean((m.EA / L) * elong));
  }
  const R = new Map<string, { Rx: number; Ry: number }>();
  const u = new Map<string, { ux: number; uy: number }>();
  m.nodes.forEach((n, i) => {
    u.set(n.id, { ux: D[2 * i]!, uy: D[2 * i + 1]! });
    if (n.support === 'none') return;
    // reaction = Σ bar forces acting on the node − applied load, from nodal equilibrium
    let Rx = -n.Fx;
    let Ry = -n.Fy;
    for (const bar of bars) {
      if (bar.a !== n.id && bar.b !== n.id) continue;
      const { c, s: sn } = geometry(m, bar);
      const dir = bar.a === n.id ? 1 : -1; // unit vector from this node along the bar
      Rx -= N.get(bar.id)! * c * dir;
      Ry -= N.get(bar.id)! * sn * dir;
    }
    R.set(n.id, { Rx: held(n.support).x ? clean(Rx) : 0, Ry: held(n.support).y ? clean(Ry) : 0 });
  });
  return { ...base, ok: true, N, R, u };
}
