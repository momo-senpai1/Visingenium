/** Reference: psychrometric tables (e.g. Recknagel / ASHRAE), p = 101.325 kPa. */
import { describe, expect, it } from 'vitest';
import { dewPoint, heatCool, mix, state, wetBulb, xOf, xSat } from '../humidair';

const P = 101.325;
describe('humid air', () => {
  it('20 °C, 50 %: x = 7.3 g/kg, h = 38.6 kJ/kg, dew point 9.3 °C, wet bulb 13.8 °C', () => {
    const x = xOf(20, 0.5, P);
    expect(x * 1000).toBeCloseTo(7.29, 1);
    const s = state(20, x, P);
    expect(s.h).toBeCloseTo(38.5, 0);
    expect(dewPoint(x, P)).toBeCloseTo(9.3, 1);
    expect(wetBulb(20, x, P)).toBeCloseTo(13.8, 0);
  });
  it('saturation at 30 °C: x_s = 27.3 g/kg', () => expect(xSat(30, P) * 1000).toBeCloseTo(27.3, 0));
  it('cooling below the dew point condenses water', () => {
    const s1 = state(30, xOf(30, 0.6, P), P);
    const r = heatCool(s1, 12, P);
    expect(r.s2.phi).toBeCloseTo(1, 6);
    expect(r.condensate).toBeGreaterThan(0.005);
    expect(r.q).toBeLessThan(0);
  });
  it('mixing: x and h are mass-weighted averages', () => {
    const a = state(0, xOf(0, 0.8, P), P);
    const b = state(24, xOf(24, 0.4, P), P);
    const m = mix(a, b, 1, 3, P);
    expect(m.x).toBeCloseTo(0.25 * a.x + 0.75 * b.x, 9);
    expect(m.h).toBeCloseTo(0.25 * a.h + 0.75 * b.h, 6);
  });
});
