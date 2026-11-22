import { describe, expect, it } from 'vitest';
import { diagnose, parseAnswer } from '../diagnose';

describe('answer diagnosis', () => {
  it('accepts values within 1 %', () => expect(diagnose(1503, 1500).ok).toBe(true));
  it('recognises typical slips', () => {
    expect(diagnose(1.5, 1500).key).toMatch(/1000/);
    expect(diagnose(-1500, 1500).key).toMatch(/sign/);
    expect(diagnose(3000, 1500).key).toMatch(/factor of 2/);
    expect(diagnose(373.15, 100).key).toMatch(/273/);
    expect(diagnose(1500 * 2 * Math.PI, 1500).key).toMatch(/2π/);
    expect(diagnose(1540, 1500).key).toMatch(/Almost/);
  });
  it('step-specific wrong method wins', () => expect(diagnose(2000, 500, [{ value: 2000, key: 'series instead of parallel' }]).key).toBe('series instead of parallel'));
  it('parses SI prefixes and decimal commas', () => {
    expect(parseAnswer('1,5 k')).toBe(1500);
    expect(parseAnswer('1.5kΩ')).toBe(1500);
    expect(parseAnswer('470')).toBe(470);
    expect(parseAnswer('2,2 µF')).toBeCloseTo(2.2e-6, 12);
    expect(parseAnswer('5 m')).toBe(5);
    expect(parseAnswer('5 mA')).toBe(0.005);
    expect(Number.isNaN(parseAnswer('abc'))).toBe(true);
  });
});
