import type { CSSProperties } from 'react';
import { Tex } from '@/components/balance/Tex';
import { nf } from '@/components/mechanics/common';
import { faceFlows, type Optics } from '@/engine/heat/surfaceRadiation';
import { t } from '@/i18n';

/** layer colours by material (own materials get the neutral one) */
const FILL: Record<string, string> = {
  Steel: '#8a94a3',
  'Stainless steel': '#a7b0ba',
  Copper: '#c77d4a',
  Aluminium: '#b8c2cc',
  Concrete: '#9aa0a6',
  Brick: '#b4553a',
  Glass: '#7fd0ea',
  Wood: '#a9764b',
  'Mineral wool': '#e6c75a',
  'Polystyrene (EPS)': '#e4ebf1',
  'PUR foam': '#e8c46e',
  Plaster: '#d8cfba',
};

const W = 800;
const H = 330;
const X0 = 250; // inside surface
const X1 = 550; // outside surface
const TOP = 44;
const BOT = 252;
const LANES = [70, 110, 150, 190, 230];
const LEN = 150;

const C = { G: '#fbbf24', refl: '#38bdf8', emis: '#f87171', abs: '#f59e0b', trans: '#2dd4bf' };

interface Props {
  layers: { name: string; s: number }[];
  /** surface and interface temperatures inside → outside [°C] */
  temps: number[];
  Ti: number;
  Ta: number;
  /** irradiation onto the outside / inside surface [W/m²] */
  Gout: number;
  Gin: number;
  outer: Optics;
  inner: Optics;
}

function Arrow({ x1, y1, x2, y2, color, w, dash }: { x1: number; y1: number; x2: number; y2: number; color: string; w: number; dash?: boolean }) {
  const dx = Math.sign(x2 - x1) || 1;
  const hs = 5 + w * 1.2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - dx * hs * 0.6} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash ? '6 4' : undefined} />
      <polygon points={`${x2},${y2} ${x2 - dx * hs},${y2 - hs * 0.55} ${x2 - dx * hs},${y2 + hs * 0.55}`} fill={color} />
    </g>
  );
}

function Label({ x, y, align, color, math }: { x: number; y: number; align: 'left' | 'right'; color: string; math: string }) {
  const st: CSSProperties = { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, color, transform: align === 'right' ? 'translate(-100%,-100%)' : 'translate(0,-100%)' };
  return (
    <span className="pointer-events-none absolute whitespace-nowrap text-[11px] leading-none" style={st}>
      <Tex math={math} />
    </span>
  );
}

const N = (v: number, d = 0) => nf(v, d).replace(',', '{,}');

