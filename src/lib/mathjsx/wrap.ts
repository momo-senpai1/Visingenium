/**
 * Site-wide typesetting of symbols: every string child of an ordinary text element that contains a
 * symbol with an index (`x_D`, `T_s`, `Δp_V`, `η_T` …) is handed to MathText and set by KaTeX, so
 * raw underscores never reach the screen. SVG text gets lowered index spans, <option> text Unicode
 * subscripts (both cannot hold KaTeX markup). Used by the custom JSX runtime in this folder.
 */
import { createElement, type ReactNode } from 'react';
import { hasMathSymbol, MathText, plainSymbols, svgMath } from '@/components/MathText';

/** host elements whose text is visible prose (not code or form values) */
const HTML = new Set(['p', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'li', 'td', 'th', 'div', 'a', 'strong', 'em', 'b', 'i', 'small', 'summary', 'dt', 'dd', 'figcaption', 'legend', 'caption']);
const SVG = new Set(['text', 'tspan']);

type Convert = (s: string) => ReactNode;
const html: Convert = (s) => createElement(MathText, null, s);
const svg: Convert = (s) => svgMath(s);
const option: Convert = (s) => plainSymbols(s);

export function wrapProps<P>(type: unknown, props: P): P {
  if (typeof type !== 'string') return props;
  const convert = HTML.has(type) ? html : SVG.has(type) ? svg : type === 'option' ? option : null;
  if (!convert) return props;
  // <option> cannot hold markup: every underscore is replaced, even one the symbol pattern would not typeset
  const needs = type === 'option' ? (s: string) => s.includes('_') : hasMathSymbol;
  const children = (props as { children?: ReactNode } | null)?.children;
  if (typeof children === 'string') {
    return needs(children) ? { ...props, children: convert(children) } : props;
  }
  if (Array.isArray(children)) {
    const mapped = children.map((c) => (typeof c === 'string' && needs(c) ? convert(c) : c));
    return mapped.some((c, i) => c !== children[i]) ? { ...props, children: mapped } : props;
  }
  return props;
}
