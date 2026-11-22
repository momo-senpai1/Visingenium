/** Reference values: IAPWS-IF97 steam tables (e.g. VDI-Wärmeatlas / Wagner & Kretzschmar). */
import { describe, expect, it } from 'vitest';
import { psat, satT, stateTP, statePS, tsat } from '../steam';

describe('saturation line', () => {
  it('100 °C: p = 101.42 kPa, h\' = 419.1, h\'\' = 2675.6, s\' = 1.3069, s\'\' = 7.3545', () => {
    const s = satT(373.15);
    expect(psat(373.15)).toBeCloseTo(101.42, 1);
    expect(s.hL).toBeCloseTo(419.1, 0);
    expect(s.hV).toBeCloseTo(2675.6, 0);
    expect(s.sL).toBeCloseTo(1.3069, 2);
    expect(s.sV).toBeCloseTo(7.3545, 2);
    expect(s.vV).toBeCloseTo(1.6718, 2);
  });
  it('0.1 bar: T_s = 45.81 °C, h\' = 191.8, h\'\' = 2583.9', () => {
    expect(tsat(10) - 273.15).toBeCloseTo(45.81, 1);
    const s = satT(tsat(10));
    expect(s.hL).toBeCloseTo(191.8, 0);
    expect(s.hV / 2583.9).toBeCloseTo(1, 3);
  });
  it('100 bar: T_s = 311.0 °C, h\' = 1408, h\'\' = 2725', () => {
    expect(tsat(10000) - 273.15).toBeCloseTo(311.0, 0);
    const s = satT(tsat(10000));
    expect(s.hL / 1408.1).toBeCloseTo(1, 2);
    expect(s.hV / 2725.5).toBeCloseTo(1, 2);
  });
});

describe('superheated steam (IF97 region 2)', () => {
  const cases: [number, number, number, number][] = [
    // T [°C], p [kPa], h, s
    [200, 100, 2875.5, 7.8356],
    [300, 1000, 3051.7, 7.1246],
    [500, 10000, 3374.6, 6.5994],
    [400, 4000, 3214.5, 6.7714],
  ];
  for (const [t, p, h, s] of cases)
    it(`${t} °C, ${p / 100} bar: h = ${h}, s = ${s}`, () => {
      const st = stateTP(t + 273.15, p);
      expect(st.h / h).toBeCloseTo(1, 2);
      expect(st.s / s).toBeCloseTo(1, 2);
    });
  it('isentropic expansion 100 bar 500 °C → 0.1 bar: x ≈ 0.79', () => {
    const s3 = stateTP(773.15, 10000).s;
    const e = statePS(10, s3);
    expect(e.phase).toBe('wet');
    expect(e.x!).toBeCloseTo(0.79, 1);
  });
});
