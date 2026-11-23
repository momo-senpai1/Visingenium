/**
 * Engineering Mechanics 3 (dynamics) helpers for the explainer pages:
 * particle kinematics in natural coordinates, the slider-crank with its
 * instantaneous centre, rolling bodies on an incline, central impact and the
 * single-degree-of-freedom oscillator.
 */

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- particle kinematics

/** particle on an ellipse x = a cos ωt, y = b sin ωt: velocity, acceleration, tangential/normal split */
export function ellipseMotion(a: number, b: number, omega: number, t: number) {
  const p = omega * t;
  const x = a * Math.cos(p);
  const y = b * Math.sin(p);
  const vx = -a * omega * Math.sin(p);
  const vy = b * omega * Math.cos(p);
  const ax = -a * omega * omega * Math.cos(p);
  const ay = -b * omega * omega * Math.sin(p);
  const v = Math.hypot(vx, vy);
  const at = v > 1e-12 ? (vx * ax + vy * ay) / v : 0;
  const cross = vx * ay - vy * ax;
  const an = v > 1e-12 ? Math.abs(cross) / v : Math.hypot(ax, ay);
  const rho = Math.abs(cross) > 1e-12 ? v ** 3 / Math.abs(cross) : Infinity;
  // polar components: radial and circumferential
  const r = Math.hypot(x, y);
  const er = r > 1e-12 ? [x / r, y / r] : [1, 0];
  const ephi = [-er[1]!, er[0]!];
  return {
    x,
    y,
    vx,
    vy,
    ax,
    ay,
    v,
    a: Math.hypot(ax, ay),
    at,
    an,
    rho,
    vr: vx * er[0]! + vy * er[1]!,
    vphi: vx * ephi[0]! + vy * ephi[1]!,
    ar: ax * er[0]! + ay * er[1]!,
    aphi: ax * ephi[0]! + ay * ephi[1]!,
  };
}

// ---------------------------------------------------------------- slider-crank

/** crank radius r, connecting rod l, crank angle φ [°], crank speed ω [rad/s] */
export function sliderCrank(r: number, l: number, phiDeg: number, omega: number) {
  const p = phiDeg * DEG;
  const A = { x: r * Math.cos(p), y: r * Math.sin(p) };
  const root = Math.sqrt(Math.max(0, l * l - (r * Math.sin(p)) ** 2));
  const B = { x: A.x + root, y: 0 };
  const vA = omega * r;
  // instantaneous centre of the rod: on the line O–A (v_A ⟂ OA) and on the vertical through B (v_B horizontal)
  let IC: { x: number; y: number } | null = null;
  let omegaRod = 0;
  let vB: number;
  if (Math.abs(Math.cos(p)) > 1e-6) {
    const s = B.x / A.x;
    IC = { x: B.x, y: s * A.y };
    const dA = Math.hypot(IC.x - A.x, IC.y - A.y);
    omegaRod = dA > 1e-12 ? vA / dA : 0;
    vB = omegaRod * Math.abs(IC.y);
  } else {
    // crank vertical: the rod translates instantaneously
    vB = vA;
  }
  // signed slider velocity from differentiation: ẋ_B = −r ω sin φ (1 + r cos φ / root)
  const vBsigned = -r * omega * Math.sin(p) * (1 + (r * Math.cos(p)) / (root || 1e-12));
  return { A, B, IC, vA, omegaRod, /** |v_B| from the instantaneous centre */ vBic: vB, /** signed slider velocity (positive to the right) */ vB: vBsigned };
}

// ---------------------------------------------------------------- rolling body

export type BodyKind = 'cylinder' | 'ring' | 'sphere' | 'shell';
/** J_S = k m r² */
export const K_BODY: Record<BodyKind, number> = { cylinder: 0.5, ring: 1, sphere: 0.4, shell: 2 / 3 };

export function rolling(kind: BodyKind, alphaDeg: number, mu0: number, mu: number, g = 9.81) {
  const k = K_BODY[kind];
  const a_ = alphaDeg * DEG;
  // rolling without slipping: m a = m g sin α − R, J_S α̇ = R r, a = r α̇ → a = g sin α / (1 + k), R = k m a
  const aRoll = (g * Math.sin(a_)) / (1 + k);
  const Rneed = k * aRoll; // per unit mass
  const Rmax = mu0 * g * Math.cos(a_);
  const rolls = Rneed <= Rmax + 1e-12;
  if (rolls) return { k, rolls, a: aRoll, alphaR: aRoll, R: Rneed, tanLimit: ((1 + k) / k) * mu0 };
  // sliding while spinning up: translation and rotation decouple
  const R = mu * g * Math.cos(a_);
  return { k, rolls, a: g * Math.sin(a_) - R, alphaR: R / k, R, tanLimit: ((1 + k) / k) * mu0 };
}

// ---------------------------------------------------------------- impact

export function impact(m1: number, v1: number, m2: number, v2: number, e: number) {
  const M = m1 + m2;
  const vS = (m1 * v1 + m2 * v2) / M;
  const u1 = vS - (e * m2 * (v1 - v2)) / M;
  const u2 = vS + (e * m1 * (v1 - v2)) / M;
  const E0 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const E1 = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  // impulse transferred to body 2 during the impact
  const P = m2 * (u2 - v2);
  return { u1, u2, vS, E0, E1, loss: E0 - E1, P, approaching: v1 > v2 };
}

// ---------------------------------------------------------------- 1-DOF oscillator

export interface Oscillator {
  m: number;
  c: number;
  d: number;
}

export function oscParams({ m, c, d }: Oscillator) {
  const w0 = Math.sqrt(c / m);
  const delta = d / (2 * m);
  const D = delta / w0;
  const wd = D < 1 ? w0 * Math.sqrt(1 - D * D) : 0;
  return { w0, f0: w0 / (2 * Math.PI), delta, D, wd, T: wd > 0 ? (2 * Math.PI) / wd : Infinity };
}

/** amplitude ratio x̂ / (F̂/c) and phase lag ψ [°] at η = Ω/ω₀ */
export function magnification(eta: number, D: number) {
  const V = 1 / Math.sqrt((1 - eta * eta) ** 2 + (2 * D * eta) ** 2);
  const psi = Math.atan2(2 * D * eta, 1 - eta * eta) / DEG;
  return { V, psi };
}

/** time response of m ẍ + d ẋ + c x = F̂ cos Ωt (RK4) */
export function simulate(o: Oscillator, x0: number, v0: number, F: number, Omega: number, tEnd: number, n = 800) {
  const h = tEnd / n;
  const f = (t: number, x: number, v: number) => (F * Math.cos(Omega * t) - o.d * v - o.c * x) / o.m;
  const out: { t: number; x: number; v: number }[] = [{ t: 0, x: x0, v: v0 }];
  let x = x0;
  let v = v0;
  for (let i = 0; i < n; i++) {
    const t = i * h;
    const k1x = v;
    const k1v = f(t, x, v);
    const k2x = v + (h / 2) * k1v;
    const k2v = f(t + h / 2, x + (h / 2) * k1x, v + (h / 2) * k1v);
    const k3x = v + (h / 2) * k2v;
    const k3v = f(t + h / 2, x + (h / 2) * k2x, v + (h / 2) * k2v);
    const k4x = v + h * k3v;
    const k4v = f(t + h, x + h * k3x, v + h * k3v);
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    out.push({ t: t + h, x, v });
  }
  return out;
}
