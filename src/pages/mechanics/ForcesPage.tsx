/** TM 1: plane force systems — components, resultant, moment about a point, force polygon. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea } from '@/components/ee/common';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, MomentArrow, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { components, reduceForces, type PlaneForce } from '@/engine/mechanics/statics';

const COLORS = ['rgb(var(--sig-alarm))', 'rgb(var(--sig-liquid))', 'rgb(var(--sig-vapor))'];

const useForces = paramStore('tm-forces', {
  mode: 'general' as 'central' | 'general',
  forces: [
    { x: 0.5, y: 0.5, F: 30, angle: 60 },
    { x: 3.5, y: 0.5, F: 20, angle: 120 },
    { x: 2, y: 2, F: 15, angle: 0 },
  ] as PlaneForce[],
  px: 0,
  py: 0,
});

export default function ForcesPage() {
  const s = useForces();
  const forces = s.mode === 'central' ? s.forces.map((f) => ({ ...f, x: 2, y: 1 })) : s.forces;
  const px = s.mode === 'central' ? 2 : s.px;
  const py = s.mode === 'central' ? 1 : s.py;
  const r = reduceForces(forces, px, py);
  const setF = (i: number, p: Partial<PlaneForce>) => s.set({ forces: s.forces.map((f, k) => (k === i ? { ...f, ...p } : f)) });

  // drawing: 1 m = 100 px, plate 4 m × 2 m
  const sx = (x: number) => 80 + x * 100;
  const sy = (y: number) => 290 - y * 100;
  const Fmax = Math.max(1, ...forces.map((f) => f.F), r.R);
  const L = (F: number) => 25 + (85 * F) / Fmax;
  const tip = (x: number, y: number, F: number, ang: number): [number, number] => [sx(x) + L(F) * Math.cos((ang * Math.PI) / 180), sy(y) - L(F) * Math.sin((ang * Math.PI) / 180)];

  // force polygon: forces head to tail
  let cx = 0;
  let cy = 0;
  const poly = forces.map((f) => {
    const { Fx, Fy } = components(f);
    const a = [cx, cy];
    cx += Fx;
    cy += Fy;
    return { a, b: [cx, cy] };
  });
  const ext = Math.max(1, ...poly.flatMap((p) => [Math.abs(p.a[0]!), Math.abs(p.a[1]!), Math.abs(p.b[0]!), Math.abs(p.b[1]!)]));
  const ps = 110 / ext;
  const pp = (v: number[]): [number, number] => [150 + v[0]! * ps, 140 - v[1]! * ps];

  return (
    <EeLayout
      aside={
        <>
          <Card title="Force systems in the plane">
            <Idea>
              {t(
                'A force is a vector bound to its line of action: it may be slid along that line, but not moved sideways. Any set of forces on a rigid body can be replaced by one resultant R at a reference point A plus a moment M_A. If all lines of action meet in one point (central system), the moment vanishes and only the force polygon matters. A body is in equilibrium when R = 0 and M_A = 0.',
              )}
            </Idea>
            <Segmented
              value={s.mode}
              onChange={(mode) => s.set({ mode })}
              options={[
                { value: 'central', label: t('Central') },
                { value: 'general', label: t('General') },
              ]}
            />
          </Card>
          {s.forces.map((f, i) => (
            <Card key={i} title={`${t('Force')} F${'₁₂₃'[i]}`}>
              <div className="space-y-3">
                <ParamSlider label="Magnitude" symbol={`F${'₁₂₃'[i]}`} unit="N" value={f.F} min={0} max={50} step={1} digits={0} onChange={(F) => setF(i, { F })} />
                <ParamSlider label="Direction" symbol="α" unit="°" value={f.angle} min={0} max={360} step={5} digits={0} onChange={(angle) => setF(i, { angle })} />
                {s.mode === 'general' && (
                  <>
                    <ParamSlider label="Point of application x" symbol="x" unit="m" value={f.x} min={0} max={4} step={0.1} onChange={(x) => setF(i, { x })} />
                    <ParamSlider label="Point of application y" symbol="y" unit="m" value={f.y} min={0} max={2} step={0.1} onChange={(y) => setF(i, { y })} />
                  </>
                )}
              </div>
            </Card>
          ))}
          {s.mode === 'general' && (
            <Card title="Reference point A">
              <div className="space-y-3">
                <ParamSlider label="x_A" symbol="x_A" unit="m" value={s.px} min={0} max={4} step={0.1} onChange={(px) => s.set({ px })} />
                <ParamSlider label="y_A" symbol="y_A" unit="m" value={s.py} min={0} max={2} step={0.1} onChange={(py) => s.set({ py })} />
              </div>
            </Card>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="R_x" value={nf(r.Rx, 2)} unit="N" />
        <Kpi label="R_y" value={nf(r.Ry, 2)} unit="N" />
        <Kpi label="Resultant R" value={nf(r.R, 2)} unit="N" sub={`${t('direction')} ${nf(r.angle, 1)}°`} />
        <Kpi label="Moment M_A" value={nf(r.M, 2)} unit="Nm" sub={t('counter-clockwise positive')} />
        <Kpi label="State" value={r.R < 1e-6 && Math.abs(r.M) < 1e-6 ? t('equilibrium') : r.R < 1e-6 ? t('pure couple') : t('resultant')} />
      </div>
      {r.R < 1e-6 && Math.abs(r.M) > 1e-6 && <Notice tone="info">{t('The forces cancel, but a couple remains: the body would rotate without translating.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Rigid plate with forces">
          <svg viewBox="0 0 580 360" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Rigid plate with forces')}>
            <rect x={sx(0)} y={sy(2)} width={400} height={200} rx={6} fill={TM.fill} fillOpacity={0.45} stroke={TM.body} strokeWidth={1.2} />
            {forces.map((f, i) => (
              <g key={i}>
                <circle cx={sx(f.x)} cy={sy(f.y)} r={3} fill={COLORS[i]} />
                {/* line of action */}
                <line
                  x1={sx(f.x) - 600 * Math.cos((f.angle * Math.PI) / 180)}
                  y1={sy(f.y) + 600 * Math.sin((f.angle * Math.PI) / 180)}
                  x2={sx(f.x) + 600 * Math.cos((f.angle * Math.PI) / 180)}
                  y2={sy(f.y) - 600 * Math.sin((f.angle * Math.PI) / 180)}
                  stroke={COLORS[i]}
                  strokeOpacity={0.18}
                  strokeDasharray="3 5"
                />
                {f.F > 0 && <Arrow a={[sx(f.x), sy(f.y)]} b={tip(f.x, f.y, f.F, f.angle)} color={COLORS[i]} label={`F${'₁₂₃'[i]}`} />}
              </g>
            ))}
            {r.line && r.R > 1e-6 && (
              <g>
                <line
                  x1={sx(r.line.x) - 800 * Math.cos((r.angle * Math.PI) / 180)}
                  y1={sy(r.line.y) + 800 * Math.sin((r.angle * Math.PI) / 180)}
                  x2={sx(r.line.x) + 800 * Math.cos((r.angle * Math.PI) / 180)}
                  y2={sy(r.line.y) - 800 * Math.sin((r.angle * Math.PI) / 180)}
                  stroke={TM.reaction}
                  strokeOpacity={0.5}
                  strokeDasharray="8 5"
                />
                <Arrow a={[sx(r.line.x), sy(r.line.y)]} b={tip(r.line.x, r.line.y, r.R, r.angle)} color={TM.reaction} width={3} label="R" />
              </g>
            )}
            <circle cx={sx(px)} cy={sy(py)} r={4.5} fill="none" stroke={TM.text} strokeWidth={1.5} />
            <Label x={sx(px) - 10} y={sy(py) + 16} anchor="end">
              A
            </Label>
            <MomentArrow c={[sx(px), sy(py)]} r={22} M={r.M} color={TM.aux} label={`M_A = ${nf(r.M, 1)} Nm`} />
          </svg>
          <Caption>{t('Faint dashed lines: lines of action. Green: the resultant on its own line of action — it produces the same moment about every point as all forces together.')}</Caption>
        </Card>
        <Card title="Force polygon">
          <svg viewBox="0 0 300 280" className="mx-auto h-auto w-full max-w-[340px]" role="img" aria-label={t('Force polygon')}>
            {poly.map((p, i) => (forces[i]!.F > 0 ? <Arrow key={i} a={pp(p.a)} b={pp(p.b)} color={COLORS[i]} label={`F${'₁₂₃'[i]}`} /> : null))}
            {r.R > 1e-6 ? <Arrow a={pp([0, 0])} b={pp([cx, cy])} color={TM.reaction} width={3} dashed label="R" /> : <circle cx={150} cy={140} r={5} fill="none" stroke={TM.reaction} strokeWidth={2} />}
          </svg>
          <Caption>{t('Placing the forces head to tail, the closing side from start to end is the resultant. A closed polygon means R = 0.')}</Caption>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`R_x = \\sum F_i \\cos\\alpha_i = ${forces.map((f) => nf(components(f).Fx, 2)).join(' + ').replace(/\+ -/g, '- ')} = ${nf(r.Rx, 2)}\\,\\mathrm N`} />
          <Tex block math={`R_y = \\sum F_i \\sin\\alpha_i = ${forces.map((f) => nf(components(f).Fy, 2)).join(' + ').replace(/\+ -/g, '- ')} = ${nf(r.Ry, 2)}\\,\\mathrm N`} />
          <Tex block math={`R = \\sqrt{R_x^2 + R_y^2} = ${nf(r.R, 2)}\\,\\mathrm N,\\quad \\tan\\alpha_R = \\frac{R_y}{R_x} \\Rightarrow \\alpha_R = ${nf(r.angle, 1)}^\\circ`} />
          <Tex block math={`M_A = \\sum \\left[(x_i - x_A) F_{y,i} - (y_i - y_A) F_{x,i}\\right] = ${nf(r.M, 2)}\\,\\mathrm{Nm}`} />
          {r.R > 1e-6 && <Tex block math={`h = \\frac{|M_A|}{R} = ${nf(Math.abs(r.M) / r.R, 3)}\\,\\mathrm m \\quad (\\text{${t('distance of the line of action from A')}})`} />}
        </div>
      </Card>
    </EeLayout>
  );
}
