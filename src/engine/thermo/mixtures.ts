/**
 * Mixtures: ideal-gas mixtures (Dalton, mixing entropy) and liquid–liquid miscibility gaps with the
 * two-parameter Margules model g^E/RT = x₁x₂(A₂₁x₁ + A₁₂x₂), A_ij = a_ij/T.
 */

export const R = 8.314462618; // J/(mol K)

// ---------------------------------------------------------------- ideal gas mixture

export interface GasComp {
  name: string;
  /** amount [mol] */
  n: number;
  /** molar mass [g/mol] */
  M: number;
  /** molar heat capacity c_p [J/(mol K)] */
  cp: number;
}
export function gasMixture(comps: GasComp[], p: number, T: number) {
  const nTot = comps.reduce((a, c) => a + Math.max(0, c.n), 0);
  const x = comps.map((c) => (nTot > 0 ? Math.max(0, c.n) / nTot : 0));
  const M = comps.reduce((a, c, i) => a + x[i]! * c.M, 0);
  const cp = comps.reduce((a, c, i) => a + x[i]! * c.cp, 0);
  const w = comps.map((c, i) => (M > 0 ? (x[i]! * c.M) / M : 0));
  // ΔS_mix = −R Σ n_i ln x_i  [J/K] (mixing at constant T and p)
  const dS = -R * comps.reduce((a, c, i) => a + (x[i]! > 0 ? Math.max(0, c.n) * Math.log(x[i]!) : 0), 0);
  const V = (nTot * R * T) / (p * 1e5); // m³ (p in bar)
  return { x, w, pPart: x.map((xi) => xi * p), M, cp, cv: cp - R, kappa: cp / (cp - R), Rs: (R / M) * 1000, dS, dG: -T * dS, V, rho: (M / 1000) * (p * 1e5) / (R * T) };
}

// ---------------------------------------------------------------- miscibility gap (Margules)

export interface Margules {
  /** a₁₂, a₂₁ [K]: A_ij = a_ij / T */
  a12: number;
  a21: number;
}
const A = (m: Margules, T: number) => ({ A12: m.a12 / T, A21: m.a21 / T });

/** ln γ₁, ln γ₂ */
export function lnGamma(m: Margules, T: number, x1: number) {
  const { A12, A21 } = A(m, T);
  const x2 = 1 - x1;
  return { g1: x2 * x2 * (A12 + 2 * (A21 - A12) * x1), g2: x1 * x1 * (A21 + 2 * (A12 - A21) * x2) };
}
/** Δg_mix / RT */
export function gMix(m: Margules, T: number, x1: number) {
  const { A12, A21 } = A(m, T);
  const x2 = 1 - x1;
  const id = (x1 > 0 ? x1 * Math.log(x1) : 0) + (x2 > 0 ? x2 * Math.log(x2) : 0);
  return id + x1 * x2 * (A21 * x1 + A12 * x2);
}
/** d²(Δg/RT)/dx₁² */
function g2(m: Margules, T: number, x: number) {
  const { A12, A21 } = A(m, T);
  // gE = x(1−x)(A21 x + A12 (1 − x)) = A12 x + (A21 − 2A12) x² + (A12 − A21) x³ … second derivative:
  const gE2 = 2 * (A21 - 2 * A12) + 6 * (A12 - A21) * x;
  return 1 / (x * (1 - x)) + gE2;
}

/** Spinodal compositions at T (where the curvature changes sign), or null if the mixture is stable. */
export function spinodal(m: Margules, T: number): [number, number] | null {
  const n = 2000;
  const xs: number[] = [];
  let prev = g2(m, T, 1e-6);
  for (let i = 1; i <= n; i++) {
    const x = Math.min(1 - 1e-6, i / n);
    const v = g2(m, T, x);
    if (Math.sign(v) !== Math.sign(prev)) {
      let lo = (i - 1) / n;
      let hi = x;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(g2(m, T, mid)) === Math.sign(g2(m, T, lo))) lo = mid;
        else hi = mid;
      }
      xs.push((lo + hi) / 2);
    }
    prev = v;
  }
  return xs.length >= 2 ? [xs[0]!, xs.at(-1)!] : null;
}

/** Binodal (coexisting phases) at T from equal activities x_i γ_i in both phases. */
export function binodal(m: Margules, T: number): [number, number] | null {
  const sp = spinodal(m, T);
  if (!sp) return null;
  let a = Math.max(1e-9, sp[0] / 2);
  let b = Math.min(1 - 1e-9, (sp[1] + 1) / 2);
  const F = (xa: number, xb: number) => {
    const ga = lnGamma(m, T, xa);
    const gb = lnGamma(m, T, xb);
    return [Math.log(xa) + ga.g1 - Math.log(xb) - gb.g1, Math.log(1 - xa) + ga.g2 - Math.log(1 - xb) - gb.g2];
  };
  for (let it = 0; it < 200; it++) {
    const f = F(a, b);
    const h = 1e-7;
    const fa = F(a + h, b);
    const fb = F(a, b + h);
    const J = [
      [(fa[0]! - f[0]!) / h, (fb[0]! - f[0]!) / h],
      [(fa[1]! - f[1]!) / h, (fb[1]! - f[1]!) / h],
    ];
    const det = J[0]![0]! * J[1]![1]! - J[0]![1]! * J[1]![0]!;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-300) break;
    const da = (f[0]! * J[1]![1]! - f[1]! * J[0]![1]!) / det;
    const db = (J[0]![0]! * f[1]! - J[1]![0]! * f[0]!) / det;
    a = Math.min(sp[0] - 1e-9, Math.max(1e-12, a - 0.8 * da));
    b = Math.max(sp[1] + 1e-9, Math.min(1 - 1e-12, b - 0.8 * db));
    if (Math.abs(da) + Math.abs(db) < 1e-12) break;
  }
  const f = F(a, b);
  return Math.abs(f[0]!) + Math.abs(f[1]!) < 1e-6 ? [a, b] : null;
}

/** Upper critical solution temperature: highest T with a spinodal (bisection). */
export function ucst(m: Margules): number | null {
  let hi = Math.max(m.a12, m.a21) * 2;
  if (!spinodal(m, 1)) return null;
  let lo = 1;
  if (spinodal(m, hi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (spinodal(m, mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
