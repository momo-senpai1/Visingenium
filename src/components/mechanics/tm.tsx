/** Drawing helpers and a tiny persisted store for the Engineering Mechanics 1–3 explainer pages. */

import type { ReactNode } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { svgMath } from '@/components/MathText';
import { safeStorage } from '@/components/mechanics/common';

export const TM = {
  load: 'rgb(var(--sig-alarm))',
  reaction: 'rgb(var(--sig-ok))',
  body: 'rgb(var(--plant-200))',
  fill: 'rgb(var(--plant-700))',
  ground: 'rgb(var(--plant-500))',
  text: 'rgb(var(--plant-200))',
  muted: 'rgb(var(--plant-400))',
  v: 'rgb(var(--sig-liquid))',
  a: 'rgb(var(--sig-heat))',
  aux: 'rgb(var(--sig-vapor))',
};

/** persisted parameter store: `const useX = paramStore('tm-x', { a: 1 })` */
export function paramStore<T extends object>(name: string, defaults: T) {
  return create<T & { set: (p: Partial<T>) => void; reset: () => void }>()(
    persist(
      (set) => ({ ...defaults, set: (p: Partial<T>) => set(p as never), reset: () => set(defaults as never) }) as T & { set: (p: Partial<T>) => void; reset: () => void },
      {
        name,
        version: 1,
        storage: createJSONStorage(() => safeStorage),
        partialize: (s) => {
          const { set: _s, reset: _r, ...rest } = s as T & { set: unknown; reset: unknown };
          return rest as never;
        },
      },
    ),
  );
}

type P = [number, number];

/** arrow from a to b with a filled head; label at the tip */
export function Arrow({ a, b, color = TM.load, width = 2.2, label, labelOffset = [6, -6], dashed = false }: { a: P; b: P; color?: string; width?: number; label?: ReactNode; labelOffset?: P; dashed?: boolean }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 1) return null;
  const ux = dx / L;
  const uy = dy / L;
  const hl = Math.min(11, L * 0.45);
  const hw = hl * 0.45;
  const base: P = [b[0] - ux * hl, b[1] - uy * hl];
  const head = `M${b[0]},${b[1]} L${base[0] - uy * hw},${base[1] + ux * hw} L${base[0] + uy * hw},${base[1] - ux * hw} Z`;
  return (
    <g>
      <line x1={a[0]} y1={a[1]} x2={base[0]} y2={base[1]} stroke={color} strokeWidth={width} strokeDasharray={dashed ? '5 4' : undefined} />
      <path d={head} fill={color} />
      {label !== undefined && (
        <text
          x={b[0] + labelOffset[0]}
          y={b[1] + labelOffset[1]}
          className="text-[12px] font-semibold"
          style={{ fill: color, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}
        >
          {svgMath(label)}
        </text>
      )}
    </g>
  );
}

/** curved moment arrow around c (counter-clockwise for M > 0) */
export function MomentArrow({ c, r = 20, M, color = TM.load, label }: { c: P; r?: number; M: number; color?: string; label?: ReactNode }) {
  if (Math.abs(M) < 1e-12) return null;
  const ccw = M > 0;
  // SVG y points down: counter-clockwise on screen means sweep flag 0
  const a0 = (-30 * Math.PI) / 180;
  const a1 = (220 * Math.PI) / 180;
  const p0: P = [c[0] + r * Math.cos(a0), c[1] - r * Math.sin(a0)];
  const p1: P = [c[0] + r * Math.cos(a1), c[1] - r * Math.sin(a1)];
  const [s, e] = ccw ? [p0, p1] : [p1, p0];
  const tang = ccw ? a1 + Math.PI / 2 : a0 - Math.PI / 2;
  const tip: P = [e[0] + 9 * Math.cos(tang), e[1] - 9 * Math.sin(tang)];
  const n: P = [Math.cos(tang + Math.PI / 2), -Math.sin(tang + Math.PI / 2)];
  return (
    <g>
      <path d={`M${s[0]},${s[1]} A${r},${r} 0 1 ${ccw ? 0 : 1} ${e[0]},${e[1]}`} fill="none" stroke={color} strokeWidth={2} />
      <path d={`M${tip[0]},${tip[1]} L${e[0] + 4 * n[0]},${e[1] + 4 * n[1]} L${e[0] - 4 * n[0]},${e[1] - 4 * n[1]} Z`} fill={color} />
      {label !== undefined && (
        <text x={c[0] + r + 6} y={c[1] - r} className="text-[12px] font-semibold" style={{ fill: color, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}>
          {svgMath(label)}
        </text>
      )}
    </g>
  );
}

/** hatched ground line from a to b, hatches on the side `side` (1 = below for a left-to-right line) */
export function Ground({ a, b, side = 1, step = 10 }: { a: P; b: P; side?: 1 | -1; step?: number }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy * side;
  const ny = ux * side;
  const n = Math.floor(L / step);
  return (
    <g stroke={TM.ground} strokeWidth={1.2}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={1.8} />
      {Array.from({ length: n }, (_, i) => {
        const p: P = [a[0] + ux * (i + 0.5) * step, a[1] + uy * (i + 0.5) * step];
        return <line key={i} x1={p[0]} y1={p[1]} x2={p[0] + (nx - ux) * 8} y2={p[1] + (ny - uy) * 8} />;
      })}
    </g>
  );
}

/** label inside an SVG with a halo */
export function Label({ x, y, children, color = TM.text, anchor = 'middle', size = 11 }: { x: number; y: number; children: ReactNode; color?: string; anchor?: 'start' | 'middle' | 'end'; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} style={{ fill: color, fontSize: size, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}>
      {svgMath(children)}
    </text>
  );
}

/** note under a figure */
export const Caption = ({ children }: { children: ReactNode }) => <p className="mt-1 text-[10px] leading-relaxed text-plant-500">{children}</p>;
