import { describe, expect, it } from 'vitest';
import { rmse, runKalman, steadyGainCv, steadyGainScalar, type KalmanSpec } from '../kalman';

const base: KalmanSpec = { model: 'constant', q: 0.01, r: 1, qf: 0.01, rf: 1, p0: 10, dt: 0.1, n: 400, seed: 7 };

describe('Kalman filter', () => {
  it('steady-state scalar gain solves the Riccati equation', () => {
    const q = 0.04;
    const r = 2;
    const K = steadyGainScalar(q, r);
    // P⁻ = K r /(1 − K); P = (1 − K) P⁻; P⁻ = P + q
    const pp = (K * r) / (1 - K);
    expect((1 - K) * pp + q).toBeCloseTo(pp, 10);
  });

  it('gain converges to the steady state and the variance shrinks below r', () => {
    const s = runKalman(base);
    expect(s[0]!.K).toBeCloseTo(10 / 11, 10); // first update: P₀/(P₀ + r)
    expect(s.at(-1)!.K).toBeCloseTo(steadyGainScalar(base.qf, base.rf), 6);
    expect(s.at(-1)!.pPost).toBeLessThan(base.r);
  });

  it('beats the raw measurements', () => {
    const s = runKalman(base);
    expect(rmse(s, (x) => x.xPost)).toBeLessThan(0.5 * rmse(s, (x) => x.z));
  });

  it('constant-velocity model tracks position and velocity', () => {
    const s = runKalman({ ...base, model: 'cv', q: 0.5, qf: 0.5, r: 0.5, rf: 0.5 });
    expect(rmse(s, (x) => x.xPost)).toBeLessThan(rmse(s, (x) => x.z));
    const tail = s.slice(200);
    const vErr = Math.sqrt(tail.reduce((a, x) => a + (x.vPost - x.v) ** 2, 0) / tail.length);
    expect(vErr).toBeLessThan(1);
    expect(s.at(-1)!.K).toBeCloseTo(steadyGainCv(0.5, 0.5, base.dt), 4);
  });

  it('is deterministic for a seed', () => {
    expect(runKalman(base).at(-1)!.xPost).toBe(runKalman(base).at(-1)!.xPost);
  });
});
