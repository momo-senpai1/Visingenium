/** TM 3: particle kinematics — path, velocity, acceleration in Cartesian, natural and polar coordinates. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { ellipseMotion } from '@/engine/mechanics/dynamics';

const useKin = paramStore('tm-kinematics', { a: 3, b: 1.6, omega: 1, view: 'natural' as 'natural' | 'cartesian' | 'polar', play: true, t0: 0 });

export default function KinematicsPage() {
  const s = useKin();
  const ta = useAnimTime();
  const T = (2 * Math.PI) / s.omega;
  const time = s.play ? (ta * 0.6) % T : s.t0;
  const k = ellipseMotion(s.a, s.b, s.omega, time);
  const sc = Math.min(250 / s.a, 140 / s.b);
  const X = (x: number) => 290 + x * sc;
  const Y = (y: number) => 170 - y * sc;
  const P: [number, number] = [X(k.x), Y(k.y)];
  const vmax = Math.max(s.a, s.b) * s.omega;
  const amax = Math.max(s.a, s.b) * s.omega ** 2;
  const vs = 70 / vmax;
  const as = 70 / amax;
  const tip = (dx: number, dy: number, f: number): [number, number] => [P[0] + dx * f, P[1] - dy * f];
  const tx = k.v > 1e-12 ? k.vx / k.v : 1;
  const ty = k.v > 1e-12 ? k.vy / k.v : 0;
  // principal normal points toward the centre of curvature
  const sgn = Math.sign(k.vx * k.ay - k.vy * k.ax) || 1;
  const nx = -ty * sgn;
  const ny = tx * sgn;
  const rho = Math.min(k.rho, 50);
  const curve = Array.from({ length: 121 }, (_, i) => {
    const ti = (T * i) / 120;
    const m = ellipseMotion(s.a, s.b, s.omega, ti);
    return { t: ti, v: m.v, at: m.at, an: m.an, rho: Math.min(m.rho, 20) };
  });
  const path = Array.from({ length: 121 }, (_, i) => {
    const p = (2 * Math.PI * i) / 120;
    return `${X(s.a * Math.cos(p))},${Y(s.b * Math.sin(p))}`;
  }).join(' ');

  return (
    <EeLayout
      aside={
        <>
          <Card title="Kinematics of a particle">
            <Idea>
              {t(
                'Position, velocity and acceleration are vectors: v = ṙ, a = v̇. The velocity is always tangent to the path. The acceleration is best split along the path (natural coordinates): the tangential part a_t = v̇ changes the speed, the normal part a_n = v²/ρ changes the direction and points to the centre of curvature. On a circle at constant speed only a_n remains; on the ellipse both parts change all the time.',
              )}
            </Idea>
            <Segmented
              value={s.view}
              onChange={(view) => s.set({ view })}
              options={[
                { value: 'natural', label: t('Natural') },
                { value: 'cartesian', label: t('Cartesian') },
                { value: 'polar', label: t('Polar') },
              ]}
            />
          </Card>
          <Card title="Path x = a cos ωt, y = b sin ωt">
            <div className="space-y-3">
              <ParamSlider label="Semi-axis" symbol="a" unit="m" value={s.a} min={0.5} max={5} step={0.1} onChange={(a) => s.set({ a })} />
              <ParamSlider label="Semi-axis" symbol="b" unit="m" value={s.b} min={0.5} max={5} step={0.1} onChange={(b) => s.set({ b })} />
              <ParamSlider label="Angular frequency" symbol="ω" unit="1/s" value={s.omega} min={0.2} max={3} step={0.05} digits={2} onChange={(omega) => s.set({ omega })} />
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-plant-300">
                <input type="checkbox" checked={s.play} onChange={(e) => s.set({ play: e.target.checked, t0: time })} />
                {t('Animate')}
              </label>
              {!s.play && <ParamSlider label="Time" symbol="t" unit="s" value={s.t0} min={0} max={T} step={T / 200} digits={2} onChange={(t0) => s.set({ t0 })} />}
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Speed v" value={nf(k.v, 3)} unit="m/s" />
        <Kpi label="Tangential a_t" value={nf(k.at, 3)} unit="m/s²" sub={k.at > 1e-6 ? t('speeding up') : k.at < -1e-6 ? t('slowing down') : '–'} />
        <Kpi label="Normal a_n" value={nf(k.an, 3)} unit="m/s²" />
        <Kpi label="Radius of curvature ρ" value={Number.isFinite(k.rho) ? nf(k.rho, 3) : '∞'} unit="m" />
        <Kpi label="|a|" value={nf(k.a, 3)} unit="m/s²" sub="√(a_t² + a_n²)" />
      </div>
      <Card title="Path with velocity and acceleration">
        <svg viewBox="0 0 580 340" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Particle on an elliptical path')}>
          <line x1={20} y1={Y(0)} x2={560} y2={Y(0)} stroke={TM.ground} strokeOpacity={0.4} />
          <line x1={X(0)} y1={10} x2={X(0)} y2={330} stroke={TM.ground} strokeOpacity={0.4} />
          <polygon points={path} fill="none" stroke={TM.muted} strokeDasharray="5 4" />
          {s.view === 'natural' && Number.isFinite(k.rho) && rho * sc < 2000 && (
            <circle cx={P[0] + nx * rho * sc} cy={P[1] - ny * rho * sc} r={rho * sc} fill="none" stroke={TM.aux} strokeOpacity={0.35} strokeDasharray="3 4" />
          )}
          {s.view === 'polar' && <line x1={X(0)} y1={Y(0)} x2={P[0]} y2={P[1]} stroke={TM.muted} />}
          <Arrow a={P} b={tip(k.vx, k.vy, vs)} color={TM.v} label="v" />
          {s.view === 'cartesian' && (
            <>
              <Arrow a={P} b={tip(k.ax, 0, as)} color={TM.a} width={1.6} dashed label="a_x" />
              <Arrow a={P} b={tip(0, k.ay, as)} color={TM.a} width={1.6} dashed label="a_y" />
            </>
          )}
          {s.view === 'natural' && (
            <>
              <Arrow a={P} b={tip(tx * k.at, ty * k.at, as)} color={TM.load} width={2} dashed label="a_t" />
              <Arrow a={P} b={tip(nx * k.an, ny * k.an, as)} color={TM.aux} width={2} dashed label="a_n" />
            </>
          )}
          {s.view === 'polar' && (
            <>
              <Arrow a={P} b={tip((k.x / Math.hypot(k.x, k.y)) * k.ar, (k.y / Math.hypot(k.x, k.y)) * k.ar, as)} color={TM.load} width={2} dashed label="a_r" />
              <Arrow a={P} b={tip((-k.y / Math.hypot(k.x, k.y)) * k.aphi, (k.x / Math.hypot(k.x, k.y)) * k.aphi, as)} color={TM.aux} width={2} dashed label="a_φ" />
            </>
          )}
          <Arrow a={P} b={tip(k.ax, k.ay, as)} color={TM.a} label="a" />
          <circle cx={P[0]} cy={P[1]} r={6} fill={TM.body} />
          <Label x={540} y={325} color={TM.muted} anchor="end">{`t = ${nf(time, 2)} s`}</Label>
        </svg>
        <Caption>{t('Blue: velocity (tangent to the path). Orange: total acceleration; dashed: its components in the chosen coordinates. In natural coordinates the faint circle is the osculating circle with radius ρ.')}</Caption>
      </Card>
      <Card title="Over one revolution">
        <LineChartBox
          height={240}
          series={[
            { name: 'v [m/s]', data: curve.map((c) => ({ x: c.t, y: c.v })), color: TM.v },
            { name: 'a_t [m/s²]', data: curve.map((c) => ({ x: c.t, y: c.at })), color: TM.load },
            { name: 'a_n [m/s²]', data: curve.map((c) => ({ x: c.t, y: c.an })), color: TM.aux },
          ]}
          xLabel="t [s]"
          yLabel=""
          refX={[{ x: time, label: 't' }]}
          digits={2}
        />
        <Caption>{t('a_t is zero where the speed is extreme (at the ends of the axes). a_n is largest at the sharp ends of the ellipse, where ρ is smallest.')}</Caption>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`\\vec v = \\begin{pmatrix}-a\\omega\\sin\\omega t\\\\ b\\omega\\cos\\omega t\\end{pmatrix} = \\begin{pmatrix}${nf(k.vx, 3)}\\\\ ${nf(k.vy, 3)}\\end{pmatrix}\\,\\mathrm{\\tfrac ms}`} />
          <Tex block math={`\\vec a = -\\omega^2\\begin{pmatrix}a\\cos\\omega t\\\\ b\\sin\\omega t\\end{pmatrix} = \\begin{pmatrix}${nf(k.ax, 3)}\\\\ ${nf(k.ay, 3)}\\end{pmatrix}\\,\\mathrm{\\tfrac m{s^2}}`} />
          <Tex block math={`a_t = \\frac{\\vec v \\cdot \\vec a}{v} = ${nf(k.at, 3)},\\quad a_n = \\frac{|\\vec v \\times \\vec a|}{v} = ${nf(k.an, 3)}\\,\\mathrm{\\tfrac m{s^2}}`} />
          <Tex block math={`\\rho = \\frac{v^2}{a_n} = ${Number.isFinite(k.rho) ? nf(k.rho, 3) : '\\infty'}\\,\\mathrm m`} />
          <Tex block math={`\\text{${t('polar')}}:\\ a_r = \\ddot r - r\\dot\\varphi^2 = ${nf(k.ar, 3)},\\quad a_\\varphi = r\\ddot\\varphi + 2\\dot r\\dot\\varphi = ${nf(k.aphi, 3)}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
