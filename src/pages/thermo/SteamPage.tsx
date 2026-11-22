import { useMemo, useState } from 'react';
import { Card, fieldCls, nf, NumRow } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { satP, satT, stateTP, statePH, statePS, statePX, tsat, TC, PC, type WaterState } from '@/engine/thermo/steam';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

type Mode = 'pT' | 'px' | 'Tx' | 'ph' | 'ps';
const MODES: { id: Mode; label: string }[] = [
  { id: 'pT', label: 'p and T' },
  { id: 'px', label: 'p and quality x' },
  { id: 'Tx', label: 'T and quality x' },
  { id: 'ph', label: 'p and h' },
  { id: 'ps', label: 'p and s' },
];

export default function SteamPage() {
  const [mode, setMode] = useState<Mode>('pT');
  const [p, setP] = useState(10);
  const [T, setT] = useState(300);
  const [x, setX] = useState(0.9);
  const [h, setH] = useState(2800);
  const [sv, setS] = useState(6.5);
  const [from, setFrom] = useState(0.01);
  const [to, setTo] = useState(200);
  const st: WaterState | null = useMemo(() => {
    const pk = p * 100;
    if (!(pk > 0.6 && pk < PC)) return null;
    switch (mode) {
      case 'pT':
        return stateTP(T + 273.15, pk);
      case 'px':
        return statePX(pk, x);
      case 'Tx':
        return T + 273.15 < TC ? statePX(satT(T + 273.15).p, x) : null;
      case 'ph':
        return statePH(pk, h);
      case 'ps':
        return statePS(pk, sv);
    }
  }, [mode, p, T, x, h, sv]);
  const table = useMemo(() => {
    const out = [];
    const a = Math.max(0.0062, Math.min(from, to));
    const b = Math.min(220, Math.max(from, to));
    for (let i = 0; i <= 14; i++) {
      const pb = a * (b / a) ** (i / 14);
      out.push(satP(pb * 100));
    }
    return out;
  }, [from, to]);
  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2">
        <Card title="State of water / steam">
          <div className="mb-2 grid grid-cols-2 gap-1">
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn('rounded px-2 py-1 text-[11px]', mode === m.id ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:bg-white/[0.04]')}>
                {t(m.label)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {mode !== 'Tx' && <NumRow label={t('Pressure p')} unit="bar" value={p} onChange={setP} />}
            {(mode === 'pT' || mode === 'Tx') && <NumRow label={t('Temperature T')} unit="°C" value={T} onChange={setT} />}
            {(mode === 'px' || mode === 'Tx') && <NumRow label={t('Quality x')} value={x} onChange={(v) => setX(Math.min(1, Math.max(0, v)))} />}
            {mode === 'ph' && <NumRow label={t('Enthalpy h')} unit="kJ/kg" value={h} onChange={setH} />}
            {mode === 'ps' && <NumRow label={t('Entropy s')} unit="kJ/(kg·K)" value={sv} onChange={setS} />}
          </div>
          {mode !== 'Tx' && p * 100 < PC && <p className="mt-2 text-[10px] text-plant-500">{t('Saturation temperature at this pressure')}: {nf(tsat(p * 100) - 273.15, 2)} °C</p>}
        </Card>
        <Card title="Model">
          <p className="text-[10px] leading-relaxed text-plant-400">{t('IAPWS saturation equations (Wagner–Pruß) and IF97 region 2 for superheated steam; deviation from the steam tables below 0.1 % (a few % only right next to the saturation line above 120 bar). Compressed liquid: saturated liquid at T plus v·Δp.')}</p>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        {!st ? (
          <Notice tone="warning">{t('Outside the range of the model (0.006 bar … 220 bar, below the critical point).')}</Notice>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-7">
            <Kpi label={t('Phase')} value={t(st.phase === 'wet' ? 'wet steam' : st.phase === 'liquid' ? 'liquid' : 'superheated steam')} small />
            <Kpi label="T" value={nf(st.T - 273.15, 3)} unit="°C" />
            <Kpi label="p" value={nf(st.p / 100, 5)} unit="bar" />
            <Kpi label="v" value={st.v < 0.01 ? st.v.toExponential(4) : nf(st.v, 5)} unit="m³/kg" />
            <Kpi label="h" value={nf(st.h, 2)} unit="kJ/kg" />
            <Kpi label="s" value={nf(st.s, 4)} unit="kJ/(kg·K)" />
            <Kpi label="x" value={st.x === null ? '–' : nf(st.x, 4)} />
          </div>
        )}
        <Card title="Saturation table (pressure)">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-plant-300">
            {t('from')}
            <input aria-label="from" className={cn(fieldCls, 'w-20')} value={from} onChange={(e) => Number(e.target.value.replace(',', '.')) > 0 && setFrom(Number(e.target.value.replace(',', '.')))} />
            {t('to')}
            <input aria-label="to" className={cn(fieldCls, 'w-20')} value={to} onChange={(e) => Number(e.target.value.replace(',', '.')) > 0 && setTo(Number(e.target.value.replace(',', '.')))} />
            bar
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-right text-[10px] uppercase tracking-wider text-plant-500">
                  <th className="py-1 pr-3">p [bar]</th>
                  <th className="pr-3">T_s [°C]</th>
                  <th className="pr-3">v′ [m³/kg]</th>
                  <th className="pr-3">v″ [m³/kg]</th>
                  <th className="pr-3">h′</th>
                  <th className="pr-3">h″</th>
                  <th className="pr-3">r = h″ − h′</th>
                  <th className="pr-3">s′</th>
                  <th>s″</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-right text-plant-100">
                {table.map((r) => (
                  <tr key={r.p}>
                    <td className="py-1 pr-3">{nf(r.p / 100, 4)}</td>
                    <td className="pr-3">{nf(r.T - 273.15, 2)}</td>
                    <td className="pr-3">{r.vL.toFixed(6)}</td>
                    <td className="pr-3">{nf(r.vV, 4)}</td>
                    <td className="pr-3">{nf(r.hL, 1)}</td>
                    <td className="pr-3">{nf(r.hV, 1)}</td>
                    <td className="pr-3">{nf(r.hV - r.hL, 1)}</td>
                    <td className="pr-3">{nf(r.sL, 4)}</td>
                    <td>{nf(r.sV, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-plant-500">{t('h in kJ/kg, s in kJ/(kg·K). r: enthalpy of vaporisation.')}</p>
        </Card>
      </div>
    </div>
  );
}
