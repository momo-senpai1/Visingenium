/** TM 3: straight central impact — conservation of momentum, coefficient of restitution, energy loss. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Ground, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { impact } from '@/engine/mechanics/dynamics';

const useImpact = paramStore('tm-impact', { m1: 2, v1: 3, m2: 1, v2: -1, e: 0.6 });

export default function ImpactPage() {
  const s = useImpact();
  const r = impact(s.m1, s.v1, s.m2, s.v2, s.e);
  const ta = useAnimTime();
  // animation: 1 s approach, collision at t = 0, 1.5 s after; distances in m, 1 m = 90 px
  const T = 3.2;
  const tt = (ta % T) - 1.4;
  const w1 = 30 + 14 * Math.cbrt(s.m1);
  const w2 = 30 + 14 * Math.cbrt(s.m2);
  const xc = 300;
  const pos = (v: number, u: number, side: -1 | 1, w: number) => xc + side * (w / 2) + 90 * (tt < 0 ? v * tt : u * tt);
  const approaching = r.approaching;
  const x1 = approaching ? pos(s.v1, r.u1, -1, w1) : xc - 120 + 90 * s.v1 * (tt + 1.4) * 0.3;
  const x2 = approaching ? pos(s.v2, r.u2, 1, w2) : xc + 120 + 90 * s.v2 * (tt + 1.4) * 0.3;
  const after = approaching && tt >= 0;
  const xS = (s.m1 * x1 + s.m2 * x2) / (s.m1 + s.m2);
  const vScale = 18;
  const tl = [-1, -0.001, 0.001, 1.5];
  const vel = (v: number, u: number) => tl.map((x) => ({ x, y: x < 0 ? v : u }));
  const p = (u1: number, u2: number) => s.m1 * u1 + s.m2 * u2;
  const E = (u1: number, u2: number) => 0.5 * s.m1 * u1 * u1 + 0.5 * s.m2 * u2 * u2;
  const eCurve = Array.from({ length: 21 }, (_, i) => {
    const e = i / 20;
    const q = impact(s.m1, s.v1, s.m2, s.v2, e);
    return { x: e, y: q.loss };
  });

  return (
    <EeLayout
      aside={
        <>
          <Card title="Impact">
            <Idea>
              {t(
                'During the very short impact the contact forces are huge compared with all other forces, so the total momentum of both bodies is conserved. That gives one equation for two unknown velocities. The second comes from the material: the coefficient of restitution e = (separation speed)/(approach speed). e = 1 is a fully elastic impact (no energy lost), e = 0 fully plastic (both move on together). The centre of mass is not affected by the impact at all.',
              )}
            </Idea>
          </Card>
          <Card title="Bodies">
            <div className="space-y-3">
              <ParamSlider label="Mass 1" symbol="m₁" unit="kg" value={s.m1} min={0.1} max={10} step={0.1} onChange={(m1) => s.set({ m1 })} />
              <ParamSlider label="Velocity 1" symbol="v₁" unit="m/s" value={s.v1} min={-5} max={5} step={0.1} onChange={(v1) => s.set({ v1 })} />
              <ParamSlider label="Mass 2" symbol="m₂" unit="kg" value={s.m2} min={0.1} max={10} step={0.1} onChange={(m2) => s.set({ m2 })} />
              <ParamSlider label="Velocity 2" symbol="v₂" unit="m/s" value={s.v2} min={-5} max={5} step={0.1} onChange={(v2) => s.set({ v2 })} />
              <ParamSlider label="Coefficient of restitution" symbol="e" value={s.e} min={0} max={1} step={0.01} digits={2} onChange={(e) => s.set({ e })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="v₁′" value={nf(r.u1, 3)} unit="m/s" />
        <Kpi label="v₂′" value={nf(r.u2, 3)} unit="m/s" />
        <Kpi label="Centre of mass v_S" value={nf(r.vS, 3)} unit="m/s" sub={t('unchanged')} />
        <Kpi label="Energy loss" value={nf(r.loss, 3)} unit="J" sub={`${nf(r.E0 > 0 ? (r.loss / r.E0) * 100 : 0, 1)} %`} />
        <Kpi label="Impulse on body 2" value={nf(r.P, 3)} unit="Ns" />
      </div>
      {!approaching && <Notice tone="info">{t('The bodies do not approach each other (v₁ ≤ v₂): there is no impact.')}</Notice>}
      <Card title="Collision">
        <svg viewBox="0 0 600 170" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Two blocks colliding')}>
          <Ground a={[0, 130]} b={[600, 130]} />
          <rect x={x1 - w1 / 2} y={130 - w1} width={w1} height={w1} fill={TM.load} fillOpacity={0.55} stroke={TM.load} />
          <rect x={x2 - w2 / 2} y={130 - w2} width={w2} height={w2} fill={TM.v} fillOpacity={0.55} stroke={TM.v} />
          <Label x={x1} y={130 - w1 / 2 + 4}>
            1
          </Label>
          <Label x={x2} y={130 - w2 / 2 + 4}>
            2
          </Label>
          <Arrow a={[x1, 130 - w1 - 10]} b={[x1 + (after ? r.u1 : s.v1) * vScale, 130 - w1 - 10]} color={TM.load} label={after ? 'v₁′' : 'v₁'} />
          <Arrow a={[x2, 130 - w2 - 10]} b={[x2 + (after ? r.u2 : s.v2) * vScale, 130 - w2 - 10]} color={TM.v} label={after ? 'v₂′' : 'v₂'} />
          {approaching && <circle cx={xS} cy={150} r={4} fill={TM.reaction} />}
          {approaching && (
            <Label x={xS} y={166} color={TM.reaction} size={10}>
              S
            </Label>
          )}
        </svg>
        <Caption>{t('Green dot: common centre of mass — it moves with constant speed before, during and after the impact.')}</Caption>
      </Card>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="Velocities before and after">
          <LineChartBox
            height={230}
            series={[
              { name: 'v₁', data: vel(s.v1, r.u1), color: TM.load },
              { name: 'v₂', data: vel(s.v2, r.u2), color: TM.v },
              { name: 'v_S', data: vel(r.vS, r.vS), color: TM.reaction, dashed: true },
            ]}
            xLabel="t [s]"
            yLabel="v [m/s]"
            refX={[{ x: 0, label: t('impact') }]}
            digits={1}
          />
          <Caption>
            {t('Momentum before / after')}: {nf(p(s.v1, s.v2), 3)} / {nf(p(r.u1, r.u2), 3)} Ns · {t('kinetic energy')}: {nf(E(s.v1, s.v2), 3)} / {nf(E(r.u1, r.u2), 3)} J
          </Caption>
        </Card>
        <Card title="Energy loss over e">
          <LineChartBox height={230} series={[{ name: 'ΔE [J]', data: eCurve, color: TM.aux }]} xLabel="e" yLabel="ΔE [J]" refX={[{ x: s.e, label: 'e' }]} digits={2} />
          <Caption>{t('ΔE = (1 − e²)·½·m₁m₂/(m₁+m₂)·(v₁ − v₂)²: maximal for the plastic impact, zero for the elastic one.')}</Caption>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2' = ${nf(p(s.v1, s.v2), 3)}\\,\\mathrm{Ns}`} />
          <Tex block math={`e = -\\frac{v_1' - v_2'}{v_1 - v_2} = ${nf(s.e, 2)}`} />
          <Tex block math={`v_1' = \\frac{m_1 v_1 + m_2 v_2 - e\\,m_2 (v_1 - v_2)}{m_1 + m_2} = ${nf(r.u1, 3)}\\,\\mathrm{\\tfrac ms}`} />
          <Tex block math={`v_2' = \\frac{m_1 v_1 + m_2 v_2 + e\\,m_1 (v_1 - v_2)}{m_1 + m_2} = ${nf(r.u2, 3)}\\,\\mathrm{\\tfrac ms}`} />
          <Tex block math={`\\Delta E = \\frac{1 - e^2}{2}\\,\\frac{m_1 m_2}{m_1 + m_2}\\,(v_1 - v_2)^2 = ${nf(r.loss, 3)}\\,\\mathrm J`} />
        </div>
      </Card>
    </EeLayout>
  );
}
