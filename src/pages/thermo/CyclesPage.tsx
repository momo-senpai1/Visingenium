import { useMemo, useRef } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Card, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { StateDiagram, type Axis, type DPoint, type Line } from '@/components/thermo/StateDiagram';
import { Kpi, Notice } from '@/components/workbench/controls';
import { AIR, carnot, diesel, gasP, gasS, joule, otto, rankine, waterDome, waterIsobarLine, type CycleResult, type Path } from '@/engine/thermo/cycles';
import { psat, pressureTS, satT } from '@/engine/thermo/steam';
import { t } from '@/i18n';
import { navigate } from '@/lib/route';
import { cn } from '@/lib/utils';

type Kind = 'carnot' | 'rankine' | 'joule' | 'otto' | 'diesel';
interface S {
  kind: Kind;
  T0: number;
  // carnot
  cTL: number;
  cTH: number;
  cp1: number;
  cds: number;
  // rankine (pressures in bar, T in °C for the inputs)
  rpc: number;
  rpb: number;
  rT3: number;
  retaT: number;
  retaP: number;
  rTsrc: number;
  // joule
  jT1: number;
  jpr: number;
  jT3: number;
  jetaC: number;
  jetaT: number;
  // otto / diesel
  oT1: number;
  oeps: number;
  oT3: number;
  deps: number;
  dT3: number;
  gTsrc: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const DEFAULTS: Omit<S, 'set'> = {
  kind: 'rankine',
  T0: 288.15,
  cTL: 300,
  cTH: 900,
  cp1: 1,
  cds: 0.5,
  rpc: 0.1,
  rpb: 100,
  rT3: 500,
  retaT: 0.85,
  retaP: 0.8,
  rTsrc: 1200,
  jT1: 288,
  jpr: 12,
  jT3: 1400,
  jetaC: 0.86,
  jetaT: 0.9,
  oT1: 300,
  oeps: 10,
  oT3: 2400,
  deps: 18,
  dT3: 2200,
  gTsrc: 2500,
};
const useCycle = create<S>()(
  persist((set) => ({ ...DEFAULTS, set: (p) => set(p) }), { name: 'ts-thermo-cycles', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...r }) => r }),
);

const KINDS: { id: Kind; label: string; sub: string }[] = [
  { id: 'carnot', label: 'Carnot', sub: 'reversible reference' },
  { id: 'rankine', label: 'Clausius–Rankine', sub: 'steam power plant' },
  { id: 'joule', label: 'Joule (Brayton)', sub: 'gas turbine' },
  { id: 'otto', label: 'Otto', sub: 'spark-ignition engine' },
  { id: 'diesel', label: 'Diesel', sub: 'compression-ignition engine' },
];

const C = {
  in: 'rgb(var(--sig-alarm))',
  out: 'rgb(var(--sig-vapor))',
  work: 'rgb(var(--sig-liquid))',
  dome: 'rgb(var(--plant-300))',
  faint: 'rgb(var(--plant-500)/0.55)',
};
const pathColor = (p: Path) => (p.kind === 'heat-in' ? C.in : p.kind === 'heat-out' ? C.out : C.work);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function compute(s: S): CycleResult {
  switch (s.kind) {
    case 'carnot':
      return carnot({ TL: s.cTL, TH: s.cTH, p1: s.cp1 * 100, ds: s.cds, T0: s.T0 });
    case 'rankine':
      return rankine({ pc: s.rpc * 100, pb: s.rpb * 100, T3: s.rT3 + 273.15, etaT: s.retaT, etaP: s.retaP, T0: s.T0, Tsrc: s.rTsrc + 273.15 });
    case 'joule':
      return joule({ T1: s.jT1, p1: 100, pr: s.jpr, T3: s.jT3, etaC: s.jetaC, etaT: s.jetaT, T0: s.T0, Tsrc: s.gTsrc });
    case 'otto':
      return otto({ T1: s.oT1, p1: 100, eps: s.oeps, T3: s.oT3, T0: s.T0, Tsrc: s.gTsrc });
    case 'diesel':
      return diesel({ T1: s.oT1, p1: 100, eps: s.deps, T3: s.dT3, T0: s.T0, Tsrc: s.gTsrc });
  }
}

