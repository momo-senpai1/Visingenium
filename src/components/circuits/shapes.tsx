/**
 * Schematic symbols (IEC style, own drawings) and pin layouts for every
 * circuit device. Each shape lives in a w×h box; pins sit on the box edges.
 */

import type { CKind, CParams } from '@/engine/circuits/devices';

export interface ShapeState {
  level?: number;
  logic?: boolean;
}
export interface Shape {
  w: number;
  h: number;
  pins: Record<string, [number, number]>;
  /** labels drawn next to pins (short) */
  pinLabels?: Record<string, string>;
  draw: (p: CParams, s: ShapeState) => JSX.Element;
}

const LED_COLOR: Record<NonNullable<CParams['color']>, string> = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', white: '#f8fafc' };
const H = (x1: number, x2: number, y = 20) => <path d={`M${x1} ${y}H${x2}`} />;
const T = (x: number, y: number, s: string, size = 10, anchor: 'start' | 'middle' | 'end' = 'middle') => (
  <text x={x} y={y} textAnchor={anchor} className="fill-current stroke-none" style={{ fontSize: size }}>
    {s}
  </text>
);
const two = (draw: Shape['draw']): Shape => ({ w: 96, h: 40, pins: { a: [0, 20], b: [96, 20] }, draw });
const arrowsIn = (x: number, y: number) => <path d={`M${x} ${y}l8 6m-4 0h4v-4M${x + 8} ${y - 4}l8 6m-4 0h4v-4`} />;
const arrowsOut = (x: number, y: number, c?: string) => (
  <g style={c ? { stroke: c } : undefined}>
    <path d={`M${x} ${y}l8 -6m-4 0h4v4M${x + 6} ${y + 4}l8 -6m-4 0h4v4`} />
  </g>
);
const diodeBody = (fill?: string, fo = 0) => (
  <>
    {H(0, 36)}
    <path d="M36 8L60 20 36 32z" style={fill ? { fill, fillOpacity: fo } : undefined} />
    <path d="M60 8V32" />
    {H(60, 96)}
  </>
);

function gateShape(kind: string, nIn: number): Shape {
  const h = nIn === 1 ? 40 : 60;
  const ys = nIn === 1 ? [20] : nIn === 2 ? [15, 45] : [10, 30, 50];
  const pins: Shape['pins'] = { out: [90, h / 2] };
  ys.forEach((y, i) => (pins[`in${i + 1}`] = [0, y]));
  const neg = ['not', 'nand', 'nor', 'xnor'].includes(kind);
  return {
    w: 90,
    h,
    pins,
    draw: (_p, s) => {
      const body =
        kind === 'buffer' || kind === 'not' ? (
          <path d="M20 4L66 20 20 36z" />
        ) : kind.includes('and') ? (
          <path d={`M20 ${h / 2 - 22}H44A22 22 0 0 1 44 ${h / 2 + 22}H20z`} />
        ) : (
          <>
            <path d={`M18 ${h / 2 - 22}Q30 ${h / 2} 18 ${h / 2 + 22}Q54 ${h / 2 + 22} 68 ${h / 2}Q54 ${h / 2 - 22} 18 ${h / 2 - 22}z`} />
            {kind.startsWith('x') && <path d={`M12 ${h / 2 - 22}Q24 ${h / 2} 12 ${h / 2 + 22}`} />}
          </>
        );
      const tip = kind === 'buffer' || kind === 'not' ? 66 : kind.includes('and') ? 66 : 68;
      return (
        <>
          {ys.map((y) => (
            <path key={y} d={`M0 ${y}H${kind.includes('or') && !kind.startsWith('x') ? 22 : 20}`} />
          ))}
          <g style={{ fill: s.logic ? 'rgb(var(--sig-vapor)/0.25)' : undefined }}>{body}</g>
          {neg && <circle cx={tip + 3} cy={h / 2} r={3} />}
          <path d={`M${neg ? tip + 6 : tip} ${h / 2}H90`} />
        </>
      );
    },
  };
}

