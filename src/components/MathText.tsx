/** @jsxImportSource react */
/**
 * Plain UI text with formula symbols typeset by KaTeX.
 *
 * Symbols written like `U_CE`, `R_L`, `x_D`, `û_in` or `cos φ₂` in labels, slider symbols, legends
 * and notes are found automatically and rendered as KaTeX (U_CE → U_{\mathrm{CE}}); `$…$` marks an
 * explicit inline formula. Everything else stays normal text, so translations keep working.
 */

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, type ReactNode } from 'react';

const cache = new Map<string, string>();
/** KaTeX HTML; `mathml` adds the hidden MathML copy for screen readers (used for full formulas) */
export function texHtml(math: string, display = false, mathml = true) {
  const key = `${display ? 'D' : 'I'}${mathml ? 'M' : 'H'}${math}`;
  let h = cache.get(key);
  if (h === undefined) {
    // German decimal comma: KaTeX would set “1,5” as a list with a space; {,} keeps it tight
    h = katex.renderToString(math.replace(/(\d),(\d)/g, '$1{,}$2'), { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', output: mathml ? 'htmlAndMathml' : 'html' });
    if (cache.size > 2000) cache.clear();
    cache.set(key, h);
  }
  return h;
}

const BASE: Record<string, string> = { û: '\\hat u', î: '\\hat\\imath', Û: '\\hat U', Î: '\\hat I', ü: '\\ddot u', x̂: '\\hat x' };
const UNI_SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

/**
 * symbol base: one letter (optionally with a hat/dot/umlaut or a Δ/δ/Σ/∂/∇ in front, Δp, ΣF),
 * or a short dimensionless group (NTU, Bi, Re, Nu)
 */
const BASE_ONE = String.raw`[ΔδΣ∂∇]?\p{L}[̂̇̈]?`;
/** dimensionless groups need an explicit "_" (NTU_OG, Bi_V), so that chemical formulas like CO₂ stay plain text */
const BASE_RE = String.raw`(?:${BASE_ONE}|(?:[A-Z][a-z]{1,2}|[A-Z]{2,4})(?=_))`;
/** one symbol with an index: base + "_" + index (letters, digits, commas) */
const SYM = new RegExp(String.raw`(?<![\p{L}_])(${BASE_RE})_(\{[^}]+\}|[\p{L}\p{N},]+)`, 'gu');
/** symbol with an index or Unicode subscript digits (I₁, U₂₃, f₀) — used for UI text */
const SYM_ANY = new RegExp(String.raw`(?<![\p{L}_])(${BASE_RE})(?:_(\{[^}]+\}|[\p{L}\p{N},]+)|([₀-₉]+))(?![\p{L}])`, 'gu');
const HAS_SUB = /[_$₀-₉]/;
/** explicit inline math */
const DOLLAR = /\$([^$]+)\$/g;

const PREFIX: Record<string, string> = { Δ: '\\Delta ', δ: '\\delta ', Σ: '\\Sigma ', '∂': '\\partial ', '∇': '\\nabla ' };
const ACCENT: Record<string, string> = { '̂': '\\hat', '̇': '\\dot', '̈': '\\ddot' };

/** LaTeX of a symbol base: Δp → \Delta p, ω̇ → \dot{ω}, NTU → \mathrm{NTU} */
function baseTex(base: string): string {
  const known = BASE[base];
  if (known) return known;
  const m = /^([ΔδΣ∂∇])?(\p{L})([̂̇̈])?$/u.exec(base);
  if (!m) return `\\mathrm{${base}}`;
  const acc = m[3] ? ACCENT[m[3]] : undefined;
  return (m[1] ? PREFIX[m[1]]! : '') + (acc ? `${acc}{${m[2]}}` : m[2]!);
}

export function symbolTex(base: string, idx: string) {
  const b = baseTex(base);
  const raw = idx.startsWith('{') ? idx.slice(1, -1) : idx;
  const i = raw.replace(/[₀-₉]/g, (c) => UNI_SUB[c]!);
  // descriptive indices (CE, in, max, L) are set upright, as in DIN 1338
  const sub = /^[0-9]+$/.test(i) ? i : `\\mathrm{${i.replace(/,/g, ',\\,')}}`;
  return `${b}_{${sub}}`;
}

/** split a string into text and formula pieces */
export function mathPieces(s: string): ({ text: string } | { tex: string; src: string })[] {
  const out: ({ text: string } | { tex: string; src: string })[] = [];
  const pushText = (str: string) => {
    let last = 0;
    for (const m of str.matchAll(SYM_ANY)) {
      if (m.index! > last) out.push({ text: str.slice(last, m.index) });
      out.push({ tex: symbolTex(m[1]!, m[2] ?? m[3]!), src: m[0] });
      last = m.index! + m[0].length;
    }
    if (last < str.length) out.push({ text: str.slice(last) });
  };
  let last = 0;
  for (const m of s.matchAll(DOLLAR)) {
    if (m.index! > last) pushText(s.slice(last, m.index));
    out.push({ tex: m[1]!, src: m[1]! });
    last = m.index! + m[0].length;
  }
  if (last < s.length) pushText(s.slice(last));
  return out;
}

const SUB_CHARS: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };

/** plain-text fallback for places that cannot hold markup (<option>): x_N → xₙ, no underscore left */
export function plainSymbols(s: string): string {
  const sub = (idx: string) => [...idx.replace(/[{}]/g, '')].map((c) => SUB_CHARS[c] ?? SUB_CHARS[c.toLowerCase()] ?? c).join('');
  const first = s.replace(SYM_ANY, (m: string, base: string, idx?: string) => (idx ? base + sub(idx) : m));
  // anything the symbol pattern did not take (sT_t inside a formula in prose): still no raw underscore
  return first.replace(/(\p{L})_(\{[^}]+\}|[\p{L}\p{N}]+)/gu, (_m, b: string, idx: string) => b + sub(idx));
}

