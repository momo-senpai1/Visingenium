import { describe, expect, it } from 'vitest';
import { mathPieces, symbolTex } from '@/components/MathText';
describe('MathText', () => {
  it('finds symbols with indices', () => {
    expect(mathPieces('U_CE = 5 V and R_L')).toMatchObject([{ tex: 'U_{\\mathrm{CE}}' }, { text: ' = 5 V and ' }, { tex: 'R_{\\mathrm{L}}' }]);
    expect(mathPieces('max_tension')).toEqual([{ text: 'max_tension' }]);
    expect(mathPieces('û_in')[0]).toMatchObject({ tex: '\\hat u_{\\mathrm{in}}' });
    expect(symbolTex('x', '12')).toBe('x_{12}');
    expect(mathPieces('a $x^2$ b')).toMatchObject([{ text: 'a ' }, { tex: 'x^2' }, { text: ' b' }]);
  });
});
describe('MathText unicode indices', () => {
  it('turns I₁ and f₀ into symbols but leaves CO₂ alone', () => {
    expect(mathPieces('I₁ = 5 mA')[0]).toMatchObject({ tex: 'I_{1}' });
    expect(mathPieces('CO₂ flow')).toEqual([{ text: 'CO₂ flow' }]);
  });
});
