import { nf } from '@/components/mechanics/common';
import type { PlantResult, PlantSpec } from '@/engine/pilotPlant';
import { t } from '@/i18n';

const W = 860;
const H = 436;
const COL = { x0: 340, x1: 430, y0: 84, y1: 332 };
const stageY = (stage: number, n: number) => COL.y0 + ((stage - 0.5) / n) * (COL.y1 - COL.y0);

const INK = 'rgb(148 163 184)';
const HOT = '#f87171';
const COLD = '#38bdf8';
const ELEC = '#fbbf24';
const CTRL = '#a78bfa';

function Arrow({ x1, y1, x2, y2, color = INK }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 7;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * h * 0.6} y2={y2 - Math.sin(a) * h * 0.6} stroke={color} strokeWidth={1.6} />
      <polygon points={`${x2},${y2} ${x2 - h * Math.cos(a - 0.4)},${y2 - h * Math.sin(a - 0.4)} ${x2 - h * Math.cos(a + 0.4)},${y2 - h * Math.sin(a + 0.4)}`} fill={color} />
    </g>
  );
}

/** label set by KaTeX: symbols like x_D, Q_c, T_W become real subscripts (HTML inside the SVG) */
function Txt({ x, y, children, color = INK, anchor = 'start', bold = false }: { x: number; y: number; children: string; color?: string; anchor?: 'start' | 'middle' | 'end'; bold?: boolean }) {
  const w = 320;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return (
    <foreignObject x={x0} y={y - 13} width={w} height={20} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div style={{ color, fontSize: 11, lineHeight: '16px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', textAlign: anchor === 'end' ? 'right' : anchor === 'middle' ? 'center' : 'left', whiteSpace: 'nowrap', fontWeight: bold ? 600 : 400 }}>{children}</div>
    </foreignObject>
  );
}

