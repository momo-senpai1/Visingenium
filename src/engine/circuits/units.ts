/** SI-prefixed numbers: "4k7", "4.7k", "2,2µ", "10m", "1M" ↔ number. */

const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

export function parseSI(text: string): number | null {
  const s = text.trim().replace(',', '.').replace(/\s+/g, '').replace(/(Ω|ohm|V|A|W|F|H)$/i, '');
  if (!s) return null;
  // 4k7 style
  const inner = /^([+-]?\d+)([pnuµμmkKMG])(\d+)$/.exec(s);
  if (inner) return Number(`${inner[1]}.${inner[3]}`) * PREFIX[inner[2]!]!;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([pnuµμmkKMG]?)$/i.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * (PREFIX[m[2]!] ?? 1);
  return Number.isFinite(v) ? v : null;
}

const STEPS: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

/** 0.0123 A → "12.3 mA" (3 significant digits). */
export function formatSI(v: number, unit: string, digits = 3, comma = false): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const [f, p] = STEPS.find(([k]) => a >= k * 0.9995) ?? STEPS.at(-1)!;
  let s = String(Number((v / f).toPrecision(digits)));
  if (comma) s = s.replace('.', ',');
  return `${s} ${p}${unit}`;
}
