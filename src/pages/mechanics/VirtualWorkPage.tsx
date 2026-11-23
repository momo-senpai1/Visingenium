/** TM 1: principle of virtual work on a toggle press — one equation instead of cutting the system apart. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Ground, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { togglePress } from '@/engine/mechanics/statics';

const useVw = paramStore('tm-virtual-work', { F: 500, alpha: 15, l: 0.3 });

export default function VirtualWorkPage() {
  const s = useVw();
  const r = togglePress(s.F, s.alpha, s.l);
  const ta = useAnimTime();
  // virtual displacement shown as a small oscillation of α
  const dAlpha = 4 * Math.sin(ta * 2.4);
  const geom = (alphaDeg: number) => {
    const a = (alphaDeg * Math.PI) / 180;
    const L = 200;
    const A: [number, number] = [90, 230];
    const C: [number, number] = [A[0] + L * Math.cos(a), A[1] - L * Math.sin(a)];
    const B: [number, number] = [A[0] + 2 * L * Math.cos(a), A[1]];
    return { A, B, C };
  };
  const g = geom(s.alpha);
  const gv = geom(Math.max(1, s.alpha + dAlpha));
  const curve = Array.from({ length: 118 }, (_, i) => {
    const a = 2 + i * 0.5;
    return { x: a, y: togglePress(1, a, s.l).ratio };
  });

  return (
    <EeLayout
      aside={
        <>
          <Card title="Principle of virtual work">
            <Idea>
              {t(
                'Imagine a tiny, geometrically possible displacement of the system (virtual displacement δ). A system is in equilibrium exactly when the total work of all applied forces in every such displacement is zero: δW = 0. Constraint forces do no work, so they drop out. To find one unknown force, release only the matching constraint — here the press: F·δz + H·δx = 0 gives H directly.',
              )}
            </Idea>
          </Card>
          <Card title="Toggle press">
            <div className="space-y-3">
              <ParamSlider label="Force on the hinge" symbol="F" unit="N" value={s.F} min={10} max={2000} step={10} digits={0} onChange={(F) => s.set({ F })} />
              <ParamSlider label="Angle of the bars" symbol="α" unit="°" value={s.alpha} min={2} max={60} step={0.5} onChange={(alpha) => s.set({ alpha })} />
              <ParamSlider label="Bar length" symbol="l" unit="m" value={s.l} min={0.1} max={1} step={0.01} digits={2} onChange={(l) => s.set({ l })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Press force H" value={nf(r.H, 1)} unit="N" />
        <Kpi label="Force ratio H/F" value={nf(r.ratio, 2)} />
        <Kpi label="δz / δα" value={nf(r.dz, 3)} unit="m" sub={t('hinge, downward')} />
        <Kpi label="δx / δα" value={nf(r.dx, 3)} unit="m" sub={t('slider, outward')} />
      </div>
      {s.alpha < 5 && <Notice tone="info">{t('Near the stretched position (α → 0) the press force grows without bound: a small force on the hinge produces a huge force on the slider.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Mechanism and virtual displacement">
          <svg viewBox="0 0 600 300" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Toggle press')}>
            <Ground a={[60, 262]} b={[540, 262]} />
            <line x1={gv.A[0]} y1={gv.A[1]} x2={gv.C[0]} y2={gv.C[1]} stroke={TM.muted} strokeWidth={2} strokeDasharray="5 4" />
            <line x1={gv.C[0]} y1={gv.C[1]} x2={gv.B[0]} y2={gv.B[1]} stroke={TM.muted} strokeWidth={2} strokeDasharray="5 4" />
            <line x1={g.A[0]} y1={g.A[1]} x2={g.C[0]} y2={g.C[1]} stroke={TM.body} strokeWidth={5} strokeLinecap="round" />
            <line x1={g.C[0]} y1={g.C[1]} x2={g.B[0]} y2={g.B[1]} stroke={TM.body} strokeWidth={5} strokeLinecap="round" />
            {/* fixed pin A */}
            <path d={`M${g.A[0]},${g.A[1]} l-14,26 h28 z`} fill="none" stroke={TM.body} strokeWidth={1.5} />
            <circle cx={g.A[0]} cy={g.A[1]} r={5} fill="rgb(var(--plant-950))" stroke={TM.body} strokeWidth={2} />
            {/* slider B */}
            <rect x={g.B[0] - 18} y={g.B[1] - 14} width={36} height={28} fill={TM.fill} stroke={TM.body} strokeWidth={1.4} />
            <circle cx={g.B[0]} cy={g.B[1]} r={5} fill="rgb(var(--plant-950))" stroke={TM.body} strokeWidth={2} />
            <circle cx={g.C[0]} cy={g.C[1]} r={5} fill="rgb(var(--plant-950))" stroke={TM.body} strokeWidth={2} />
            <Arrow a={[g.C[0], g.C[1] - 70]} b={[g.C[0], g.C[1] - 8]} color={TM.load} label="F" labelOffset={[8, -40]} />
            <Arrow a={[g.B[0] + 80, g.B[1]]} b={[g.B[0] + 20, g.B[1]]} color={TM.reaction} label="H" labelOffset={[30, -10]} />
            <Label x={g.A[0] + 46} y={g.A[1] - 6}>
              α
            </Label>
            <Label x={g.C[0] - 8} y={g.C[1] + 22} color={TM.muted}>
              C
            </Label>
            <Label x={g.A[0] - 14} y={g.A[1] - 8} color={TM.muted}>
              A
            </Label>
            <Label x={g.B[0]} y={g.B[1] - 20} color={TM.muted}>
              B
            </Label>
          </svg>
          <Caption>{t('Dashed: the system after a small virtual change δα. The hinge C moves down by δz while the slider B moves outward by δx — the press force H does negative work against it.')}</Caption>
        </Card>
        <Card title="Force ratio H/F over α">
          <LineChartBox height={250} logY series={[{ name: 'H/F = 1/(2 tan α)', data: curve, color: TM.reaction }]} xLabel="α [°]" yLabel="H/F" refX={[{ x: s.alpha, label: 'α' }]} digits={0} />
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`z_C = l\\sin\\alpha \\Rightarrow \\delta z_C = l\\cos\\alpha\\,\\delta\\alpha,\\qquad x_B = 2l\\cos\\alpha \\Rightarrow \\delta x_B = -2l\\sin\\alpha\\,\\delta\\alpha`} />
          <Tex block math={`\\delta W = -F\\,\\delta z_C - H\\,\\delta x_B = \\left(-F\\,l\\cos\\alpha + 2H\\,l\\sin\\alpha\\right)\\delta\\alpha = 0`} />
          <Tex block math={`H = \\frac{F}{2\\tan\\alpha} = \\frac{${nf(s.F, 0)}}{2\\tan ${nf(s.alpha, 1)}^\\circ} = ${nf(r.H, 1)}\\,\\mathrm N`} />
          <Tex block math={`\\text{${t('Check by cutting')}}:\\ S = \\frac{F}{2\\sin\\alpha},\\quad H = S\\cos\\alpha = ${nf((s.F / (2 * Math.sin((s.alpha * Math.PI) / 180))) * Math.cos((s.alpha * Math.PI) / 180), 1)}\\,\\mathrm N`} />
        </div>
      </Card>
    </EeLayout>
  );
}