/** does the string contain a symbol that MathText would typeset? */
export const hasMathSymbol = (s: string) => HAS_SUB.test(s) && mathPieces(s).some((p) => 'tex' in p);

/** text with KaTeX symbols; non-string children pass through unchanged */
export function MathText({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>;
  if (!HAS_SUB.test(children)) return <>{children}</>;
  return (
    <>
      {mathPieces(children).map((p, k) =>
        'text' in p ? <Fragment key={k}>{p.text}</Fragment> : <span key={k} className="mtx" role="math" aria-label={p.src} dangerouslySetInnerHTML={{ __html: texHtml(p.tex, false, false) }} />,
      )}
    </>
  );
}

/** the same for SVG <text>: indices become lowered <tspan>s (KaTeX cannot live inside SVG text) */
export function svgMath(s: ReactNode): ReactNode {
  if (typeof s !== 'string' || !/[_₀-₉]/.test(s)) return s;
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(SYM_ANY)) {
    if (m.index! > last) parts.push(s.slice(last, m.index));
    const idx = (m[2] ?? m[3]!).replace(/[{}]/g, '').replace(/[₀-₉]/g, (c) => UNI_SUB[c]!);
    parts.push(
      <Fragment key={k++}>
        <tspan fontStyle="italic" fontFamily="KaTeX_Math, 'Times New Roman', serif">
          {m[1]}
        </tspan>
        <tspan baselineShift="sub" fontSize="0.75em">
          {idx}
        </tspan>
      </Fragment>,
    );
    last = m.index! + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

/**
 * A short symbol (slider symbol, axis name) always typeset as math: `x_F`, `P₀`, `√q`, `σ_a`, `N`.
 * Unicode subscript digits become real indices.
 */
export function MathSymbol({ children }: { children: string }) {
  const s = children.trim();
  if (!s || s.length > 12 || /\s{2,}|[A-Za-z]{4,}/.test(s.replace(/_\{?[\p{L}\p{N},]+\}?/gu, ''))) return <MathText>{children}</MathText>;
  let tex = s
    .replace(/([\p{L}])([₀-₉]+)/gu, (_m, b: string, d: string) => `${b}_${d.replace(/[₀-₉]/g, (c) => UNI_SUB[c]!)}`)
    .replace(SYM, (_m, b: string, i: string) => symbolTex(b, i))
    .replace(/√(\w)/g, '\\sqrt{$1}')
    .replace(/·/g, '\\cdot ')
    .replace(/\b(cos|sin|tan|ln|log)\b/g, '\\$1 ');
  for (const [k, v] of Object.entries(BASE)) tex = tex.split(k).join(`${v} `);
  return <span className="mtx" role="math" aria-label={s} dangerouslySetInnerHTML={{ __html: texHtml(tex, false, false) }} />;
}

/** SVG label that is a single symbol (`R`, `R₁`, `U_CE`, `Z3`): italic math letter with a lowered index */
export function svgSymbol(s: ReactNode): ReactNode {
  if (typeof s !== 'string') return s;
  const m = /^([\p{L}])(?:_?\{?([\p{N}₀-₉]+|[\p{L}\p{N}]+)\}?)?$/u.exec(s.trim());
  if (!m || (m[2] && !s.includes('_') && !/^[\p{N}₀-₉]+$/u.test(m[2]))) return svgMath(s);
  const idx = m[2]?.replace(/[₀-₉]/g, (c) => UNI_SUB[c]!);
  return (
    <>
      <tspan fontStyle="italic" fontFamily="KaTeX_Math, 'Times New Roman', serif" fontSize="1.15em">
        {m[1]}
      </tspan>
      {idx && (
        <tspan baselineShift="sub" fontSize="0.75em">
          {idx}
        </tspan>
      )}
    </>
  );
}
