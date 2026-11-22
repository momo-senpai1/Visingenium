/**
 * Straight beam (x to the right, z downward as in Gross/Hauger, Technische
 * Mechanik): supports, hinges, point forces, point moments and linearly
 * varying line loads. Reactions and the deflection come from a fine
 * Euler–Bernoulli finite-element model (exact at the nodes), so statically
 * indeterminate beams work too; N, Q and M follow from equilibrium of the
 * part left of each cut.
 *
 * Sign conventions: forces Fz and line loads q positive downward, Fx positive
 * to the right, applied moments positive counter-clockwise; internal forces as
 * in the textbooks (N tension positive, Q positive downward on the positive
 * cut face, M positive sagging, i.e. tension at the bottom).
 */

export type SupportType = 'pinned' | 'roller' | 'fixed';

export interface Support {
  id: string;
  x: number;
  type: SupportType;
}
export interface PointLoad {
  id: string;
  x: number;
  /** magnitude [kN] */
  F: number;
  /** direction: angle to the +x axis, measured towards +z (90° = straight down) */
  angle: number;
}
export interface MomentLoad {
  id: string;
  x: number;
  /** [kNm], counter-clockwise positive */
  M: number;
}
export interface LineLoad {
  id: string;
  x1: number;
  x2: number;
  /** [kN/m] downward at x1 and x2 */
  q1: number;
  q2: number;
}

export interface BeamModel {
  L: number;
  supports: Support[];
  hinges: number[];
  points: PointLoad[];
  moments: MomentLoad[];
  lines: LineLoad[];
  /** bending stiffness [kN·m²] and axial stiffness [kN] */
  EI: number;
  EA: number;
}

export interface Reaction {
  supportId: string;
  x: number;
  type: SupportType;
  /** components acting on the beam: Fx → right, Fz ↓, M ↺ */
  Fx: number;
  Fz: number;
  M: number;
}

export interface BeamResult {
  ok: boolean;
  error?: 'nosupport' | 'mechanism';
  /** reactions, unknown count r, hinge count g, degree of indeterminacy n = r − 3 − g */
  reactions: Reaction[];
  r: number;
  g: number;
  degree: number;
  /** samples along the beam */
  x: number[];
  N: number[];
  Q: number[];
  M: number[];
  /** deflection [m], positive downward */
  w: number[];
  max: { M: { x: number; v: number }; Q: { x: number; v: number }; N: { x: number; v: number }; w: { x: number; v: number } };
  /** equilibrium residuals (should be ~0) */
  check: { Fx: number; Fz: number; M0: number };
}

const fx = (p: PointLoad) => p.F * Math.cos((p.angle * Math.PI) / 180);
const fz = (p: PointLoad) => p.F * Math.sin((p.angle * Math.PI) / 180);
export const pointComponents = (p: PointLoad) => ({ Fx: clean(fx(p)), Fz: clean(fz(p)) });
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

/** Resultant of the part of a line load left of x (or the whole load): magnitude and lever arm position. */
export function lineResultant(l: LineLoad, upTo = Infinity) {
  const a = Math.min(l.x1, l.x2);
  const b = Math.min(Math.max(l.x1, l.x2), upTo);
  if (b <= a) return { R: 0, xc: a };
  const q = (x: number) => (l.x2 === l.x1 ? l.q1 : l.q1 + ((l.q2 - l.q1) * (x - l.x1)) / (l.x2 - l.x1));
  const qa = q(a);
  const qb = q(b);
  const len = b - a;
  const R = ((qa + qb) / 2) * len;
  const xc = Math.abs(qa + qb) < 1e-15 ? a + len / 2 : a + (len * (qa + 2 * qb)) / (3 * (qa + qb));
  return { R, xc };
}

function solveBanded(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  const scale = Math.max(1e-300, ...A.map((r, i) => Math.abs(r[i]!)));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < Math.min(n, c + 12); r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-11 * scale) return null;
    if (p !== c) [M[c], M[p]] = [M[p]!, M[c]!];
    const piv = M[c]![c]!;
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / piv;
      if (f === 0) continue;
      const row = M[r]!;
      const src = M[c]!;
      for (let k = c; k <= n; k++) if (src[k] !== 0) row[k]! -= f * src[k]!;
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

