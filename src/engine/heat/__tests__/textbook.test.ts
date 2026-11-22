/**
 * Checks against published tables and textbook results (values as printed in the source).
 * Add worked examples from lectures/exercises here, always with the source next to the test.
 */

import { describe, expect, it } from 'vitest';
import { effectiveness } from '../exchanger';
import { bandFraction, WIEN } from '../radiation';
import { besselJ0, eigenvalues, erf } from '../transient';

describe('Incropera et al., Fundamentals of Heat and Mass Transfer — Table 5.1 (one-term approximation, ζ₁)', () => {
  const cases: [body: 'plate' | 'cylinder' | 'sphere', Bi: number, zeta1: number][] = [
    ['plate', 0.1, 0.3111],
    ['plate', 1.0, 0.8603],
    ['plate', 10, 1.4289],
    ['cylinder', 0.1, 0.4417],
    ['cylinder', 1.0, 1.2558],
    ['sphere', 0.1, 0.5423],
    ['sphere', 1.0, 1.5708],
  ];
  for (const [body, Bi, z] of cases) it(`${body}, Bi = ${Bi}: ζ₁ = ${z}`, () => expect(eigenvalues(body, Bi, 1)[0]!).toBeCloseTo(z, 3));
});

describe('Incropera et al. — Table 12.2 (black-body radiation functions F(0→λT))', () => {
  const cases: [lamT: number, F: number][] = [
    [1000, 0.000321],
    [2898, 0.250],
    [5000, 0.633747],
    [10000, 0.914199],
  ];
  for (const [lamT, F] of cases) it(`λT = ${lamT} µm·K: F = ${F}`, () => expect(bandFraction(lamT)).toBeCloseTo(F, 3));
  it('Wien displacement constant 2897.8 µm·K', () => expect(WIEN).toBeCloseTo(2897.8, 1));
});

describe('Incropera et al. — Table 11.3 (effectiveness of a counter-flow exchanger)', () => {
  it('NTU = 2, C_r = 0.5: ε = (1 − e^{−1})/(1 − 0.5 e^{−1}) = 0.7746', () => expect(effectiveness('counter', 2, 0.5)).toBeCloseTo(0.7746, 4));
  it('C_r = 1: ε = NTU/(1 + NTU)', () => expect(effectiveness('counter', 3, 1)).toBeCloseTo(0.75, 4));
});

describe('Abramowitz & Stegun, Handbook of Mathematical Functions — Tables 7.1 and 9.5', () => {
  it('error function: erf(0.5) = 0.5205, erf(1) = 0.8427, erf(2) = 0.9953', () => {
    expect(erf(0.5)).toBeCloseTo(0.5205, 4);
    expect(erf(1)).toBeCloseTo(0.8427, 4);
    expect(erf(2)).toBeCloseTo(0.9953, 4);
  });
  it('zeros of J₀: 2.4048, 5.5201', () => {
    expect(Math.abs(besselJ0(2.4048))).toBeLessThan(1e-4);
    expect(Math.abs(besselJ0(5.5201))).toBeLessThan(1e-4);
  });
});
