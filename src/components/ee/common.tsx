/**
 * Building blocks for the electrical-engineering explainer pages: an animation clock hook,
 * IEC circuit symbols drawn between two points, moving charges along a wire, potential
 * colours and a phasor diagram.
 */

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { nf } from '@/components/mechanics/common';
import { MathText, svgMath, svgSymbol } from '@/components/MathText';
import { clockNow, useAnimClock } from '@/store/animClock';
import type { Cx } from '@/lib/ee';

/** animation time [s] from the global clock (header pause/speed apply), re-rendered at `fps` */
export function useAnimTime(fps = 30) {
  const [t, setT] = useState(() => clockNow(useAnimClock.getState()));
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const f = (now: number) => {
      raf = requestAnimationFrame(f);
      if (now - last < 1000 / fps || document.hidden) return;
      last = now;
      setT(clockNow(useAnimClock.getState()));
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}

export const EE = {
  wire: 'rgb(var(--plant-300))',
  body: 'rgb(var(--plant-100))',
  fill: 'rgb(var(--plant-950))',
  charge: 'rgb(var(--sig-heat))',
  u: 'rgb(var(--sig-liquid))',
  i: 'rgb(var(--sig-heat))',
  p: 'rgb(var(--sig-vapor))',
  red: 'rgb(var(--sig-alarm))',
  ok: 'rgb(var(--sig-ok))',
  text: 'rgb(var(--plant-200))',
  muted: 'rgb(var(--plant-400))',
  ph: ['rgb(var(--sig-alarm))', 'rgb(var(--sig-ok))', 'rgb(var(--sig-liquid))'] as const,
};

/** potential colour: 0 → blue, vmax → red */
export function potColor(v: number, vmax: number) {
  const x = Math.min(1, Math.max(0, vmax > 0 ? v / vmax : 0));
  const hue = 220 - 220 * x;
  return `hsl(${hue} 80% 58%)`;
}

type P = [number, number];
export type SymKind = 'R' | 'C' | 'L' | 'V' | 'AC' | 'D' | 'lamp' | 'switch';
const HALF: Record<SymKind, number> = { R: 22, C: 5, L: 22, V: 16, AC: 16, D: 10, lamp: 14, switch: 16 };

/**
 * An IEC symbol between a and b with leads. `colorA`/`colorB` colour the leads (node potentials),
 * `label` is placed beside the body.
 */
export function Sym({
  a,
  b,
  kind,
  label,
  sub,
  colorA = EE.wire,
  colorB = EE.wire,
  side = 1,
  open = false,
  glow = 0,
}: {
  a: P;
  b: P;
  kind: SymKind;
  label?: ReactNode;
  sub?: ReactNode;
  colorA?: string;
  colorB?: string;
  side?: 1 | -1;
  open?: boolean;
  glow?: number;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const m = L / 2;
  const h = HALF[kind];
  const nx = (-dy / L) * side;
  const ny = (dx / L) * side;
  const cx = (a[0] + b[0]) / 2 + nx * 28;
  // above the body the second line would run into it: lift the block
  const cy = (a[1] + b[1]) / 2 + ny * 28 - (sub && ny < -0.5 ? 12 : 0);
  return (
    <g>
      <g transform={`translate(${a[0]},${a[1]}) rotate(${ang})`} strokeWidth={2} fill="none">
        <line x1={0} y1={0} x2={m - h} y2={0} stroke={colorA} />
        <line x1={m + h} y1={0} x2={L} y2={0} stroke={colorB} />
        {kind === 'R' && <rect x={m - 20} y={-7} width={40} height={14} stroke={EE.body} fill={EE.fill} />}
        {kind === 'C' && (
          <>
            <line x1={m - 5} y1={-15} x2={m - 5} y2={15} stroke={EE.body} strokeWidth={3} />
            <line x1={m + 5} y1={-15} x2={m + 5} y2={15} stroke={EE.body} strokeWidth={3} />
          </>
        )}
        {kind === 'L' && <path d={`M${m - 22},0 a5.5,5.5 0 0 1 11,0 a5.5,5.5 0 0 1 11,0 a5.5,5.5 0 0 1 11,0 a5.5,5.5 0 0 1 11,0`} stroke={EE.body} />}
        {(kind === 'V' || kind === 'AC') && (
          <>
            <circle cx={m} cy={0} r={16} stroke={EE.body} fill={EE.fill} />
            {kind === 'V' ? <line x1={m - 16} y1={0} x2={m + 16} y2={0} stroke={EE.body} /> : <path d={`M${m - 9},0 q4.5,-10 9,0 t9,0`} stroke={EE.body} />}
          </>
        )}
        {kind === 'D' && (
          <>
            <path d={`M${m - 10},-10 L${m + 8},0 L${m - 10},10 Z`} stroke={EE.body} fill={glow > 0 ? `rgb(var(--sig-heat) / ${0.25 + 0.6 * glow})` : EE.fill} />
            <line x1={m + 9} y1={-11} x2={m + 9} y2={11} stroke={EE.body} strokeWidth={2.5} />
          </>
        )}
        {kind === 'lamp' && (
          <>
            <circle cx={m} cy={0} r={14} stroke={EE.body} fill={glow > 0 ? `rgb(var(--sig-vapor) / ${Math.min(0.9, glow)})` : EE.fill} />
            <path d={`M${m - 10},-10 L${m + 10},10 M${m - 10},10 L${m + 10},-10`} stroke={EE.body} />
          </>
        )}
        {kind === 'switch' && (
          <>
            <circle cx={m - 16} cy={0} r={2.5} fill={EE.body} />
            <line x1={m - 16} y1={0} x2={m + 16} y2={open ? -14 : 0} stroke={EE.body} />
            <circle cx={m + 16} cy={0} r={2.5} fill={EE.body} />
          </>
        )}
      </g>
      {label && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-semibold" style={{ fill: EE.text }}>
          {svgSymbol(label)}
          {sub && (
            <tspan x={cx} dy={14} className="text-[10px] font-normal" style={{ fill: EE.muted }}>
              {svgMath(sub)}
            </tspan>
          )}
        </text>
      )}
    </g>
  );
}

/** polyline wire, optionally coloured by potential */
export function Wire({ pts, color = EE.wire, width = 2 }: { pts: P[]; color?: string; width?: number }) {
  return <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" />;
}

/** junction dot */
export const Dot = ({ p, color = EE.body }: { p: P; color?: string }) => <circle cx={p[0]} cy={p[1]} r={3.5} fill={color} />;

/**
 * Charges moving along a path with a speed proportional to the current (conventional direction
 * from first to last point; negative current runs backwards).
 */
export function Charges({ pts, I, t, k = 60, spacing = 22, color = EE.charge }: { pts: P[]; I: number; t: number; k?: number; spacing?: number; color?: string }) {
  const seg: { a: P; b: P; l: number; s0: number }[] = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push({ a, b, l, s0: tot });
    tot += l;
  }
  if (tot <= 0 || !Number.isFinite(I)) return null;
  const off = (((t * k * I) % spacing) + spacing) % spacing;
  const dots: P[] = [];
  for (let s = off; s < tot; s += spacing) {
    const g = seg.find((x) => s >= x.s0 && s <= x.s0 + x.l) ?? seg.at(-1)!;
    const u = (s - g.s0) / g.l;
    dots.push([g.a[0] + u * (g.b[0] - g.a[0]), g.a[1] + u * (g.b[1] - g.a[1])]);
  }
  const op = Math.abs(I * k) < 1e-6 ? 0 : 0.9;
  return (
    <g pointerEvents="none">
      {dots.map((d, i) => (
        <circle key={i} cx={d[0]} cy={d[1]} r={2.6} fill={color} opacity={op} />
      ))}
    </g>
  );
}

