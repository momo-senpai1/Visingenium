import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Card, fieldCls, nf, Num, NumRow, safeStorage } from '@/components/mechanics/common';
import { StateDiagram, type Line } from '@/components/thermo/StateDiagram';
import { Kpi, Notice } from '@/components/workbench/controls';
import { binodal, gasMixture, gMix, spinodal, ucst, type GasComp } from '@/engine/thermo/mixtures';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface S {
  tab: 'gap' | 'gas';
  a12: number;
  a21: number;
  T: number;
  z: number;
  comps: GasComp[];
  p: number;
  Tg: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const AIR: GasComp[] = [
  { name: 'N₂', n: 78.08, M: 28.013, cp: 29.12 },
  { name: 'O₂', n: 20.95, M: 31.999, cp: 29.38 },
  { name: 'Ar', n: 0.93, M: 39.948, cp: 20.79 },
  { name: 'CO₂', n: 0.04, M: 44.01, cp: 37.12 },
];
const PRESETS: Record<string, { label: string; comps: GasComp[] }> = {
  air: { label: 'Dry air', comps: AIR },
  flue: {
    label: 'Flue gas (natural gas, λ = 1.1)',
    comps: [
      { name: 'N₂', n: 71.6, M: 28.013, cp: 29.12 },
      { name: 'CO₂', n: 8.6, M: 44.01, cp: 37.12 },
      { name: 'H₂O', n: 17.9, M: 18.015, cp: 33.58 },
      { name: 'O₂', n: 1.9, M: 31.999, cp: 29.38 },
    ],
  },
  ng: {
    label: 'Natural gas (H)',
    comps: [
      { name: 'CH₄', n: 93, M: 16.043, cp: 35.69 },
      { name: 'C₂H₆', n: 3, M: 30.07, cp: 52.49 },
      { name: 'C₃H₈', n: 1, M: 44.097, cp: 73.6 },
      { name: 'N₂', n: 2, M: 28.013, cp: 29.12 },
      { name: 'CO₂', n: 1, M: 44.01, cp: 37.12 },
    ],
  },
};
const GAP_PRESETS: Record<string, { label: string; a12: number; a21: number; T: number }> = {
  sym: { label: 'Symmetric (regular solution), UCST = 500 K', a12: 1000, a21: 1000, T: 420 },
  asym: { label: 'Asymmetric gap (a₁₂ ≠ a₂₁)', a12: 700, a21: 1300, T: 360 },
  weak: { label: 'Weakly non-ideal: no gap', a12: 400, a21: 450, T: 300 },
};
const useMix = create<S>()(
  persist((set) => ({ tab: 'gap', a12: 1000, a21: 1000, T: 420, z: 0.5, comps: AIR, p: 1.01325, Tg: 293.15, set: (p) => set(p) }), {
    name: 'ts-thermo-mix',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

export default function MixturesPage() {
  const s = useMix();
  return (
    <div className="space-y-2">
      <div role="tablist" className="glass flex gap-1 p-1.5">
        {(
          [
            ['gap', 'Liquid–liquid miscibility gap'],
            ['gas', 'Ideal gas mixture'],
          ] as const
        ).map(([id, l]) => (
          <button key={id} role="tab" type="button" aria-selected={s.tab === id} onClick={() => s.set({ tab: id })} className={cn('rounded px-3 py-1 text-[12px]', s.tab === id ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:bg-white/[0.04]')}>
            {t(l)}
          </button>
        ))}
      </div>
      {s.tab === 'gap' ? <Gap /> : <GasMix />}
    </div>
  );
}

function Gap() {
  const s = useMix();
  const m = { a12: s.a12, a21: s.a21 };
  const Tc = useMemo(() => ucst(m), [s.a12, s.a21]); // eslint-disable-line react-hooks/exhaustive-deps
  const bin = useMemo(() => binodal(m, s.T), [s.a12, s.a21, s.T]); // eslint-disable-line react-hooks/exhaustive-deps
  const spi = useMemo(() => spinodal(m, s.T), [s.a12, s.a21, s.T]); // eslint-disable-line react-hooks/exhaustive-deps
  const curves = useMemo(() => {
    const bl: { x: number; y: number }[] = [];
    const br: { x: number; y: number }[] = [];
    const sl: { x: number; y: number }[] = [];
    const sr: { x: number; y: number }[] = [];
    if (Tc) {
      for (let i = 0; i <= 60; i++) {
        const T = Tc * (0.45 + 0.55 * (1 - (1 - i / 60) ** 2.5));
        const b = binodal(m, T);
        const sp = spinodal(m, T);
        if (b) {
          bl.push({ x: b[0], y: T });
          br.push({ x: b[1], y: T });
        }
        if (sp) {
          sl.push({ x: sp[0], y: T });
          sr.push({ x: sp[1], y: T });
        }
      }
    }
    return { bin: [...bl, ...br.reverse()], spi: [...sl, ...sr.reverse()] };
  }, [s.a12, s.a21, Tc]); // eslint-disable-line react-hooks/exhaustive-deps
  const Tmax = (Tc ?? s.T) * 1.15;
  const Tmin = (Tc ?? s.T) * 0.4;
  const gCurve = Array.from({ length: 201 }, (_, i) => {
    const x = Math.min(1 - 1e-6, Math.max(1e-6, i / 200));
    return { x, y: gMix(m, s.T, x) };
  });
  const gLines: Line[] = [];
  if (bin) {
    const ga = gMix(m, s.T, bin[0]);
    const gb = gMix(m, s.T, bin[1]);
    gLines.push({ pts: [{ x: 0, y: ga - (bin[0] * (gb - ga)) / (bin[1] - bin[0]) }, { x: 1, y: ga + ((1 - bin[0]) * (gb - ga)) / (bin[1] - bin[0]) }], color: 'rgb(var(--sig-vapor))', dashed: true, label: t('common tangent') });
  }
  const gy = gCurve.map((p) => p.y);
  const twoPhase = bin && s.z > bin[0] && s.z < bin[1];
  const beta = bin ? (s.z - bin[0]) / (bin[1] - bin[0]) : 0;
  const unstable = spi && s.z > spi[0] && s.z < spi[1];
  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Margules model">
          <select aria-label={t('Examples')} className={fieldCls} value="" onChange={(e) => e.target.value && s.set(GAP_PRESETS[e.target.value]!)}>
            <option value="">{t('Load an example…')}</option>
            {Object.entries(GAP_PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {t(p.label)}
              </option>
            ))}
          </select>
          <div className="mt-2 space-y-1.5">
            <NumRow label="a₁₂ (A₁₂ = a₁₂/T)" unit="K" value={s.a12} onChange={(v) => s.set({ a12: v })} />
            <NumRow label="a₂₁ (A₂₁ = a₂₁/T)" unit="K" value={s.a21} onChange={(v) => s.set({ a21: v })} />
            <NumRow label={t('Temperature T')} unit="K" value={s.T} onChange={(v) => s.set({ T: Math.max(1, v) })} />
            <NumRow label={t('Overall composition z₁')} value={s.z} onChange={(v) => s.set({ z: Math.min(0.999, Math.max(0.001, v)) })} />
          </div>
        </Card>
        <Card title="Model">
          <div className="space-y-1 text-[12px] text-plant-100">
            <Tex block math="\frac{g^E}{RT} = x_1 x_2\,(A_{21} x_1 + A_{12} x_2)" />
            <Tex block math="\frac{\Delta g_{mix}}{RT} = x_1\ln x_1 + x_2 \ln x_2 + \frac{g^E}{RT}" />
            <Tex block math="x_i^{\alpha}\gamma_i^{\alpha} = x_i^{\beta}\gamma_i^{\beta}\quad(i = 1, 2)" />
          </div>
          <p className="mt-1 text-[10px] text-plant-500">{t('Two liquid phases form where Δg_mix has a common tangent (binodal). Between the spinodals the mixture is unstable and separates spontaneously; between spinodal and binodal it is metastable.')}</p>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={t('UCST (critical solution temperature)')} value={Tc ? nf(Tc, 1) : '–'} unit={Tc ? 'K' : undefined} small />
          <Kpi label={t('Phase α: x₁′')} value={bin ? nf(bin[0], 4) : '–'} />
          <Kpi label={t('Phase β: x₁″')} value={bin ? nf(bin[1], 4) : '–'} />
          <Kpi label={t('Amount of phase β (lever rule)')} value={twoPhase ? nf(beta * 100, 1) : '–'} unit={twoPhase ? '%' : undefined} sub={twoPhase ? t('of the total amount') : t('single phase')} />
        </div>
        {!bin && <Notice tone="info">{t('At this temperature the liquids mix completely (no miscibility gap).')}</Notice>}
        {twoPhase && <Notice tone={unstable ? 'warning' : 'info'}>{t(unstable ? 'z lies between the spinodals: the mixture is unstable and separates spontaneously into two liquid phases.' : 'z lies between binodal and spinodal: metastable, separates into two phases only after nucleation.')}</Notice>}
        <div className="grid gap-2 2xl:grid-cols-2">
          <Card title="T,x diagram (drag the state point)">
            <StateDiagram
              title={t('T,x diagram')}
              x={{ label: 'x₁', min: 0, max: 1 }}
              y={{ label: 'T [K]', min: Tmin, max: Tmax }}
              lines={[
                { pts: curves.bin, color: 'rgb(var(--sig-liquid))', width: 1.8, label: t('binodal') },
                { pts: curves.spi, color: 'rgb(var(--sig-alarm))', dashed: true, label: t('spinodal') },
                { pts: [{ x: 0, y: s.T }, { x: 1, y: s.T }], color: 'rgb(var(--plant-500))', dashed: true },
              ]}
              paths={bin && twoPhase ? [{ pts: [{ x: bin[0], y: s.T }, { x: bin[1], y: s.T }], color: 'rgb(var(--sig-vapor))', width: 2 }] : []}
              points={[
                { id: 'z', x: s.z, y: s.T, label: 'z', draggable: true },
                ...(bin && twoPhase ? [{ id: 'a', x: bin[0], y: s.T, label: 'α' }, { id: 'b', x: bin[1], y: s.T, label: 'β' }] : []),
              ]}
              onDrag={(_, x, y) => s.set({ z: Math.min(0.999, Math.max(0.001, x)), T: Math.max(Tmin, Math.min(Tmax, y)) })}
            />
          </Card>
          <Card title="Gibbs energy of mixing at T">
            <StateDiagram
              title={t('Gibbs energy of mixing')}
              x={{ label: 'x₁', min: 0, max: 1 }}
              y={{ label: 'Δg_mix / RT', min: Math.min(...gy) - 0.05, max: Math.max(0.02, Math.max(...gy) + 0.05) }}
              lines={gLines}
              paths={[{ pts: gCurve, color: 'rgb(var(--sig-liquid))', width: 2 }]}
              points={bin ? [{ id: 'a', x: bin[0], y: gMix(m, s.T, bin[0]), label: 'α' }, { id: 'b', x: bin[1], y: gMix(m, s.T, bin[1]), label: 'β' }] : []}
            />
            <p className="mt-1 text-[10px] text-plant-500">{t('Where the curve has two minima, the common tangent touches it at the compositions of the two coexisting phases: a mixture between them lowers its Gibbs energy by splitting.')}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GasMix() {
  const s = useMix();
  const r = gasMixture(s.comps, s.p, s.Tg);
  const upd = (i: number, c: GasComp | null) => {
    const a = [...s.comps];
    if (c) a[i] = c;
    else a.splice(i, 1);
    s.set({ comps: a });
  };
  const [preset, setPreset] = useState('');
  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Components">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select aria-label={t('Examples')} className={cn(fieldCls, 'w-64')} value={preset} onChange={(e) => (setPreset(''), e.target.value && s.set({ comps: PRESETS[e.target.value]!.comps }))}>
            <option value="">{t('Load an example…')}</option>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {t(p.label)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-plant-300">
            p <Num ariaLabel="p" className="w-20" value={s.p} onChange={(v) => s.set({ p: Math.max(1e-3, v) })} /> bar
          </label>
          <label className="flex items-center gap-1 text-[11px] text-plant-300">
            T <Num ariaLabel="T" className="w-20" value={s.Tg} onChange={(v) => s.set({ Tg: Math.max(1, v) })} /> K
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-right text-[10px] uppercase tracking-wider text-plant-500">
                <th className="py-1 pr-2 text-left">{t('Component')}</th>
                <th className="pr-2">n [mol]</th>
                <th className="pr-2">M [g/mol]</th>
                <th className="pr-2">c_p [J/(mol·K)]</th>
                <th className="pr-2">x_i</th>
                <th className="pr-2">w_i</th>
                <th className="pr-2">p_i [bar]</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {s.comps.map((c, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input aria-label={t('Name')} className={cn(fieldCls, 'w-20 font-sans')} value={c.name} onChange={(e) => upd(i, { ...c, name: e.target.value })} />
                  </td>
                  <td className="pr-2">
                    <Num ariaLabel="n" className="w-20" value={c.n} onChange={(v) => upd(i, { ...c, n: Math.max(0, v) })} />
                  </td>
                  <td className="pr-2">
                    <Num ariaLabel="M" className="w-20" value={c.M} onChange={(v) => upd(i, { ...c, M: Math.max(0.1, v) })} />
                  </td>
                  <td className="pr-2">
                    <Num ariaLabel="cp" className="w-20" value={c.cp} onChange={(v) => upd(i, { ...c, cp: Math.max(1, v) })} />
                  </td>
                  <td className="pr-2 text-right font-mono text-plant-100">{nf(r.x[i]!, 4)}</td>
                  <td className="pr-2 text-right font-mono text-plant-100">{nf(r.w[i]!, 4)}</td>
                  <td className="pr-2 text-right font-mono text-plant-100">{nf(r.pPart[i]!, 4)}</td>
                  <td>
                    <button type="button" aria-label={t('Delete')} onClick={() => upd(i, null)} className="text-plant-500 hover:text-signal-alarm">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => s.set({ comps: [...s.comps, { name: 'X', n: 1, M: 28, cp: 29 }] })} className="mt-1 flex items-center gap-1 text-[11px] text-signal-heat hover:underline">
          <Plus className="h-3 w-3" /> {t('Add component')}
        </button>
      </Card>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label={t('Molar mass M')} value={nf(r.M, 3)} unit="g/mol" />
          <Kpi label={t('Gas constant R_s')} value={nf(r.Rs, 2)} unit="J/(kg·K)" />
          <Kpi label="c_p" value={nf(r.cp, 2)} unit="J/(mol·K)" />
          <Kpi label="κ = c_p/c_v" value={nf(r.kappa, 4)} />
          <Kpi label={t('Density ρ')} value={nf(r.rho, 4)} unit="kg/m³" />
          <Kpi label={t('Mixing entropy ΔS_mix')} value={nf(r.dS, 2)} unit="J/K" sub={t('for the given amounts')} />
        </div>
        <Card title="Relations">
          <div className="space-y-1 text-[12px] text-plant-100">
            <Tex block math="p = \sum p_i,\quad p_i = x_i\,p\quad\text{(Dalton)}" />
            <Tex block math="M = \sum x_i M_i,\quad c_p = \sum x_i c_{p,i},\quad R_s = \frac{R}{M}" />
            <Tex block math="\Delta S_{mix} = -R \sum n_i \ln x_i > 0" />
          </div>
        </Card>
      </div>
    </div>
  );
}
