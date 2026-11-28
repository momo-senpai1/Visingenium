/**
 * Third-party SVG text (Recharts axis labels, legends, reference-line labels) is created with the
 * library's own React elements, so the JSX runtime in lib/mathjsx never sees it. This observer sets
 * the symbols of such <text>/<tspan> elements afterwards: italic letter, lowered index, no underscore.
 * Only elements that hold nothing but text are touched, so React can still update them (it replaces
 * the text content, which simply triggers another pass).
 */
import { hasMathSymbol, mathPieces } from '@/components/MathText';

const NS = 'http://www.w3.org/2000/svg';

function typeset(el: Element) {
  if (!(el instanceof SVGElement) || el.childElementCount > 0) return;
  const txt = el.textContent ?? '';
  if (!hasMathSymbol(txt)) return;
  const frag = document.createDocumentFragment();
  for (const p of mathPieces(txt)) {
    if ('text' in p) {
      frag.append(p.text);
      continue;
    }
    const k = p.src.search(/[_₀-₉]/);
    if (k < 1) {
      frag.append(p.src);
      continue;
    }
    const base = p.src.slice(0, k);
    const idx = p.src
      .slice(k)
      .replace(/^_/, '')
      .replace(/[{}]/g, '')
      .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));
    const b = document.createElementNS(NS, 'tspan');
    b.setAttribute('font-style', 'italic');
    b.setAttribute('font-family', "KaTeX_Math, 'Times New Roman', serif");
    b.textContent = base;
    const sub = document.createElementNS(NS, 'tspan');
    sub.setAttribute('baseline-shift', 'sub');
    sub.setAttribute('font-size', '0.75em');
    sub.textContent = idx;
    frag.append(b, sub);
  }
  el.replaceChildren(frag);
}

function visit(node: Node) {
  if (node instanceof Text) {
    if (node.parentElement) typeset(node.parentElement);
    return;
  }
  if (!(node instanceof Element)) return;
  if (node.matches('text, tspan')) typeset(node);
  node.querySelectorAll('text, tspan').forEach(typeset);
}

export function installSvgMath() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') visit(m.target);
      else m.addedNodes.forEach(visit);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  visit(document.body);
}