function ffShape(kind: 'dff' | 'jkff' | 'tff' | 'srff'): Shape {
  const left = kind === 'jkff' ? { j: 15, clk: 40, k: 65 } : kind === 'dff' ? { d: 20, clk: 60 } : kind === 'tff' ? { t: 20, clk: 60 } : { s: 20, r: 60 };
  const pins: Shape['pins'] = { q: [90, kind === 'jkff' ? 15 : 20], qn: [90, kind === 'jkff' ? 65 : 60] };
  Object.entries(left).forEach(([k, y]) => (pins[k] = [0, y]));
  return {
    w: 90,
    h: 80,
    pins,
    draw: (_p, s) => (
      <>
        <rect x="14" y="4" width="62" height="72" rx="2" style={{ fill: s.logic ? 'rgb(var(--sig-vapor)/0.12)' : undefined }} />
        {Object.entries(left).map(([k, y]) => (
          <g key={k}>
            {H(0, 14, y)}
            {k === 'clk' ? <path d={`M14 ${y - 5}L21 ${y}L14 ${y + 5}`} /> : T(18, y + 3, k.toUpperCase(), 9, 'start')}
          </g>
        ))}
        {H(76, 90, pins.q![1])}
        {H(76, 90, pins.qn![1])}
        {T(72, pins.q![1] + 3, 'Q', 9, 'end')}
        {T(72, pins.qn![1] + 3, 'Q̄', 9, 'end')}
      </>
    ),
  };
}

const csShape = (current: boolean, label: string): Shape => ({
  w: 96,
  h: 80,
  pins: { cp: [0, 15], cn: [0, 65], op: [96, 15], on: [96, 65] },
  draw: () => (
    <>
      {H(0, 10, 15)}
      {H(0, 10, 65)}
      <circle cx="12" cy="15" r="2" />
      <circle cx="12" cy="65" r="2" />
      {T(14, 34, '+', 9, 'start')}
      {T(14, 52, '−', 9, 'start')}
      <path d="M96 15H66V24M96 65H66V56" />
      <path d="M66 24L80 40 66 56 52 40z" />
      {current ? <path d="M66 50V30m-4 5 4-5 4 5" /> : (
        <>
          {T(66, 36, '+', 9)}
          {T(66, 52, '−', 9)}
        </>
      )}
      {T(30, 44, label, 9)}
    </>
  ),
});

const bjtShape = (pnp: boolean): Shape => ({
  w: 60,
  h: 80,
  pins: { b: [0, 40], c: [60, 0], e: [60, 80] },
  draw: () => (
    <>
      <circle cx="34" cy="40" r="22" />
      {H(0, 26, 40)}
      <path d="M26 26V54" />
      <path d="M26 33L60 12V0M26 47L60 68V80" />
      {pnp ? <path d="M38 55l-9-6 10-1" /> : <path d="M47 60l6 3-2-8" />}
    </>
  ),
});

const fetShape = (kind: 'mos' | 'jfet', p: boolean): Shape => ({
  w: 60,
  h: 80,
  pins: { g: [0, 50], d: [60, 0], s: [60, 80] },
  draw: () =>
    kind === 'mos' ? (
      <>
        {H(0, 22, 50)}
        <path d="M22 24V56" />
        <path d="M28 22V32M28 35V45M28 48V58" />
        <path d="M28 27H60V0M28 53H60V80M28 40H44V53" />
        {p ? <path d="M36 36l8 4-8 4" /> : <path d="M38 36l-8 4 8 4" />}
      </>
    ) : (
      <>
        {H(0, 28, 50)}
        <path d="M28 22V58" />
        <path d="M28 27H60V0M28 53H60V80" />
        {p ? <path d="M14 46l-6 4 6 4" /> : <path d="M20 46l6 4-6 4" />}
      </>
    ),
});