export function solveBeam(m: BeamModel, segments = 160): BeamResult {
  const L = m.L;
  const supports = m.supports.filter((s) => s.x >= 0 && s.x <= L);
  const hinges = m.hinges.filter((h) => h > 1e-9 && h < L - 1e-9);
  const r = supports.reduce((s, sp) => s + (sp.type === 'fixed' ? 3 : sp.type === 'pinned' ? 2 : 1), 0);
  const g = hinges.length;
  const degree = r - 3 - g;
  const empty: BeamResult = {
    ok: false,
    reactions: [],
    r,
    g,
    degree,
    x: [],
    N: [],
    Q: [],
    M: [],
    w: [],
    max: { M: { x: 0, v: 0 }, Q: { x: 0, v: 0 }, N: { x: 0, v: 0 }, w: { x: 0, v: 0 } },
    check: { Fx: 0, Fz: 0, M0: 0 },
  };
  if (!supports.length) return { ...empty, error: 'nosupport' };

  // mesh: key points + uniform subdivision
  const keys = new Set<number>([0, L]);
  for (const s of supports) keys.add(s.x);
  for (const h of hinges) keys.add(h);
  for (const p of m.points) if (p.x >= 0 && p.x <= L) keys.add(p.x);
  for (const p of m.moments) if (p.x >= 0 && p.x <= L) keys.add(p.x);
  for (const l of m.lines) {
    keys.add(Math.max(0, Math.min(L, l.x1)));
    keys.add(Math.max(0, Math.min(L, l.x2)));
  }
  const sorted = [...keys].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1]! > 1e-9);
  // elements between key points only: with consistent loads Euler–Bernoulli elements are exact at the
  // nodes, and the deflection inside an element is added analytically below (well-conditioned, exact)
  const xs = sorted;
  const nn = xs.length;
  const near = (x: number) => {
    let best = 0;
    for (let i = 1; i < nn; i++) if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i;
    return best;
  };
  const hingeNode = new Set(hinges.map(near));

  // DOFs: u, v (y up) per node; θ per node, doubled at hinges (left/right element ends)
  const uDof: number[] = [];
  const vDof: number[] = [];
  const tL: number[] = [];
  const tR: number[] = [];
  let nd = 0;
  for (let i = 0; i < nn; i++) {
    uDof.push(nd++);
    vDof.push(nd++);
    const t = nd++;
    tL.push(t);
    tR.push(hingeNode.has(i) ? nd++ : t);
  }
  const K = Array.from({ length: nd }, () => new Array<number>(nd).fill(0));
  const F = new Array<number>(nd).fill(0);
  const EI = Math.max(m.EI, 1e-9);
  const EA = Math.max(m.EA, 1e-9);
  for (let e = 0; e < nn - 1; e++) {
    const le = xs[e + 1]! - xs[e]!;
    const d = [uDof[e]!, vDof[e]!, tR[e]!, uDof[e + 1]!, vDof[e + 1]!, tL[e + 1]!];
    const a = EA / le;
    const b = (12 * EI) / le ** 3;
    const c = (6 * EI) / le ** 2;
    const k4 = (4 * EI) / le;
    const k2 = (2 * EI) / le;
    const ke = [
      [a, 0, 0, -a, 0, 0],
      [0, b, c, 0, -b, c],
      [0, c, k4, 0, -c, k2],
      [-a, 0, 0, a, 0, 0],
      [0, -b, -c, 0, b, -c],
      [0, c, k2, 0, -c, k4],
    ];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[d[i]!]![d[j]!]! += ke[i]![j]!;
    // consistent loads of line loads on this element (p = −q, y up)
    for (const l of m.lines) {
      const lo = Math.max(Math.min(l.x1, l.x2), xs[e]!);
      const hi = Math.min(Math.max(l.x1, l.x2), xs[e + 1]!);
      if (hi - lo < 1e-12) continue;
      const q = (x: number) => (l.x2 === l.x1 ? l.q1 : l.q1 + ((l.q2 - l.q1) * (x - l.x1)) / (l.x2 - l.x1));
      const pa = -q(xs[e]!);
      const pb = -q(xs[e + 1]!);
      F[d[1]!]! += (le * (7 * pa + 3 * pb)) / 20;
      F[d[2]!]! += (le * le * (3 * pa + 2 * pb)) / 60;
      F[d[4]!]! += (le * (3 * pa + 7 * pb)) / 20;
      F[d[5]!]! -= (le * le * (2 * pa + 3 * pb)) / 60;
    }
  }
  for (const p of m.points) {
    if (p.x < 0 || p.x > L) continue;
    const i = near(p.x);
    F[uDof[i]!]! += fx(p);
    F[vDof[i]!]! -= fz(p);
  }
  for (const mo of m.moments) {
    if (mo.x < 0 || mo.x > L) continue;
    const i = near(mo.x);
    F[tR[i]!]! += mo.M; // applied to the right-hand side of a hinge
  }

  const fixedDofs: { dof: number; s: Support; comp: 'Fx' | 'Fz' | 'M' }[] = [];
  for (const s of supports) {
    const i = near(s.x);
    if (s.type !== 'roller') fixedDofs.push({ dof: uDof[i]!, s, comp: 'Fx' });
    fixedDofs.push({ dof: vDof[i]!, s, comp: 'Fz' });
    if (s.type === 'fixed') {
      fixedDofs.push({ dof: tL[i]!, s, comp: 'M' });
      if (tR[i] !== tL[i]) fixedDofs.push({ dof: tR[i]!, s, comp: 'M' });
    }
  }
  const fixedSet = new Set(fixedDofs.map((f) => f.dof));
  const free = [...Array(nd).keys()].filter((d) => !fixedSet.has(d));
  const Kff = free.map((i) => free.map((j) => K[i]![j]!));
  const Ff = free.map((i) => F[i]!);
  // symmetric diagonal scaling (translations and rotations differ by orders of magnitude) + one refinement step
  const sc = free.map((d) => 1 / Math.sqrt(Math.max(Math.abs(K[d]![d]!), 1e-300)));
  const Ks = Kff.map((row, i) => row.map((v, j) => v * sc[i]! * sc[j]!));
  const solveScaled = (rhs: number[]) => {
    const y = solveBanded(Ks, rhs.map((v, i) => v * sc[i]!));
    return y ? y.map((v, i) => v * sc[i]!) : null;
  };
  let sol = solveScaled(Ff);
  if (!sol) return { ...empty, error: 'mechanism' };
  const res = Ff.map((f, i) => f - Kff[i]!.reduce((acc, k, j) => (k === 0 ? acc : acc + k * sol![j]!), 0));
  const corr = solveScaled(res);
  if (corr) sol = sol.map((v, i) => v + corr[i]!);
  const D = new Array<number>(nd).fill(0);
  free.forEach((d, k) => (D[d] = sol[k]!));
  // a mechanism can slip through with a tiny pivot: check displacement scale
  if (D.some((v) => !Number.isFinite(v)) || Math.max(...D.map(Math.abs)) > 1e6 * L) return { ...empty, error: 'mechanism' };

  const reactions = new Map<string, Reaction>();
  for (const s of supports) reactions.set(s.id, { supportId: s.id, x: s.x, type: s.type, Fx: 0, Fz: 0, M: 0 });
  for (const f of fixedDofs) {
    let R = -F[f.dof]!;
    for (let j = 0; j < nd; j++) R += K[f.dof]![j]! * D[j]!;
    const re = reactions.get(f.s.id)!;
    if (f.comp === 'Fx') re.Fx += R;
    else if (f.comp === 'Fz') re.Fz += -R; // y-up force → z-down
    else re.M += R;
  }
  const reacts = [...reactions.values()].map((re) => ({ ...re, Fx: clean(round(re.Fx)), Fz: clean(round(re.Fz)), M: clean(round(re.M)) }));

  // internal forces from the left part (all external actions incl. reactions)
  const actions = [
    ...m.points.filter((p) => p.x >= 0 && p.x <= L).map((p) => ({ x: p.x, Fx: fx(p), Fz: fz(p), C: 0 })),
    ...m.moments.filter((p) => p.x >= 0 && p.x <= L).map((p) => ({ x: p.x, Fx: 0, Fz: 0, C: p.M })),
    ...reacts.map((re) => ({ x: re.x, Fx: re.Fx, Fz: re.Fz, C: re.M })),
  ];
  const internal = (x: number, inclusive: boolean) => {
    let N = 0;
    let Q = 0;
    let M = 0;
    for (const a of actions) {
      if (a.x < x - 1e-12 || (inclusive && Math.abs(a.x - x) <= 1e-12)) {
        N -= a.Fx;
        Q -= a.Fz;
        M -= a.Fz * (x - a.x) + a.C;
      }
    }
    for (const l of m.lines) {
      const { R, xc } = lineResultant(l, x);
      Q -= R;
      M -= R * (x - xc);
    }
    return { N, Q, M };
  };
  const X: number[] = [];
  const Nn: number[] = [];
  const Qn: number[] = [];
  const Mn: number[] = [];
  const W: number[] = [];
  const push = (x: number, w: number, inclusive: boolean) => {
    const a = internal(x, inclusive);
    X.push(x);
    Nn.push(a.N);
    Qn.push(a.Q);
    Mn.push(a.M);
    W.push(w);
  };
  for (let e = 0; e < nn - 1; e++) {
    const x0 = xs[e]!;
    const le = xs[e + 1]! - x0;
    const v1 = D[vDof[e]!]!;
    const t1 = D[tR[e]!]!;
    const v2 = D[vDof[e + 1]!]!;
    const t2 = D[tL[e + 1]!]!;
    const loads = m.lines
      .filter((l) => Math.min(l.x1, l.x2) <= x0 + 1e-12 && Math.max(l.x1, l.x2) >= x0 + le - 1e-12)
      .map((l) => {
        const q = (x: number) => (l.x2 === l.x1 ? l.q1 : l.q1 + ((l.q2 - l.q1) * (x - l.x1)) / (l.x2 - l.x1));
        return { pa: -q(x0), pb: -q(x0 + le) };
      });
    const n = Math.max(2, Math.round((le / L) * segments));
    for (let k = 0; k <= n; k++) {
      if (k === n && e < nn - 2) break; // next element starts here
      const xi = (le * k) / n;
      const s1 = xi / le;
      const h1 = 1 - 3 * s1 ** 2 + 2 * s1 ** 3;
      const h2 = le * (s1 - 2 * s1 ** 2 + s1 ** 3);
      const h3 = 3 * s1 ** 2 - 2 * s1 ** 3;
      const h4 = le * (-(s1 ** 2) + s1 ** 3);
      let v = h1 * v1 + h2 * t1 + h3 * v2 + h4 * t2;
      for (const { pa, pb } of loads) v += (xi ** 2 * (le - xi) ** 2 * (3 * le * pa + 2 * le * pb - (pa - pb) * xi)) / (120 * EI * le);
      const x = x0 + xi;
      // at a key point inside the beam: value left of the jump, then right of it
      if (k === 0 && e > 0) push(x, -v, false);
      push(x, -v, k === n ? false : true);
    }
  }
  const arg = (arr: number[]) => {
    let k = 0;
    for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i]!) > Math.abs(arr[k]!) + 1e-12) k = i;
    return { x: X[k]!, v: clean(round(arr[k]!)) };
  };

  // global equilibrium check (moments about x = 0, counter-clockwise positive)
  let cFx = 0;
  let cFz = 0;
  let cM = 0;
  for (const a of actions) {
    cFx += a.Fx;
    cFz += a.Fz;
    cM += a.C - a.Fz * a.x;
  }
  for (const l of m.lines) {
    const { R, xc } = lineResultant(l);
    cFz += R;
    cM -= R * xc;
  }
  return {
    ok: true,
    reactions: reacts,
    r,
    g,
    degree,
    x: X,
    N: Nn.map(clean),
    Q: Qn.map(clean),
    M: Mn.map(clean),
    w: W,
    max: { M: arg(Mn), Q: arg(Qn), N: arg(Nn), w: arg(W) },
    check: { Fx: cFx, Fz: cFz, M0: cM },
  };
}