export function WallRadiationDiagram({ layers, temps, Ti, Ta, Gout, Gin, outer, inner }: Props) {
  const n = layers.length;
  const total = layers.reduce((a, l) => a + l.s, 0) || 1;
  const minW = Math.min(30, (X1 - X0) / n);
  const widths = layers.map((l) => minW + (X1 - X0 - minW * n) * (l.s / total));
  const edges = [X0];
  widths.forEach((w) => edges.push(edges.at(-1)! + w));

  const fOut = faceFlows(Gout, outer, temps.at(-1) ?? Ta);
  const fIn = faceFlows(Gin, inner, temps[0] ?? Ti);
  const vmax = Math.max(1, fOut.G, fOut.emis, fIn.G, fIn.emis);
  const sw = (v: number) => 1.4 + 4.6 * Math.min(1, v / vmax);
  const lastW = widths.at(-1) ?? 0;
  const firstW = widths[0] ?? 0;

  /** arrows and labels of one face; d = +1 outside (right), −1 inside (left) */
  const faceArrows = (f: ReturnType<typeof faceFlows>, o: Optics, d: 1 | -1) => {
    const x = d === 1 ? X1 : X0;
    const far = x + d * LEN;
    return (
      <>
        <Arrow x1={far} y1={LANES[0]!} x2={x + d * 3} y2={LANES[0]!} color={C.G} w={sw(f.G)} />
        <Arrow x1={x + d * 3} y1={LANES[1]!} x2={far - d * 30} y2={LANES[1]!} color={C.refl} w={sw(f.refl)} />
        <Arrow x1={x + d * 3} y1={LANES[2]!} x2={far} y2={LANES[2]!} color={C.emis} w={sw(f.emis)} />
        <Arrow x1={x} y1={LANES[3]!} x2={x - d * Math.min(26, (d === 1 ? lastW : firstW) * 0.9)} y2={LANES[3]!} color={C.abs} w={sw(f.abs)} />
        {o.tau > 0 && <Arrow x1={x} y1={LANES[4]!} x2={x - d * (d === 1 ? lastW : firstW)} y2={LANES[4]!} color={C.trans} w={sw(f.trans)} dash />}
      </>
    );
  };
  const faceLabels = (f: ReturnType<typeof faceFlows>, o: Optics, d: 1 | -1) => {
    const x = d === 1 ? X1 : X0;
    const align = d === 1 ? 'left' : 'right';
    const lx = d === 1 ? x + 4 : x - 4;
    const sub = d === 1 ? 'a' : 'i';
    return (
      <>
        <Label x={lx} y={LANES[0]! - 6} align={align} color={C.G} math={`G_${sub} = ${N(f.G)}`} />
        <Label x={lx} y={LANES[1]! - 6} align={align} color={C.refl} math={`\\rho G = ${N(f.refl)}`} />
        <Label x={lx} y={LANES[2]! - 6} align={align} color={C.emis} math={`\\varepsilon\\sigma T^4 = ${N(f.emis)}`} />
        <Label x={lx} y={LANES[3]! - 6} align={align} color={C.abs} math={`\\alpha G = ${N(f.abs)}`} />
        {o.tau > 0 && <Label x={lx} y={LANES[4]! - 6} align={align} color={C.trans} math={`\\tau G = ${N(f.trans)}`} />}
      </>
    );
  };

  return (
    <div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label={t('Layers (inside → outside)')}>
          {/* fluid / room on both sides */}
          <rect x={0} y={TOP} width={X0} height={BOT - TOP} fill="rgb(59 130 246 / 0.05)" />
          <rect x={X1} y={TOP} width={W - X1} height={BOT - TOP} fill="rgb(148 163 184 / 0.05)" />
          {/* layers */}
          {layers.map((l, i) => (
            <g key={i}>
              <rect x={edges[i]} y={TOP} width={widths[i]} height={BOT - TOP} fill={FILL[l.name] ?? '#6b7a90'} fillOpacity={l.name === 'Glass' ? 0.55 : 0.85} stroke="rgb(15 23 42 / 0.55)" strokeWidth={1} />
              <text
                transform={`translate(${edges[i]! + widths[i]! / 2 + 4},${(TOP + BOT) / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#0f172a"
                style={{ paintOrder: 'stroke', stroke: 'rgb(255 255 255 / 0.35)', strokeWidth: 2 }}
              >
                {t(l.name)} · {nf(l.s * 1000, 1)} mm
              </text>
            </g>
          ))}
          {/* both faces */}
          {faceArrows(fIn, inner, -1)}
          {faceArrows(fOut, outer, 1)}
          {/* temperature ticks under the wall */}
          {edges.map((x, i) => (
            <g key={i}>
              <line x1={x} y1={BOT} x2={x} y2={BOT + (i % 2 ? 36 : 14)} stroke="rgb(148 163 184 / 0.5)" strokeWidth={1} />
            </g>
          ))}
          <text x={X0 - 12} y={TOP - 26} textAnchor="end" fontSize={11} fill="rgb(148 163 184)">
            {t('inside')}
          </text>
          <text x={X1 + 12} y={TOP - 26} textAnchor="start" fontSize={11} fill="rgb(148 163 184)">
            {t('outside')}
          </text>
        </svg>
        {faceLabels(fIn, inner, -1)}
        {faceLabels(fOut, outer, 1)}
        <Label x={X0 - 12} y={TOP - 4} align="right" color="rgb(148 163 184)" math={`T_i = ${N(Ti, 1)}\\,^\\circ\\mathrm{C}`} />
        <Label x={X1 + 12} y={TOP - 4} align="left" color="rgb(148 163 184)" math={`T_a = ${N(Ta, 1)}\\,^\\circ\\mathrm{C}`} />
        {edges.map((x, i) => (
          <span key={i} className="pointer-events-none absolute text-[10px] leading-none text-plant-200" style={{ left: `${(x / W) * 100}%`, top: `${((BOT + (i % 2 ? 38 : 16)) / H) * 100}%`, transform: 'translateX(-50%)' }}>
            <Tex math={`${i === 0 ? 'T_{s,i}' : i === n ? 'T_{s,a}' : `T_{${i}|${i + 1}}`} = ${N(temps[i] ?? 0, 1)}\\,^\\circ\\mathrm{C}`} />
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-plant-300">
        {[
          [C.G, t('irradiation G')],
          [C.refl, t('reflected ρ·G')],
          [C.emis, t('self-emission ε·σ·T⁴')],
          [C.abs, t('absorbed α·G')],
          [C.trans, t('transmitted τ·G')],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
        <span className="text-plant-500">· W/m² · {t('arrow width ∝ flux')}</span>
      </div>
    </div>
  );
}
