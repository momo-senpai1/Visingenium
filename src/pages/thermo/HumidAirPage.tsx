import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Card, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { StateDiagram, type DPoint, type Line } from '@/components/thermo/StateDiagram';
import { Kpi, Notice } from '@/components/workbench/controls';
import { CP_A, heatCool, humidify, mix, mollierY, phiOf, R0, state, tFromMollier, xOf, xSat, type AirState } from '@/engine/thermo/humidair';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

type Mode = 'heat' | 'mix' | 'humid';
interface S {
  mode: Mode;
  p: number;
  t1: number;
  phi1: number;
  t2: number;
  phi2: number;
  tTarget: number;
  share1: number;
  phiTarget: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useHX = create<S>()(
  persist(
    (set) => ({
      mode: 'heat',
      p: 101.325,
      t1: 28,
      phi1: 0.6,
      t2: 0,
      phi2: 0.8,
      tTarget: 14,
      share1: 0.3,
      phiTarget: 0.9,
      set: (p) => set(p),
    }),
    {
      name: 'ts-thermo-hx',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ set: _s, ...r }) => r,
    },
  ),
);
const MODES: { id: Mode; label: string }[] = [
  { id: 'heat', label: 'Heating / cooling (with condensation)' },
  { id: 'mix', label: 'Mixing of two air streams' },
  { id: 'humid', label: 'Adiabatic humidification (water spray)' },
];
const X_MAX = 30; // g/kg
const Y_MIN = -10;
const Y_MAX = 50;

