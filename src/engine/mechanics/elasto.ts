/**
 * Engineering Mechanics 2 (strength of materials) helpers for the explainer pages:
 * plane stress and Mohr's circle, bars in tension/compression with thermal strain,
 * thin-walled sections (Bredt, open profiles, shear flow, shear centre),
 * energy methods on a cantilever and Euler buckling.
 */

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- plane stress

export interface PlaneStress {
  sx: number;
  sz: number;
  txz: number;
}

/** stresses on an element rotated by φ [°] (counter-clockwise from x to ξ) */
export function rotateStress({ sx, sz, txz }: PlaneStress, phiDeg: number) {
  const c = Math.cos(2 * phiDeg * DEG);
  const s = Math.sin(2 * phiDeg * DEG);
  const m = (sx + sz) / 2;
  const d = (sx - sz) / 2;
  return { s1: m + d * c + txz * s, s2: m - d * c - txz * s, t: -d * s + txz * c };
}

export function mohr(p: PlaneStress) {
  const m = (p.sx + p.sz) / 2;
  const r = Math.hypot((p.sx - p.sz) / 2, p.txz);
  // angle of the first principal direction: tan 2φ* = 2τ / (σx − σz)
  const phi = (0.5 * Math.atan2(2 * p.txz, p.sx - p.sz)) / DEG;
  const s1 = m + r;
  const s2 = m - r;
  return { m, r, s1, s2, phi, tmax: r, vonMises: Math.sqrt(p.sx ** 2 + p.sz ** 2 - p.sx * p.sz + 3 * p.txz ** 2), tresca: s1 - s2 };
}

// ---------------------------------------------------------------- bars

export interface BarSeg {
  /** length [mm], area [mm²], Young's modulus [GPa], thermal expansion [1e-6/K] */
  l: number;
  A: number;
  E: number;
  alpha: number;
}

export interface BarInput {
  segs: [BarSeg, BarSeg];
  /** axial force at the joint, positive to the right [kN] */
  F: number;
  /** temperature change of the whole bar [K] */
  dT: number;
  /** right end: free, or a wall at gap s [mm] (s = 0: clamped) */
  rightWall: boolean;
  gap: number;
}

export interface BarResult {
  /** normal forces in the segments [kN] */
  N: [number, number];
  /** stresses [MPa] */
  sigma: [number, number];
  /** elongations [mm] */
  dl: [number, number];
  /** displacement of the joint and of the right end [mm] */
  u1: number;
  u2: number;
  /** contact with the right wall */
  contact: boolean;
  /** reaction of the right wall (compression positive) [kN] */
  RB: number;
  /** left wall reaction, positive pointing left [kN] */
  RA: number;
}

export function solveBar(b: BarInput): BarResult | null {
  const [s1, s2] = b.segs;
  if ([s1, s2].some((s) => !(s.l > 0) || !(s.A > 0) || !(s.E > 0))) return null;
  // compliance [mm/kN]: l / (E A) with E in GPa = kN/mm² → mm/kN
  const f1 = s1.l / (s1.E * s1.A);
  const f2 = s2.l / (s2.E * s2.A);
  const th1 = s1.alpha * 1e-6 * b.dT * s1.l;
  const th2 = s2.alpha * 1e-6 * b.dT * s2.l;
  // segment 2 carries N, segment 1 carries N + F; free end: N = 0
  let N = 0;
  let contact = false;
  const free = b.F * f1 + th1 + th2;
  if (b.rightWall && free > b.gap) {
    contact = true;
    // compatibility: (N + F) f1 + N f2 + th1 + th2 = gap
    N = (b.gap - b.F * f1 - th1 - th2) / (f1 + f2);
  }
  const N1 = N + b.F;
  const dl1 = N1 * f1 + th1;
  const dl2 = N * f2 + th2;
  return {
    N: [N1, N],
    sigma: [(N1 * 1000) / s1.A, (N * 1000) / s2.A],
    dl: [dl1, dl2],
    u1: dl1,
    u2: dl1 + dl2,
    contact,
    RB: contact ? -N : 0,
    RA: N1,
  };
}

// ---------------------------------------------------------------- thin-walled sections

/**
 * Rectangular tube b × h (centre-line dimensions) with wall thickness t, closed or
 * slit open along one wall, under torque Mt. Units: mm, Nmm, G in N/mm².
 */
