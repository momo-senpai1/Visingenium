import { describe, expect, it } from 'vitest';
import { colebrook, fluidProps, frictionFactor, solvePipe, velocityProfile } from '../pipe';

describe('fluid properties', () => {
  it('water 20 °C: ρ = 998.2 kg/m³, μ = 1.002 mPa·s, p_v = 2.34 kPa', () => {
    const f = fluidProps('water', 20);
    expect(f.rho).toBeCloseTo(998.2, 0);
    expect(f.mu * 1000).toBeCloseTo(1.002, 1);
    expect(f.pv / 1000).toBeCloseTo(2.34, 1);
  });
});

describe('friction factor', () => {
  it('laminar 64/Re, transition at Re = 2300', () => {
    expect(frictionFactor(1000, 0).lambda).toBeCloseTo(0.064, 9);
    expect(frictionFactor(2299, 0).regime).toBe('laminar');
    expect(frictionFactor(3000, 0).regime).toBe('transitional');
    expect(frictionFactor(5000, 0).regime).toBe('turbulent');
  });
  it('Colebrook: smooth pipe Re = 1e5 → λ ≈ 0.0180 (Moody chart)', () => expect(colebrook(1e5, 0)).toBeCloseTo(0.018, 3));
  it('Colebrook: k/d = 0.001, Re = 1e6 → λ ≈ 0.0199', () => expect(colebrook(1e6, 0.001)).toBeCloseTo(0.0199, 3));
});

describe('pipe system', () => {
  const base = { fluid: 'water' as const, T: 20, Q: 2, pIn: 3, k: 0.05 };
  it('single straight pipe: Δp = λ L/d ρ w²/2, horizontal', () => {
    const r = solvePipe({ ...base, segments: [{ id: 'a', L: 100, d: 50, dz: 0, zeta: 0, inlet: 'sudden' }] });
    const s = r.segs[0]!;
    expect(r.dpLoss).toBeCloseTo(s.lambda * (100 / 0.05) * 0.5 * r.fluid.rho * s.w ** 2, 6);
    expect(r.pOut).toBeCloseTo(3e5 - r.dpLoss, 6);
  });
  it('Venturi: static pressure drops in the throat and recovers; ideal Bernoulli in the throat', () => {
    const r = solvePipe({
      ...base,
      k: 0,
      segments: [
        { id: 'in', L: 0.001, d: 50, dz: 0, zeta: 0, inlet: 'sudden' },
        { id: 'throat', L: 0.001, d: 25, dz: 0, zeta: 0, inlet: 'smooth' },
        { id: 'out', L: 0.001, d: 50, dz: 0, zeta: 0, inlet: 'smooth' },
      ],
    });
    const w1 = r.segs[0]!.w;
    const w2 = r.segs[1]!.w;
    const pThroat = r.profile.find((q) => q.seg === 1)!.p;
    const ideal = 3e5 - 0.5 * r.fluid.rho * (w2 * w2 - w1 * w1);
    expect(Math.abs(pThroat - ideal) / (0.5 * r.fluid.rho * w2 * w2)).toBeLessThan(0.05);
    expect(r.pOut).toBeGreaterThan(pThroat);
  });
  it('cavitation when the throat pressure falls below the vapour pressure', () => {
    const r = solvePipe({ ...base, Q: 6, pIn: 1.2, segments: [
      { id: 'in', L: 1, d: 50, dz: 0, zeta: 0, inlet: 'sudden' },
      { id: 'throat', L: 0.05, d: 15, dz: 0, zeta: 0, inlet: 'smooth' },
      { id: 'out', L: 1, d: 50, dz: 0, zeta: 0, inlet: 'smooth' },
    ] });
    expect(r.cavitation).toBe(true);
  });
  it('sudden expansion: Borda–Carnot loss (1 − A₁/A₂)² ρw₁²/2', () => {
    const r = solvePipe({ ...base, k: 0, segments: [{ id: 'a', L: 1e-6, d: 25, dz: 0, zeta: 0, inlet: 'sudden' }, { id: 'b', L: 1e-6, d: 50, dz: 0, zeta: 0, inlet: 'sudden' }] });
    const w1 = r.segs[0]!.w;
    expect(r.segs[1]!.dpIn).toBeCloseTo((1 - 0.25) ** 2 * 0.5 * r.fluid.rho * w1 * w1, 6);
  });
  it('velocity profiles have the mean velocity 1 (area average)', () => {
    for (const [reg, Re] of [['laminar', 1000], ['turbulent', 1e5]] as const) {
      let s = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) {
        const r = (i + 0.5) / n;
        s += velocityProfile(reg, Re, r) * 2 * r * (1 / n);
      }
      expect(s).toBeCloseTo(1, 3);
    }
  });
});
