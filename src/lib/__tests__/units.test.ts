import { describe, expect, it } from 'vitest';
import { convert, QUANTITIES } from '../units';

const U = (q: string, id: string) => QUANTITIES.find((x) => x.id === q)!.units.find((x) => x.id === id)!;

describe('unit conversion', () => {
  it('temperatures with offsets', () => {
    expect(convert(100, U('temperature', '°C'), U('temperature', 'K'))).toBeCloseTo(373.15, 9);
    expect(convert(212, U('temperature', '°F'), U('temperature', '°C'))).toBeCloseTo(100, 9);
    expect(convert(0, U('temperature', 'K'), U('temperature', '°F'))).toBeCloseTo(-459.67, 9);
  });
  it('pressure, energy, flows', () => {
    expect(convert(1, U('pressure', 'atm'), U('pressure', 'bar'))).toBeCloseTo(1.01325, 9);
    expect(convert(1, U('energy', 'kWh'), U('energy', 'MJ'))).toBeCloseTo(3.6, 9);
    expect(convert(36, U('nflow', 'kmol/h'), U('nflow', 'mol/s'))).toBeCloseTo(10, 9);
    expect(convert(1, U('freq', '1/min (rpm)'), U('freq', 'rad/s (ω)'))).toBeCloseTo((2 * Math.PI) / 60, 9);
  });
  it('round trip of every unit', () => {
    for (const q of QUANTITIES) for (const a of q.units) for (const b of q.units) expect(convert(convert(3.7, a, b), b, a)).toBeCloseTo(3.7, 9);
  });
});
