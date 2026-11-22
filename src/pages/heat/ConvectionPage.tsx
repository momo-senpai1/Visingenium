import { useMemo, useState } from 'react';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { convection, type Case, type Fluid } from '@/engine/heat/convection';
import { t } from '@/i18n';

const CASES: { id: Case; label: string; Llabel: string }[] = [
  { id: 'plate', label: 'Flat plate, forced flow', Llabel: 'Plate length L' },
  { id: 'pipe', label: 'Pipe flow (inside)', Llabel: 'Inner diameter d' },
  { id: 'cylinder', label: 'Cylinder in cross flow', Llabel: 'Diameter d' },
  { id: 'freePlate', label: 'Free convection, vertical plate', Llabel: 'Height H' },
  { id: 'freeCylinder', label: 'Free convection, horizontal cylinder', Llabel: 'Diameter d' },
];

export default function ConvectionPage() {
  const [kind, setKind] = useState<Case>('plate');
  const [fluid, setFluid] = useState<Fluid>('air');
  const [Tf, setTf] = useState(20);
  const [Tw, setTw] = useState(60);
  const [u, setU] = useState(5);
  const [L, setL] = useState(0.5);
  const [Lpipe, setLpipe] = useState(3);
  const [b, setB] = useState(1);
  const r = useMemo(() => convection({ kind, fluid, Tf, Tw, u, L, Lpipe, b }), [kind, fluid, Tf, Tw, u, L, Lpipe, b]);
  const forced = kind === 'plate' || kind === 'pipe' || kind === 'cylinder';
  const c = CASES.find((x) => x.id === kind)!;
  // Nu over the driving parameter (velocity or temperature difference)
  const sweep = useMemo(() => {
    const pts = Array.from({ length: 60 }, (_, i) => (forced ? 0.05 * 1.12 ** i : 0.5 * 1.1 ** i));
    return pts.map((v) => {
      const rr = forced ? convection({ kind, fluid, Tf, Tw, u: v, L, Lpipe, b }) : convection({ kind, fluid, Tf, Tw: Tf + v, u, L, Lpipe, b });
      return { x: forced ? rr.Re : rr.Ra, y: rr.Nu };
    });
  }, [kind, fluid, Tf, Tw, L, Lpipe, b, forced, u]);
  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Case">
          <div className="space-y-2">
            <select
              aria-label={t('Case')}
              className={fieldCls}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Case;
                setKind(k);
                const d: Record<Case, [number, number, number]> = { plate: [0.5, 5, 1], pipe: [0.025, 1, 3], cylinder: [0.05, 5, 1], freePlate: [0.5, 0, 1], freeCylinder: [0.1, 0, 1] };
                setL(d[k][0]);
                if (d[k][1]) setU(d[k][1]);
                setB(d[k][2]);
              }}
            >
              {CASES.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.label)}
                </option>
              ))}
            </select>
            <Segmented value={fluid} onChange={setFluid} options={[{ value: 'air', label: 'Air' }, { value: 'water', label: 'Water' }]} />
            <NumRow label={kind === 'pipe' ? t('Bulk temperature T_m') : t('Fluid temperature T_∞')} unit="°C" value={Tf} onChange={setTf} />
            <NumRow label={t('Wall temperature T_W')} unit="°C" value={Tw} onChange={setTw} />
            {forced && <NumRow label={t('Velocity u')} unit="m/s" value={u} onChange={(v) => v > 0 && setU(v)} />}
            <NumRow label={t(c.Llabel)} unit="m" value={L} onChange={(v) => v > 0 && setL(v)} />
            {kind === 'pipe' && <NumRow label={t('Pipe length')} unit="m" value={Lpipe} onChange={(v) => v > 0 && setLpipe(v)} />}
            {kind !== 'pipe' && <NumRow label={kind === 'plate' || kind === 'freePlate' ? t('Width b') : t('Length')} unit="m" value={b} onChange={(v) => v > 0 && setB(v)} />}
          </div>
        </Card>
        <Card title="Fluid properties">
          <div className="space-y-0.5 font-mono text-[11px] text-plant-300">
            <p>
              {t('at')} {nf(r.Tm, 1)} °C ({kind === 'pipe' ? t('bulk') : t('film temperature')})
            </p>
            <p>ρ = {nf(r.p.rho, 3)} kg/m³</p>
            <p>c_p = {nf(r.p.cp, 0)} J/kgK</p>
            <p>λ = {nf(r.p.lambda, 4)} W/mK</p>
            <p>ν = {nf(r.p.nu * 1e6, 3)}·10⁻⁶ m²/s</p>
            <p>Pr = {nf(r.p.Pr, 3)}</p>
            <p>β = {nf(r.p.beta * 1e3, 3)}·10⁻³ 1/K</p>
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {forced ? <Kpi label="Re" value={r.Re.toExponential(3)} sub={t(r.regime)} /> : <Kpi label="Ra = Gr·Pr" value={r.Ra.toExponential(3)} sub={t(r.regime)} />}
          <Kpi label="Pr" value={nf(r.p.Pr, 3)} />
          <Kpi label="Nu" value={nf(r.Nu, 2)} />
          <Kpi label="α = Nu·λ/L" value={nf(r.alpha, 2)} unit="W/m²K" />
          <Kpi label={t('Heat flow Q̇')} value={nf(r.Q, 1)} unit="W" sub={`A = ${nf(r.A, 3)} m²`} />
        </div>
        <Card title="Correlation">
          <p className="font-mono text-[11px] text-plant-200">{r.correlation}</p>
          <p className="mt-1 text-[10px] text-plant-500">
            {forced ? 'Re = u·L/ν' : 'Gr = g·β·ΔT·L³/ν²'} · Nu = α·L/λ · Q̇ = α·A·(T_W − T)
          </p>
        </Card>
        <div className="grid gap-2 lg:grid-cols-2">
          {r.local && (
            <Card title="Along the plate">
              <LineChartBox
                series={[{ name: t('local α(x) [W/m²K]'), data: r.local.map((p) => ({ x: p.x, y: p.alpha })) }, { name: t('boundary layer δ(x) [mm]'), data: r.local.map((p) => ({ x: p.x, y: p.delta })) }]}
                xLabel="x [m]"
                yLabel=""
                digits={2}
              />
            </Card>
          )}
          <Card title={forced ? 'Nu over Re' : 'Nu over Ra'}>
            <LineChartBox series={[{ name: 'Nu', data: sweep }]} xLabel={forced ? 'Re' : 'Ra'} yLabel="Nu" logX logY refX={[{ x: forced ? r.Re : Math.max(r.Ra, 1), label: t('now') }]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