export function thinWalledTorsion(b: number, h: number, t: number, Mt: number, G: number) {
  const Am = b * h;
  const perim = 2 * (b + h);
  const ItClosed = (4 * Am * Am * t) / perim;
  const tauClosed = Mt / (2 * Am * t);
  const ItOpen = (perim * t ** 3) / 3;
  const tauOpen = (Mt * t) / ItOpen;
  return {
    Am,
    perim,
    ItClosed,
    ItOpen,
    tauClosed,
    tauOpen,
    /** twist per length [rad/mm] */
    thetaClosed: Mt / (G * ItClosed),
    thetaOpen: Mt / (G * ItOpen),
    /** shear flow of the closed tube [N/mm] */
    q: Mt / (2 * Am),
  };
}

/**
 * Thin-walled I-section (centre-line dimensions): flange width b, flange thickness tf,
 * web height h (between flange centre lines), web thickness tw, under shear force Q [N].
 * Returns I_y and the shear stress in the web τ(z) and in the flanges τ(s).
 */
export function iBeamShear(b: number, tf: number, h: number, tw: number, Q: number) {
  const Iy = (tw * h ** 3) / 12 + 2 * b * tf * (h / 2) ** 2;
  const Sflange = b * tf * (h / 2);
  const web = (z: number) => {
    const S = Sflange + (tw / 2) * (h ** 2 / 4 - z * z);
    return (Q * S) / (Iy * tw);
  };
  /** flange: s measured from the tip (0 … b/2) */
  const flange = (s: number) => (Q * s * tf * (h / 2)) / (Iy * tf);
  return { Iy, web, flange, tauMaxWeb: web(0), tauMean: Q / (h * tw) };
}

/** thin-walled channel (U) with uniform t: shear centre at distance e = 3b² / (h + 6b) from the web, away from the flanges */
export const channelShearCentre = (b: number, h: number) => (3 * b * b) / (h + 6 * b);

// ---------------------------------------------------------------- energy methods

/**
 * Cantilever (clamped at x = 0) of length l: deflection at x due to a unit load at a
 * (influence function, = Maxwell's reciprocal function). EI in Nmm², lengths mm.
 */
export function cantileverInfluence(x: number, a: number, EI: number) {
  return x <= a ? (x * x * (3 * a - x)) / (6 * EI) : (a * a * (3 * x - a)) / (6 * EI);
}

/** strain energy of a cantilever with a point load F at a: U = F² a³ / (6 EI); Castigliano: f = ∂U/∂F */
export function cantileverEnergy(F: number, a: number, EI: number) {
  const U = (F * F * a ** 3) / (6 * EI);
  return { U, f: (F * a ** 3) / (3 * EI) };
}

// ---------------------------------------------------------------- buckling

export type EulerCase = 1 | 2 | 3 | 4;
/** buckling-length factor β: l_K = β l */
export const BETA: Record<EulerCase, number> = { 1: 2, 2: 1, 3: 0.6992, 4: 0.5 };

export function euler(c: EulerCase, l: number, E: number, I: number, A: number, sigmaP: number) {
  const lk = BETA[c] * l;
  const Fk = (Math.PI ** 2 * E * I) / (lk * lk);
  const i = Math.sqrt(I / A);
  const lambda = lk / i;
  const lambdaP = Math.PI * Math.sqrt(E / sigmaP);
  return { lk, Fk, i, lambda, lambdaP, sigmaK: Fk / A, valid: lambda >= lambdaP };
}

/** normalised first buckling mode w(ξ), ξ = x/l from the clamped / lower end, max |w| = 1 */
export function bucklingMode(c: EulerCase, xi: number): number {
  switch (c) {
    case 1:
      return 1 - Math.cos((Math.PI / 2) * xi);
    case 2:
      return Math.sin(Math.PI * xi);
    case 3: {
      const kl = 4.4934;
      const w = (s: number) => Math.tan(kl) * (1 - Math.cos(kl * s)) + Math.sin(kl * s) - kl * s;
      return w(xi) / MODE3_MAX;
    }
    case 4:
      return (1 - Math.cos(2 * Math.PI * xi)) / 2;
  }
}

const MODE3_MAX = (() => {
  const kl = 4.4934;
  let m = 0;
  for (let k = 0; k <= 400; k++) {
    const s = k / 400;
    const w = Math.tan(kl) * (1 - Math.cos(kl * s)) + Math.sin(kl * s) - kl * s;
    if (Math.abs(w) > Math.abs(m)) m = w;
  }
  return m;
})();
