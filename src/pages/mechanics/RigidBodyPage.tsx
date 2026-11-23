/** TM 3: kinematics of rigid bodies — slider-crank with the instantaneous centre, relative motion and Coriolis acceleration. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Ground, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { sliderCrank } from '@/engine/mechanics/dynamics';

const useRigid = paramStore('tm-rigid', { r: 0.1, l: 0.3, omega: 2, Om: 1, vrel: 0.3 });

type P = [number, number];

export default function RigidBodyPage() {
  const s = useRigid();
  const ta = useAnimTime();
  const phi = ((s.omega * ta * 0.5 * 180) / Math.PI) % 360;
  const k = sliderCrank(s.r, s.l, phi, s.omega);
  const sc = 360 / (s.r + s.l) / 1.4;
  const O: P = [110, 190];
  const X = (x: number) => O[0] + x * sc;
  const Y = (y: number) => O[1] - y * sc;
  const A: P = [X(k.A.x), Y(k.A.y)];
  const B: P = [X(k.B.x), Y(0)];
  const IC: P | null = k.IC && Math.abs(k.IC.y) < 5 * (s.r + s.l) ? [X(k.IC.x), Y(k.IC.y)] : null;
  const vsc = 50 / (s.omega * s.r);
  const vAdir: P = [-Math.sin((phi * Math.PI) / 180), Math.cos((phi * Math.PI) / 180)];
  const curve = Array.from({ length: 181 }, (_, i) => {
    const c = sliderCrank(s.r, s.l, i * 2, s.omega);
    return { phi: i * 2, x: c.B.x, v: c.vB };
  });

  // Coriolis: disc turning with Ω, slider moving outward along a radial slot with v_rel
  const R = 110;
  const Rm = 1; // [m] slot length
  const cycle = Rm / Math.max(0.05, s.vrel);
  const rr = ((ta * 0.6 * s.vrel) % Rm) / Rm; // 0…1
  const th = ta * 0.6 * s.Om;
  const C: P = [150, 140];
  const e: P = [Math.cos(th), -Math.sin(th)];
  const n: P = [e[1], -e[0]]; // e_φ: 90° ahead in the (counter-clockwise) sense of rotation, screen y downward
  const pos: P = [C[0] + e[0] * rr * R, C[1] + e[1] * rr * R];
  const aF = s.Om ** 2 * rr * Rm;
  const aC = 2 * s.Om * s.vrel;
  const am = 60 / Math.max(aF, aC, 1e-9);

  return (
    <EeLayout
      aside={
        <>
          <Card title="Kinematics of rigid bodies">
            <Idea>
              {t(
                'In plane motion every rigid body turns, at each instant, about one point: the instantaneous centre of zero velocity. It lies where the perpendiculars to two known velocity directions meet. All velocities are then v = ω·(distance to that point). If a point also moves relative to a rotating body, its acceleration has three parts: the acceleration of the body point (guide), the relative acceleration, and the Coriolis acceleration 2·Ω×v_rel.',
              )}
            </Idea>
          </Card>
          <Card title="Slider-crank">
            <div className="space-y-3">
              <ParamSlider label="Crank radius" symbol="r" unit="m" value={s.r} min={0.02} max={0.2} step={0.005} digits={3} onChange={(r) => s.set({ r, l: Math.max(s.l, r * 1.2) })} />
              <ParamSlider label="Connecting rod" symbol="l" unit="m" value={s.l} min={Math.max(0.05, s.r * 1.2)} max={0.6} step={0.005} digits={3} onChange={(l) => s.set({ l })} />
              <ParamSlider label="Crank speed" symbol="ω" unit="1/s" value={s.omega} min={0.2} max={6} step={0.1} onChange={(omega) => s.set({ omega })} />
            </div>
          </Card>
          <Card title="Rotating disc with slot">
            <div className="space-y-3">
              <ParamSlider label="Angular velocity" symbol="Ω" unit="1/s" value={s.Om} min={0} max={3} step={0.05} digits={2} onChange={(Om) => s.set({ Om })} />
              <ParamSlider label="Relative speed" symbol="v_rel" unit="m/s" value={s.vrel} min={0.05} max={1} step={0.01} digits={2} onChange={(vrel) => s.set({ vrel })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Crank angle φ" value={nf(phi, 0)} unit="°" />
        <Kpi label="v_A" value={nf(k.vA, 3)} unit="m/s" sub="ω·r" />
        <Kpi label="ω of the rod" value={nf(k.omegaRod, 3)} unit="1/s" />
        <Kpi label="v_B (slider)" value={nf(k.vB, 3)} unit="m/s" />
        <Kpi label="Coriolis a_C" value={nf(aC, 3)} unit="m/s²" sub="2·Ω·v_rel" />
      </div>
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card title="Slider-crank and instantaneous centre">
          <svg viewBox="0 -150 600 450" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Slider-crank mechanism')}>
            <Ground a={[X(s.l - s.r) - 30, O[1] + 16]} b={[X(s.l + s.r) + 40, O[1] + 16]} />
            <circle cx={O[0]} cy={O[1]} r={s.r * sc} fill="none" stroke={TM.muted} strokeDasharray="3 4" />
            {IC && (
              <g>
                <line x1={O[0]} y1={O[1]} x2={IC[0]} y2={IC[1]} stroke={TM.aux} strokeOpacity={0.6} strokeDasharray="5 4" />
                <line x1={B[0]} y1={B[1]} x2={IC[0]} y2={IC[1]} stroke={TM.aux} strokeOpacity={0.6} strokeDasharray="5 4" />
                <circle cx={IC[0]} cy={IC[1]} r={6} fill={TM.aux} />
                <Label x={IC[0] + 10} y={IC[1] + 4} anchor="start" color={TM.aux}>
                  {t('IC')}
                </Label>
              </g>
            )}
            <line x1={O[0]} y1={O[1]} x2={A[0]} y2={A[1]} stroke={TM.body} strokeWidth={7} strokeLinecap="round" />
            <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={TM.body} strokeWidth={5} strokeLinecap="round" />
            <rect x={B[0] - 22} y={B[1] - 14} width={44} height={28} fill={TM.fill} stroke={TM.body} />
            {[O, A, B].map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={5} fill="rgb(var(--plant-950))" stroke={TM.body} strokeWidth={2} />
            ))}
            <Arrow a={A} b={[A[0] + vAdir[0] * k.vA * vsc, A[1] - vAdir[1] * k.vA * vsc]} color={TM.v} label="v_A" />
            <Arrow a={B} b={[B[0] + k.vB * vsc, B[1]]} color={TM.v} label="v_B" labelOffset={[4, -10]} />
            <Label x={O[0] - 10} y={O[1] + 32} color={TM.muted}>
              0
            </Label>
          </svg>
          <Caption>{t('v_A is perpendicular to the crank, v_B horizontal. The perpendiculars to both meet in the instantaneous centre IC of the rod: there the rod momentarily has zero velocity and turns about it.')}</Caption>
        </Card>
        <Card title="Slider position and velocity">
          <LineChartBox
            height={250}
            series={[
              { name: 'x_B [m]', data: curve.map((c) => ({ x: c.phi, y: c.x })), color: TM.body },
              { name: 'v_B [m/s]', data: curve.map((c) => ({ x: c.phi, y: c.v })), color: TM.v },
            ]}
            xLabel="φ [°]"
            yLabel=""
            refX={[{ x: phi, label: 'φ' }]}
            digits={2}
          />
          <Caption>{t('The motion is not a pure sine: the finite rod length l makes the slider faster near the outer dead centre than near the inner one.')}</Caption>
        </Card>
      </div>
      <Card title="Relative motion: Coriolis acceleration">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <svg viewBox="0 0 300 280" className="mx-auto h-auto w-full max-w-[360px]" role="img" aria-label={t('Rotating disc with slider')}>
            <circle cx={C[0]} cy={C[1]} r={R + 12} fill={TM.fill} fillOpacity={0.35} stroke={TM.body} />
            <line x1={C[0]} y1={C[1]} x2={C[0] + e[0] * (R + 8)} y2={C[1] + e[1] * (R + 8)} stroke={TM.body} strokeWidth={8} strokeOpacity={0.5} strokeLinecap="round" />
            <circle cx={C[0]} cy={C[1]} r={4} fill={TM.body} />
            <rect x={pos[0] - 8} y={pos[1] - 8} width={16} height={16} fill={TM.load} transform={`rotate(${(-th * 180) / Math.PI} ${pos[0]} ${pos[1]})`} />
            <Arrow a={pos} b={[pos[0] + e[0] * 40, pos[1] + e[1] * 40]} color={TM.v} label="v_rel" />
            <Arrow a={pos} b={[pos[0] + n[0] * s.Om * rr * Rm * 40 / Math.max(s.vrel, 0.05), pos[1] + n[1] * s.Om * rr * Rm * 40 / Math.max(s.vrel, 0.05)]} color={TM.v} width={1.6} dashed label="v_F" />
            <Arrow a={pos} b={[pos[0] - e[0] * aF * am, pos[1] - e[1] * aF * am]} color={TM.aux} label="a_F" labelOffset={[-28, -4]} />
            <Arrow a={pos} b={[pos[0] + n[0] * aC * am, pos[1] + n[1] * aC * am]} color={TM.a} label="a_C" />
            <Label x={C[0]} y={270} color={TM.muted}>{`r = ${nf(rr * Rm, 2)} m`}</Label>
          </svg>
          <div className="space-y-2 text-[11px] text-plant-300">
            <p>{t('The block slides outward in the slot with constant v_rel while the disc turns. Seen from outside it needs two accelerations sideways and inward:')}</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>{t('a_F = Ω²·r toward the centre — the guide acceleration of the disc point it is currently on.')}</li>
              <li>{t('a_C = 2·Ω·v_rel perpendicular to the slot — because moving outward it reaches points that move faster, and because v_rel itself turns with the disc.')}</li>
            </ul>
            <Tex block math={`\\vec a = \\vec a_F + \\vec a_{rel} + \\vec a_C,\\quad a_C = 2\\,\\Omega\\,v_{rel} = 2 \\cdot ${nf(s.Om, 2)} \\cdot ${nf(s.vrel, 2)} = ${nf(aC, 3)}\\,\\mathrm{\\tfrac m{s^2}}`} />
            <p className="text-[10px] text-plant-500">{t('Cycle time of the animation')}: {nf(cycle / 0.6, 1)} s</p>
          </div>
        </div>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`v_A = \\omega\\,r = ${nf(k.vA, 3)}\\,\\mathrm{\\tfrac ms}\\ \\perp\\ \\overline{0A}`} />
          <Tex block math={`x_B = r\\cos\\varphi + \\sqrt{l^2 - r^2\\sin^2\\varphi} = ${nf(k.B.x, 4)}\\,\\mathrm m`} />
          <Tex block math={`\\omega_{AB} = \\frac{v_A}{\\overline{A\\,IC}} = ${nf(k.omegaRod, 3)}\\,\\mathrm{s^{-1}},\\quad v_B = \\omega_{AB}\\,\\overline{B\\,IC} = ${nf(Math.abs(k.vB), 3)}\\,\\mathrm{\\tfrac ms}`} />
          <Tex block math={`\\text{${t('check')}}:\\ \\dot x_B = -r\\omega\\sin\\varphi\\left(1 + \\frac{r\\cos\\varphi}{\\sqrt{l^2 - r^2\\sin^2\\varphi}}\\right) = ${nf(k.vB, 3)}\\,\\mathrm{\\tfrac ms}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