export interface PhasorItem {
  v: Cx;
  color: string;
  label: string;
  /** start point (for chained phasors), default origin */
  from?: Cx;
  dashed?: boolean;
}

/** phasor (pointer) diagram; all phasors rotated by `rot` [rad] so they can spin with time */
export function PhasorPlot({ items, size = 260, rot = 0, scale, showProjection = false }: { items: PhasorItem[]; size?: number; rot?: number; scale?: number; showProjection?: boolean }) {
  const r = size / 2 - 22;
  const max = scale ?? Math.max(1e-12, ...items.map((p) => Math.hypot(p.v.re + (p.from?.re ?? 0), p.v.im + (p.from?.im ?? 0))));
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const tr = (z: Cx): P => {
    const x = z.re * c - z.im * s;
    const y = z.re * s + z.im * c;
    return [size / 2 + (x / max) * r, size / 2 - (y / max) * r];
  };
  const id = `ph${Math.round(size)}`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[320px]" role="img" aria-label="phasor diagram">
      <defs>
        {items.map((p, i) => (
          <marker key={i} id={`${id}-${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={p.color} />
          </marker>
        ))}
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--plant-700))" strokeDasharray="3 4" />
      <line x1={8} y1={size / 2} x2={size - 8} y2={size / 2} stroke="rgb(var(--plant-700))" />
      <line x1={size / 2} y1={8} x2={size / 2} y2={size - 8} stroke="rgb(var(--plant-700))" />
      <text x={size - 10} y={size / 2 - 5} textAnchor="end" className="text-[9px]" style={{ fill: EE.muted }}>
        Re
      </text>
      <text x={size / 2 + 5} y={14} className="text-[9px]" style={{ fill: EE.muted }}>
        Im
      </text>
      {items.map((p, i) => {
        const a = tr(p.from ?? { re: 0, im: 0 });
        const b = tr({ re: (p.from?.re ?? 0) + p.v.re, im: (p.from?.im ?? 0) + p.v.im });
        return (
          <g key={i}>
            {showProjection && !p.from && <line x1={b[0]} y1={b[1]} x2={b[0]} y2={size / 2} stroke={p.color} strokeOpacity={0.35} strokeDasharray="2 3" />}
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={p.color} strokeWidth={2.4} strokeDasharray={p.dashed ? '5 4' : undefined} markerEnd={`url(#${id}-${i})`} />
            <text
              x={b[0] + (b[0] >= size / 2 ? 6 : -6)}
              y={b[1] + (b[1] <= size / 2 ? -4 : 12)}
              textAnchor={b[0] >= size / 2 ? 'start' : 'end'}
              className="text-[11px] font-semibold"
              style={{ fill: p.color, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}
            >
              {svgMath(p.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** small value readout chip used inside schematics */
export function Readout({ x, y, children, color = EE.text, anchor = 'middle' }: { x: number; y: number; children: ReactNode; color?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="font-mono text-[11px]" style={{ fill: color, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}>
      {Array.isArray(children) ? children.map((c, k) => <Fragment key={k}>{svgMath(c)}</Fragment>) : svgMath(children)}
    </text>
  );
}

/** engineering notation with SI prefix */
export function si(v: number, unit: string, digits = 3) {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return `0 ${unit}`;
  const pre: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];
  const [k, p] = pre.find(([k]) => Math.abs(v) >= k * 0.9995) ?? [1e-12, 'p'];
  return `${nf(v / k, digits)} ${p}${unit}`;
}

/** page skeleton shared by the explainers: parameter column + content */
export function EeLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">{aside}</aside>
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}

/** the idea of the page in two or three plain sentences */
export function Idea({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] leading-relaxed text-plant-300">
      <MathText>{children}</MathText>
    </p>
  );
}
