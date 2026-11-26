import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { WallRadiationDiagram } from '@/components/heat/WallRadiationDiagram';
import { Card, fieldCls, ListEditor, newId, nf, Num, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { criticalRadius, solveWall, type Geometry, type Layer } from '@/engine/heat/conduction';
import { SIGMA } from '@/engine/heat/radiation';
import { faceFlows, type Optics } from '@/engine/heat/surfaceRadiation';
import { t } from '@/i18n';

const MATERIALS: [string, number][] = [
  ['Steel', 50],
  ['Stainless steel', 15],
  ['Copper', 380],
  ['Aluminium', 220],
  ['Concrete', 1.4],
  ['Brick', 0.8],
  ['Glass', 1.0],
  ['Wood', 0.13],
  ['Mineral wool', 0.04],
  ['Polystyrene (EPS)', 0.035],
  ['PUR foam', 0.025],
  ['Plaster', 0.7],
];

/** surface presets (gray: α = ε, ρ = 1 − ε − τ) */
const SURFACES: [string, Optics][] = [
  ['Matt, rough (ε 0.9)', { eps: 0.9, tau: 0 }],
  ['Paint / brick (ε 0.93)', { eps: 0.93, tau: 0 }],
  ['Oxidised steel (ε 0.8)', { eps: 0.8, tau: 0 }],
  ['Polished metal (ε 0.05)', { eps: 0.05, tau: 0 }],
  ['Glass pane (α 0.1, τ 0.8)', { eps: 0.1, tau: 0.8 }],
];

function SurfaceEditor({ o, setO }: { o: Optics; setO: (o: Optics) => void }) {
  const idx = SURFACES.findIndex(([, p]) => p.eps === o.eps && p.tau === o.tau);
  return (
    <div className="space-y-2">
      <select
        aria-label={t('Surface')}
        className={fieldCls}
        value={idx >= 0 ? idx : ''}
        onChange={(e) => {
          const p = SURFACES[Number(e.target.value)];
          if (p) setO(p[1]);
        }}
      >
        <option value="">{t('Own')}</option>
        {SURFACES.map(([n], i) => (
          <option key={n} value={i}>
            {t(n)}
          </option>
        ))}
      </select>
      <NumRow label={t('Emissivity ε = α')} value={o.eps} onChange={(v) => v >= 0 && v + o.tau <= 1 && setO({ ...o, eps: v })} />
      <NumRow label={t('Transmissivity τ')} value={o.tau} onChange={(v) => v >= 0 && v + o.eps <= 1 && setO({ ...o, tau: v })} />
      <p className="font-mono text-[10px] text-plant-500">ρ = 1 − ε − τ = {nf(Math.max(0, 1 - o.eps - o.tau), 3)}</p>
    </div>
  );
}

export default function ConductionPage() {
  const [geometry, setGeometry] = useState<Geometry>('plane');
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'l1', name: 'Plaster', s: 0.015, lambda: 0.7 },
    { id: 'l2', name: 'Brick', s: 0.24, lambda: 0.8 },
    { id: 'l3', name: 'Mineral wool', s: 0.12, lambda: 0.04 },
  ]);
  const [A, setA] = useState(10);
  const [L, setL] = useState(1);
  const [di, setDi] = useState(0.1);
  const [Ti, setTi] = useState(20);
  const [Ta, setTa] = useState(-10);
  const [ai, setAi] = useState(8);
  const [aa, setAa] = useState(25);
  const [Gout, setGout] = useState(300);
  const [outer, setOuter] = useState<Optics>({ eps: 0.9, tau: 0 });
  const [inner, setInner] = useState<Optics>({ eps: 0.9, tau: 0 });
  const switchGeo = (g: Geometry) => {
    setGeometry(g);
    if (g === 'plane') {
      setLayers([{ id: 'l1', name: 'Plaster', s: 0.015, lambda: 0.7 }, { id: 'l2', name: 'Brick', s: 0.24, lambda: 0.8 }, { id: 'l3', name: 'Mineral wool', s: 0.12, lambda: 0.04 }]);
      setTi(20);
      setTa(-10);
      setAi(8);
      setAa(25);
    } else {
      setLayers([{ id: 'l1', name: 'Steel', s: 0.004, lambda: 50 }, { id: 'l2', name: 'Mineral wool', s: 0.05, lambda: 0.04 }]);
      setTi(150);
      setTa(20);
      setAi(1000);
      setAa(10);
      setDi(0.1);
    }
  };
  const r = useMemo(() => solveWall({ geometry, layers, A, L, ri: di / 2, Ti, Ta, alphaI: ai, alphaA: aa }), [geometry, layers, A, L, di, Ti, Ta, ai, aa]);
  const ra = di / 2 + layers.reduce((s, l) => s + l.s, 0);
  const insul = layers.at(-1);
  const rc = insul ? criticalRadius(geometry, insul.lambda, aa) : 0;
  // heat loss vs thickness of the outer layer (insulation curve)
  const curve = useMemo(() => {
    if (!insul) return [];
    return Array.from({ length: 61 }, (_, i) => {
      const s = (i / 60) * Math.max(insul.s * 3, geometry === 'plane' ? 0.3 : 0.1);
      const rr = solveWall({ geometry, layers: [...layers.slice(0, -1), { ...insul, s: Math.max(s, 1e-6) }], A, L, ri: di / 2, Ti, Ta, alphaI: ai, alphaA: aa });
      return { x: s * 1000, y: rr.Q };
    });
  }, [geometry, layers, insul, A, L, di, Ti, Ta, ai, aa]);
  const Gin = SIGMA * (Ti + 273.15) ** 4;
  const fo = faceFlows(Gout, outer, r.temps.at(-1)!);
  const fi = faceFlows(Gin, inner, r.temps[0]!);
  const tn = (v: number, d = 3) => nf(v, d).replace(',', '{,}');
  const xUnit = geometry === 'plane' ? 'x [mm]' : 'r [mm]';
  const prof = r.profile.map((p) => ({ x: p.x * 1000, y: p.T }));
  const fluidI = geometry === 'plane' ? [{ x: -20, y: Ti }, { x: 0, y: r.temps[0]! }] : [];
  const fluidA = [{ x: r.pos.at(-1)! * 1000, y: r.temps.at(-1)! }, { x: r.pos.at(-1)! * 1000 + 20, y: Ta }];

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Geometry">
          <div className="space-y-2">
            <Segmented
              value={geometry}
              onChange={switchGeo}
              options={[
                { value: 'plane', label: 'Plane wall' },
                { value: 'cylinder', label: 'Pipe' },
                { value: 'sphere', label: 'Sphere' },
              ]}
            />
            {geometry === 'plane' && <NumRow label={t('Area A')} unit="m²" value={A} onChange={(v) => v > 0 && setA(v)} />}
            {geometry !== 'plane' && <NumRow label={t('Inner diameter d_i')} unit="m" value={di} onChange={(v) => v > 0 && setDi(v)} />}
            {geometry === 'cylinder' && <NumRow label={t('Pipe length L')} unit="m" value={L} onChange={(v) => v > 0 && setL(v)} />}
          </div>
        </Card>
        <Card title="Layers (inside → outside)">
          <ListEditor
            items={layers}
            cols={[t('Material'), 's [m]', 'λ [W/mK]']}
            addLabel={t('Add layer')}
            onAdd={() => setLayers([...layers, { id: newId('l'), name: 'Mineral wool', s: 0.05, lambda: 0.04 }])}
            onRemove={(id) => layers.length > 1 && setLayers(layers.filter((l) => l.id !== id))}
            render={(l) => [
              <select
                key="m"
                aria-label={t('Material')}
                className={fieldCls}
                value={MATERIALS.some(([n]) => n === l.name) ? l.name : ''}
                onChange={(e) => {
                  const m = MATERIALS.find(([n]) => n === e.target.value);
                  if (m) setLayers(layers.map((o) => (o.id === l.id ? { ...o, name: m[0], lambda: m[1] } : o)));
                }}
              >
                <option value="">{t('Own')}</option>
                {MATERIALS.map(([n]) => (
                  <option key={n} value={n}>
                    {t(n)}
                  </option>
                ))}
              </select>,
              <Num key="s" ariaLabel="s" value={l.s} onChange={(s) => setLayers(layers.map((o) => (o.id === l.id ? { ...o, s } : o)))} />,
              <Num key="λ" ariaLabel="λ" value={l.lambda} onChange={(lambda) => setLayers(layers.map((o) => (o.id === l.id ? { ...o, lambda } : o)))} />,
            ]}
          />
        </Card>
        <Card title="Boundary conditions">
          <div className="space-y-2">
            <NumRow label={t('Inside temperature T_i')} unit="°C" value={Ti} onChange={setTi} />
            <NumRow label={t('Inside α_i (0 = surface at T_i)')} unit="W/m²K" value={ai} onChange={(v) => v >= 0 && setAi(v)} />
            <NumRow label={t('Outside temperature T_a')} unit="°C" value={Ta} onChange={setTa} />
            <NumRow label={t('Outside α_a (0 = surface at T_a)')} unit="W/m²K" value={aa} onChange={(v) => v >= 0 && setAa(v)} />
            <p className="text-[10px] text-plant-500">{t('Typical α: still air 5–10, wind 25, water 500–5000, condensing steam 10⁴ W/m²K.')}</p>
          </div>
        </Card>
        <Card title="Radiation at the surfaces">
          <div className="space-y-2">
            <NumRow label={t('Irradiation outside G_a')} unit="W/m²" value={Gout} onChange={(v) => v >= 0 && setGout(v)} />
            <p className="tag text-plant-400">{t('Outside surface')}</p>
            <SurfaceEditor o={outer} setO={setOuter} />
            <p className="tag pt-1 text-plant-400">{t('Inside surface')}</p>
            <SurfaceEditor o={inner} setO={setInner} />
            <p className="text-[10px] text-plant-500">{t('Illustration of the radiation balance; the room radiates as a black body at T_i onto the inside surface. The conduction result above does not include it.')}</p>
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label={t('Heat flow Q̇')} value={nf(r.Q, 1)} unit="W" />
          <Kpi label={t('Total resistance R')} value={nf(r.Rtot, 5)} unit="K/W" />
          <Kpi
            label={geometry === 'plane' ? t('U-value k') : geometry === 'cylinder' ? t('k per length') : '1/R'}
            value={nf(r.k, 3)}
            unit={geometry === 'plane' ? 'W/m²K' : geometry === 'cylinder' ? 'W/mK' : 'W/K'}
          />
          <Kpi label={t('Flux inside q̇_i')} value={nf(r.qi, 1)} unit="W/m²" />
          <Kpi label={t('Surface temperatures')} value={`${nf(r.temps[0]!, 1)} / ${nf(r.temps.at(-1)!, 1)}`} unit="°C" />
        </div>
        {!r.ok && <Notice tone="error">{t('Every layer needs a positive thickness and conductivity.')}</Notice>}
        {geometry !== 'plane' && insul && ra < rc && (
          <Notice tone="warning">
            {t('The outer radius ({r} mm) is below the critical insulation radius r_krit = {rc} mm: more insulation increases the heat loss here.', { r: nf(ra * 1000, 1), rc: nf(rc * 1000, 1) })}
          </Notice>
        )}
        <Card title="Layers and radiation (inside → outside)">
          <WallRadiationDiagram layers={layers} temps={r.temps} Ti={Ti} Ta={Ta} Gout={Gout} Gin={Gin} outer={outer} inner={inner} />
          <div className="mt-3 grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
            <div>
              <Tex block math={'G = \\rho G + \\alpha G + \\tau G \\qquad \\alpha + \\rho + \\tau = 1 \\qquad \\alpha = \\varepsilon'} />
              <Tex block math={'E = \\varepsilon\\,\\sigma\\,T_s^4 \\qquad \\dot q_{rad} = \\alpha G - \\varepsilon\\sigma T_s^4'} />
            </div>
            <div>
              <Tex block math={`\\text{${t('outside')}}:\\ E_a = ${tn(outer.eps)}\\cdot 5{,}67\\cdot10^{-8}\\,(${tn(r.temps.at(-1)! + 273.15, 1)})^4 = ${tn(fo.emis, 1)}\\ \\mathrm{W/m^2}`} />
              <Tex block math={`\\dot q_{rad,a} = ${tn(fo.abs, 1)} - ${tn(fo.emis, 1)} = ${tn(fo.net, 1)}\\ \\mathrm{W/m^2}`} />
              <Tex block math={`\\text{${t('inside')}}:\\ G_i = \\sigma T_i^4 = ${tn(Gin, 1)}\\ \\mathrm{W/m^2}\\ ,\\quad \\dot q_{rad,i} = ${tn(fi.net, 1)}\\ \\mathrm{W/m^2}`} />
            </div>
          </div>
        </Card>
        <div className="grid gap-2 lg:grid-cols-2">
          <Card title="Temperature profile T(x)">
            <LineChartBox
              series={[
                { name: t('wall'), data: prof },
                ...(fluidI.length ? [{ name: t('boundary layer inside'), data: fluidI, dashed: true }] : []),
                { name: t('boundary layer outside'), data: fluidA, dashed: true },
              ]}
              xLabel={xUnit}
              yLabel="T [°C]"
              xDomain={[geometry === 'plane' ? -25 : Math.round(r.pos[0]! * 1000), Math.ceil(r.pos.at(-1)! * 1000 + 25)]}
              refX={r.pos.slice(1, -1).map((p, i) => ({ x: p * 1000, label: `${i + 1}|${i + 2}` }))}
              digits={1}
            />
            <p className="text-[10px] text-plant-500">
              {geometry === 'plane' ? t('Plane wall: straight lines, steeper where λ is small.') : geometry === 'cylinder' ? t('Pipe: logarithmic profile T ∝ ln r.') : t('Sphere: T ∝ 1/r.')}
            </p>
          </Card>
          <Card title="Heat loss vs. thickness of the outer layer">
            <LineChartBox series={[{ name: 'Q̇', data: curve }]} xLabel={`s ${t('outer layer')} [mm]`} yLabel="Q̇ [W]" refX={geometry !== 'plane' && rc > di / 2 ? [{ x: (rc - (ra - (insul?.s ?? 0))) * 1000, label: 'r_krit' }] : undefined} digits={1} />
          </Card>
        </div>
        <Card title="Thermal resistances in series (solution path)">
          <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
            <div className="space-y-1">
              {r.res.map((x, i) => (
                <p key={i} className="flex justify-between font-mono text-[11px]">
                  <span className="text-plant-300">
                    {x.kind === 'conv' ? (x.label === 'α_i' ? t('convection inside') : t('convection outside')) : t(x.label)}
                  </span>
                  <span>
                    R = {nf(x.R, 5)} K/W · ΔT = {nf(x.T1 - x.T2, 2)} K
                  </span>
                </p>
              ))}
            </div>
            <div>
              <Tex
                block
                math={
                  geometry === 'plane'
                    ? 'R = \\frac{1}{\\alpha_i A} + \\sum \\frac{s_j}{\\lambda_j A} + \\frac{1}{\\alpha_a A}'
                    : geometry === 'cylinder'
                      ? 'R = \\frac{1}{\\alpha_i 2\\pi r_i L} + \\sum \\frac{\\ln(r_{j+1}/r_j)}{2\\pi\\lambda_j L} + \\frac{1}{\\alpha_a 2\\pi r_a L}'
                      : 'R = \\frac{1}{\\alpha_i 4\\pi r_i^2} + \\sum \\frac{1/r_j - 1/r_{j+1}}{4\\pi\\lambda_j} + \\frac{1}{\\alpha_a 4\\pi r_a^2}'
                }
              />
              <Tex block math={`\\dot Q = \\frac{T_i - T_a}{R} = \\frac{${nf(Ti - Ta, 2).replace(',', '{,}')}\\ \\mathrm{K}}{${nf(r.Rtot, 5).replace(',', '{,}')}\\ \\mathrm{K/W}} = ${nf(r.Q, 2).replace(',', '{,}')}\\ \\mathrm{W}`} />
              {geometry !== 'plane' && <Tex block math={`r_{krit} = ${geometry === 'sphere' ? '\\frac{2\\lambda_{iso}}{\\alpha_a}' : '\\frac{\\lambda_{iso}}{\\alpha_a}'} = ${nf(rc * 1000, 2).replace(',', '{,}')}\\ \\mathrm{mm}`} />}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
