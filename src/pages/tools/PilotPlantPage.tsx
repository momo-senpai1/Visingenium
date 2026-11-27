import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, NumRow } from '@/components/mechanics/common';
import { PilotSchematic } from '@/components/pilot/PilotSchematic';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { DEFAULT_PLANT, ratePlant, rateLoop, simc, type PlantSpec } from '@/engine/pilotPlant';
import { yFromAlpha } from '@/engine/thermodynamics';
import { t } from '@/i18n';
import { navigate, type Route } from '@/lib/route';

type View = 'process' | 'thermo' | 'electric' | 'control';

/** number as TeX (decimal comma stays tight) */
const N = (v: number, d = 2) => nf(v, d).replace(',', '{,}');
const clamp = (v: number, lim = 8) => Math.max(-lim, Math.min(lim, v));

function Links({ items }: { items: { route: Route; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-plant-400">
      <span>{t('Learn the background:')}</span>
      {items.map((i) => (
        <button key={i.route} type="button" onClick={() => navigate(i.route)} className="rounded-full border border-white/[0.1] px-2.5 py-0.5 text-plant-200 hover:border-white/[0.3] hover:text-plant-100">
          {t(i.label)}
        </button>
      ))}
    </div>
  );
}

function Bar({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  return (
    <div className="grid grid-cols-[170px_minmax(0,1fr)_90px] items-center gap-2 text-[11px] text-plant-300">
      <span className="truncate">{label}</span>
      <span className="h-2.5 rounded-full bg-white/[0.05]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(1, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </span>
      <span className="text-right font-mono">
        {nf(value, value < 10 ? 2 : 1)} {unit}
      </span>
    </div>
  );
}

export default function PilotPlantPage() {
  const [spec, setSpec] = useState<PlantSpec>(DEFAULT_PLANT);
  const [view, setView] = useState<View>('process');
  const [tuning, setTuning] = useState<'simc' | 'manual'>('simc');
  const [KcM, setKcM] = useState(10);
  const [TiM, setTiM] = useState(4);
  const set = <K extends keyof PlantSpec>(k: K, v: PlantSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));

  const calc = useMemo(() => {
    try {
      return { r: ratePlant(spec), err: '' };
    } catch (e) {
      return { r: null, err: e instanceof Error ? e.message : String(e) };
    }
  }, [spec]);
  const r = calc.r;

  const loop = useMemo(() => {
    if (!r || !r.control.K) return null;
    const { K, tau, theta } = r.control;
    const auto = simc(K, tau, theta);
    const Kc = tuning === 'simc' ? auto.Kc : KcM * Math.sign(K);
    const Ti = tuning === 'simc' ? auto.Ti : TiM;
    try {
      return { auto, ...rateLoop(K, tau, theta, Kc, Ti) };
    } catch {
      return null;
    }
  }, [r, tuning, KcM, TiM]);

  const pos = (min: number, max?: number) => (v: number) => v > min && (max === undefined || v <= max);

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Feed">
          <div className="space-y-2">
            <NumRow label={t('Feed flow F')} unit="kmol/h" value={spec.F} onChange={(v) => pos(0)(v) && set('F', v)} />
            <NumRow label={t('Benzene fraction z_F')} value={spec.zF} onChange={(v) => v > 0 && v < 1 && set('zF', v)} />
            <NumRow label={t('Feed condition q')} value={spec.q} onChange={(v) => v >= 0 && v <= 1.5 && set('q', v)} />
          </div>
        </Card>
        <Card title="Column">
          <div className="space-y-2">
            <NumRow label={t('Equilibrium stages N')} value={spec.N} onChange={(v) => v >= 3 && v <= 60 && set('N', Math.round(v))} />
            <NumRow label={t('Reflux ratio R = L/D')} value={spec.R} onChange={(v) => pos(0.05)(v) && set('R', v)} />
            <NumRow label={t('Distillate ratio D/F')} value={spec.DF} onChange={(v) => v > 0 && v < 1 && set('DF', v)} />
            <NumRow label={t('Pressure')} unit="kPa" value={spec.P} onChange={(v) => v >= 20 && v <= 500 && set('P', v)} />
            <NumRow label={t('Controlled stage (TT)')} value={spec.sensor} onChange={(v) => v >= 1 && v <= spec.N && set('sensor', Math.round(v))} />
            <NumRow label={t('Hold-up per stage')} unit="kmol" value={spec.holdup} onChange={(v) => pos(0)(v) && set('holdup', v)} />
          </div>
        </Card>
        <Card title="Utilities">
          <div className="space-y-2">
            <Segmented
              value={spec.heating}
              onChange={(v) => set('heating', v)}
              options={[
                { value: 'electric', label: 'Electric' },
                { value: 'steam', label: 'Steam' },
              ]}
            />
            {spec.heating === 'electric' ? (
              <NumRow label={t('Heater efficiency')} value={spec.etaHeater} onChange={(v) => v > 0 && v <= 1 && set('etaHeater', v)} />
            ) : (
              <NumRow label={t('Steam pressure')} unit="bar" value={spec.steamBar} onChange={(v) => v >= 1 && v <= 40 && set('steamBar', v)} />
            )}
            <NumRow label={t('Cooling water rise')} unit="K" value={spec.dTcw} onChange={(v) => v >= 2 && v <= 40 && set('dTcw', v)} />
          </div>
        </Card>
        <Card title="Electrical supply">
          <div className="space-y-2">
            <NumRow label={t('Line voltage U')} unit="V" value={spec.U} onChange={(v) => pos(50)(v) && set('U', v)} />
            <NumRow label={t('Motor power factor')} value={spec.cosPhiMotor} onChange={(v) => v > 0.3 && v <= 1 && set('cosPhiMotor', v)} />
            <NumRow label={t('Motor efficiency')} value={spec.etaMotor} onChange={(v) => v > 0.3 && v <= 1 && set('etaMotor', v)} />
            <NumRow label={t('Pump efficiency')} value={spec.etaPump} onChange={(v) => v > 0.1 && v <= 1 && set('etaPump', v)} />
            <NumRow label={t('Pump head')} unit="m" value={spec.head} onChange={(v) => pos(0)(v) && set('head', v)} />
            <NumRow label={t('Other motor loads')} unit="kW" value={spec.aux} onChange={(v) => v >= 0 && set('aux', v)} />
            <NumRow label={t('Electricity price')} unit="€/kWh" value={spec.priceEl} onChange={(v) => v >= 0 && set('priceEl', v)} />
            {spec.heating === 'steam' && <NumRow label={t('Steam price')} unit="€/t" value={spec.priceSteam} onChange={(v) => v >= 0 && set('priceSteam', v)} />}
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-2">
        {calc.err && <Notice tone="error">{t(calc.err)}</Notice>}
        {r && (
          <>
            <Card title="Pilot plant: benzene / toluene rectification">
              <PilotSchematic r={r} spec={spec} />
              <p className="mt-1 text-[10px] text-plant-500">
                {t('One plant, four views: every change in the sidebar flows through process, thermodynamics, electrics and control. Constant molar overflow, ideal mixture, steady state.')}
              </p>
            </Card>

            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'process', label: 'Process' },
                { value: 'thermo', label: 'Thermodynamics' },
                { value: 'electric', label: 'Electrics' },
                { value: 'control', label: 'Control' },
              ]}
            />

            {view === 'process' && <ProcessView r={r} spec={spec} />}
            {view === 'thermo' && <ThermoView r={r} spec={spec} />}
            {view === 'electric' && <ElectricView r={r} spec={spec} />}
            {view === 'control' && (
              <ControlView r={r} spec={spec} loop={loop} tuning={tuning} setTuning={setTuning} KcM={KcM} setKcM={setKcM} TiM={TiM} setTiM={setTiM} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

type R = NonNullable<ReturnType<typeof ratePlant>>;

function ProcessView({ r, spec }: { r: R; spec: PlantSpec }) {
  const c = r.col;
  const eq = Array.from({ length: 51 }, (_, i) => ({ x: i / 50, y: yFromAlpha(r.alpha, i / 50) }));
  const stair = [{ x: c.xD, y: c.xD }];
  c.steps.forEach((s, i) => {
    stair.push({ x: s.x, y: s.y });
    const nx = c.steps[i + 1];
    stair.push({ x: s.x, y: nx ? nx.y : s.x });
  });
  const prof = r.tray.map((T, i) => ({ x: i + 1, y: T }));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Kpi label="x_D" value={nf(c.xD, 4)} sub={t('distillate')} />
        <Kpi label="x_B" value={nf(c.xB, 4)} sub={t('bottoms')} />
        <Kpi label="D / B" value={`${nf(c.D, 2)} / ${nf(c.B, 2)}`} unit="kmol/h" />
        <Kpi label="R / R_min" value={`${nf(spec.R, 2)} / ${nf(c.Rmin, 2)}`} sub={`${nf(spec.R / c.Rmin, 2)}×`} />
        <Kpi label="N / N_min" value={`${spec.N} / ${nf(c.Nmin, 1)}`} sub={`α = ${nf(r.alpha, 2)}`} />
        <Kpi label={t('Feed stage')} value={String(c.feedStage)} sub={`V = ${nf(c.V, 1)} · V′ = ${nf(c.Vp, 1)}`} />
      </div>
      {spec.R < c.Rmin * 1.05 && <Notice tone="warning">{t('The reflux ratio is close to the minimum: the column needs very many stages for this split.')}</Notice>}
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="McCabe–Thiele diagram">
          <LineChartBox
            series={[
              { name: t('equilibrium'), data: eq },
              { name: 'y = x', data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], dashed: true },
              { name: t('rectifying line'), data: [{ x: c.xD, y: c.xD }, { x: c.intersection.x, y: c.intersection.y }] },
              { name: t('stripping line'), data: [{ x: c.intersection.x, y: c.intersection.y }, { x: c.xB, y: c.xB }] },
              { name: t('stages'), data: stair },
            ]}
            xLabel="x"
            yLabel="y"
            xDomain={[0, 1]}
            yDomain={[0, 1]}
            digits={3}
          />
        </Card>
        <Card title="Temperature profile along the column">
          <LineChartBox
            series={[{ name: 'T [°C]', data: prof }]}
            xLabel={t('stage (1 = top, reboiler last)')}
            yLabel="T [°C]"
            xDomain={[1, spec.N]}
            refX={[
              { x: c.feedStage, label: t('feed') },
              { x: Math.min(Math.max(Math.round(spec.sensor), 1), spec.N), label: 'TT' },
            ]}
            digits={1}
          />
          <p className="text-[10px] text-plant-500">{t('The steepest part of the profile is where a temperature sensor reacts most strongly: the best place for the controlled stage.')}</p>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <div>
            <Tex block math={`F = D + B \\qquad F z_F = D x_D + B x_B`} />
            <Tex block math={`D = ${N(spec.DF)}\\cdot ${N(spec.F, 2)} = ${N(c.D)}\\ \\mathrm{kmol/h}\\quad x_D = ${N(c.xD, 4)}\\quad x_B = ${N(c.xB, 4)}`} />
            <Tex block math={`L = R D = ${N(c.L)}\\quad V = (R+1)D = ${N(c.V)}\\quad V' = V-(1-q)F = ${N(c.Vp)}\\ \\mathrm{kmol/h}`} />
          </div>
          <div>
            <Tex block math={`y = \\frac{R}{R+1}\\,x + \\frac{x_D}{R+1} = ${N(c.rectifying.slope, 3)}\\,x + ${N(c.rectifying.intercept, 3)}`} />
            <Tex block math={`y = \\frac{L'}{V'}\\,x - \\frac{B x_B}{V'} = ${N(c.stripping.slope, 3)}\\,x ${c.stripping.intercept < 0 ? '-' : '+'} ${N(Math.abs(c.stripping.intercept), 4)}`} />
            <Tex block math={`y^* = \\frac{\\alpha x}{1+(\\alpha-1)x}\\ ,\\quad \\alpha = ${N(r.alpha, 3)}`} />
          </div>
        </div>
      </Card>
      <Links
        items={[
          { route: 'mccabe-thiele', label: 'McCabe–Thiele' },
          { route: 'flowsheet', label: 'Flowsheet' },
        ]}
      />
    </div>
  );
}

function ThermoView({ r, spec }: { r: R; spec: PlantSpec }) {
  const th = r.thermo;
  const top = Math.max(th.Qreb, th.Qcond);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Kpi label="Q̇_reb" value={nf(th.Qreb, 1)} unit="kW" sub={`${nf(r.Tbot, 1)} °C`} />
        <Kpi label="Q̇_cond" value={nf(th.Qcond, 1)} unit="kW" sub={`${nf(r.Ttop, 1)} °C`} />
        {spec.heating === 'steam' ? <Kpi label={t('Steam')} value={nf(th.steamKgH, 0)} unit="kg/h" sub={`${nf(spec.steamBar, 1)} bar · ${nf(th.steamT, 0)} °C`} /> : <Kpi label={t('Heater power')} value={nf(r.elec.Pheat, 1)} unit="kW" sub={`η = ${nf(spec.etaHeater, 2)}`} />}
        <Kpi label={t('Cooling water')} value={nf(th.cwM3h, 2)} unit="m³/h" sub={`ΔT = ${nf(spec.dTcw, 0)} K`} />
        <Kpi label="Ẇ_min" value={nf(th.Wmin, 2)} unit="kW" sub={t('ideal separation work')} />
        <Kpi label="η_II" value={`${nf(th.etaII * 100, 1)} %`} sub={t('second-law efficiency')} />
      </div>
      {spec.heating === 'steam' && !th.steamOk && <Notice tone="warning">{t('The steam is not hot enough: it must be at least 10 K above the reboiler temperature. Raise the steam pressure.')}</Notice>}
      <Card title="Energy and exergy">
        <div className="space-y-2">
          <Bar label={t('Reboiler heat in')} value={th.Qreb} max={top} color="#f87171" unit="kW" />
          <Bar label={t('Condenser heat out')} value={th.Qcond} max={top} color="#38bdf8" unit="kW" />
          <Bar label={t('Exergy of the reboiler heat')} value={th.exergyIn} max={top} color="#f59e0b" unit="kW" />
          <Bar label={t('Minimum separation work')} value={th.Wmin} max={top} color="#34d399" unit="kW" />
        </div>
        <p className="mt-2 text-[10px] text-plant-500">
          {t('Almost all of the reboiler heat leaves again in the condenser at a lower temperature; only a small part of its exergy is needed for the separation itself. That is why distillation is energy-hungry and why heat integration pays.')}
        </p>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <div>
            <Tex block math={`\\dot Q_{reb} = \\dot V'\\,\\Delta h_v = ${N((r.col.Vp * 1000) / 3600, 3)}\\,\\mathrm{mol/s}\\cdot ${N(th.dHbot, 2)}\\,\\mathrm{kJ/mol} = ${N(th.Qreb, 1)}\\ \\mathrm{kW}`} />
            <Tex block math={`\\dot Q_{cond} = \\dot V\\,\\Delta h_v = ${N((r.col.V * 1000) / 3600, 3)}\\,\\mathrm{mol/s}\\cdot ${N(th.dHtop, 2)}\\,\\mathrm{kJ/mol} = ${N(th.Qcond, 1)}\\ \\mathrm{kW}`} />
            {spec.heating === 'steam' ? (
              <Tex block math={`\\dot m_{steam} = \\frac{\\dot Q_{reb}}{h_{fg}} = \\frac{${N(th.Qreb, 1)}\\,\\mathrm{kW}}{${N(th.hfg, 0)}\\,\\mathrm{kJ/kg}} = ${N(th.steamKgH, 0)}\\ \\mathrm{kg/h}`} />
            ) : (
              <Tex block math={`P_{el} = \\frac{\\dot Q_{reb}}{\\eta_H} = \\frac{${N(th.Qreb, 1)}}{${N(spec.etaHeater, 2)}} = ${N(r.elec.Pheat, 1)}\\ \\mathrm{kW}`} />
            )}
            <Tex block math={`\\dot m_{cw} = \\frac{\\dot Q_{cond}}{c_p\\,\\Delta T} = \\frac{${N(th.Qcond, 1)}}{4{,}18\\cdot ${N(spec.dTcw, 0)}}\\cdot 3600 = ${N(th.cwM3h * 1000, 0)}\\ \\mathrm{kg/h}`} />
          </div>
          <div>
            <Tex block math={`\\dot W_{min} = R T_0\\,\\bigl[D\\textstyle\\sum x_D\\ln x_D + B\\sum x_B\\ln x_B - F\\sum z\\ln z\\bigr] = ${N(th.Wmin, 2)}\\ \\mathrm{kW}`} />
            <Tex block math={`\\dot E_x = \\dot Q_{reb}\\left(1-\\frac{T_0}{T_{reb}}\\right) = ${N(th.Qreb, 1)}\\left(1-\\frac{298{,}15}{${N(r.Tbot + 273.15, 1)}}\\right) = ${N(th.exergyIn, 1)}\\ \\mathrm{kW}`} />
            <Tex block math={`\\eta_{II} = \\frac{\\dot W_{min}}{\\dot E_x} = ${N(th.etaII * 100, 1)}\\ \\%`} />
            <Tex block math={`\\dot Q / \\dot D = ${N(th.kWhPerKg, 3)}\\ \\mathrm{kWh/kg}`} />
          </div>
        </div>
      </Card>
      <Links
        items={[
          { route: 'cycles', label: 'Cycles (T,s / p,v)' },
          { route: 'mixtures', label: 'Mixtures' },
          { route: 'exchanger', label: 'Heat exchanger' },
        ]}
      />
    </div>
  );
}

