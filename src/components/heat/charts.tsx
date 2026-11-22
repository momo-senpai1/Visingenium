/** Generic multi-series line chart for the heat-transfer pages. */

import { CartesianGrid, ComposedChart, Label, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, VIZ } from '@/components/analysis/vizTokens';
import { nf } from '@/components/mechanics/common';
import { MathText } from '@/components/MathText';

export const SERIES = [VIZ.equilibrium, VIZ.operating, VIZ.qLine, VIZ.text, 'rgb(var(--sig-vapor))', 'rgb(var(--sig-alarm))'];

export interface Series {
  name: string;
  data: { x: number; y: number }[];
  color?: string;
  dashed?: boolean;
}

export function LineChartBox({
  series,
  xLabel,
  yLabel,
  height = 300,
  xDomain,
  yDomain,
  logX = false,
  logY = false,
  refX,
  digits = 2,
}: {
  series: Series[];
  xLabel: string;
  yLabel: string;
  height?: number;
  xDomain?: [number | 'auto', number | 'auto'];
  yDomain?: [number | 'auto', number | 'auto'];
  logX?: boolean;
  logY?: boolean;
  refX?: { x: number; label: string }[];
  digits?: number;
}) {
  const lbl = { fill: VIZ.textMuted, fontSize: 10, fontFamily: 'Inter, sans-serif' };
  const decades = (vals: number[], dom?: [number | 'auto', number | 'auto']) => {
    const pos = vals.filter((v) => v > 0 && Number.isFinite(v));
    const lo = typeof dom?.[0] === 'number' ? dom[0] : Math.min(...pos);
    const hi = typeof dom?.[1] === 'number' ? dom[1] : Math.max(...pos);
    if (!pos.length || !(hi > lo)) return undefined;
    const out: number[] = [];
    for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) out.push(10 ** k);
    return out;
  };
  const xTicks = logX
    ? decades(
        series.flatMap((s) => s.data.map((d) => d.x)),
        xDomain,
      )
    : undefined;
  const yTicks = logY
    ? decades(
        series.flatMap((s) => s.data.map((d) => d.y)),
        yDomain,
      )
    : undefined;
  const sup = (v: number) => {
    const k = Math.round(Math.log10(v));
    return k >= -2 && k <= 3 ? String(v) : `1e${k}`;
  };
  return (
    <div>
      <ul className="mb-1 flex flex-wrap gap-x-4 text-[10px] text-plant-300">
        {series.map((s, i) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color ?? SERIES[i % SERIES.length] }} />
            <MathText>{s.name}</MathText>
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: refX?.length ? 18 : 8, right: 16, bottom: 22, left: 4 }}>
          <CartesianGrid stroke={VIZ.grid} />
          <XAxis
            type="number"
            dataKey="x"
            scale={logX ? 'log' : 'auto'}
            domain={xDomain ?? (logX && xTicks ? [xTicks[0]!, xTicks.at(-1)!] : ['auto', 'auto'])}
            ticks={xTicks}
            allowDataOverflow
            tick={axisTick}
            stroke={VIZ.axis}
            tickLine={false}
            tickFormatter={(v: number) => (logX ? sup(v) : nf(v, digits))}
          >
            <Label value={xLabel} position="bottom" offset={6} style={lbl} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            scale={logY ? 'log' : 'auto'}
            domain={yDomain ?? (logY && yTicks ? [yTicks[0]!, yTicks.at(-1)!] : ['auto', 'auto'])}
            ticks={yTicks}
            allowDataOverflow
            tick={axisTick}
            stroke={VIZ.axis}
            tickLine={false}
            width={54}
            tickFormatter={(v: number) => (logY ? sup(v) : Math.abs(v) >= 1e5 ? v.toExponential(1) : nf(v, digits))}
          >
            <Label value={yLabel} angle={-90} position="insideLeft" offset={4} style={{ ...lbl, textAnchor: 'middle' }} />
          </YAxis>
          {refX?.map((r) => (
            <ReferenceLine key={r.label} x={r.x} stroke={VIZ.textFaint} strokeDasharray="4 3" label={{ value: r.label, position: 'top', fill: VIZ.textMuted, fontSize: 10 }} />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.name}
              data={s.data}
              dataKey="y"
              name={s.name}
              stroke={s.color ?? SERIES[i % SERIES.length]}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            contentStyle={{ background: 'rgb(var(--plant-950))', border: '1px solid rgb(var(--white)/0.1)', fontSize: 10 }}
            formatter={(raw) => {
              const v = Number(raw);
              return nf(v, digits + 2);
            }}
            labelFormatter={(raw) => {
              const l = Number(raw);
              return `${xLabel}: ${nf(l, digits + 2)}`;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
