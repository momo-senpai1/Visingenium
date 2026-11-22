import { describe, expect, it } from 'vitest';
import { departure, maxwellCheck, pressure, RB, stableZ, SUBSTANCES, vaporPressure, zRoots } from '../realgas';

const S = (id: string) => SUBSTANCES.find((s) => s.id === id)!;

describe('cubic equations of state', () => {
  it('van der Waals critical point: Z_c = 3/8', () => {
    const s = S('co2');
    const vc = (3 * RB * s.Tc) / (8 * s.pc);
    expect(pressure('vdw', s, s.Tc, vc)).toBeCloseTo(s.pc, 6);
  });
  it('Peng–Robinson: Z_c ≈ 0.307', () => {
    const s = S('n2');
    const z = zRoots('pr', s, s.Tc, s.pc);
    // triple root at the critical point: numerically sensitive, the rounded constants give ±0.02
    expect(Math.abs(z.reduce((a, b) => a + b, 0) / z.length - 0.307)).toBeLessThan(0.02);
  });
  it('PR vapour pressure of propane at 300 K ≈ 9.97 bar (NIST: 9.98 bar)', () => {
    const r = vaporPressure('pr', S('c3h8'), 300)!;
    expect(r.p).toBeGreaterThan(9.6);
    expect(r.p).toBeLessThan(10.4);
  });
  it('PR vapour pressure of CO₂ at 273.15 K ≈ 34.9 bar', () => {
    expect(vaporPressure('pr', S('co2'), 273.15)!.p / 34.85).toBeCloseTo(1, 1);
  });
  it('Maxwell equal-area rule: ∫ p dv between v_L and v_V equals p_s (v_V − v_L)', () => {
    const s = S('co2');
    const T = 280;
    const r = vaporPressure('vdw', s, T)!;
    let I = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = r.vL + ((r.vV - r.vL) * (i + 0.5)) / n;
      I += pressure('vdw', s, T, v) * ((r.vV - r.vL) / n);
    }
    expect(I / (r.p * (r.vV - r.vL))).toBeCloseTo(1, 4);
  });
  it('stable root: liquid below, vapour above the vapour pressure', () => {
    const s = S('c3h8');
    const ps = vaporPressure('pr', s, 300)!.p;
    expect(stableZ('pr', s, 300, ps * 1.2).liquid).toBe(true);
    expect(stableZ('pr', s, 300, ps * 0.8).liquid).toBe(false);
  });
  it('Maxwell relation (∂s/∂v)_T = (∂p/∂T)_v holds for every EOS', () => {
    for (const eos of ['ideal', 'vdw', 'rk', 'pr'] as const) {
      const m = maxwellCheck(eos, S('co2'), 320, 0.4);
      expect(m.dsdv / m.dpdT).toBeCloseTo(1, 5);
    }
  });
  it('departure functions vanish at low pressure', () => {
    const s = S('n2');
    const Z = stableZ('pr', s, 300, 0.001).Z;
    const d = departure('pr', s, 300, 0.001, Z);
    expect(Math.abs(d.h)).toBeLessThan(0.05);
    expect(Math.abs(d.s)).toBeLessThan(1e-4);
  });
});
