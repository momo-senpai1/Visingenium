/**
 * Rule-based diagnosis of a numeric answer: recognises typical slips (unit prefixes, sign,
 * factor 2/4/π, °C↔K, decimal point, time units) and step-specific wrong methods.
 */

export interface Mistake {
  /** the value a typical wrong method gives */
  value: number;
  /** explanation (i18n key) */
  key: string;
}
export interface Diagnosis {
  ok: boolean;
  /** i18n key and variables */
  key: string;
  vars?: Record<string, string | number>;
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-300);

export function diagnose(user: number, correct: number, mistakes: Mistake[] = []): Diagnosis {
  if (!Number.isFinite(user)) return { ok: false, key: 'Please enter a number.' };
  if (near(user, correct, 0.01) || (correct === 0 && Math.abs(user) < 1e-9)) return { ok: true, key: 'Correct!' };
  for (const m of mistakes) if (near(user, m.value, 0.01)) return { ok: false, key: m.key };
  if (near(user, correct, 0.05)) return { ok: false, key: 'Almost: {pct} % off. Check the rounding of intermediate results.', vars: { pct: (((user - correct) / correct) * 100).toFixed(1) } };
  if (near(user, -correct, 0.01)) return { ok: false, key: 'Wrong sign: check the direction or reference arrow you assumed.' };
  if (Math.abs(Math.abs(user - correct) - 273.15) < 0.5) return { ok: false, key: 'Off by 273.15: °C and K mixed up.' };
  const r = user / correct;
  const factors: [number, string][] = [
    [1e3, 'Off by a factor of 1000: check the unit prefixes (k, m, mm/m, kW/W).'],
    [1e-3, 'Off by a factor of 1000: check the unit prefixes (k, m, mm/m, kW/W).'],
    [1e6, 'Off by a factor of 10⁶: check the unit prefixes (M, µ, mm²/m²).'],
    [1e-6, 'Off by a factor of 10⁶: check the unit prefixes (M, µ, mm²/m²).'],
    [2, 'Off by a factor of 2: radius and diameter mixed up, or a factor ½ missing?'],
    [0.5, 'Off by a factor of 2: radius and diameter mixed up, or a factor ½ missing?'],
    [4, 'Off by a factor of 4: probably a squared factor 2 (e.g. d² instead of r²).'],
    [0.25, 'Off by a factor of 4: probably a squared factor 2 (e.g. d² instead of r²).'],
    [Math.PI, 'Off by a factor of π: check circle areas and circumferences.'],
    [1 / Math.PI, 'Off by a factor of π: check circle areas and circumferences.'],
    [2 * Math.PI, 'Off by a factor of 2π: ω = 2π·f mixed up with f?'],
    [1 / (2 * Math.PI), 'Off by a factor of 2π: ω = 2π·f mixed up with f?'],
    [60, 'Off by a factor of 60: time units (s, min, h) mixed up.'],
    [1 / 60, 'Off by a factor of 60: time units (s, min, h) mixed up.'],
    [3600, 'Off by a factor of 3600: hours and seconds mixed up.'],
    [1 / 3600, 'Off by a factor of 3600: hours and seconds mixed up.'],
    [10, 'Off by a factor of 10: decimal point slipped?'],
    [0.1, 'Off by a factor of 10: decimal point slipped?'],
  ];
  for (const [f, key] of factors) if (near(r, f, 0.01)) return { ok: false, key };
  return { ok: false, key: 'Not correct ({pct} % off). Use the hints or check each intermediate value.', vars: { pct: (((user - correct) / correct) * 100).toFixed(0) } };
}

/** Parse a typed number: decimal comma, SI prefixes (k, M, m, µ/u, n, p) and an optional unit. */
export function parseAnswer(s: string): number {
  const m = /^\s*([+-]?\d*[.,]?\d+(?:e[+-]?\d+)?)\s*([kMGmµunp]?)/i.exec(s.replace(/\s+/g, ' '));
  if (!m) return NaN;
  const v = Number(m[1]!.replace(',', '.'));
  const p: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, m: 1e-3, µ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12 };
  // "m" alone after a number is milli only if more text follows (e.g. "5 mΩ"); a bare "5 m" (metre) stays 5
  const pre = m[2] ?? '';
  const rest = s.slice(m.index + m[0].length).trim();
  return pre && (pre !== 'm' || rest.length > 0) ? v * (p[pre] ?? 1) : v;
}
