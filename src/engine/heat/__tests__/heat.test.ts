import { describe, expect, it } from 'vitest';
import { criticalRadius, solveFin, solveWall } from '../conduction';
import { convection, props } from '../convection';
import { fuller, penetration, stefan } from '../diffusion';
import { effectiveness, solveHX } from '../exchanger';
import { bandFraction, exchange, planck, shields, SIGMA, viewFactor, WIEN } from '../radiation';
import { besselJ0, besselJ1, eigenvalues, erf, semiInfinite, seriesTheta } from '../transient';

describe('conduction', () => {
  it('plane two-layer wall with convection: resistances in series', () => {
    const r = solveWall({
      geometry: 'plane',
      layers: [{ id: 'a', name: 'brick', s: 0.24, lambda: 0.8 }, { id: 'b', name: 'insulation', s: 0.1, lambda: 0.04 }],
      A: 1, L: 1, ri: 0, Ti: 20, Ta: -10, alphaI: 8, alphaA: 25,
    });
    const R = 1 / 8 + 0.24 / 0.8 + 0.1 / 0.04 + 1 / 25;
    expect(r.Rtot).toBeCloseTo(R, 12);
    expect(r.Q).toBeCloseTo(30 / R, 9);
    expect(r.k).toBeCloseTo(1 / R, 12);
    expect(r.temps.at(-1)).toBeCloseTo(-10 + (30 / R) / 25, 9);
  });
  it('insulated pipe: ln(r2/r1)/(2πλL)', () => {
    const r = solveWall({ geometry: 'cylinder', layers: [{ id: 'i', name: 'ins', s: 0.05, lambda: 0.05 }], A: 1, L: 2, ri: 0.05, Ti: 150, Ta: 20, alphaI: 0, alphaA: 10 });
    const R = Math.log(0.1 / 0.05) / (2 * Math.PI * 0.05 * 2) + 1 / (10 * 2 * Math.PI * 0.1 * 2);
    expect(r.Q).toBeCloseTo(130 / R, 9);
    expect(criticalRadius('cylinder', 0.05, 10)).toBeCloseTo(0.005);
  });
  it('adiabatic-tip fin: Q = √(αUλA)·θ0·tanh(mL)', () => {
    const f = solveFin({ shape: 'pin', d: 0.005, w: 0, L: 0.05, lambda: 200, alpha: 25, Tb: 100, Tinf: 25, tip: 'adiabatic' });
    const U = Math.PI * 0.005;
    const A = (Math.PI * 0.005 ** 2) / 4;
    const m = Math.sqrt((25 * U) / (200 * A));
    expect(f.Q).toBeCloseTo(Math.sqrt(25 * U * 200 * A) * 75 * Math.tanh(m * 0.05), 9);
    expect(f.eta).toBeCloseTo(Math.tanh(m * 0.05) / (m * 0.05), 9);
    expect(f.profile[0]!.T).toBeCloseTo(100, 9);
  });
});

describe('transient conduction', () => {
  it('special functions', () => {
    expect(erf(0.5)).toBeCloseTo(0.5204999, 6);
    expect(besselJ0(2.4048255577)).toBeCloseTo(0, 6);
    expect(besselJ1(1)).toBeCloseTo(0.4400506, 6);
  });
  it('plate eigenvalue for Bi = 1 is 0.8603; centre θ at Fo = 0 is 1', () => {
    expect(eigenvalues('plate', 1)[0]).toBeCloseTo(0.8603, 4);
    expect(eigenvalues('cylinder', 1)[0]).toBeCloseTo(1.2558, 4);
    expect(eigenvalues('sphere', 1)[0]).toBeCloseTo(1.5708, 4);
    expect(seriesTheta('plate', 1, 1e-4, 0)).toBeCloseTo(1, 3);
    // one-term check at Fo = 0.5: C1 = 1.1191 for Bi = 1
    expect(seriesTheta('plate', 1, 0.5, 0)).toBeCloseTo(1.1191 * Math.exp(-(0.8603 ** 2) * 0.5), 3);
  });
  it('semi-infinite body: surface at Ts, profile follows erf', () => {
    const a = 1e-6;
    expect(semiInfinite(0, 100, a, 20, 100, null, 1)).toBeCloseTo(100, 9);
    expect(semiInfinite(2 * Math.sqrt(a * 100) * 0.5, 100, a, 20, 100, null, 1)).toBeCloseTo(100 + (20 - 100) * erf(0.5), 9);
  });
});

