/**
 * Engineering Mechanics 1 (statics) helpers for the explainer pages:
 * plane force systems, friction on an incline, rope friction, composite
 * cross-sections (centroid, second moments, principal axes) and the principle
 * of virtual work on a toggle press.
 *
 * Plane coordinates: x to the right, y upward (forces); cross-sections use the
 * convention y to the right, z downward, I_yz = −∫ y z dA.
 */

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- force systems

export interface PlaneForce {
  /** point of application [m] */
  x: number;
  y: number;
  /** magnitude [N] and direction [°] measured counter-clockwise from +x */
  F: number;
  angle: number;
}

export interface ForceSystem {
  Rx: number;
  Ry: number;
  R: number;
  /** direction of the resultant [°] */
  angle: number;
  /** resultant moment about the reference point (counter-clockwise positive) [Nm] */
  M: number;
  /**
   * a point on the line of action of the resultant, closest to the reference point;
   * null when R = 0 (the system reduces to a couple or is in equilibrium)
   */
  line: { x: number; y: number } | null;
}

export const components = (f: PlaneForce) => ({ Fx: f.F * Math.cos(f.angle * DEG), Fy: f.F * Math.sin(f.angle * DEG) });

/** Reduce a plane force system to the resultant at the reference point (px, py). */
export function reduceForces(forces: PlaneForce[], px = 0, py = 0): ForceSystem {
  let Rx = 0;
  let Ry = 0;
  let M = 0;
  for (const f of forces) {
    const { Fx, Fy } = components(f);
    Rx += Fx;
    Ry += Fy;
    M += (f.x - px) * Fy - (f.y - py) * Fx;
  }
  Rx = clean(Rx);
  Ry = clean(Ry);
  M = clean(M);
  const R = Math.hypot(Rx, Ry);
  // line of action: r × R = M, the point closest to P is P + (R × M)/R²
  const line = R > 1e-9 ? { x: px + (Ry * M) / (R * R), y: py - (Rx * M) / (R * R) } : null;
  return { Rx, Ry, R, angle: R > 1e-9 ? Math.atan2(Ry, Rx) / DEG : 0, M, line };
}

// ---------------------------------------------------------------- friction

export interface InclineInput {
  /** mass [kg], incline angle [°], static and sliding friction coefficient, pulling force up the slope [N] */
  m: number;
  alpha: number;
  mu0: number;
  mu: number;
  F: number;
  g?: number;
}

export interface InclineResult {
  N: number;
  /** downhill component of the weight [N] */
  G_t: number;
  /** friction force needed for rest, positive up the slope [N] */
  R_req: number;
  /** limit of static friction μ₀N */
  R_max: number;
  state: 'rest' | 'up' | 'down';
  /** friction force actually acting (positive up the slope) [N] */
  R: number;
  /** acceleration up the slope [m/s²] */
  a: number;
  /** range of the pulling force for which the block stays at rest */
  Fmin: number;
  Fmax: number;
  /** self-locking: the block stays on the slope without any force */
  selfLocking: boolean;
}

export function incline({ m, alpha, mu0, mu, F, g = 9.81 }: InclineInput): InclineResult {
  const a_ = alpha * DEG;
  const G = m * g;
  const N = G * Math.cos(a_);
  const G_t = G * Math.sin(a_);
  const R_req = G_t - F;
  const R_max = mu0 * N;
  const Fmin = Math.max(0, G * (Math.sin(a_) - mu0 * Math.cos(a_)));
  const Fmax = G * (Math.sin(a_) + mu0 * Math.cos(a_));
  const selfLocking = Math.tan(a_) <= mu0 + 1e-12;
  if (Math.abs(R_req) <= R_max + 1e-9) return { N, G_t, R_req, R_max, state: 'rest', R: R_req, a: 0, Fmin, Fmax, selfLocking };
  const state = F > G_t ? 'up' : 'down';
  // sliding friction opposes the motion
  const R = state === 'up' ? -mu * N : mu * N;
  return { N, G_t, R_req, R_max, state, R, a: (F - G_t + R) / m, Fmin, Fmax, selfLocking };
}

/** Euler–Eytelwein: largest ratio S₂/S₁ a rope can hold over a drum (wrap angle in degrees). */
export const ropeRatio = (mu: number, wrapDeg: number) => Math.exp(mu * wrapDeg * DEG);

// ---------------------------------------------------------------- cross-sections

/** rectangle with its centre at (y, z); sign −1 cuts a hole */
export interface Rect {
  y: number;
  z: number;
  b: number;
  h: number;
  sign?: 1 | -1;
}

export interface SectionResult {
  A: number;
  /** centroid */
  yS: number;
  zS: number;
  /** second moments about the centroidal axes */
  Iy: number;
  Iz: number;
  Iyz: number;
  /** principal moments and the angle of the 1-axis to the y-axis [°] */
  I1: number;
  I2: number;
  phi: number;
  /** per-part contributions for the Steiner table */
  parts: { A: number; y: number; z: number; Iy0: number; Iz0: number; dz: number; dy: number; Iy: number; Iz: number; Iyz: number }[];
}