/** Axis ranges that only grow while dragging (no jumping under the cursor); reset per cycle type. */
function useStickyRange(key: string, lo: number, hi: number, log = false) {
  const r = useRef<{ key: string; lo: number; hi: number } | null>(null);
  if (!r.current || r.current.key !== key) r.current = { key, lo, hi };
  else {
    if (lo < r.current.lo) r.current.lo = log ? lo / 1.5 : lo - (hi - lo) * 0.1;
    if (hi > r.current.hi) r.current.hi = log ? hi * 1.5 : hi + (hi - lo) * 0.1;
  }
  return [r.current.lo, r.current.hi] as const;
}

export default function CyclesPage() {
  const s = useCycle();
  const r = useMemo(() => compute(s), [s]);
  const steam = s.kind === 'rankine';
  const dome = useMemo(() => waterDome(), []);
  const Tconv = (T: number) => (steam ? T - 273.15 : T);
  const Tunit = steam ? '°C' : 'K';

  // ---- axis ranges
  const sv = r.points.map((p) => p.s).concat(r.paths.flatMap((p) => p.s));
  const Tv = r.points.map((p) => Tconv(p.T));
  const pad = (a: number, b: number, f = 0.12) => [a - (b - a) * f, b + (b - a) * f] as const;
  const sRange = steam ? ([0, 9.5] as const) : pad(Math.min(...sv), Math.max(...sv));
  const TRange = steam ? ([0, 650] as const) : ([Math.max(0, Math.min(...Tv) - 100), Math.max(...Tv) * 1.12] as const);
  const [sLo, sHi] = useStickyRange(`${s.kind}-s`, sRange[0], sRange[1]);
  const [TLo, THi] = useStickyRange(`${s.kind}-T`, TRange[0], TRange[1]);
  const vs = r.points.map((p) => p.v);
  const ps = r.points.map((p) => p.p / 100);
  const [vLo, vHi] = useStickyRange(`${s.kind}-v`, steam ? 5e-4 : 0, steam ? 200 : Math.max(...vs) * 1.15, steam);
  const [pLo, pHi] = useStickyRange(`${s.kind}-p`, steam ? 0.005 : 0, steam ? 300 : Math.max(...ps) * 1.12, steam);
  const xs: Axis = { label: 's [kJ/(kg·K)]', min: sLo, max: sHi };
  const yT: Axis = { label: `T [${Tunit}]`, min: TLo, max: THi };
  const xv: Axis = steam ? { label: 'v [m³/kg] (log)', min: vLo, max: vHi, log: true } : { label: 'v [m³/kg]', min: Math.max(0, vLo), max: vHi };
  const yp: Axis = steam ? { label: 'p [bar] (log)', min: pLo, max: pHi, log: true } : { label: 'p [bar]', min: Math.max(0, pLo), max: pHi };

  // ---- background lines
  const bgTs: Line[] = [];
  const bgPv: Line[] = [];
  if (steam) {
    bgTs.push({ pts: dome.map((d) => ({ x: d.sL, y: d.T - 273.15 })), color: C.dome, width: 1.4 }, { pts: dome.map((d) => ({ x: d.sV, y: d.T - 273.15 })), color: C.dome, width: 1.4 });
    bgPv.push({ pts: dome.map((d) => ({ x: d.vL, y: d.p / 100 })), color: C.dome, width: 1.4 }, { pts: dome.map((d) => ({ x: d.vV, y: d.p / 100 })), color: C.dome, width: 1.4 });
    for (const pb of [0.05, 0.5, 5, 50, 200]) {
      const l = waterIsobarLine(pb * 100, 923);
      bgTs.push({ pts: l.map((q) => ({ x: q.s, y: q.T - 273.15 })), color: C.faint, dashed: true, label: `${pb} bar` });
    }
    for (const T of [100, 200, 300, 400, 500, 600]) {
      // isotherm in p,v: liquid ~ vertical, wet horizontal, vapour ~ hyperbola
      const pts: { x: number; y: number }[] = [];
      const Tk = T + 273.15;
      const ps0 = Tk < 647 ? psat(Tk) : 22064;
      for (let i = 0; i <= 40; i++) {
        const p = 0.6 * (ps0 / 0.6) ** (i / 40);
        const w = waterIsobarLine(p, Tk, 4).find((q) => Math.abs(q.T - Tk) < 1e-6) ?? null;
        if (w) pts.push({ x: w.v, y: p / 100 });
      }
      if (Tk < 647) {
        const sat = satT(Tk);
        pts.push({ x: sat.vV, y: sat.p / 100 }, { x: sat.vL, y: sat.p / 100 }, { x: sat.vL * 0.98, y: 300 });
      }
      bgPv.push({ pts, color: C.faint, dashed: true });
    }
  } else {
    const pLevels = [...new Set(r.points.map((p) => p.p))];
    for (const p of pLevels) {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const T = Math.max(50, TLo) + ((THi - Math.max(50, TLo)) * i) / 60;
        pts.push({ x: gasS(T, p), y: T });
      }
      bgTs.push({ pts, color: C.faint, dashed: true, label: `${nf(p / 100, 3)} bar` });
    }
    for (const T of [...new Set(r.points.map((p) => p.T))]) {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const v = Math.max(vLo, 0.005) + ((vHi - Math.max(vLo, 0.005)) * i) / 60;
        pts.push({ x: v, y: (AIR.R * T) / v / 100 });
      }
      bgPv.push({ pts, color: C.faint, dashed: true, label: `${nf(T, 4)} K` });
    }
  }
  const pathsTs: Line[] = r.paths.map((p) => ({ pts: p.s.map((x, i) => ({ x, y: Tconv(p.T[i]!) })), color: pathColor(p) }));
  const pathsPv: Line[] = r.paths.map((p) => ({ pts: p.v.map((x, i) => ({ x, y: p.p[i]! / 100 })), color: pathColor(p) }));

  // ---- draggable points
  const drag = new Set<string>(s.kind === 'carnot' ? ['1', '3'] : ['1', '3', ...(s.kind !== 'joule' ? ['2'] : [])]);
  const ptsTs: DPoint[] = r.points.map((p) => ({ id: p.id, x: p.s, y: Tconv(p.T), label: p.id, draggable: drag.has(p.id) && !(steam && p.id === '2') }));
  const ptsPv: DPoint[] = r.points.map((p) => ({ id: p.id, x: p.v, y: p.p / 100, label: p.id, draggable: drag.has(p.id) && !(steam && p.id === '2') }));

  const onTs = (id: string, x: number, y: number) => {
    const T = steam ? y + 273.15 : y;
    if (s.kind === 'carnot') {
      if (id === '3') s.set({ cTH: clamp(T, s.cTL + 10, 3000), cds: clamp(x - r.points[0]!.s, 0.01, 3) });
      if (id === '1') s.set({ cTL: clamp(T, 150, s.cTH - 10), cp1: clamp(gasP(T, x) / 100, 0.05, 200) });
    } else if (steam) {
      if (id === '3') {
        const Tc = clamp(T, 300, 923);
        const sV = satT(Math.min(Tc, 647)).sV;
        const pb = Tc < 647 && x <= sV ? psat(Tc) : pressureTS(Tc, x);
        s.set({ rT3: Tc - 273.15, rpb: clamp(pb / 100, s.rpc * 3, 120) });
      }
      if (id === '1' || id === '4') s.set({ rpc: clamp(psat(clamp(T, 280, 450)) / 100, 0.01, 5) });
    } else if (s.kind === 'joule') {
      if (id === '3') s.set({ jT3: clamp(T, r.points[1]!.T + 20, 2200), jpr: clamp(gasP(T, x) / 100, 1.5, 60) });
      if (id === '1') s.set({ jT1: clamp(T, 200, 400) });
    } else {
      if (id === '3') s.set(s.kind === 'otto' ? { oT3: clamp(T, r.points[1]!.T + 20, 3500) } : { dT3: clamp(T, r.points[1]!.T + 20, 3500) });
      if (id === '1') s.set({ oT1: clamp(T, 200, 450) });
      if (id === '2') {
        // 1→2 is isentropic: the compression ratio follows from T₂/T₁ = ε^(κ−1)
        const eps = clamp((T / s.oT1) ** (1 / (AIR.k - 1)), 2, 30);
        s.set(s.kind === 'otto' ? { oeps: eps } : { deps: eps });
      }
    }
  };
  const onPv = (id: string, x: number, y: number) => {
    const p = y * 100;
    if (s.kind === 'carnot') {
      if (id === '1') s.set({ cp1: clamp(y, 0.05, 200) });
      if (id === '3') {
        const T = (p * x) / AIR.R;
        s.set({ cTH: clamp(T, s.cTL + 10, 3000), cds: clamp(gasS(T, p) - r.points[0]!.s, 0.01, 3) });
      }
    } else if (steam) {
      if (id === '3') s.set({ rpb: clamp(y, s.rpc * 3, 120) });
      if (id === '1' || id === '4') s.set({ rpc: clamp(y, 0.01, 5) });
    } else if (s.kind === 'joule') {
      if (id === '3') s.set({ jpr: clamp(y, 1.5, 60), jT3: clamp((p * x) / AIR.R, r.points[1]!.T + 20, 2200) });
      if (id === '1') s.set({ jT1: clamp((p * x) / AIR.R, 200, 400) });
    } else {
      if (id === '2') {
        const eps = clamp(r.points[0]!.v / Math.max(x, 1e-3), 2, 30);
        s.set(s.kind === 'otto' ? { oeps: eps } : { deps: eps });
      }
      if (id === '3') {
        const T = (p * x) / AIR.R;
        s.set(s.kind === 'otto' ? { oT3: clamp(T, r.points[1]!.T + 20, 3500) } : { dT3: clamp(T, r.points[1]!.T + 20, 3500) });
      }
      if (id === '1') s.set({ oT1: clamp((p * x) / AIR.R, 200, 450) });
    }
  };

  const lossTotal = r.losses.reduce((a, l) => a + l.loss, 0);
  const pct = (v: number) => `${nf(v * 100, 1)}`;
  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Cycle">
          <div className="grid grid-cols-1 gap-1">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={s.kind === k.id} onClick={() => s.set({ kind: k.id })} className={cn('rounded border px-2 py-1 text-left', s.kind === k.id ? 'border-signal-liquid/50 bg-signal-liquid/10' : 'border-white/[0.06] hover:bg-white/[0.03]')}>
                <span className="block text-[12px] text-plant-100">{t(k.label)}</span>
                <span className="block text-[10px] text-plant-500">{t(k.sub)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Parameters">
          <div className="space-y-1.5">
            {s.kind === 'carnot' && (
              <>
                <NumRow label={t('Lower temperature T_L')} unit="K" value={s.cTL} onChange={(v) => s.set({ cTL: v })} />
                <NumRow label={t('Upper temperature T_H')} unit="K" value={s.cTH} onChange={(v) => s.set({ cTH: v })} />
                <NumRow label={t('Pressure p₁')} unit="bar" value={s.cp1} onChange={(v) => s.set({ cp1: v })} />
                <NumRow label={t('Entropy change Δs')} unit="kJ/(kg·K)" value={s.cds} onChange={(v) => s.set({ cds: v })} />
              </>
            )}
            {steam && (
              <>
                <NumRow label={t('Condenser pressure')} unit="bar" value={s.rpc} onChange={(v) => s.set({ rpc: v })} />
                <NumRow label={t('Boiler pressure (≤ 120 bar)')} unit="bar" value={s.rpb} onChange={(v) => s.set({ rpb: v })} />
                <NumRow label={t('Live steam temperature')} unit="°C" value={s.rT3} onChange={(v) => s.set({ rT3: v })} />
                <NumRow label={t('Turbine efficiency η_T')} value={s.retaT} onChange={(v) => s.set({ retaT: v })} />
                <NumRow label={t('Pump efficiency η_P')} value={s.retaP} onChange={(v) => s.set({ retaP: v })} />
                <NumRow label={t('Flue gas temperature')} unit="°C" value={s.rTsrc} onChange={(v) => s.set({ rTsrc: v })} />
                <button type="button" onClick={() => navigate('steam')} className="text-[11px] text-signal-liquid hover:underline">
                  {t('Look up a state in the steam table')} →
                </button>
              </>
            )}
            {s.kind === 'joule' && (
              <>
                <NumRow label={t('Inlet temperature T₁')} unit="K" value={s.jT1} onChange={(v) => s.set({ jT1: v })} />
                <NumRow label={t('Pressure ratio Π')} value={s.jpr} onChange={(v) => s.set({ jpr: v })} />
                <NumRow label={t('Turbine inlet temperature T₃')} unit="K" value={s.jT3} onChange={(v) => s.set({ jT3: v })} />
                <NumRow label={t('Compressor efficiency η_C')} value={s.jetaC} onChange={(v) => s.set({ jetaC: v })} />
                <NumRow label={t('Turbine efficiency η_T')} value={s.jetaT} onChange={(v) => s.set({ jetaT: v })} />
              </>
            )}
            {(s.kind === 'otto' || s.kind === 'diesel') && (
              <>
                <NumRow label={t('Inlet temperature T₁')} unit="K" value={s.oT1} onChange={(v) => s.set({ oT1: v })} />
                <NumRow label={t('Compression ratio ε')} value={s.kind === 'otto' ? s.oeps : s.deps} onChange={(v) => s.set(s.kind === 'otto' ? { oeps: v } : { deps: v })} />
                <NumRow label={t('Maximum temperature T₃')} unit="K" value={s.kind === 'otto' ? s.oT3 : s.dT3} onChange={(v) => s.set(s.kind === 'otto' ? { oT3: v } : { dT3: v })} />
              </>
            )}
            {s.kind !== 'carnot' && !steam && <NumRow label={t('Heat source temperature')} unit="K" value={s.gTsrc} onChange={(v) => s.set({ gTsrc: v })} />}
            <NumRow label={t('Ambient temperature T₀')} unit="K" value={s.T0} onChange={(v) => s.set({ T0: v })} />
          </div>
          <button type="button" onClick={() => s.set({ ...DEFAULTS, kind: s.kind })} className="mt-2 text-[10px] text-plant-500 hover:text-signal-liquid">
            {t('Reset values')}
          </button>
        </Card>
        <Card title="How to use">
          <p className="text-[11px] leading-relaxed text-plant-300">{t('Drag the highlighted state points in the diagrams; efficiency and exergy losses update while you drag. Red: heat input, yellow: heat rejection, green: work (compression/expansion).')}</p>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
          <Kpi label={t('Thermal efficiency η')} value={pct(r.eta)} unit="%" />
          <Kpi label={t('Carnot efficiency')} value={pct(r.etaCarnot)} unit="%" sub={t('between T_min and T_max')} />
          <Kpi label={t('Exergetic efficiency')} value={pct(r.etaEx)} unit="%" />
          <Kpi label={t('Net work w')} value={nf(r.wNet, 1)} unit="kJ/kg" />
          <Kpi label={t('Heat input q_in')} value={nf(r.qIn, 1)} unit="kJ/kg" />
          <Kpi label={t('Exergy losses')} value={nf(lossTotal, 1)} unit="kJ/kg" />
        </div>
        {r.warnings.map((w) => (
          <Notice key={w} tone="warning">
            {t(w)}
          </Notice>
        ))}
        <div className="grid gap-2 2xl:grid-cols-2">
          <Card title="T,s diagram">
            <StateDiagram title={t('T,s diagram')} x={xs} y={yT} lines={bgTs} paths={pathsTs} points={ptsTs} onDrag={onTs} />
          </Card>
          <Card title="p,v diagram">
            <StateDiagram title={t('p,v diagram')} x={xv} y={yp} lines={bgPv} paths={pathsPv} points={ptsPv} onDrag={onPv} />
          </Card>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <Card title="Exergy flow">
            <ExergyBar r={r} />
          </Card>
          <Card title="Energy balance and key values">
            <table className="w-full font-mono text-[11px]">
              <tbody className="divide-y divide-white/[0.04]">
                <Row k={t('Heat input q_in')} v={`${nf(r.qIn, 1)} kJ/kg`} />
                <Row k={t('Heat rejected q_out')} v={`${nf(r.qOut, 1)} kJ/kg`} />
                <Row k={t('Net work w = q_in − q_out')} v={`${nf(r.wNet, 1)} kJ/kg`} />
                {r.extra.map((e) => (
                  <Row key={e.label} k={t(e.label)} v={`${nf(e.value, e.unit ? 3 : 4)} ${e.unit}`} />
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title="State points">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-plant-500">
                  <th className="py-1 pr-3">{t('Point')}</th>
                  <th className="pr-3 text-right">T [{Tunit}]</th>
                  <th className="pr-3 text-right">p [bar]</th>
                  <th className="pr-3 text-right">v [m³/kg]</th>
                  <th className="pr-3 text-right">h [kJ/kg]</th>
                  <th className="pr-3 text-right">s [kJ/(kg·K)]</th>
                  {steam && <th className="text-right">x</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {r.points.map((p) => (
                  <tr key={p.id} className="text-plant-100">
                    <td className="py-1 pr-3">{p.id}</td>
                    <td className="pr-3 text-right">{nf(Tconv(p.T), 2)}</td>
                    <td className="pr-3 text-right">{nf(p.p / 100, 4)}</td>
                    <td className="pr-3 text-right">{p.v < 0.01 ? p.v.toExponential(4) : nf(p.v, 4)}</td>
                    <td className="pr-3 text-right">{nf(p.h, 1)}</td>
                    <td className="pr-3 text-right">{nf(p.s, 4)}</td>
                    {steam && <td className="text-right">{p.x === null || p.x === undefined ? '–' : nf(p.x, 3)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-plant-500">
            {steam
              ? t('Water/steam: IAPWS saturation equations and IF97 region 2 (deviation from the steam tables below 0.1 %, up to a few % right next to the saturation line above 120 bar). Liquid: saturated liquid plus v·Δp.')
              : t('Air as ideal gas with constant c_p = 1.005 kJ/(kg·K), κ = 1.4; s = 0 at 0 °C and 1 bar.')}
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="py-1 pr-3 font-sans text-plant-300">{k}</td>
      <td className="py-1 text-right text-plant-100">{v}</td>
    </tr>
  );
}

const LOSS_COLORS = ['rgb(var(--sig-heat))', 'rgb(var(--sig-alarm))', 'rgb(var(--sig-vapor))', 'rgb(var(--plant-400))'];
function ExergyBar({ r }: { r: CycleResult }) {
  const total = Math.max(r.exIn, 1e-9);
  const parts = [{ name: 'Net work (useful)', loss: r.wNet, color: 'rgb(var(--sig-liquid))' }, ...r.losses.map((l, i) => ({ ...l, color: LOSS_COLORS[i % 4]! }))].filter((p) => p.loss > 1e-6);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-plant-300">
        {t('Exergy of the supplied heat')}: <span className="font-mono text-plant-100">{nf(r.exIn, 1)} kJ/kg</span> = q_in · (1 − T₀/T_source)
      </p>
      <div className="flex h-6 w-full overflow-hidden rounded">
        {parts.map((p) => (
          <div key={p.name} title={`${t(p.name)}: ${nf(p.loss, 1)} kJ/kg`} style={{ width: `${(p.loss / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="space-y-0.5 text-[11px]">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1 text-plant-300">{t(p.name)}</span>
            <span className="font-mono text-plant-100">{nf(p.loss, 1)} kJ/kg</span>
            <span className="w-14 text-right font-mono text-plant-400">{nf((p.loss / total) * 100, 1)} %</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-plant-500">{t('Exergy loss = T₀ · entropy generated. The largest block shows where improving the cycle pays off most.')}</p>
    </div>
  );
}
