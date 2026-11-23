/** TM 1: static and sliding friction on an incline (Coulomb) and rope friction (Euler–Eytelwein). */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Ground, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { incline, ropeRatio } from '@/engine/mechanics/statics';

const useFriction = paramStore('tm-friction', { m: 10, alpha: 25, mu0: 0.5, mu: 0.4, F: 20, S1: 100, muRope: 0.3, wrap: 180 });

export default function FrictionPage() {
  const s = useFriction();
  const r = incline(s);
  const ta = useAnimTime();
  const G = s.m * 9.81;

  // block slides along the slope in a loop when it is not at rest
  const period = 2.2;
  const tau = ta % period;
  const travel = r.state === 'rest' ? 0 : Math.max(-150, Math.min(150, 0.5 * r.a * tau * tau * 60));

  // geometry: slope from bottom left to top right
  const al = (s.alpha * Math.PI) / 180;
  const O: [number, number] = [60, 300];
  const len = 440;
  const top: [number, number] = [O[0] + len * Math.cos(al), O[1] - len * Math.sin(al)];
  const u: [number, number] = [Math.cos(al), -Math.sin(al)]; // up the slope (screen)
  const n: [number, number] = [-Math.sin(al), -Math.cos(al)]; // outward normal (screen)
  const sAlong = len / 2 + travel;
  const base: [number, number] = [O[0] + u[0] * sAlong, O[1] + u[1] * sAlong];
  const bw = 70;
  const bh = 44;
  const c: [number, number] = [base[0] + n[0] * (bh / 2), base[1] + n[1] * (bh / 2)];
  const corners = [
    [-bw / 2, 0],
    [bw / 2, 0],
    [bw / 2, bh],
    [-bw / 2, bh],
  ].map(([a, b]) => [base[0] + u[0] * a! + n[0] * b!, base[1] + u[1] * a! + n[1] * b!]);
  const k = 70 / Math.max(G, s.F, 1);
  const add = (p: [number, number], d: [number, number], m: number): [number, number] => [p[0] + d[0] * m, p[1] + d[1] * m];

  // friction characteristic: R over the pulling force F
  const Fend = Math.max(r.Fmax * 1.4, 10);
  const charac = Array.from({ length: 241 }, (_, i) => {
    const F = (Fend * i) / 240;
    return { x: F, y: incline({ ...s, F }).R };
  });
  const ropeCurve = Array.from({ length: 145 }, (_, i) => ({ x: i * 5, y: ropeRatio(s.muRope, i * 5) }));
  const S2 = s.S1 * ropeRatio(s.muRope, s.wrap);

  return (
    <EeLayout
      aside={
        <>
          <Card title="Static and sliding friction">
            <Idea>
              {t(
                'Static friction is a reaction force: it takes exactly the value needed for rest, but at most μ₀·N (Coulomb). Only when this limit is exceeded does the body slide; then the sliding friction μ·N acts against the direction of motion. Without a pulling force the block stays put as long as tan α ≤ μ₀ — the slope is self-locking.',
              )}
            </Idea>
          </Card>
          <Card title="Block on an incline">
            <div className="space-y-3">
              <ParamSlider label="Mass" symbol="m" unit="kg" value={s.m} min={1} max={50} step={1} digits={0} onChange={(m) => s.set({ m })} />
              <ParamSlider label="Incline angle" symbol="α" unit="°" value={s.alpha} min={0} max={60} step={1} digits={0} onChange={(alpha) => s.set({ alpha })} />
              <ParamSlider label="Static friction coefficient" symbol="μ₀" value={s.mu0} min={0} max={1} step={0.01} digits={2} onChange={(mu0) => s.set({ mu0, mu: Math.min(s.mu, mu0) })} />
              <ParamSlider label="Sliding friction coefficient" symbol="μ" value={s.mu} min={0} max={s.mu0} step={0.01} digits={2} onChange={(mu) => s.set({ mu })} />
              <ParamSlider label="Pulling force up the slope" symbol="F" unit="N" value={s.F} min={0} max={Math.round(G * 1.6)} step={1} digits={0} onChange={(F) => s.set({ F })} />
            </div>
          </Card>
          <Card title="Rope friction">
            <div className="space-y-3">
              <ParamSlider label="Holding force" symbol="S₁" unit="N" value={s.S1} min={1} max={500} step={1} digits={0} onChange={(S1) => s.set({ S1 })} />
              <ParamSlider label="Friction coefficient" symbol="μ" value={s.muRope} min={0} max={0.8} step={0.01} digits={2} onChange={(muRope) => s.set({ muRope })} />
              <ParamSlider label="Wrap angle" symbol="α" unit="°" value={s.wrap} min={0} max={720} step={15} digits={0} onChange={(wrap) => s.set({ wrap })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Normal force N" value={nf(r.N, 1)} unit="N" />
        <Kpi label="Needed friction" value={nf(r.R_req, 1)} unit="N" sub={`${t('limit')} μ₀N = ${nf(r.R_max, 1)} N`} />
        <Kpi label="State" value={r.state === 'rest' ? t('at rest') : r.state === 'up' ? t('slides up') : t('slides down')} />
        <Kpi label="Acceleration" value={nf(r.a, 2)} unit="m/s²" />
        <Kpi label="Rest for" value={`${nf(r.Fmin, 0)} … ${nf(r.Fmax, 0)}`} unit="N" sub={r.selfLocking ? t('self-locking') : t('not self-locking')} />
      </div>
      {r.state !== 'rest' && <Notice tone="warning">{t('The needed friction force exceeds μ₀·N: the block slides and the smaller sliding friction μ·N acts against the motion.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Free-body diagram">
          <svg viewBox="0 0 580 340" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Block on an incline with forces')}>
            <Ground a={O} b={top} side={-1} />
            <line x1={O[0]} y1={O[1]} x2={top[0]} y2={O[1]} stroke={TM.ground} strokeDasharray="4 4" />
            <Label x={O[0] + 70} y={O[1] - 8}>
              α
            </Label>
            <polygon points={corners.map((p) => p.join(',')).join(' ')} fill={TM.fill} stroke={TM.body} strokeWidth={1.4} />
            <Arrow a={c} b={[c[0], c[1] + G * k]} color={TM.load} label="G" />
            <Arrow a={base} b={add(base, n, r.N * k)} color={TM.reaction} label="N" labelOffset={[-22, -4]} />
            {Math.abs(r.R) > 1e-6 && <Arrow a={add(base, u, -bw / 2)} b={add(add(base, u, -bw / 2), u, r.R * k)} color={TM.aux} label="R" labelOffset={[-6, 18]} />}
            {s.F > 0 && <Arrow a={add(c, u, bw / 2)} b={add(add(c, u, bw / 2), u, s.F * k)} color={TM.v} label="F" />}
          </svg>
          <Caption>{t('G: weight, N: normal force, R: friction force (drawn in its actual direction), F: pulling force. Increase α until the block starts to slide.')}</Caption>
        </Card>
        <Card title="Friction force over the pulling force">
          <LineChartBox
            height={270}
            series={[{ name: 'R(F) [N]', data: charac, color: TM.aux }]}
            xLabel="F [N]"
            yLabel="R [N]"
            refX={[
              { x: r.Fmin, label: 'F_min' },
              { x: r.Fmax, label: 'F_max' },
              { x: s.F, label: 'F' },
            ]}
            digits={0}
          />
          <Caption>{t('Between F_min and F_max the block rests and the friction adapts linearly (positive: acts up the slope). Outside it jumps to the sliding value ±μN.')}</Caption>
        </Card>
      </div>
      <div className="grid gap-2 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card title="Rope over a fixed drum">
          <svg viewBox="0 0 300 240" className="mx-auto h-auto w-full max-w-[340px]" role="img" aria-label={t('Rope over a fixed drum')}>
            <circle cx={150} cy={110} r={60} fill={TM.fill} stroke={TM.body} strokeWidth={1.4} />
            <circle cx={150} cy={110} r={4} fill={TM.body} />
            {/* rope: from the left tangent over the top, wrapping by the wrap angle (shown up to 360°) */}
            {(() => {
              const w = Math.min(s.wrap, 359.9) * (Math.PI / 180);
              const a0 = Math.PI; // left side, rope leaves downwards
              const pts = Array.from({ length: 60 }, (_, i) => {
                const a = a0 - (w * i) / 59;
                return [150 + 64 * Math.cos(a), 110 - 64 * Math.sin(a)];
              });
              const end = pts.at(-1)!;
              const ae = a0 - w;
              const tang: [number, number] = [Math.sin(ae), Math.cos(ae)];
              return (
                <>
                  <line x1={86} y1={110} x2={86} y2={215} stroke={TM.v} strokeWidth={3} />
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.v} strokeWidth={3} />
                  <line x1={end[0]} y1={end[1]} x2={end[0]! + tang[0] * 70} y2={end[1]! + tang[1] * 70} stroke={TM.v} strokeWidth={3} />
                  <Arrow a={[86, 190]} b={[86, 232]} color={TM.reaction} label={`S₁ = ${nf(s.S1, 0)} N`} labelOffset={[8, -4]} />
                  <Arrow a={[end[0]! + tang[0] * 50, end[1]! + tang[1] * 50]} b={[end[0]! + tang[0] * 85, end[1]! + tang[1] * 85]} color={TM.load} label={`S₂ = ${nf(S2, 0)} N`} />
                </>
              );
            })()}
          </svg>
          <Caption>{t('Each element of the wrapped rope adds friction proportional to the local rope force — so the force grows exponentially with the wrap angle.')}</Caption>
        </Card>
        <Card title="Euler–Eytelwein: force ratio over the wrap angle">
          <LineChartBox height={240} series={[{ name: 'S₂/S₁', data: ropeCurve, color: TM.load }]} xLabel={t('wrap angle α [°]')} yLabel="S₂/S₁" refX={[{ x: s.wrap, label: 'α' }]} digits={1} />
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`\\nearrow:\\ F + R - G\\sin\\alpha = 0 \\Rightarrow R = ${nf(r.G_t, 1)} - ${nf(s.F, 1)} = ${nf(r.R_req, 1)}\\,\\mathrm N`} />
          <Tex block math={`\\nwarrow:\\ N - G\\cos\\alpha = 0 \\Rightarrow N = ${nf(r.N, 1)}\\,\\mathrm N`} />
          <Tex block math={`|R| \\le \\mu_0 N = ${nf(r.R_max, 1)}\\,\\mathrm N \\ \\Rightarrow\\ \\text{${r.state === 'rest' ? t('rest') : t('violated: sliding')}}`} />
          <Tex block math={`F_{min/max} = G(\\sin\\alpha \\mp \\mu_0\\cos\\alpha) = ${nf(r.Fmin, 1)}\\ /\\ ${nf(r.Fmax, 1)}\\,\\mathrm N`} />
          <Tex block math={`\\text{${t('self-locking')}}:\\ \\tan\\alpha = ${nf(Math.tan((s.alpha * Math.PI) / 180), 3)} ${r.selfLocking ? '\\le' : '>'} \\mu_0 = ${nf(s.mu0, 2)}`} />
          <Tex block math={`S_2 = S_1\\,e^{\\mu\\alpha} = ${nf(s.S1, 0)} \\cdot e^{${nf(s.muRope, 2)} \\cdot ${nf((s.wrap * Math.PI) / 180, 3)}} = ${nf(S2, 1)}\\,\\mathrm N`} />
        </div>
      </Card>
    </EeLayout>
  );
}