function ElectricView({ r, spec }: { r: R; spec: PlantSpec }) {
  const e = r.elec;
  const I = (P: number, cos: number) => (P * 1000) / (Math.sqrt(3) * spec.U * cos);
  const rows: { name: string; P: number; cos: number }[] = [
    ...(spec.heating === 'electric' ? [{ name: t('Reboiler heater'), P: e.Pheat, cos: 1 }] : []),
    { name: t('Feed pump motor'), P: e.feedPump.Pel, cos: spec.cosPhiMotor },
    { name: t('Reflux pump motor'), P: e.refluxPump.Pel, cos: spec.cosPhiMotor },
    { name: t('Other motors'), P: e.Paux, cos: spec.cosPhiMotor },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Kpi label="P" value={nf(e.P, 2)} unit="kW" sub={t('active power')} />
        <Kpi label="Q" value={nf(e.Q, 2)} unit="kvar" sub={t('reactive power')} />
        <Kpi label="S" value={nf(e.S, 2)} unit="kVA" sub={t('apparent power')} />
        <Kpi label="cos φ" value={nf(e.cosPhi, 3)} />
        <Kpi label={t('Line current I')} value={nf(e.I, 1)} unit="A" sub={`${nf(spec.U, 0)} V · 3~`} />
        <Kpi label={t('Energy cost')} value={nf(e.costPerH, 2)} unit="€/h" sub={`${nf(r.thermo.kWhPerKg, 2)} kWh/kg`} />
      </div>
      <Card title="Electrical loads">
        <div className="space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_60px_80px] gap-2 font-mono text-[10px] uppercase tracking-wider text-plant-500">
            <span>{t('Load')}</span>
            <span className="text-right">P [kW]</span>
            <span className="text-right">cos φ</span>
            <span className="text-right">I [A]</span>
          </div>
          {rows.map((x) => (
            <div key={x.name} className="grid grid-cols-[minmax(0,1fr)_80px_60px_80px] gap-2 border-t border-white/[0.05] pt-1.5 font-mono text-[11px] text-plant-200">
              <span className="truncate font-sans">{x.name}</span>
              <span className="text-right">{nf(x.P, 3)}</span>
              <span className="text-right">{nf(x.cos, 2)}</span>
              <span className="text-right">{nf(I(x.P, x.cos), 1)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-plant-500">
          {spec.heating === 'electric'
            ? t('The resistive heater dominates the load and has cos φ = 1: the line current is set by the reboiler duty, i.e. by the separation task. The currents of the single loads add up as phasors, not arithmetically.')
            : t('With steam heating only motors remain: their lagging reactive current lowers cos φ, and a compensation capacitor can lower the line current.')}
        </p>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <div>
            <Tex block math={`P_{pump} = \\frac{\\rho\\, g\\, H\\, \\dot V}{\\eta_P\\,\\eta_M} = \\frac{${N(e.feedPump.rho, 0)}\\cdot 9{,}81\\cdot ${N(spec.head, 0)}\\cdot ${N(e.feedPump.Vdot / 3600, 6)}}{${N(spec.etaPump, 2)}\\cdot ${N(spec.etaMotor, 2)}} = ${N(e.feedPump.Pel * 1000, 0)}\\ \\mathrm{W}`} />
            <Tex block math={`Q = P_{mot}\\tan\\varphi = ${N(e.Ppumps, 2)}\\cdot ${N(Math.tan(Math.acos(spec.cosPhiMotor)), 3)} = ${N(e.Q, 2)}\\ \\mathrm{kvar}`} />
            <Tex block math={`S = \\sqrt{P^2+Q^2} = ${N(e.S, 2)}\\ \\mathrm{kVA}\\qquad \\cos\\varphi = \\frac{P}{S} = ${N(e.cosPhi, 3)}`} />
          </div>
          <div>
            <Tex block math={`I = \\frac{S}{\\sqrt{3}\\,U} = \\frac{${N(e.S * 1000, 0)}\\ \\mathrm{VA}}{\\sqrt{3}\\cdot ${N(spec.U, 0)}\\ \\mathrm{V}} = ${N(e.I, 1)}\\ \\mathrm{A}`} />
            {e.Qc > 0.01 ? (
              <Tex block math={`Q_C = Q - P\\tan\\varphi_{0.95} = ${N(e.Qc, 2)}\\ \\mathrm{kvar}\\quad C_\\Delta = \\frac{Q_C}{3\\,\\omega\\,U^2} = ${N(e.Cdelta * 1e6, 1)}\\ \\mu\\mathrm{F}`} />
            ) : (
              <p className="px-1 text-[12px] text-plant-300">{t('cos φ ≥ 0.95: no compensation needed.')}</p>
            )}
            <Tex block math={`\\text{${t('cost')}} = P\\cdot c_{el} = ${N(e.P, 2)}\\cdot ${N(spec.priceEl, 2)} = ${N(e.P * spec.priceEl, 2)}\\ \\text{€/h}`} />
          </div>
        </div>
      </Card>
      <Links
        items={[
          { route: 'ee-3phase', label: 'Three-phase' },
          { route: 'ee-power', label: 'AC power' },
          { route: 'ee-motor', label: 'Induction motor' },
        ]}
      />
    </div>
  );
}

function ControlView({
  r,
  spec,
  loop,
  tuning,
  setTuning,
  KcM,
  setKcM,
  TiM,
  setTiM,
}: {
  r: R;
  spec: PlantSpec;
  loop: (ReturnType<typeof rateLoop> & { auto: { Kc: number; Ti: number } }) | null;
  tuning: 'simc' | 'manual';
  setTuning: (v: 'simc' | 'manual') => void;
  KcM: number;
  setKcM: (v: number) => void;
  TiM: number;
  setTiM: (v: number) => void;
}) {
  const { K, tau, theta } = r.control;
  if (!loop) return <Notice tone="warning">{t('The process gain could not be determined for this operating point.')}</Notice>;
  const m = loop.margins;
  const unstable = (m.pm !== null && m.pm <= 0) || loop.y.some((v) => !Number.isFinite(v) || Math.abs(v) > 50);
  const closed = loop.t.map((x, i) => ({ x, y: clamp(loop.y[i] ?? 0) }));
  const open = loop.t.map((x, i) => ({ x, y: clamp((loop.open[i] ?? 0) / K) }));
  const sp = loop.t.map((x) => ({ x, y: 1 }));
  const u = loop.t.map((x, i) => ({ x, y: Math.max(-200, Math.min(200, (loop.u[i] ?? 0) * 1)) }));
  const dQ = 1 / K;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card title="Controller">
          <div className="space-y-2">
            <Segmented
              value={tuning}
              onChange={setTuning}
              options={[
                { value: 'simc', label: 'SIMC (auto)' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            {tuning === 'manual' && (
              <>
                <NumRow label={t('Gain K_c')} unit="kW/K" value={KcM} onChange={(v) => v > 0 && setKcM(v)} />
                <NumRow label={t('Reset time T_i')} unit="min" value={TiM} onChange={(v) => v > 0 && setTiM(v)} />
              </>
            )}
            <p className="font-mono text-[11px] text-plant-300">
              K_c = {nf(Math.abs(loop.Kc), 2)} kW/K · T_i = {nf(loop.Ti, 2)} min
            </p>
            <p className="text-[10px] text-plant-500">
              {t('The controller output is the heater / steam duty in kW. The loop is a PI controller on the temperature of the controlled stage.')}
            </p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={t('Process gain K')} value={nf(K, 3)} unit="K/kW" sub={K < 0 ? t('reverse acting') : t('direct acting')} />
          <Kpi label="τ" value={nf(tau, 2)} unit="min" sub={t('lag from hold-up')} />
          <Kpi label="θ" value={nf(theta, 2)} unit="min" sub={t('dead time')} />
          <Kpi label={t('Phase margin')} value={m.pm === null ? '—' : `${nf(m.pm, 0)}°`} sub={m.gm === null ? undefined : `${t('gain margin')} ${nf(m.gm, 1)} dB`} />
          <Kpi label={t('Overshoot')} value={loop.info ? `${nf(loop.info.overshoot, 1)} %` : '—'} />
          <Kpi label={t('Rise time')} value={loop.info?.rise != null ? nf(loop.info.rise, 2) : '—'} unit="min" />
          <Kpi label={t('Settling time (2 %)')} value={loop.info ? nf(loop.info.settling, 2) : '—'} unit="min" />
          <Kpi label={t('Duty step for 1 K')} value={nf(dQ, 2)} unit="kW" sub={r.elec.Pheat > 0 ? `ΔI ≈ ${nf((dQ * 1000) / (Math.sqrt(3) * 400), 1)} A` : undefined} />
        </div>
      </div>
      {unstable && <Notice tone="error">{t('The closed loop is unstable or badly damped with these settings: reduce K_c or increase T_i.')}</Notice>}
      <Notice tone="info">
        {t('Estimate: gain from the steady-state column model (1 % reflux step), lag from hold-up and liquid flow, dead time as 12 % of the lag. A real plant must be identified from a step test.')}
      </Notice>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="Setpoint step 1 K">
          <LineChartBox
            series={[
              { name: t('setpoint'), data: sp, dashed: true },
              { name: t('closed loop'), data: closed },
              { name: t('open loop (duty step 1/K)'), data: open },
            ]}
            xLabel="t [min]"
            yLabel="ΔT [K]"
            digits={2}
          />
        </Card>
        <Card title="Controller output (duty)">
          <LineChartBox series={[{ name: 'ΔQ [kW]', data: u }]} xLabel="t [min]" yLabel="ΔQ [kW]" digits={2} />
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <div>
            <Tex block math={`G(s) = \\frac{K}{\\tau s + 1}\\,e^{-\\theta s} = \\frac{${N(K, 3)}}{${N(tau, 2)}\\,s + 1}\\,e^{-${N(theta, 2)}\\,s}`} />
            <Tex block math={`\\tau = \\frac{n\\,H}{L'} = \\frac{${spec.N - Math.round(spec.sensor) + 1}\\cdot ${N(spec.holdup, 2)}\\ \\mathrm{kmol}}{${N(r.col.Lp, 2)}\\ \\mathrm{kmol/h}} = ${N(tau, 2)}\\ \\mathrm{min}`} />
            <Tex block math={`K = \\frac{\\Delta T_{TT}}{\\Delta \\dot Q_{reb}}\\ (\\text{${t('1 % reflux step')}})\\qquad \\theta = ${N(theta, 2)}\\ \\mathrm{min}`} />
          </div>
          <div>
            <Tex block math={`C(s) = K_c\\left(1 + \\frac{1}{T_i s}\\right) = ${N(Math.abs(loop.Kc), 2)}\\left(1+\\frac{1}{${N(loop.Ti, 2)}\\,s}\\right)`} />
            <Tex block math={`K_c = \\frac{\\tau}{K(\\tau_c+\\theta)}\\ ,\\ T_i = \\min\\bigl(\\tau,\\,4(\\tau_c+\\theta)\\bigr)\\ ,\\ \\tau_c = \\theta`} />
          </div>
        </div>
      </Card>
      <Links
        items={[
          { route: 'control', label: 'Control loop' },
          { route: 'bode', label: 'Bode diagram' },
          { route: 'control-sim', label: 'Simulator' },
        ]}
      />
    </div>
  );
}