export const SHAPES: Record<CKind, Shape> = {
  resistor: two(() => (
    <>
      {H(0, 24)}
      <rect x="24" y="12" width="48" height="16" rx="1" />
      {H(72, 96)}
    </>
  )),
  vsource: two(() => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" />
      <path d="M34 20H62" />
      {H(62, 96)}
      {T(26, 10, '+')}
      {T(70, 10, '−')}
    </>
  )),
  battery: two(() => (
    <>
      {H(0, 42)}
      <path d="M42 6V34" />
      <path d="M52 13V27" strokeWidth="3" />
      {H(52, 96)}
      {T(36, 10, '+')}
      {T(60, 10, '−')}
    </>
  )),
  acsource: two((p) => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" />
      {p.wave === 'square' ? <path d="M38 24V16H48V24H58V16" /> : p.wave === 'triangle' ? <path d="M38 24L43 16L53 24L58 16" /> : <path d="M38 20q5-10 10 0t10 0" />}
      {H(62, 96)}
    </>
  )),
  isource: two(() => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" />
      <path d="M48 6V34" />
      {H(62, 96)}
      <path d="M40 20H22m5-4-5 4 5 4" />
    </>
  )),
  ground: {
    w: 60,
    h: 40,
    pins: { a: [30, 0] },
    draw: () => <path d="M30 0V20M14 20H46M20 27H40M26 34H34" />,
  },
  pot: {
    w: 96,
    h: 50,
    pins: { a: [0, 20], w: [48, 50], b: [96, 20] },
    draw: () => (
      <>
        {H(0, 24)}
        <rect x="24" y="12" width="48" height="16" rx="1" />
        {H(72, 96)}
        <path d="M48 50V31m-4 6 4-6 4 6" />
      </>
    ),
  },
  lamp: two((_p, s) => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" style={{ fill: '#facc15', fillOpacity: 0.85 * Math.min(1, s.level ?? 0) }} />
      <path d="M38 10l20 20M58 10L38 30" />
      {H(62, 96)}
    </>
  )),
  capacitor: two(() => (
    <>
      {H(0, 44)}
      <path d="M44 6V34M52 6V34" />
      {H(52, 96)}
    </>
  )),
  inductor: two(() => (
    <>
      {H(0, 24)}
      <rect x="24" y="13" width="48" height="14" className="fill-current" />
      {H(72, 96)}
    </>
  )),
  transformer: {
    w: 96,
    h: 80,
    pins: { p1: [0, 10], p2: [0, 70], s1: [96, 10], s2: [96, 70] },
    draw: () => (
      <>
        <path d="M0 10H30V18M0 70H30V62M96 10H66V18M96 70H66V62" />
        <path d="M30 18q8 5 0 11q8 5 0 11q8 5 0 11q8 5 0 11" />
        <path d="M66 18q-8 5 0 11q-8 5 0 11q-8 5 0 11q-8 5 0 11" />
        <path d="M45 14V66M51 14V66" />
        <circle cx="36" cy="14" r="2" className="fill-current" />
        <circle cx="60" cy="14" r="2" className="fill-current" />
      </>
    ),
  },
  fuse: two(() => (
    <>
      {H(0, 26)}
      <rect x="26" y="13" width="44" height="14" rx="1" />
      {H(26, 70)}
      {H(70, 96)}
    </>
  )),
  ldr: two(() => (
    <>
      {H(0, 24)}
      <rect x="24" y="14" width="48" height="12" rx="1" />
      {H(72, 96)}
      {arrowsIn(28, 0)}
    </>
  )),
  thermistor: two(() => (
    <>
      {H(0, 24)}
      <rect x="24" y="12" width="48" height="16" rx="1" />
      {H(72, 96)}
      <path d="M26 34L70 6H78" />
      {T(80, 38, 'ϑ', 10, 'start')}
    </>
  )),
  speaker: two(() => (
    <>
      {H(0, 36)}
      <rect x="36" y="12" width="10" height="16" />
      <path d="M46 12L62 2V38L46 28" />
      <path d="M62 20H96" />
    </>
  )),
  switch: two((p) => (
    <>
      {H(0, 30)}
      <circle cx="32" cy="20" r="2" />
      {p.closed ? <path d="M32 20L64 18" /> : <path d="M32 20L60 4" />}
      <circle cx="64" cy="20" r="2" />
      {H(66, 96)}
    </>
  )),
  pushNO: two((p) => (
    <>
      {H(0, 30)}
      <circle cx="32" cy="20" r="2" />
      <circle cx="64" cy="20" r="2" />
      {H(66, 96)}
      <path d={p.on ? 'M30 18H66M48 18V6M42 6H54' : 'M30 10H66M48 10V2M42 2H54'} />
    </>
  )),
  pushNC: two((p) => (
    <>
      {H(0, 30)}
      <circle cx="32" cy="20" r="2" />
      <circle cx="64" cy="20" r="2" />
      {H(66, 96)}
      <path d={p.on ? 'M30 30H66M48 30V36' : 'M30 22H66M48 22V36'} />
      <path d="M42 38H54" />
    </>
  )),
  spdt: {
    w: 96,
    h: 60,
    pins: { com: [0, 30], a: [96, 10], b: [96, 50] },
    pinLabels: { a: '1', b: '2' },
    draw: (p) => (
      <>
        {H(0, 30, 30)}
        <circle cx="32" cy="30" r="2" />
        <path d="M66 10H96M66 50H96" />
        <circle cx="64" cy="10" r="2" />
        <circle cx="64" cy="50" r="2" />
        <path d={p.on ? 'M32 30L63 48' : 'M32 30L63 12'} />
      </>
    ),
  },
  dpdt: {
    w: 96,
    h: 90,
    pins: { com1: [0, 20], a1: [96, 10], b1: [96, 30], com2: [0, 70], a2: [96, 60], b2: [96, 80] },
    draw: (p) => (
      <>
        {[0, 50].map((dy) => (
          <g key={dy}>
            {H(0, 30, 20 + dy)}
            <circle cx="32" cy={20 + dy} r="2" />
            <path d={`M66 ${10 + dy}H96M66 ${30 + dy}H96`} />
            <circle cx="64" cy={10 + dy} r="2" />
            <circle cx="64" cy={30 + dy} r="2" />
            <path d={p.on ? `M32 ${20 + dy}L63 ${28 + dy}` : `M32 ${20 + dy}L63 ${12 + dy}`} />
          </g>
        ))}
        <path d="M48 26V64" strokeDasharray="3 3" />
      </>
    ),
  },
  relay: {
    w: 120,
    h: 80,
    pins: { c1: [0, 20], c2: [0, 60], com: [80, 80], no: [120, 20], nc: [120, 60] },
    pinLabels: { no: 'NO', nc: 'NC' },
    draw: (_p, s) => (
      <>
        <path d="M0 20H20V28M0 60H20V52" />
        <rect x="12" y="28" width="16" height="24" />
        <path d="M28 40H62" strokeDasharray="3 3" />
        <path d="M80 80V64" />
        <circle cx="80" cy="62" r="2" />
        <path d="M120 20H96V30M120 60H96" />
        <circle cx="96" cy="32" r="2" />
        <circle cx="96" cy="58" r="2" />
        <path d={s.logic ? 'M80 62L95 33' : 'M80 62L95 57'} />
      </>
    ),
  },
  diode: two(() => diodeBody()),
  zener: two(() => (
    <>
      {diodeBody()}
      <path d="M60 8H66M60 32H54" />
    </>
  )),
  led: two((p, s) => (
    <>
      {diodeBody(LED_COLOR[p.color ?? 'red'], 0.12 + 0.8 * Math.min(1, Math.max(0, s.level ?? 0)))}
      {arrowsOut(52, 4, LED_COLOR[p.color ?? 'red'])}
    </>
  )),
  photodiode: two(() => (
    <>
      {diodeBody()}
      {arrowsIn(64, 0)}
    </>
  )),
  bridge: {
    w: 80,
    h: 80,
    pins: { ac1: [0, 40], ac2: [80, 40], p: [40, 0], m: [40, 80] },
    pinLabels: { p: '+', m: '−' },
    draw: () => (
      <>
        <path d="M40 4L76 40 40 76 4 40z" />
        <path d="M40 0V4M40 76V80M0 40H4M76 40H80" />
        {T(40, 22, '+')}
        {T(40, 64, '−')}
        {T(20, 44, '~')}
        {T(60, 44, '~')}
      </>
    ),
  },
  npn: bjtShape(false),
  pnp: bjtShape(true),
  nmos: fetShape('mos', false),
  pmos: fetShape('mos', true),
  njfet: fetShape('jfet', false),
  pjfet: fetShape('jfet', true),
  vcvs: csShape(false, 'μU'),
  vccs: csShape(true, 'gU'),
  ccvs: csShape(false, 'rI'),
  cccs: csShape(true, 'βI'),
  opamp: {
    w: 96,
    h: 80,
    pins: { inn: [0, 20], inp: [0, 60], out: [96, 40] },
    draw: () => (
      <>
        <path d="M0 20H18M0 60H18M78 40H96" />
        <path d="M18 6L78 40 18 74z" />
        {T(26, 24, '−', 12, 'start')}
        {T(26, 64, '+', 12, 'start')}
      </>
    ),
  },
  regulator: {
    w: 96,
    h: 60,
    pins: { in: [0, 20], out: [96, 20], gnd: [48, 60] },
    draw: (p) => (
      <>
        <path d="M0 20H20M76 20H96M48 44V60" />
        <rect x="20" y="4" width="56" height="40" rx="2" />
        {T(28, 16, 'IN', 8, 'start')}
        {T(70, 16, 'OUT', 8, 'end')}
        {T(48, 40, 'GND', 8)}
        {T(48, 30, `${p.Vreg ?? 5} V`, 9)}
      </>
    ),
  },
  timer555: {
    w: 120,
    h: 120,
    pins: { trig: [0, 30], thres: [0, 60], ctrl: [0, 90], dis: [120, 30], out: [120, 60], reset: [120, 90], vcc: [60, 0], gnd: [60, 120] },
    draw: (_p, s) => (
      <>
        <rect x="16" y="16" width="88" height="88" rx="2" style={{ fill: s.logic ? 'rgb(var(--sig-vapor)/0.1)' : undefined }} />
        <path d="M0 30H16M0 60H16M0 90H16M104 30H120M104 60H120M104 90H120M60 0V16M60 104V120" />
        {T(20, 33, 'TRIG', 8, 'start')}
        {T(20, 63, 'THR', 8, 'start')}
        {T(20, 93, 'CV', 8, 'start')}
        {T(100, 33, 'DIS', 8, 'end')}
        {T(100, 63, 'OUT', 8, 'end')}
        {T(100, 93, 'RST', 8, 'end')}
        {T(60, 28, 'VCC', 8)}
        {T(60, 100, 'GND', 8)}
        {T(60, 64, '555', 13)}
      </>
    ),
  },
  logicIn: {
    w: 60,
    h: 40,
    pins: { out: [60, 20] },
    draw: (p) => (
      <>
        <rect x="6" y="8" width="30" height="24" rx="12" style={{ fill: p.on ? 'rgb(var(--sig-vapor)/0.35)' : undefined }} />
        {T(21, 24, p.on ? '1' : '0', 12)}
        {H(36, 60)}
      </>
    ),
  },
  clock: {
    w: 60,
    h: 40,
    pins: { out: [60, 20] },
    draw: () => (
      <>
        <circle cx="21" cy="20" r="15" />
        <path d="M12 25V15H21V25H30V15" />
        {H(36, 60)}
      </>
    ),
  },
  logicOut: {
    w: 60,
    h: 40,
    pins: { in: [0, 20] },
    draw: (_p, s) => (
      <>
        {H(0, 24)}
        <circle cx="39" cy="20" r="14" style={{ fill: s.logic ? 'rgb(var(--sig-vapor))' : undefined, fillOpacity: s.logic ? 0.8 : 0 }} />
        {T(39, 24, s.logic ? 'H' : 'L', 11)}
      </>
    ),
  },
  buffer: gateShape('buffer', 1),
  not: gateShape('not', 1),
  and: gateShape('and', 2),
  nand: gateShape('nand', 2),
  or: gateShape('or', 2),
  nor: gateShape('nor', 2),
  xor: gateShape('xor', 2),
  xnor: gateShape('xnor', 2),
  dff: ffShape('dff'),
  jkff: ffShape('jkff'),
  tff: ffShape('tff'),
  srff: ffShape('srff'),
  ammeter: two(() => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" />
      {T(48, 25, 'A', 14)}
      {H(62, 96)}
    </>
  )),
  voltmeter: two(() => (
    <>
      {H(0, 34)}
      <circle cx="48" cy="20" r="14" />
      {T(48, 25, 'V', 14)}
      {H(62, 96)}
    </>
  )),
  probe: {
    w: 60,
    h: 40,
    pins: { a: [0, 20] },
    draw: () => (
      <>
        {H(0, 22)}
        <rect x="22" y="8" width="30" height="24" rx="2" />
        <path d="M27 26l5-6 5 4 5-8 5 6" />
      </>
    ),
  },
};

/** Gates with three inputs use a taller shape. */
export function shapeOf(kind: CKind, p: CParams): Shape {
  if (['and', 'nand', 'or', 'nor'].includes(kind) && (p.inputs ?? 2) === 3) return gateShape(kind, 3);
  return SHAPES[kind];
}

/** Text-free symbols use `currentColor`; text that must stay upright is rotated back by the node. */
export const LETTER_KINDS: readonly CKind[] = ['ammeter', 'voltmeter', 'regulator', 'timer555', 'logicIn', 'logicOut', 'dff', 'jkff', 'tff', 'srff', 'vcvs', 'vccs', 'ccvs', 'cccs', 'opamp', 'bridge'];
