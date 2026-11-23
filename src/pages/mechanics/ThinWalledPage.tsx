/** TM 2: thin-walled sections — torsion of closed (Bredt) vs open profiles, shear from transverse force, shear centre. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { channelShearCentre, iBeamShear, thinWalledTorsion } from '@/engine/mechanics/elasto';

const useTw = paramStore('tm-thinwalled', { b: 100, h: 60, t: 3, Mt: 1, Q: 50, fb: 120, tf: 10, wh: 240, tw: 6 });

type P = [number, number];

/** small arrows marching around a closed path at speed ∝ flow, to show the shear flow */
function FlowDots({ pts, speed, t, color }: { pts: P[]; speed: number; t: number; color: string }) {
  const seg: { a: P; b: P; l: number; s0: number }[] = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    seg.push({ a: pts[i - 1]!, b: pts[i]!, l, s0: tot });
    tot += l;
  }
  const sp = 26;
  const off = (((t * speed) % sp) + sp) % sp;
  const out: JSX.Element[] = [];
  for (let s = off, k = 0; s < tot; s += sp, k++) {
    const g = seg.find((x) => s >= x.s0 && s <= x.s0 + x.l) ?? seg.at(-1)!;
    const u = (s - g.s0) / g.l;
    const p: P = [g.a[0] + u * (g.b[0] - g.a[0]), g.a[1] + u * (g.b[1] - g.a[1])];
    const d: P = [(g.b[0] - g.a[0]) / g.l, (g.b[1] - g.a[1]) / g.l];
    out.push(<path key={k} d={`M${p[0] + d[0] * 5},${p[1] + d[1] * 5} L${p[0] - d[0] * 4 - d[1] * 4},${p[1] - d[1] * 4 + d[0] * 4} L${p[0] - d[0] * 4 + d[1] * 4},${p[1] - d[1] * 4 - d[0] * 4} Z`} fill={color} />);
  }
  return <g>{out}</g>;
}

