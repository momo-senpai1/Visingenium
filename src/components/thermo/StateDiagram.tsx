/** Interactive state diagram (T,s / p,v / …): background lines, process paths and draggable state points. */

import { useRef, useState, type PointerEvent } from 'react';
import { nf } from '@/components/mechanics/common';
import { cn } from '@/lib/utils';

export interface Line {
  pts: { x: number; y: number }[];
  color: string;
  width?: number;
  dashed?: boolean;
  label?: string;
  /** fill the closed polygon instead of stroking */
  fill?: string;
  /** where the label sits: at the last (default) or first visible point */
  labelAt?: 'start' | 'end';
}
export interface DPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  draggable?: boolean;
}
export interface Axis {
  label: string;
  min: number;
  max: number;
  log?: boolean;
}

const W = 520;
const H = 380;
const M = { l: 52, r: 14, t: 12, b: 38 };

function ticks(a: Axis): number[] {
  if (a.log) {
    const out: number[] = [];
    for (let k = Math.floor(Math.log10(a.min)); k <= Math.ceil(Math.log10(a.max)); k++) if (10 ** k >= a.min * 0.999 && 10 ** k <= a.max * 1.001) out.push(10 ** k);
    return out;
  }
  const span = a.max - a.min;
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(a.min / step) * step; v <= a.max + step * 1e-9; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}
const fmtTick = (v: number, log?: boolean) => (log ? (Math.abs(Math.log10(v)) >= 3 ? `1e${Math.round(Math.log10(v))}` : String(v)) : nf(v, 3));

export function StateDiagram({
  x,
  y,
  lines,
  paths,
  points,
  onDrag,
  title,
}: {
  x: Axis;
  y: Axis;
  /** background (dome, isobars …) */
  lines: Line[];
  /** cycle paths */
  paths: Line[];
  points: DPoint[];
  onDrag?: (id: string, x: number, y: number) => void;
  title: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const fx = (v: number) => (x.log ? (Math.log(v) - Math.log(x.min)) / (Math.log(x.max) - Math.log(x.min)) : (v - x.min) / (x.max - x.min));
  const fy = (v: number) => (y.log ? (Math.log(v) - Math.log(y.min)) / (Math.log(y.max) - Math.log(y.min)) : (v - y.min) / (y.max - y.min));
  const sx = (v: number) => M.l + fx(v) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - fy(v) * (H - M.t - M.b);
  const inv = (px: number, py: number) => {
    const tx = (px - M.l) / (W - M.l - M.r);
    const ty = (H - M.b - py) / (H - M.t - M.b);
    return {
      x: x.log ? Math.exp(Math.log(x.min) + tx * (Math.log(x.max) - Math.log(x.min))) : x.min + tx * (x.max - x.min),
      y: y.log ? Math.exp(Math.log(y.min) + ty * (Math.log(y.max) - Math.log(y.min))) : y.min + ty * (y.max - y.min),
    };
  };
  const toData = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return inv(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  const ok = (v: number, a: Axis) => Number.isFinite(v) && (!a.log || v > 0);
  const d = (pts: { x: number; y: number }[]) =>
    pts
      .filter((p) => ok(p.x, x) && ok(p.y, y))
      .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
      .join('');
  const xt = ticks(x);
  const yt = ticks(y);
  return (
    <figure className="space-y-1">
      <figcaption className="text-[11px] font-semibold text-plant-200">{title}</figcaption>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className={cn('h-auto w-full touch-none select-none', drag && 'cursor-grabbing')}
        role="img"
        aria-label={title}
        onPointerMove={(e) => {
          if (!drag || !onDrag) return;
          const p = toData(e);
          onDrag(drag, p.x, p.y);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <defs>
          <clipPath id={`clip-${title.replace(/\W/g, '')}`}>
            <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
          </clipPath>
        </defs>
        {/* grid and axes */}
        {xt.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={H - M.b} stroke="rgb(var(--white)/0.06)" />
            <text x={sx(v)} y={H - M.b + 13} textAnchor="middle" className="fill-plant-400 font-mono text-[9px]">
              {fmtTick(v, x.log)}
            </text>
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="rgb(var(--white)/0.06)" />
            <text x={M.l - 5} y={sy(v) + 3} textAnchor="end" className="fill-plant-400 font-mono text-[9px]">
              {fmtTick(v, y.log)}
            </text>
          </g>
        ))}
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="none" stroke="rgb(var(--plant-500))" strokeWidth={0.8} />
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="fill-plant-300 text-[10px]">
          {x.label}
        </text>
        <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`} className="fill-plant-300 text-[10px]">
          {y.label}
        </text>
        <g clipPath={`url(#clip-${title.replace(/\W/g, '')})`}>
          {lines.map((l, i) => (
            <g key={`b${i}`}>
              <path d={l.fill ? `${d(l.pts)}Z` : d(l.pts)} fill={l.fill ?? 'none'} stroke={l.fill ? 'none' : l.color} strokeWidth={l.width ?? 1} strokeDasharray={l.dashed ? '4 3' : undefined} />
              {l.label &&
                (() => {
                  const vis = l.pts.filter((p) => ok(p.x, x) && ok(p.y, y) && p.x >= x.min && p.x <= x.max && p.y >= y.min && p.y <= y.max);
                  const p = l.labelAt === 'start' ? vis[0] : vis.at(-1);
                  return p ? (
                    <text x={sx(p.x) + (l.labelAt === 'start' ? 3 : -3)} y={sy(p.y) - 3} textAnchor={l.labelAt === 'start' ? 'start' : 'end'} className="text-[8px]" style={{ fill: l.color }}>
                      {l.label}
                    </text>
                  ) : null;
                })()}
            </g>
          ))}
          {paths.map((l, i) => (
            <path key={`p${i}`} d={d(l.pts)} fill="none" stroke={l.color} strokeWidth={l.width ?? 2.2} strokeDasharray={l.dashed ? '5 3' : undefined} strokeLinejoin="round" />
          ))}
        </g>
        {points
          .filter((p) => ok(p.x, x) && ok(p.y, y))
          .map((p) => (
            <g
              key={p.id}
              onPointerDown={(e) => {
                if (!p.draggable || !onDrag) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDrag(p.id);
              }}
              onPointerEnter={() => setHover(p.id)}
              onPointerLeave={() => setHover(null)}
              className={p.draggable ? 'cursor-grab' : undefined}
            >
              {p.draggable && <circle cx={sx(p.x)} cy={sy(p.y)} r={hover === p.id || drag === p.id ? 13 : 10} fill="rgb(var(--sig-liquid)/0.15)" stroke="rgb(var(--sig-liquid))" strokeDasharray="2 2" />}
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={p.draggable ? 'rgb(var(--sig-liquid))' : 'rgb(var(--plant-100))'} stroke="rgb(var(--plant-950))" strokeWidth={1.2} />
              <text x={sx(p.x) + 8} y={sy(p.y) - 7} className="pointer-events-none fill-plant-100 font-mono text-[11px] font-semibold">
                {p.label}
              </text>
            </g>
          ))}
      </svg>
    </figure>
  );
}
