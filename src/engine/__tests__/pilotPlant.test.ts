import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANT, ratePlant, rateLoop, simc } from '../pilotPlant';

describe('pilot plant', () => {
  const r = ratePlant(DEFAULT_PLANT);
  it('closes the column material balance and produces a pure distillate', () => {
    expect(r.col.D + r.col.B).toBeCloseTo(DEFAULT_PLANT.F, 9);
    expect(r.col.xD * r.col.D + r.col.xB * r.col.B).toBeCloseTo(DEFAULT_PLANT.F * DEFAULT_PLANT.zF, 6);
    expect(r.col.xD).toBeGreaterThan(0.9);
  });
  it('condenser and reboiler duty follow V·ΔH and are of similar size (constant molar overflow)', () => {
    expect(r.thermo.Qcond).toBeCloseTo((r.col.V * 1000 * r.thermo.dHtop) / 3600, 6);
    expect(r.thermo.Qreb / r.thermo.Qcond).toBeGreaterThan(0.9);
    expect(r.thermo.Qreb / r.thermo.Qcond).toBeLessThan(1.1);
  });
  it('the second-law efficiency is a small positive fraction', () => {
    expect(r.thermo.etaII).toBeGreaterThan(0);
    expect(r.thermo.etaII).toBeLessThan(0.3);
  });
  it('line current follows S/(√3·U) and the electric reboiler dominates the load', () => {
    expect(r.elec.I).toBeCloseTo((r.elec.S * 1000) / (Math.sqrt(3) * 400), 9);
    expect(r.elec.Pheat).toBeGreaterThan(5 * r.elec.Ppumps);
    expect(r.elec.cosPhi).toBeGreaterThan(0.9);
  });
  it('steam heating needs no electric heater power', () => {
    const s = ratePlant({ ...DEFAULT_PLANT, heating: 'steam' });
    expect(s.elec.Pheat).toBe(0);
    expect(s.thermo.steamKgH).toBeGreaterThan(0);
  });
  it('SIMC loop is stable with sensible margins and settles on the setpoint', () => {
    const { K, tau, theta } = r.control;
    expect(Number.isFinite(K) && K !== 0).toBe(true);
    const { Kc, Ti } = simc(K, tau, theta);
    const loop = rateLoop(K, tau, theta, Kc, Ti);
    expect(loop.y.at(-1)!).toBeCloseTo(1, 1);
    expect(loop.margins.pm ?? 0).toBeGreaterThan(40);
  });
});
