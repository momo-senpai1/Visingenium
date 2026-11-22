import { describe, expect, it } from 'vitest';
import { binodal, gasMixture, lnGamma, spinodal, ucst } from '../mixtures';

describe('ideal gas mixture', () => {
  it('air-like 79/21: M ≈ 28.85, mixing entropy −R Σ n ln x', () => {
    const r = gasMixture([{ name: 'N2', n: 0.79, M: 28.01, cp: 29.1 }, { name: 'O2', n: 0.21, M: 32, cp: 29.4 }], 1, 298.15);
    expect(r.M).toBeCloseTo(28.85, 2);
    expect(r.dS).toBeCloseTo(-8.314462618 * (0.79 * Math.log(0.79) + 0.21 * Math.log(0.21)), 9);
    expect(r.pPart[1]).toBeCloseTo(0.21, 9);
  });
});

describe('miscibility gap (Margules)', () => {
  it('symmetric model: UCST at A = 2, i.e. T_c = a/2', () => {
    expect(ucst({ a12: 1000, a21: 1000 })!).toBeCloseTo(500, 1);
  });
  it('symmetric model: binodal is symmetric and satisfies ln(x/(1−x)) = A(2x − 1)', () => {
    const T = 400;
    const [a, b] = binodal({ a12: 1000, a21: 1000 }, T)!;
    expect(a + b).toBeCloseTo(1, 6);
    expect(Math.log(a / (1 - a))).toBeCloseTo((1000 / T) * (2 * a - 1), 6);
  });
  it('binodal lies outside the spinodal; equal activities in both phases', () => {
    const m = { a12: 900, a21: 1300 };
    const T = 380;
    const [a, b] = binodal(m, T)!;
    const [s1, s2] = spinodal(m, T)!;
    expect(a).toBeLessThan(s1);
    expect(b).toBeGreaterThan(s2);
    const ga = lnGamma(m, T, a);
    const gb = lnGamma(m, T, b);
    expect(Math.log(a) + ga.g1).toBeCloseTo(Math.log(b) + gb.g1, 6);
    expect(Math.log(1 - a) + ga.g2).toBeCloseTo(Math.log(1 - b) + gb.g2, 6);
  });
  it('above the UCST the mixture is stable', () => {
    expect(binodal({ a12: 1000, a21: 1000 }, 520)).toBeNull();
  });
});
