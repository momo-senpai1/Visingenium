import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { solveFin, type FinShape, type FinTip } from '@/engine/heat/conduction';
import { t } from '@/i18n';

export default function FinPage() {
  const [shape, setShape] = useState<FinShape>('pin');
  const [d, setD] = useState(5);
  const [w, setW] = useState(50);
  const [L, setL] = useState(50);
  const [lambda, setLambda] = useState(200);
  const [alpha, setAlpha] = useState(25);
  const [Tb, setTb] = useState(100);
  const [Tinf, setTinf] = useState(25);
  const [tip, setTip] = useState<FinTip>('convective');
  const spec = { shape, d: d / 1000, w: w / 1000, L: L / 1000, lambda, alpha, Tb, Tinf };
  const r = useMemo(() => solveFin({ ...spec, tip }), [shape, d, w, L, lambda, alpha, Tb, Tinf, tip]); // eslint-disable-line react-hooks/exhaustive-deps
  const compare = useMemo(
    () =>
      (['steel', 'alu', 'copper'] as const).map((m) => {
        const lam = { steel: 50, alu: 220, copper: 380 }[m];
        return { name: t({ steel: 'Steel', alu: 'Aluminium', copper: 'Copper' }[m]) + ` (λ = ${lam})`, data: solveFin({ ...spec, lambda: lam, tip }).profile.map((p) => ({ x: p.x * 1000, y: p.T })) };
      }),
    [shape, d, w, L, alpha, Tb, Tinf, tip], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const n = (v: number, k = 4) => nf(v, k).replace(',', '{,}');
  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Fin / rod">
          <div className="space-y-2">
            <Segmented value={shape} onChange={setShape} options={[{ value: 'pin', label: 'Pin (rod)' }, { value: 'plate', label: 'Plate fin' }]} />
            <NumRow label={shape === 'pin' ? t('Diameter d') : t('Thickness t')} unit="mm" value={d} onChange={(v) => v > 0 && setD(v)} />
            {shape === 'plate' && <NumRow label={t('Width b')} unit="mm" value={w} onChange={(v) => v > 0 && setW(v)} />}
            <NumRow label={t('Length L')} unit="mm" value={L} onChange={(v) => v > 0 && setL(v)} />
            <NumRow label={t('Conductivity λ')} unit="W/mK" value={lambda} onChange={(v) => v > 0 && setLambda(v)} />
          </div>
        </Card>
        <Card title="Boundary conditions">
          <div className="space-y-2">
            <NumRow label={t('Base temperature T_0')} unit="°C" value={Tb} onChange={setTb} />
            <NumRow label={t('Fluid temperature T_∞')} unit="°C" value={Tinf} onChange={setTinf} />
            <NumRow label={t('Heat transfer coefficient α')} unit="W/m²K" value={alpha} onChange={(v) => v > 0 && setAlpha(v)} />
            <Segmented
              value={tip}
              onChange={setTip}
              options={[
                { value: 'adiabatic', label: 'Adiabatic tip' },
                { value: 'convective', label: 'Convective tip' },
                { value: 'infinite', label: 'Infinitely long' },
              ]}
            />
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label={t('Heat flow Q̇')} value={nf(r.Q, 3)} unit="W" />
          <Kpi label={t('Fin efficiency η')} value={Number.isFinite(r.eta) ? nf(r.eta * 100, 1) : '–'} unit={Number.isFinite(r.eta) ? '%' : undefined} />
          <Kpi label={t('Effectiveness ε')} value={nf(r.eps, 2)} sub={t('Q̇ with fin / without')} />
          <Kpi label={t('Tip temperature')} value={nf(r.Ttip, 1)} unit="°C" />
          <Kpi label="m·L" value={nf(r.mL, 3)} sub={`m = ${nf(r.m, 2)} 1/m`} />
        </div>
        {r.Bi > 0.1 && <Notice tone="warning">{t('Bi = {bi} > 0.1: the temperature is not uniform over the cross-section; the 1-D fin model loses accuracy.', { bi: nf(r.Bi, 3) })}</Notice>}
        {r.eps < 2 && <Notice tone="info">{t('Effectiveness below 2: a fin hardly pays off here (low λ or high α).')}</Notice>}
        <Card title="Temperature along the fin T(x)">
          <LineChartBox series={[{ name: t('this fin'), data: r.profile.map((p) => ({ x: p.x * 1000, y: p.T })) }, ...compare.map((c) => ({ ...c, dashed: true }))]} xLabel="x [mm]" yLabel="T [°C]" digits={1} />
        </Card>
        <Card title="Solution path">
          <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
            <div>
              <Tex block math={`m = \\sqrt{\\frac{\\alpha U}{\\lambda A_q}} = \\sqrt{\\frac{${n(alpha, 2)} \\cdot ${n(r.U, 5)}}{${n(lambda, 2)} \\cdot ${n(r.Ac * 1e6, 3)}\\cdot 10^{-6}}} = ${n(r.m, 3)}\\ \\mathrm{m^{-1}}`} />
              <Tex
                block
                math={
                  tip === 'adiabatic'
                    ? '\\frac{\\vartheta(x)}{\\vartheta_0} = \\frac{\\cosh m(L-x)}{\\cosh mL}'
                    : tip === 'infinite'
                      ? '\\frac{\\vartheta(x)}{\\vartheta_0} = e^{-mx}'
                      : '\\frac{\\vartheta(x)}{\\vartheta_0} = \\frac{\\cosh m(L-x) + \\frac{\\alpha}{m\\lambda}\\sinh m(L-x)}{\\cosh mL + \\frac{\\alpha}{m\\lambda}\\sinh mL}'
                }
              />
            </div>
            <div>
              <Tex
                block
                math={`\\dot Q = \\sqrt{\\alpha U \\lambda A_q}\\,\\vartheta_0 ${tip === 'adiabatic' ? '\\tanh mL' : tip === 'infinite' ? '' : '\\frac{\\sinh mL + \\frac{\\alpha}{m\\lambda}\\cosh mL}{\\cosh mL + \\frac{\\alpha}{m\\lambda}\\sinh mL}'} = ${n(r.Q, 3)}\\ \\mathrm{W}`}
              />
              {Number.isFinite(r.eta) && <Tex block math={`\\eta_R = \\frac{\\dot Q}{\\alpha A_R \\vartheta_0} = ${n(r.eta, 4)}${tip === 'adiabatic' ? ` = \\frac{\\tanh mL}{mL}` : ''}`} />}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-plant-500">{t('ϑ = T − T_∞, U = perimeter, A_q = cross-section, A_R = fin surface. Dashed: the same fin in steel, aluminium and copper.')}</p>
        </Card>
      </div>
    </div>
  );
}
