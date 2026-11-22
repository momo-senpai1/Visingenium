/**
 * Discrete Kalman filter for two textbook models, plus a seeded simulation of the true
 * signal and its noisy measurements.
 *
 *  - 'constant': scalar random walk   x_k = x_{k−1} + w,           z_k = x_k + v
 *  - 'cv':       position + velocity  x_k = F x_{k−1} + G a,  F = [[1, Δt], [0, 1]], G = [Δt²/2, Δt]
 *                                     z_k = position + v
 *
 * w ~ N(0, q) (for 'cv': acceleration a ~ N(0, q)), v ~ N(0, r).
 */

export type KalmanModel = 'constant' | 'cv';

export interface KalmanSpec {
  model: KalmanModel;
  /** process-noise variance q (random-walk step, or acceleration for 'cv') */
  q: number;
  /** measurement-noise variance r */
  r: number;
  /** variances the filter *assumes* (may differ from the true ones to show mistuning) */
  qf: number;
  rf: number;
  /** initial estimate variance P₀ */
  p0: number;
  /** time step Δt [s] */
  dt: number;
  /** number of steps */
  n: number;
  seed: number;
}

export interface KalmanStep {
  k: number;
  t: number;
  /** true position */
  x: number;
  /** measurement */
  z: number;
  /** prediction (prior) and its variance */
  xPrior: number;
  pPrior: number;
  /** Kalman gain (position component) */
  K: number;
  /** innovation z − H x⁻ */
  innov: number;
  /** estimate (posterior) and its variance */
  xPost: number;
  pPost: number;
  /** velocity estimate ('cv' only) and true velocity */
  vPost: number;
  v: number;
  /** first-order low-pass y_k = y_{k−1} + α (z_k − y_{k−1}) with α = the steady-state gain, for comparison */
  lowpass: number;
}

/** small seeded PRNG (mulberry32) and a normal sampler (Box–Muller) */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u1 = Math.max(u(), 1e-12);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u());
  };
}

/** steady-state Kalman gain of the scalar random walk: P⁻ = P + q, K = P⁻/(P⁻ + r), P = (1 − K) P⁻ */
export function steadyGainScalar(q: number, r: number) {
  if (r <= 0) return 1;
  if (q <= 0) return 0;
  // P⁻² − q P⁻ − q r = 0
  const pp = (q + Math.sqrt(q * q + 4 * q * r)) / 2;
  return pp / (pp + r);
}

export function runKalman(s: KalmanSpec): KalmanStep[] {
  const nrm = rng(s.seed);
  const sq = Math.sqrt(Math.max(0, s.q));
  const sr = Math.sqrt(Math.max(0, s.r));
  const dt = s.dt;
  const out: KalmanStep[] = [];
  // truth
  let x = 0;
  let v = s.model === 'cv' ? 1 : 0;
  // filter state: [p, vel], covariance [[a, b], [b, c]]
  let xh = 0;
  let vh = 0;
  let Pa = s.p0;
  let Pb = 0;
  let Pc = s.model === 'cv' ? s.p0 : 0;
  // comparison low-pass, α from the steady-state gain (computed by running the Riccati recursion)
  const alpha = s.model === 'constant' ? steadyGainScalar(s.qf, s.rf) : steadyGainCv(s.qf, s.rf, dt);
  let lp = 0;
  for (let k = 0; k < s.n; k++) {
    // --- truth and measurement
    if (k > 0) {
      if (s.model === 'constant') x += sq * nrm();
      else {
        const a = sq * nrm();
        x += v * dt + 0.5 * a * dt * dt;
        v += a * dt;
      }
    }
    const z = x + sr * nrm();
    // --- predict
    let xPrior = xh;
    let vPrior = vh;
    let a = Pa;
    let b = Pb;
    let c = Pc;
    if (k > 0) {
      if (s.model === 'constant') a = Pa + s.qf;
      else {
        xPrior = xh + vh * dt;
        vPrior = vh;
        // F P Fᵀ + G q Gᵀ
        const g1 = (dt * dt) / 2;
        const g2 = dt;
        a = Pa + 2 * dt * Pb + dt * dt * Pc + s.qf * g1 * g1;
        b = Pb + dt * Pc + s.qf * g1 * g2;
        c = Pc + s.qf * g2 * g2;
      }
    }
    // --- update (H = [1, 0])
    const S = a + s.rf;
    const K = S > 0 ? a / S : 0;
    const K2 = S > 0 ? b / S : 0;
    const innov = z - xPrior;
    xh = xPrior + K * innov;
    vh = vPrior + K2 * innov;
    Pa = (1 - K) * a;
    Pb = (1 - K) * b;
    Pc = c - K2 * b;
    lp = k === 0 ? z : lp + alpha * (z - lp);
    out.push({ k, t: k * dt, x, z, xPrior, pPrior: a, K, innov, xPost: xh, pPost: Pa, vPost: vh, v, lowpass: lp });
  }
  return out;
}

/** steady-state position gain of the constant-velocity filter (Riccati recursion to convergence) */
export function steadyGainCv(q: number, r: number, dt: number) {
  let a = 1e3;
  let b = 0;
  let c = 1e3;
  let K = 1;
  for (let i = 0; i < 2000; i++) {
    const g1 = (dt * dt) / 2;
    const pa = a + 2 * dt * b + dt * dt * c + q * g1 * g1;
    const pb = b + dt * c + q * g1 * dt;
    const pc = c + q * dt * dt;
    const S = pa + r;
    const Kn = S > 0 ? pa / S : 0;
    const K2 = S > 0 ? pb / S : 0;
    a = (1 - Kn) * pa;
    b = (1 - Kn) * pb;
    c = pc - K2 * pb;
    if (Math.abs(Kn - K) < 1e-12) return Kn;
    K = Kn;
  }
  return K;
}

/** root-mean-square error of a series against the truth */
export function rmse(steps: KalmanStep[], pick: (s: KalmanStep) => number) {
  if (!steps.length) return 0;
  return Math.sqrt(steps.reduce((acc, s) => acc + (pick(s) - s.x) ** 2, 0) / steps.length);
}