export function section(rects: Rect[]): SectionResult | null {
  const valid = rects.filter((r) => r.b > 0 && r.h > 0);
  if (!valid.length) return null;
  const A = valid.reduce((s, r) => s + (r.sign ?? 1) * r.b * r.h, 0);
  if (!(A > 1e-12)) return null;
  const yS = valid.reduce((s, r) => s + (r.sign ?? 1) * r.b * r.h * r.y, 0) / A;
  const zS = valid.reduce((s, r) => s + (r.sign ?? 1) * r.b * r.h * r.z, 0) / A;
  const parts = valid.map((r) => {
    const sg = r.sign ?? 1;
    const Ai = sg * r.b * r.h;
    const Iy0 = (sg * r.b * r.h ** 3) / 12;
    const Iz0 = (sg * r.h * r.b ** 3) / 12;
    const dy = r.y - yS;
    const dz = r.z - zS;
    // Steiner: I = I_own + A·d², I_yz = −A·dy·dz (own I_yz of a rectangle is zero)
    return { A: Ai, y: r.y, z: r.z, Iy0, Iz0, dy, dz, Iy: Iy0 + Ai * dz * dz, Iz: Iz0 + Ai * dy * dy, Iyz: -Ai * dy * dz };
  });
  const Iy = parts.reduce((s, p) => s + p.Iy, 0);
  const Iz = parts.reduce((s, p) => s + p.Iz, 0);
  const Iyz = clean(parts.reduce((s, p) => s + p.Iyz, 0), Iy + Iz);
  const { I1, I2, phi } = principal(Iy, Iz, Iyz);
  return { A, yS, zS, Iy, Iz, Iyz, I1, I2, phi, parts };
}

/** principal second moments (I₁ ≥ I₂) and the angle φ* of the 1-axis: tan 2φ* = 2 I_yz / (I_y − I_z) */
export function principal(Iy: number, Iz: number, Iyz: number) {
  const m = (Iy + Iz) / 2;
  const r = Math.hypot((Iy - Iz) / 2, Iyz);
  const phi = (0.5 * Math.atan2(2 * Iyz, Iy - Iz)) / DEG;
  return { I1: m + r, I2: m - r, phi };
}

export type ProfileKind = 'rect' | 'T' | 'I' | 'L' | 'U' | 'box';

/** standard profiles from outer width b, height h and wall thickness t [mm], built from rectangles */
export function profile(kind: ProfileKind, b: number, h: number, t: number): Rect[] {
  const tt = Math.max(0.1, Math.min(t, b / 2, h / 2));
  switch (kind) {
    case 'rect':
      return [{ y: 0, z: 0, b, h }];
    case 'T':
      return [
        { y: 0, z: tt / 2, b, h: tt },
        { y: 0, z: tt + (h - tt) / 2, b: tt, h: h - tt },
      ];
    case 'I':
      return [
        { y: 0, z: tt / 2, b, h: tt },
        { y: 0, z: h / 2, b: tt, h: h - 2 * tt },
        { y: 0, z: h - tt / 2, b, h: tt },
      ];
    case 'L':
      return [
        { y: tt / 2, z: h / 2, b: tt, h },
        { y: tt + (b - tt) / 2, z: h - tt / 2, b: b - tt, h: tt },
      ];
    case 'U':
      return [
        { y: tt / 2, z: h / 2, b: tt, h },
        { y: tt + (b - tt) / 2, z: tt / 2, b: b - tt, h: tt },
        { y: tt + (b - tt) / 2, z: h - tt / 2, b: b - tt, h: tt },
      ];
    case 'box':
      return [
        { y: 0, z: h / 2, b, h },
        { y: 0, z: h / 2, b: b - 2 * tt, h: h - 2 * tt, sign: -1 },
      ];
  }
}

// ---------------------------------------------------------------- virtual work

/**
 * Toggle press: two bars of length l meet in a hinge at height l·sin α; a vertical force F
 * pushes the hinge down. The principle of virtual work gives the horizontal press force
 * H = F / (2 tan α) without cutting the system apart.
 */
export function togglePress(F: number, alphaDeg: number, l: number) {
  const a = alphaDeg * DEG;
  const H = F / (2 * Math.tan(a));
  // virtual displacements for δα: hinge δz = l cos α δα (downward when α decreases), slider δx = 2 l sin α δα
  return { H, dz: l * Math.cos(a), dx: 2 * l * Math.sin(a), ratio: H / F };
}

const clean = (v: number, scale = 1) => (Math.abs(v) < 1e-9 * Math.max(1, Math.abs(scale)) ? 0 : v);
