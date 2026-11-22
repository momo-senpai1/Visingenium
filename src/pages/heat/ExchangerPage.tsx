import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { effectiveness, solveHX, type Flow } from '@/engine/heat/exchanger';
import { t } from '@/i18n';

export default function ExchangerPage() {
  const [flow, setFlow] = useState<Flow>('counter');
  const [mh, setMh] = useState(1);
  const [cph, setCph] = useState(4180);
  const [Th1, setTh1] = useState(90);
  const [mc, setMc] = useState(1.5);
  const [cpc, setCpc] = useState(4180);
  const [Tc1, setTc1] = useState(15);
  const [k, setK] = useState(1200);
  const [A, setA] = useState(8);
  const r = useMemo(() => solveHX({ flow, mh, cph, Th1, mc, cpc, Tc1, k, A }), [flow, mh, cph, Th1, mc, cpc, Tc1, k, A]);
  const epsCurves = useMemo(
    () =>
      (['parallel', 'counter', 'cross'] as Flow[]).map((f) => ({
        name: t({ parallel: 'Co-current', counter: 'Counter-current', cross: 'Cross flow' }[f]),
        data: Array.from({ length: 60 }, (_, i) => ({ x: i * 0.1, y: effectiveness(f, i * 0.1, r.Cr) })),
      })),
    [r.Cr],
  );
  const N = (v: number, d = 2) => nf(v, d).replace(',', '{,}');
  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Arrangement">
          <Segmented
            value={flow}
            onChange={setFlow}
            options={[
              { value: 'parallel', label: 'Co-current' },
              { value: 'counter', label: 'Counter-current' },
              { value: 'cross', label: 'Cross flow' },
            ]}
          />
        </Card>
        <Card title="Hot stream">
          <div className="space-y-2">
            <NumRow label={t('Mass flow ṁ_h')} unit="kg/s" value={mh} onChange={(v) => v > 0 && setMh(v)} />
            <NumRow label={t('c_p,h')} unit="J/kgK" value={cph} onChange={(v) => v > 0 && setCph(v)} />
            <NumRow label={t('Inlet T_h,ein')} unit="°C" value={Th1} onChange={setTh1} />
          </div>
        </Card>
        <Card title="Cold stream">
          <div className="space-y-2">
            <NumRow label={t('Mass flow ṁ_c')} unit="kg/s" value={mc} onChange={(v) => v > 0 && setMc(v)} />
            <NumRow label={t('c_p,c')} unit="J/kgK" value={cpc} onChange={(v) => v > 0 && setCpc(v)} />
            <NumRow label={t('Inlet T_c,ein')} unit="°C" value={Tc1} onChange={setTc1} />
          </div>
        </Card>
        <Card title="Exchanger">
          <div className="space-y-2">
            <NumRow label={t('Overall coefficient k')} unit="W/m²K" value={k} onChange={(v) => v > 0 && setK(v)} />
            <NumRow label={t('Area A')} unit="m²" value={A} onChange={(v) => v > 0 && setA(v)} />
            <p className="text-[10px] text-plant-500">{t('Typical k: water/water 1000–2500, gas/gas 10–50, condensing steam/water 1500–4000 W/m²K.')}</p>
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Kpi label={t('Duty Q̇')} value={nf(r.Q / 1000, 2)} unit="kW" />
          <Kpi label={t('Hot outlet')} value={nf(r.Th2, 2)} unit="°C" />
          <Kpi label={t('Cold outlet')} value={nf(r.Tc2, 2)} unit="°C" />
          <Kpi label="NTU = kA/C_min" value={nf(r.NTU, 3)} />
          <Kpi label="ε" value={nf(r.eps, 4)} sub={`C_r = ${nf(r.Cr, 3)}`} />
          <Kpi label="ΔT_m,log" value={nf(r.dTlm, 2)} unit="K" />
        </div>
        {flow === 'counter' && r.Tc2 > r.Th2 && <Notice tone="info">{t('Temperature cross: the cold stream leaves hotter than the hot stream — only possible in counter-current flow.')}</Notice>}
        <div className="grid gap-2 lg:grid-cols-2">
          <Card title="Temperatures along the exchanger">
            {flow === 'cross' ? (
              <p className="text-[11px] text-plant-400">{t('Cross flow has a two-dimensional temperature field; only the outlet temperatures are shown.')}</p>
            ) : (
              <LineChartBox
                series={[
                  { name: t('hot stream'), data: r.profile.map((p) => ({ x: p.z, y: p.Th })), color: 'rgb(var(--sig-alarm))' },
                  { name: t('cold stream'), data: r.profile.map((p) => ({ x: p.z, y: p.Tc })), color: 'rgb(var(--sig-liquid))' },
                ]}
                xLabel={t('A / A_ges')}
                yLabel="T [°C]"
                digits={1}
              />
            )}
            <p className="text-[10px] text-plant-500">{flow === 'counter' ? t('Counter-current: hot enters left, cold enters right.') : flow === 'parallel' ? t('Co-current: both enter left.') : ''}</p>
          </Card>
          <Card title="Effectiveness ε over NTU">
            <LineChartBox series={epsCurves} xLabel="NTU" yLabel="ε" xDomain={[0, 6]} yDomain={[0, 1]} refX={[{ x: r.NTU, label: t('now') }]} />
          </Card>
        </div>
        <Card title="Solution path">
          <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
            <div>
              <Tex block math={`\\dot C_h = ${N(r.Ch, 0)},\\ \\dot C_c = ${N(r.Cc, 0)}\\ \\mathrm{W/K},\\quad C_r = \\frac{\\dot C_{min}}{\\dot C_{max}} = ${N(r.Cr, 3)}`} />
              <Tex block math={`NTU = \\frac{kA}{\\dot C_{min}} = \\frac{${N(k, 0)} \\cdot ${N(A)}}{${N(r.Cmin, 0)}} = ${N(r.NTU, 3)}`} />
              <Tex
                block
                math={
                  flow === 'counter'
                    ? '\\varepsilon = \\frac{1 - e^{-NTU(1 - C_r)}}{1 - C_r\\, e^{-NTU(1 - C_r)}}'
                    : flow === 'parallel'
                      ? '\\varepsilon = \\frac{1 - e^{-NTU(1 + C_r)}}{1 + C_r}'
                      : '\\varepsilon = 1 - \\exp\\!\\left[\\frac{NTU^{0.22}}{C_r}\\left(e^{-C_r NTU^{0.78}} - 1\\right)\\right]'
                }
              />
            </div>
            <div>
              <Tex block math={`\\dot Q = \\varepsilon\\, \\dot C_{min}\\,(T_{h,ein} - T_{c,ein}) = ${N(r.eps, 4)} \\cdot ${N(r.Cmin, 0)} \\cdot ${N(Th1 - Tc1)} = ${N(r.Q / 1000, 2)}\\ \\mathrm{kW}`} />
              <Tex block math={`\\text{${t('check')}}: \\dot Q = kA\\,\\Delta T_{m,log} = ${N(k, 0)}\\cdot${N(A)}\\cdot${N(r.dTlm)} = ${N((k * A * r.dTlm) / 1000, 2)}\\ \\mathrm{kW}`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