/** Process flow diagram of the pilot plant with the live numbers of the four views. */
export function PilotSchematic({ r, spec }: { r: PlantResult; spec: PlantSpec }) {
  const n = spec.N;
  const st = Math.min(Math.max(Math.round(spec.sensor), 1), n);
  const yS = stageY(st, n);
  const yF = stageY(r.col.feedStage, n);
  const cx = (COL.x0 + COL.x1) / 2;
  const trays = Array.from({ length: n }, (_, i) => stageY(i + 1, n));
  const Tsens = r.tray[st - 1] ?? r.Ttop;
  const electric = spec.heating === 'electric';
  const d = (v: number, k = 2) => nf(v, k);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Pilot plant: process flow diagram')}>
      {/* column */}
      <rect x={COL.x0} y={COL.y0} width={COL.x1 - COL.x0} height={COL.y1 - COL.y0} rx={10} fill="rgb(148 163 184 / 0.08)" stroke={INK} strokeWidth={1.6} />
      {trays.map((y, i) => (
        <line key={i} x1={COL.x0 + 6} y1={y} x2={COL.x1 - 6} y2={y} stroke={i + 1 === r.col.feedStage ? '#f59e0b' : 'rgb(148 163 184 / 0.4)'} strokeWidth={i + 1 === r.col.feedStage ? 1.8 : 1} />
      ))}
      <Txt x={cx} y={COL.y0 - 38} anchor="middle" bold>
        {t('Column')}
      </Txt>
      <Txt x={cx} y={COL.y1 + 18} anchor="middle">
        {`N = ${n} · ${t('feed stage')} ${r.col.feedStage}`}
      </Txt>

      {/* feed with pump and motor */}
      <Arrow x1={150} y1={yF} x2={COL.x0} y2={yF} />
      <circle cx={190} cy={yF} r={14} fill="none" stroke={INK} strokeWidth={1.6} />
      <path d={`M ${190 - 7} ${yF + 7} L ${190 + 10} ${yF} L ${190 - 7} ${yF - 7}`} fill="none" stroke={INK} strokeWidth={1.2} />
      <rect x={176} y={yF - 54} width={28} height={22} rx={3} fill="none" stroke={ELEC} strokeWidth={1.6} />
      <Txt x={190} y={yF - 39} anchor="middle" color={ELEC}>
        M
      </Txt>
      <line x1={190} y1={yF - 32} x2={190} y2={yF - 14} stroke={ELEC} strokeWidth={1.4} />
      <Txt x={24} y={yF - 6} bold>
        {t('Feed')}
      </Txt>
      <Txt x={24} y={yF + 10}>{`F = ${d(spec.F, 1)} kmol/h`}</Txt>
      <Txt x={24} y={yF + 24}>{`z_F = ${d(spec.zF, 2)} · q = ${d(spec.q, 2)}`}</Txt>

      {/* condenser, drum, distillate and reflux */}
      <line x1={cx} y1={COL.y0} x2={cx} y2={COL.y0 - 22} stroke={INK} strokeWidth={1.6} />
      <line x1={cx} y1={COL.y0 - 22} x2={520} y2={COL.y0 - 22} stroke={INK} strokeWidth={1.6} />
      <rect x={520} y={COL.y0 - 44} width={96} height={44} rx={6} fill="rgb(56 189 248 / 0.12)" stroke={COLD} strokeWidth={1.6} />
      <Txt x={568} y={COL.y0 - 24} anchor="middle" color={COLD} bold>
        {t('Condenser')}
      </Txt>
      <Txt x={568} y={COL.y0 - 10} anchor="middle" color={COLD}>{`Q_c = ${d(r.thermo.Qcond, 1)} kW`}</Txt>
      <Arrow x1={568} y1={COL.y0 - 74} x2={568} y2={COL.y0 - 46} color={COLD} />
      <Txt x={576} y={COL.y0 - 62} color={COLD}>{`${d(r.thermo.cwM3h, 1)} m³/h`}</Txt>
      <line x1={616} y1={COL.y0 - 22} x2={680} y2={COL.y0 - 22} stroke={INK} strokeWidth={1.6} />
      <line x1={680} y1={COL.y0 - 22} x2={680} y2={COL.y0 + 10} stroke={INK} strokeWidth={1.6} />
      {/* reflux pump + return */}
      <circle cx={680} cy={COL.y0 + 26} r={13} fill="none" stroke={INK} strokeWidth={1.6} />
      <path d={`M ${680 - 6} ${COL.y0 + 32} L ${680 + 9} ${COL.y0 + 26} L ${680 - 6} ${COL.y0 + 20}`} fill="none" stroke={INK} strokeWidth={1.2} />
      <line x1={680} y1={COL.y0 + 39} x2={680} y2={COL.y0 + 56} stroke={INK} strokeWidth={1.6} />
      <Arrow x1={680} y1={COL.y0 + 56} x2={COL.x1} y2={COL.y0 + 56} />
      <Txt x={690} y={COL.y0 + 44}>{`L = ${d(r.col.L, 1)} kmol/h`}</Txt>
      {/* distillate */}
      <line x1={680} y1={COL.y0 - 22} x2={800} y2={COL.y0 - 22} stroke={INK} strokeWidth={1.6} />
      <Arrow x1={760} y1={COL.y0 - 22} x2={820} y2={COL.y0 - 22} />
      <Txt x={706} y={COL.y0 - 32} bold>
        {t('Distillate')}
      </Txt>
      <Txt x={740} y={COL.y0 + 4}>{`D = ${d(r.col.D, 2)} kmol/h`}</Txt>
      <Txt x={740} y={COL.y0 + 18}>{`x_D = ${d(r.col.xD, 3)}`}</Txt>

      {/* reboiler */}
      <line x1={cx} y1={COL.y1} x2={cx} y2={COL.y1 + 38} stroke={INK} strokeWidth={1.6} />
      <rect x={COL.x0 - 8} y={COL.y1 + 38} width={COL.x1 - COL.x0 + 16} height={46} rx={8} fill="rgb(248 113 113 / 0.12)" stroke={HOT} strokeWidth={1.6} />
      <Txt x={cx} y={COL.y1 + 58} anchor="middle" color={HOT} bold>
        {t('Reboiler')}
      </Txt>
      <Txt x={cx} y={COL.y1 + 73} anchor="middle" color={HOT}>{`Q_r = ${d(r.thermo.Qreb, 1)} kW`}</Txt>
      {electric ? (
        <path d={`M ${COL.x0 - 8} ${COL.y1 + 61} h -26 l 4 -9 l 6 18 l 6 -18 l 6 18 l 4 -9 h 10`} fill="none" stroke={ELEC} strokeWidth={1.6} />
      ) : (
        <Arrow x1={COL.x0 - 70} y1={COL.y1 + 61} x2={COL.x0 - 8} y2={COL.y1 + 61} color={HOT} />
      )}
      <Txt x={COL.x0 - 76} y={COL.y1 + 48} anchor="end" color={electric ? ELEC : HOT}>
        {electric ? `P = ${d(r.elec.Pheat, 1)} kW` : `${d(r.thermo.steamKgH, 0)} kg/h ${t('steam')}`}
      </Txt>
      <Txt x={COL.x0 - 76} y={COL.y1 + 78} anchor="end" color={electric ? ELEC : HOT}>
        {electric ? `I = ${d(r.elec.I, 0)} A` : `${d(r.thermo.steamT, 0)} °C`}
      </Txt>
      {/* bottoms */}
      <line x1={COL.x1 + 8} y1={COL.y1 + 61} x2={COL.x1 + 70} y2={COL.y1 + 61} stroke={INK} strokeWidth={1.6} />
      <Arrow x1={COL.x1 + 40} y1={COL.y1 + 61} x2={COL.x1 + 130} y2={COL.y1 + 61} />
      <Txt x={COL.x1 + 80} y={COL.y1 + 78} bold>
        {t('Bottoms')}
      </Txt>
      <Txt x={COL.x1 + 80} y={COL.y1 + 92}>{`B = ${d(r.col.B, 2)} kmol/h · x_B = ${d(r.col.xB, 3)}`}</Txt>

      {/* temperature control loop: TT → TC → heater */}
      <circle cx={COL.x1 + 4} cy={yS} r={4} fill={CTRL} />
      <line x1={COL.x1 + 4} y1={yS} x2={560} y2={yS} stroke={CTRL} strokeWidth={1.4} strokeDasharray="5 4" />
      <circle cx={590} cy={yS} r={20} fill="rgb(167 139 250 / 0.12)" stroke={CTRL} strokeWidth={1.6} />
      <Txt x={590} y={yS + 4} anchor="middle" color={CTRL} bold>
        TC
      </Txt>
      <Txt x={590} y={yS - 28} anchor="middle" color={CTRL}>{`T = ${d(Tsens, 1)} °C`}</Txt>
      <line x1={590} y1={yS + 20} x2={590} y2={COL.y1 + 46} stroke={CTRL} strokeWidth={1.4} strokeDasharray="5 4" />
      <Arrow x1={590} y1={COL.y1 + 46} x2={COL.x1 + 10} y2={COL.y1 + 46} color={CTRL} />
      <Txt x={COL.x1 + 14} y={yS - 6} color={CTRL}>
        {`TT ${t('stage')} ${st}`}
      </Txt>
    </svg>
  );
}
