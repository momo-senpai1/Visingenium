import { describe, expect, it } from 'vitest';
import { AIR, carnot, diesel, joule, otto, rankine } from '../cycles';

const closes = (r: ReturnType<typeof carnot>) => {
  // exergy balance: supplied exergy = net work + all losses
  const lossSum = r.losses.reduce((a, l) => a + l.loss, 0);
  expect(r.wNet + lossSum).toBeCloseTo(r.exIn, 3);
};

describe('ideal-gas cycles', () => {
  it('Carnot: η = 1 − T_L/T_H, no exergy loss for T_src = T_H, T_L = T₀', () => {
    const r = carnot({ TL: 300, TH: 900, p1: 100, ds: 0.5, T0: 300 });
    expect(r.eta).toBeCloseTo(2 / 3, 9);
    expect(r.wNet).toBeCloseTo(600 * 0.5, 9);
    expect(r.losses.reduce((a, l) => a + l.loss, 0)).toBeCloseTo(0, 9);
    expect(r.etaEx).toBeCloseTo(1, 9);
    closes(r);
  });
  it('Joule ideal: η = 1 − Π^(−(κ−1)/κ)', () => {
    const r = joule({ T1: 288, p1: 100, pr: 10, T3: 1400, etaC: 1, etaT: 1, T0: 288, Tsrc: 2000 });
    expect(r.eta).toBeCloseTo(1 - 10 ** (-(AIR.k - 1) / AIR.k), 9);
    closes(r);
  });
  it('Joule with losses: lower efficiency, exergy balance still closes', () => {
    const r = joule({ T1: 288, p1: 100, pr: 10, T3: 1400, etaC: 0.85, etaT: 0.9, T0: 288, Tsrc: 2000 });
    expect(r.eta).toBeLessThan(1 - 10 ** (-(AIR.k - 1) / AIR.k));
    expect(r.losses.find((l) => l.name === 'Compressor')!.loss).toBeGreaterThan(0);
    closes(r);
  });
  it('Otto: η = 1 − ε^(1−κ)', () => {
    const r = otto({ T1: 300, p1: 100, eps: 10, T3: 2200, T0: 300, Tsrc: 2500 });
    expect(r.eta).toBeCloseTo(1 - 10 ** (1 - AIR.k), 9);
    closes(r);
  });
  it('Diesel: η from ε and cut-off ratio φ', () => {
    const r = diesel({ T1: 300, p1: 100, eps: 18, T3: 2000, T0: 300, Tsrc: 2500 });
    const k = AIR.k;
    const phi = r.points[2]!.v / r.points[1]!.v;
    expect(r.eta).toBeCloseTo(1 - (phi ** k - 1) / (k * 18 ** (k - 1) * (phi - 1)), 9);
    closes(r);
  });
});

describe('Clausius–Rankine (textbook example)', () => {
  it('10 kPa / 10 MPa / 500 °C, isentropic: η ≈ 40.3 %, x₄ ≈ 0.79', () => {
    // e.g. Çengel & Boles, Example 10-2 style: h1 = 191.8, h3 = 3373.7, h4 ≈ 2089 kJ/kg
    const r = rankine({ pc: 10, pb: 10000, T3: 773.15, etaT: 1, etaP: 1, T0: 298.15, Tsrc: 1500 });
    expect(r.eta).toBeCloseTo(0.403, 2);
    expect(r.points[3]!.x!).toBeCloseTo(0.79, 1);
    expect(r.points[0]!.h).toBeCloseTo(191.8, 0);
    closes(r);
  });
  it('turbine efficiency lowers η and creates a turbine exergy loss', () => {
    const r = rankine({ pc: 10, pb: 10000, T3: 773.15, etaT: 0.85, etaP: 0.85, T0: 298.15, Tsrc: 1500 });
    expect(r.eta).toBeLessThan(0.36);
    expect(r.losses.find((l) => l.name === 'Turbine')!.loss).toBeGreaterThan(30);
    closes(r);
  });
});