describe('convection', () => {
  it('air properties at 20 °C', () => {
    const p = props('air', 20);
    expect(p.nu).toBeCloseTo(15.35e-6, 9);
    expect(p.Pr).toBeCloseTo(0.709, 3);
  });
  it('laminar plate: Nu = 0.664 Re^½ Pr^⅓', () => {
    const r = convection({ kind: 'plate', fluid: 'air', Tf: 20, Tw: 20, u: 2, L: 0.5, Lpipe: 1, b: 1 });
    const p = props('air', 20);
    const Re = (2 * 0.5) / p.nu;
    expect(r.Nu).toBeCloseTo(0.664 * Math.sqrt(Re) * Math.cbrt(p.Pr), 9);
  });
  it('turbulent pipe flow: Gnielinski gives Nu ~ 100–300 for water at Re 5·10⁴', () => {
    const r = convection({ kind: 'pipe', fluid: 'water', Tf: 40, Tw: 60, u: 1.65, L: 0.02, Lpipe: 5, b: 5 });
    expect(r.regime).toBe('turbulent');
    expect(r.Nu).toBeGreaterThan(100);
    expect(r.Nu).toBeLessThan(400);
  });
});

describe('radiation', () => {
  it('Planck integrates to σT⁴ and peaks at Wien', () => {
    const T = 1500;
    let s = 0;
    for (let l = 0.05; l < 200; l += 0.01) s += planck(l, T) * 0.01;
    expect(s / (SIGMA * T ** 4)).toBeCloseTo(1, 3);
    expect(bandFraction(WIEN)).toBeCloseTo(0.25, 2);
  });
  it('gray parallel plates and shields', () => {
    const r = exchange('plates', 600, 300, 0.8, 0.8);
    expect(r.q).toBeCloseTo((SIGMA * (600 ** 4 - 300 ** 4)) / (1 / 0.8 + 1 / 0.8 - 1), 6);
    expect(shields(600, 300, 0.8, 0.8, 1, 0.8)).toBeCloseTo(r.q / 2, 6);
  });
  it('view factors: coaxial equal disks and parallel squares', () => {
    expect(viewFactor('disks', 1, 1, 1)).toBeCloseTo(0.382, 3);
    expect(viewFactor('parallelRect', 1, 1, 1)).toBeCloseTo(0.1998, 3);
    expect(viewFactor('perpRect', 1, 1, 1)).toBeCloseTo(0.2, 3);
  });
});

describe('heat exchanger', () => {
  it('ε–NTU limits and energy balance', () => {
    expect(effectiveness('counter', 1, 1)).toBeCloseTo(0.5, 9);
    expect(effectiveness('parallel', 1e3, 1)).toBeCloseTo(0.5, 6);
    const r = solveHX({ flow: 'counter', mh: 1, cph: 4180, Th1: 90, mc: 2, cpc: 4180, Tc1: 15, k: 1000, A: 10 });
    expect(r.Q).toBeCloseTo(1 * 4180 * (90 - r.Th2), 6);
    expect(r.Q).toBeCloseTo(1000 * 10 * r.dTlm, 3);
    expect(r.profile[0]!.Th).toBeCloseTo(90, 6);
    expect(r.profile[100]!.Tc).toBeCloseTo(15, 6);
    const p = solveHX({ flow: 'parallel', mh: 1, cph: 4180, Th1: 90, mc: 2, cpc: 4180, Tc1: 15, k: 1000, A: 10 });
    expect(p.Q).toBeCloseTo(1000 * 10 * p.dTlm, 3);
    expect(p.profile[100]!.Th).toBeCloseTo(p.Th2, 6);
  });
});

describe('mass transfer', () => {
  it('Fuller: water vapour in air ≈ 2.5·10⁻⁵ m²/s at 25 °C', () => {
    expect(fuller('H2O', 'air', 298.15, 1.01325)).toBeGreaterThan(2.2e-5);
    expect(fuller('H2O', 'air', 298.15, 1.01325)).toBeLessThan(2.9e-5);
  });
  it('Stefan flow enhances the flux by ln((1−yL)/(1−y0))/(y0−yL)', () => {
    const r = stefan(2.5e-5, 300, 1, 0.1, 0.5, 0);
    expect(r.factor).toBeCloseTo(Math.log(1 / 0.5) / 0.5, 9);
    expect(r.profile[0]!.yStefan).toBeCloseTo(0.5, 12);
    expect(r.profile[50]!.yStefan).toBeCloseTo(0, 12);
  });
  it('penetration profile', () => {
    expect(penetration(0, 10, 1e-9, 1, 0)).toBeCloseTo(1, 9);
  });
});