export default function HumidAirPage() {
  const s = useHX();
  const p = s.p;
  const A = state(s.t1, xOf(s.t1, s.phi1, p), p);
  const B = state(s.t2, xOf(s.t2, s.phi2, p), p);
  let res: {
    end: AirState;
    info: { label: string; value: string }[];
    path: AirState[];
  };
  if (s.mode === 'heat') {
    const r = heatCool(A, s.tTarget, p);
    // path: constant x down to the dew point, then along saturation
    const path: AirState[] = [A];
    if (r.condensate > 0) {
      path.push(state(A.tDew, A.x, p));
      for (let i = 1; i <= 20; i++) {
        const tt = A.tDew + ((s.tTarget - A.tDew) * i) / 20;
        path.push(state(tt, xSat(tt, p), p));
      }
    } else path.push(r.s2);
    res = {
      end: r.s2,
      path,
      info: [
        {
          label: r.q >= 0 ? 'Heat supplied q' : 'Heat removed q',
          value: `${nf(Math.abs(r.q), 2)} kJ/kg`,
        },
        { label: 'Condensate', value: `${nf(r.condensate * 1000, 2)} g/kg` },
      ],
    };
  } else if (s.mode === 'mix') {
    const M = mix(A, B, s.share1, 1 - s.share1, p);
    res = {
      end: M,
      path: [A, M, B],
      info: [
        { label: 'Share of stream 1', value: `${nf(s.share1 * 100, 1)} %` },
        ...(M.fog
          ? [
              {
                label: 'Fog (liquid water)',
                value: `${nf((M.x - xSat(M.t, p)) * 1000, 2)} g/kg`,
              },
            ]
          : []),
      ],
    };
  } else {
    const r = humidify(A, s.phiTarget, A.tWet, p);
    res = {
      end: r.s2,
      path: [A, r.s2],
      info: [
        { label: 'Water added', value: `${nf(r.water * 1000, 2)} g/kg` },
        { label: 'Cooling by evaporation', value: `${nf(A.t - r.s2.t, 2)} K` },
      ],
    };
  }
  const E = res.end;

  // ---- background of the h,x diagram
  const bg: Line[] = useMemo(() => {
    const out: Line[] = [];
    for (const phi of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const pts = [];
      for (let tt = Y_MIN; tt <= 60; tt += 0.5) {
        const x = xOf(tt, phi, p);
        if (x * 1000 > X_MAX * 1.05) break;
        pts.push({ x: x * 1000, y: mollierY(tt, x, p) });
      }
      out.push({
        pts,
        color: phi === 1 ? 'rgb(var(--sig-vapor))' : 'rgb(var(--sig-liquid)/0.45)',
        width: phi === 1 ? 1.8 : 1,
        label: Math.round(phi * 100) % 20 === 0 ? `φ = ${Math.round(phi * 100)} %` : undefined,
      });
    }
    for (let tt = -10; tt <= 50; tt += 5) {
      const xs = Math.min(xSat(tt, p), X_MAX / 1000);
      out.push({
        pts: [
          { x: 0, y: mollierY(tt, 0, p) },
          { x: xs * 1000, y: mollierY(tt, xs, p) },
        ],
        color: 'rgb(var(--plant-500)/0.6)',
        label: tt % 10 === 0 ? `${tt} °C` : undefined,
        labelAt: 'start',
      });
    }
    for (let hh = -10; hh <= 130; hh += 10) {
      const pts = [];
      for (let x = 0; x <= X_MAX / 1000; x += 0.0005) {
        const y = (hh - R0 * x) / CP_A;
        const tt = tFromMollier(y, x);
        if (x > xSat(tt, p)) break;
        pts.push({ x: x * 1000, y });
      }
      if (pts.length > 1)
        out.push({
          pts,
          color: 'rgb(var(--sig-heat)/0.35)',
          dashed: true,
          label: hh % 20 === 0 && hh > 0 ? `h = ${hh}` : undefined,
        });
    }
    return out;
  }, [p]);
  const P = (st: AirState) => ({ x: st.x * 1000, y: mollierY(st.t, st.x, p) });
  const points: DPoint[] = [
    { id: '1', ...P(A), label: '1', draggable: true },
    ...(s.mode === 'mix' ? [{ id: '2', ...P(B), label: '2', draggable: true }] : []),
    { id: 'E', ...P(E), label: s.mode === 'mix' ? 'M' : '2' },
  ];
  const onDrag = (id: string, gx: number, y: number) => {
    const x = Math.max(0, gx / 1000);
    const tt = Math.min(Y_MAX, Math.max(Y_MIN, tFromMollier(y, x)));
    const phi = Math.min(1, Math.max(0.01, phiOf(tt, x, p)));
    if (id === '1') s.set({ t1: Number(tt.toFixed(2)), phi1: Number(phi.toFixed(3)) });
    if (id === '2') s.set({ t2: Number(tt.toFixed(2)), phi2: Number(phi.toFixed(3)) });
  };
  const row = (label: string, st: AirState) => (
    <tr className="text-right text-plant-100">
      <td className="py-1 pr-3 text-left font-sans text-plant-300">{t(label)}</td>
      <td className="pr-3">{nf(st.t, 2)}</td>
      <td className="pr-3">{nf(st.phi * 100, 1)}</td>
      <td className="pr-3">{nf(st.x * 1000, 2)}</td>
      <td className="pr-3">{nf(st.h, 2)}</td>
      <td className="pr-3">{nf(st.tDew, 2)}</td>
      <td className="pr-3">{nf(st.tWet, 2)}</td>
      <td>{nf(st.rho, 4)}</td>
    </tr>
  );
  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Process">
          <div className="space-y-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={s.mode === m.id}
                onClick={() => s.set({ mode: m.id })}
                className={cn('block w-full rounded px-2 py-1 text-left text-[11px]', s.mode === m.id ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:bg-white/[0.04]')}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
        </Card>
        <Card title="States">
          <div className="space-y-1.5">
            <NumRow label={t('t₁')} unit="°C" value={s.t1} onChange={(v) => s.set({ t1: v })} />
            <NumRow label={t('φ₁')} value={s.phi1} onChange={(v) => s.set({ phi1: Math.min(1, Math.max(0, v)) })} />
            {s.mode === 'heat' && <NumRow label={t('Target temperature t₂')} unit="°C" value={s.tTarget} onChange={(v) => s.set({ tTarget: v })} />}
            {s.mode === 'mix' && (
              <>
                <NumRow label={t('t₂')} unit="°C" value={s.t2} onChange={(v) => s.set({ t2: v })} />
                <NumRow label={t('φ₂')} value={s.phi2} onChange={(v) => s.set({ phi2: Math.min(1, Math.max(0, v)) })} />
                <NumRow label={t('Mass share of stream 1')} value={s.share1} onChange={(v) => s.set({ share1: Math.min(1, Math.max(0, v)) })} />
              </>
            )}
            {s.mode === 'humid' && <NumRow label={t('Target relative humidity')} value={s.phiTarget} onChange={(v) => s.set({ phiTarget: Math.min(1, Math.max(0, v)) })} />}
            <NumRow label={t('Pressure p')} unit="kPa" value={s.p} onChange={(v) => s.set({ p: Math.max(50, v) })} />
          </div>
        </Card>
        <Card title="Relations">
          <div className="space-y-1 text-[12px] text-plant-100">
            <Tex block math="x = 0.622\,\frac{\varphi\,p_s}{p - \varphi\,p_s}" />
            <Tex block math="h_{1+x} = c_{pL}\,t + x\,(r_0 + c_{pD}\,t)" />
            <Tex block math="r_0 = 2501\ \tfrac{kJ}{kg},\ c_{pL} = 1.006,\ c_{pD} = 1.86\ \tfrac{kJ}{kg\,K}" />
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {res.info.map((i) => (
            <Kpi key={i.label} label={t(i.label)} value={i.value} small />
          ))}
          <Kpi label={t('End state')} value={`${nf(E.t, 1)} °C · ${nf(E.phi * 100, 0)} %`} small />
          <Kpi label={t('Enthalpy change Δh')} value={nf(E.h - A.h, 2)} unit="kJ/kg" />
        </div>
        {E.fog && <Notice tone="warning">{t('The end state lies in the fog region: the air is supersaturated and carries liquid droplets.')}</Notice>}
        <Card title="h,x diagram (Mollier) — drag the states">
          <div className="mx-auto max-w-4xl">
            <StateDiagram
              title={t('h,x diagram (Mollier)')}
              x={{ label: 'x [g/kg dry air]', min: 0, max: X_MAX }}
              y={{
                label: 't [°C] (Mollier: skewed h axis)',
                min: Y_MIN,
                max: Y_MAX,
              }}
              lines={bg}
              paths={[
                {
                  pts: res.path.map(P),
                  color: 'rgb(var(--sig-alarm))',
                  width: 2.4,
                },
              ]}
              points={points}
              onDrag={onDrag}
            />
          </div>
          <p className="mt-1 text-[10px] text-plant-500">
            {t(
              'Blue/green: relative humidity φ, yellow: saturation line (φ = 100 %), grey: isotherms, orange dashed: lines of constant enthalpy h [kJ/kg]. Below the saturation line is the fog region.',
            )}
          </p>
        </Card>
        <Card title="State values">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-right text-[10px] uppercase tracking-wider text-plant-500">
                  <th className="py-1 pr-3 text-left">{t('State')}</th>
                  <th className="pr-3">t [°C]</th>
                  <th className="pr-3">φ [%]</th>
                  <th className="pr-3">x [g/kg]</th>
                  <th className="pr-3">h [kJ/kg]</th>
                  <th className="pr-3">{t('dew point')} [°C]</th>
                  <th className="pr-3">{t('wet bulb')} [°C]</th>
                  <th>ρ [kg/m³]</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {row('State 1', A)}
                {s.mode === 'mix' && row('State 2', B)}
                {row(s.mode === 'mix' ? 'Mixture M' : 'End state 2', E)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
