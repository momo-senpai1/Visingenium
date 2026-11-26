import { describe, expect, it } from 'vitest';
import { SIGMA } from '../radiation';
import { faceFlows } from '../surfaceRadiation';

describe('faceFlows', () => {
  it('splits the irradiation into reflected, absorbed and transmitted parts', () => {
    const f = faceFlows(400, { eps: 0.3, tau: 0.5 }, 20);
    expect(f.refl + f.abs + f.trans).toBeCloseTo(400, 9);
    expect(f.rho).toBeCloseTo(0.2, 12);
    expect(f.trans).toBeCloseTo(200, 9);
  });
  it('emits ε σ T⁴ and a black body in equilibrium has zero net flux', () => {
    const T = 300;
    const f = faceFlows(SIGMA * (T + 273.15) ** 4, { eps: 1, tau: 0 }, T);
    expect(f.emis).toBeCloseTo(SIGMA * (T + 273.15) ** 4, 6);
    expect(f.net).toBeCloseTo(0, 6);
    expect(f.refl).toBe(0);
  });
});