const round = (v: number) => Number(v.toPrecision(10));

// ---------------------------------------------------------------------------
// Cross-sections
// ---------------------------------------------------------------------------

export type Section =
  | { kind: 'rect'; b: number; h: number }
  | { kind: 'circle'; d: number }
  | { kind: 'tube'; D: number; d: number }
  | { kind: 'I'; h: number; b: number; tw: number; tf: number };

/** A [mm²], I_y [mm⁴], W_y [mm³] (dimensions in mm). */
export function sectionProps(s: Section) {
  switch (s.kind) {
    case 'rect':
      return { A: s.b * s.h, I: (s.b * s.h ** 3) / 12, W: (s.b * s.h ** 2) / 6 };
    case 'circle':
      return { A: (Math.PI * s.d ** 2) / 4, I: (Math.PI * s.d ** 4) / 64, W: (Math.PI * s.d ** 3) / 32 };
    case 'tube': {
      const I = (Math.PI * (s.D ** 4 - s.d ** 4)) / 64;
      return { A: (Math.PI * (s.D ** 2 - s.d ** 2)) / 4, I, W: I / (s.D / 2) };
    }
    case 'I': {
      const hw = s.h - 2 * s.tf;
      const I = (s.b * s.h ** 3 - (s.b - s.tw) * hw ** 3) / 12;
      return { A: 2 * s.b * s.tf + hw * s.tw, I, W: I / (s.h / 2) };
    }
  }
}