export default function ThinWalledPage() {
  const s = useTw();
  const ta = useAnimTime();
  const G = 80e3;
  const tor = thinWalledTorsion(s.b, s.h, s.t, s.Mt * 1e6, G);
  const sh = iBeamShear(s.fb, s.tf, s.wh, s.tw, s.Q * 1e3);
  const e = channelShearCentre(s.fb / 2, s.wh);

  // tube drawings
  const k = 120 / Math.max(s.b, s.h);
  const box = (cx: number, cy: number): P[] => [
    [cx - (s.b * k) / 2, cy - (s.h * k) / 2],
    [cx + (s.b * k) / 2, cy - (s.h * k) / 2],
    [cx + (s.b * k) / 2, cy + (s.h * k) / 2],
    [cx - (s.b * k) / 2, cy + (s.h * k) / 2],
    [cx - (s.b * k) / 2, cy - (s.h * k) / 2],
  ];
  const tw = Math.max(2, s.t * k);
  const ratioTheta = tor.thetaOpen / tor.thetaClosed;
  const ratioTau = tor.tauOpen / tor.tauClosed;
  const thick = Array.from({ length: 60 }, (_, i) => {
    const tt = 0.5 + i * 0.25;
    const r = thinWalledTorsion(s.b, s.h, tt, 1, G);
    return { x: tt, y: r.thetaOpen / r.thetaClosed };
  });

  // I-beam shear stress drawing
  const kk = 200 / Math.max(s.fb, s.wh);
  const IX = (y: number) => 140 + y * kk;
  const IY = (z: number) => 150 + z * kk;
  const tmax = Math.max(sh.tauMaxWeb, sh.flange(s.fb / 2), 1e-9);
  const tk = 70 / tmax;
  const webCurve = Array.from({ length: 41 }, (_, i) => {
    const z = -s.wh / 2 + (s.wh * i) / 40;
    return [IX(s.tw / 2) + sh.web(z) * tk, IY(z)] as P;
  });
  const flangeCurve = (zc: number, dir: 1 | -1) =>
    Array.from({ length: 21 }, (_, i) => {
      const y = -s.fb / 2 + (s.fb * i) / 20;
      const sTip = s.fb / 2 - Math.abs(y);
      return [IX(y), IY(zc) + dir * sh.flange(sTip) * tk] as P;
    });
  const webChart = Array.from({ length: 81 }, (_, i) => {
    const z = -s.wh / 2 + (s.wh * i) / 80;
    return { x: z, y: sh.web(z) };
  });

  // channel
  const cb = s.fb / 2;
  const ck = 160 / Math.max(cb, s.wh);
  const CX = (y: number) => 200 + y * ck;
  const CY = (z: number) => 125 + z * ck;

  return (
    <EeLayout
      aside={
        <>
          <Card title="Thin-walled profiles">
            <Idea>
              {t(
                'In thin walls the shear stress runs along the wall centre line, described by the shear flow q = τ·t. In a closed tube a torque drives a constant q around the circumference (Bredt): τ = M_t/(2·A_m·t). Slit the same tube open and the shear must turn back within the wall thickness — the profile becomes dozens of times softer. A transverse force Q causes shear flow too: q = Q·S/I, largest at the neutral axis. Where the resultant of this shear flow acts is the shear centre — load an open profile there or it twists.',
              )}
            </Idea>
          </Card>
          <Card title="Tube under torsion">
            <div className="space-y-3">
              <ParamSlider label="Width (centre line)" symbol="b" unit="mm" value={s.b} min={20} max={200} step={2} digits={0} onChange={(b) => s.set({ b })} />
              <ParamSlider label="Height (centre line)" symbol="h" unit="mm" value={s.h} min={20} max={200} step={2} digits={0} onChange={(h) => s.set({ h })} />
              <ParamSlider label="Wall thickness" symbol="t" unit="mm" value={s.t} min={0.5} max={15} step={0.5} onChange={(tt) => s.set({ t: tt })} />
              <ParamSlider label="Torque" symbol="M_t" unit="kNm" value={s.Mt} min={0.05} max={10} step={0.05} digits={2} onChange={(Mt) => s.set({ Mt })} />
            </div>
          </Card>
          <Card title="I-beam under transverse force">
            <div className="space-y-3">
              <ParamSlider label="Transverse force" symbol="Q" unit="kN" value={s.Q} min={1} max={300} step={1} digits={0} onChange={(Q) => s.set({ Q })} />
              <ParamSlider label="Flange width" symbol="b" unit="mm" value={s.fb} min={40} max={300} step={5} digits={0} onChange={(fb) => s.set({ fb })} />
              <ParamSlider label="Flange thickness" symbol="t_F" unit="mm" value={s.tf} min={2} max={30} step={1} digits={0} onChange={(tf) => s.set({ tf })} />
              <ParamSlider label="Web height" symbol="h" unit="mm" value={s.wh} min={60} max={600} step={10} digits={0} onChange={(wh) => s.set({ wh })} />
              <ParamSlider label="Web thickness" symbol="t_S" unit="mm" value={s.tw} min={2} max={25} step={1} digits={0} onChange={(tw2) => s.set({ tw: tw2 })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="τ closed (Bredt)" value={nf(tor.tauClosed, 1)} unit="MPa" />
        <Kpi label="τ open (slit)" value={nf(tor.tauOpen, 1)} unit="MPa" sub={`× ${nf(ratioTau, 1)}`} />
        <Kpi label="Twist rate closed / open" value={`${nf((tor.thetaClosed * 1e3 * 180) / Math.PI, 3)} / ${nf((tor.thetaOpen * 1e3 * 180) / Math.PI, 2)}`} unit="°/m" sub={`${t('open is')} × ${nf(ratioTheta, 0)} ${t('softer')}`} />
        <Kpi label="τ_max in the web" value={nf(sh.tauMaxWeb, 1)} unit="MPa" sub={`${t('mean')} Q/(h·t_S) = ${nf(sh.tauMean, 1)} MPa`} />
        <Kpi label="Shear centre of a U" value={nf(e, 1)} unit="mm" sub={t('outside the web')} />
      </div>
      <Card title="Closed vs. slit tube">
        <svg viewBox="0 0 600 220" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Closed and slit tube')}>
          <polyline points={box(150, 105).map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.body} strokeWidth={tw} strokeLinejoin="miter" />
          <FlowDots pts={box(150, 105)} speed={Math.min(80, 8 + tor.q / 50)} t={ta} color={TM.aux} />
          {(() => {
            const pts = box(450, 105);
            // slit at the middle of the top wall: open the path there
            const open: P[] = [[450 + 6, pts[0]![1]], pts[1]!, pts[2]!, pts[3]!, pts[4]!, [450 - 6, pts[0]![1]]];
            return (
              <>
                <polyline points={open.map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.body} strokeWidth={tw} strokeLinejoin="miter" />
                {/* in an open wall the shear runs forward on one face, back on the other */}
                <FlowDots pts={open.map(([x, y]) => [x, y - Math.max(2, tw / 3)])} speed={16} t={ta} color={TM.load} />
                <FlowDots pts={open.slice().reverse().map(([x, y]) => [x, y + Math.max(2, tw / 3)])} speed={16} t={ta} color={TM.v} />
              </>
            );
          })()}
          <Label x={150} y={210} color={TM.muted}>{`${t('closed')}: q = M_t/(2A_m) = ${nf(tor.q, 1)} N/mm`}</Label>
          <Label x={450} y={210} color={TM.muted}>{`${t('slit')}: I_T = Σ s t³/3 = ${nf(tor.ItOpen, 0)} mm⁴`}</Label>
        </svg>
        <Caption>{t('Left: the shear flow circulates around the closed cell with a large lever arm. Right: after the slit it can only flow forward on one face and back on the other — lever arm ≈ wall thickness.')}</Caption>
      </Card>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="How much softer is the open profile?">
          <LineChartBox height={230} logY series={[{ name: 'ϑ′_open / ϑ′_closed', data: thick, color: TM.load }]} xLabel="t [mm]" yLabel="" refX={[{ x: s.t, label: 't' }]} digits={0} />
          <Caption>{t('The ratio grows like (A_m/(s·t))²: the thinner the wall, the more the closed cell pays off.')}</Caption>
        </Card>
        <Card title="Shear stress in the I-beam">
          <svg viewBox="0 0 320 290" className="mx-auto h-auto w-full max-w-[380px]" role="img" aria-label={t('Shear stress in an I-beam')}>
            <rect x={IX(-s.fb / 2)} y={IY(-s.wh / 2) - (s.tf * kk) / 2} width={s.fb * kk} height={Math.max(2, s.tf * kk)} fill={TM.fill} stroke={TM.body} />
            <rect x={IX(-s.fb / 2)} y={IY(s.wh / 2) - (s.tf * kk) / 2} width={s.fb * kk} height={Math.max(2, s.tf * kk)} fill={TM.fill} stroke={TM.body} />
            <rect x={IX(-s.tw / 2)} y={IY(-s.wh / 2)} width={Math.max(2, s.tw * kk)} height={s.wh * kk} fill={TM.fill} stroke={TM.body} />
            <polygon points={[[IX(s.tw / 2), IY(-s.wh / 2)], ...webCurve, [IX(s.tw / 2), IY(s.wh / 2)]].map((p) => p.join(',')).join(' ')} fill={TM.aux} fillOpacity={0.3} stroke={TM.aux} />
            <polyline points={flangeCurve(-s.wh / 2, -1).map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.aux} />
            <polyline points={flangeCurve(s.wh / 2, 1).map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.aux} />
            <Arrow a={[IX(0), IY(-s.wh / 2) - 42]} b={[IX(0), IY(-s.wh / 2) - 10]} color={TM.load} label="Q" labelOffset={[8, -16]} />
            <Label x={IX(s.tw / 2) + sh.tauMaxWeb * tk + 6} y={IY(0) + 4} anchor="start" color={TM.aux}>{`τ_max = ${nf(sh.tauMaxWeb, 1)}`}</Label>
          </svg>
          <LineChartBox height={170} series={[{ name: 'τ(z) [MPa]', data: webChart, color: TM.aux }]} xLabel="z [mm]" yLabel="τ [MPa]" digits={0} />
          <Caption>{t('The web carries almost all of Q: τ is a parabola with its maximum at the neutral axis. In the flanges it grows linearly from the free edges.')}</Caption>
        </Card>
      </div>
      <Card title="Shear centre of a channel (U)">
        <svg viewBox="0 0 520 250" className="mx-auto h-auto w-full max-w-[620px]" role="img" aria-label={t('Shear centre of a channel')}>
          <polyline points={[[CX(cb), CY(-s.wh / 2)], [CX(0), CY(-s.wh / 2)], [CX(0), CY(s.wh / 2)], [CX(cb), CY(s.wh / 2)]].map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.body} strokeWidth={6} />
          <FlowDots
            pts={[
              [CX(cb), CY(-s.wh / 2)],
              [CX(0), CY(-s.wh / 2)],
              [CX(0), CY(s.wh / 2)],
              [CX(cb), CY(s.wh / 2)],
            ]}
            speed={20}
            t={ta}
            color={TM.aux}
          />
          <line x1={CX(-e)} y1={CY(-s.wh / 2) - 30} x2={CX(-e)} y2={CY(s.wh / 2) + 20} stroke={TM.reaction} strokeDasharray="6 4" />
          <circle cx={CX(-e)} cy={CY(0)} r={5} fill={TM.reaction} />
          <Label x={CX(-e) - 8} y={CY(0) - 8} anchor="end" color={TM.reaction}>
            M
          </Label>
          <Arrow a={[CX(-e), CY(-s.wh / 2) - 60]} b={[CX(-e), CY(-s.wh / 2) - 30]} color={TM.load} label="Q" />
          <circle cx={CX((cb * cb) / (2 * cb + s.wh))} cy={CY(0)} r={4} fill={TM.muted} />
          <Label x={CX((cb * cb) / (2 * cb + s.wh)) + 8} y={CY(0) + 4} anchor="start" color={TM.muted}>
            S
          </Label>
          <Label x={(CX(-e) + CX(0)) / 2} y={CY(s.wh / 2) + 38} color={TM.reaction}>{`e = ${nf(e, 1)} mm`}</Label>
        </svg>
        <Caption>{t('The shear flows in the flanges form a couple that tries to twist the profile. Only if Q acts through the shear centre M (outside the web, not at the centroid S) does the channel bend without twisting.')}</Caption>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`A_m = b\\,h = ${nf(tor.Am, 0)}\\,\\mathrm{mm^2},\\quad \\tau = \\frac{M_t}{2A_m t} = ${nf(tor.tauClosed, 2)}\\,\\mathrm{MPa}`} />
          <Tex block math={`I_{T,closed} = \\frac{4A_m^2}{\\oint \\mathrm ds/t} = ${nf(tor.ItClosed / 1e4, 1)}\\,\\mathrm{cm^4}`} />
          <Tex block math={`I_{T,open} = \\tfrac13 \\textstyle\\sum s\\,t^3 = ${nf(tor.ItOpen / 1e4, 3)}\\,\\mathrm{cm^4},\\quad \\tau = \\frac{M_t}{I_T}\\,t = ${nf(tor.tauOpen, 1)}\\,\\mathrm{MPa}`} />
          <Tex block math={`I_y \\approx \\frac{t_S h^3}{12} + 2\\,b\\,t_F\\left(\\frac h2\\right)^2 = ${nf(sh.Iy / 1e4, 0)}\\,\\mathrm{cm^4}`} />
          <Tex block math={`\\tau(z) = \\frac{Q\\,S_y(z)}{I_y\\,t_S},\\quad \\tau_{max} = \\frac{Q\\,(b t_F \\tfrac h2 + t_S \\tfrac{h^2}{8})}{I_y\\,t_S} = ${nf(sh.tauMaxWeb, 2)}\\,\\mathrm{MPa}`} />
          <Tex block math={`e_M = \\frac{3 b^2}{h + 6b} = ${nf(e, 2)}\\,\\mathrm{mm}\\ \\ (U, b = ${nf(cb, 0)}\\,\\mathrm{mm})`} />
        </div>
      </Card>
    </EeLayout>
  );
}
