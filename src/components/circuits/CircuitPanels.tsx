import { RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type DragEvent } from 'react';
import { Tex } from '@/components/balance/Tex';
import { Notice } from '@/components/workbench/controls';
import { diodeParams, lampR, type CKind, type CParams } from '@/engine/circuits/solver';
import { formatSI, parseSI } from '@/engine/circuits/units';
import { t, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { EXAMPLES, useCircuit, useCircuitSolution, useTransient, type CNode, type ExampleId } from '@/store/circuitStore';
import { SharedExamples, SheetManager } from '@/components/SheetManager';
import { CIRCUIT_DND, SymbolIcon, valueLabel } from './CircuitCanvas';
import { BodeTab, SimplifyTab } from './AnalysisTabs';
import { LineChartBox } from '@/components/heat/charts';
import { pinsOf } from '@/engine/circuits/devices';

export const KIND_LABEL: Record<CKind, string> = {
  vsource: 'DC voltage source', battery: 'Battery', acsource: 'AC / signal source', isource: 'Current source', ground: 'Ground',
  resistor: 'Resistor', pot: 'Potentiometer', lamp: 'Lamp', capacitor: 'Capacitor', inductor: 'Inductor', transformer: 'Transformer',
  fuse: 'Fuse', ldr: 'Photoresistor (LDR)', thermistor: 'Thermistor (NTC)', speaker: 'Loudspeaker',
  switch: 'Switch', spdt: 'Changeover switch (SPDT)', dpdt: 'Double changeover (DPDT)', pushNO: 'Push button (NO)', pushNC: 'Push button (NC)', relay: 'Relay',
  diode: 'Diode', zener: 'Zener diode', led: 'LED', photodiode: 'Photodiode', bridge: 'Bridge rectifier',
  npn: 'NPN transistor', pnp: 'PNP transistor', nmos: 'N-MOSFET', pmos: 'P-MOSFET', njfet: 'N-JFET', pjfet: 'P-JFET',
  vcvs: 'VCVS (voltage-controlled voltage source)', vccs: 'VCCS (voltage-controlled current source)', ccvs: 'CCVS (current-controlled voltage source)', cccs: 'CCCS (current-controlled current source)',
  opamp: 'Op-amp', regulator: 'Voltage regulator', timer555: '555 timer',
  logicIn: 'Logic input', clock: 'Clock', logicOut: 'Logic output',
  buffer: 'Buffer', not: 'NOT', and: 'AND', nand: 'NAND', or: 'OR', nor: 'NOR', xor: 'XOR', xnor: 'XNOR',
  dff: 'D flip-flop', jkff: 'JK flip-flop', tff: 'T flip-flop', srff: 'SR latch',
  ammeter: 'Ammeter', voltmeter: 'Voltmeter', probe: 'Scope probe',
};

const GROUPS: { title: string; kinds: CKind[] }[] = [
  { title: 'Sources', kinds: ['vsource', 'battery', 'acsource', 'isource', 'ground'] },
  { title: 'Passive', kinds: ['resistor', 'pot', 'capacitor', 'inductor', 'transformer', 'lamp', 'fuse', 'ldr', 'thermistor', 'speaker'] },
  { title: 'Switches & relays', kinds: ['switch', 'spdt', 'dpdt', 'pushNO', 'pushNC', 'relay'] },
  { title: 'Diodes', kinds: ['diode', 'zener', 'led', 'photodiode', 'bridge'] },
  { title: 'Transistors', kinds: ['npn', 'pnp', 'nmos', 'pmos', 'njfet', 'pjfet'] },
  { title: 'Controlled sources', kinds: ['vcvs', 'vccs', 'ccvs', 'cccs'] },
  { title: 'Integrated circuits', kinds: ['opamp', 'regulator', 'timer555'] },
  { title: 'Digital inputs & outputs', kinds: ['logicIn', 'clock', 'logicOut'] },
  { title: 'Logic gates', kinds: ['buffer', 'not', 'and', 'nand', 'or', 'nor', 'xor', 'xnor'] },
  { title: 'Flip-flops', kinds: ['dff', 'jkff', 'tff', 'srff'] },
  { title: 'Meters & probes', kinds: ['ammeter', 'voltmeter', 'probe'] },
];

const comma = () => useLang.getState().lang !== 'en';
const si = (v: number, u: string, d = 3) => formatSI(v, u, d, comma());

export function CircuitPalette() {
  const load = useCircuit((s) => s.load);
  const clear = useCircuit((s) => s.clear);
  const snapshot = useCircuit((s) => s.snapshot);
  const loadSheet = useCircuit((s) => s.loadSheet);
  const onDragStart = (e: DragEvent, kind: CKind) => {
    e.dataTransfer.setData(CIRCUIT_DND, kind);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <aside className="glass flex w-56 shrink-0 flex-col overflow-y-auto">
      <div className="border-b border-white/[0.05] px-3 py-2.5">
        <p className="tag text-plant-400">{t('Components')}</p>
        <p className="mt-0.5 text-[10px] text-plant-500">{t('Drag in, then wire the terminals')}</p>
      </div>
      <div className="space-y-2 p-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="tag px-2 pb-1 pt-1 text-plant-500">{t(g.title)}</p>
            <ul className="space-y-0.5">
              {g.kinds.map((k) => (
                <li
                  key={k}
                  draggable
                  onDragStart={(e) => onDragStart(e, k)}
                  className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-white/[0.06] hover:bg-white/[0.03] active:cursor-grabbing"
                >
                  <SymbolIcon kind={k} params={{ closed: false, color: 'red' }} className="h-6 w-12 shrink-0 stroke-plant-300 text-plant-300 group-hover:stroke-signal-vapor group-hover:text-signal-vapor" />
                  <span className="text-xs text-plant-200">{t(KIND_LABEL[k])}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-white/[0.05] p-3">
        <SheetManager app="circuit" current={snapshot} apply={loadSheet} />
        <div className="mt-3">
          <SharedExamples app="circuit" apply={loadSheet} />
        </div>
      </div>
      <div className="space-y-1 border-t border-white/[0.05] p-3">
        <p className="tag mb-1 text-plant-400">{t('Examples')}</p>
        {(Object.keys(EXAMPLES) as ExampleId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => load(id)}
            className="block w-full rounded border border-white/[0.08] px-2 py-1 text-left text-[11px] text-plant-200 hover:border-signal-vapor/40 hover:text-signal-vapor"
          >
            {t(EXAMPLES[id].label)}
          </button>
        ))}
        <button type="button" onClick={clear} className="block w-full rounded border border-white/[0.08] px-2 py-1 text-left text-[11px] text-plant-300 hover:border-signal-alarm/40 hover:text-signal-alarm">
          {t('Empty sheet')}
        </button>
      </div>
    </aside>
  );
}

const inputCls = 'w-full rounded border border-white/[0.08] bg-plant-950/70 px-2 py-1 font-mono text-xs text-plant-100 outline-none focus:border-signal-vapor/50';

/** Number field with SI prefixes (4k7, 10m, 2,2µ). */
function SIInput({ label, unit, value, onChange }: { label: string; unit: string; value: number | undefined; onChange: (v: number) => void }) {
  const [text, setText] = useState(value === undefined ? '' : si(value, '', 4).trim());
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText((cur) => (parseSI(cur) === value ? cur : value === undefined ? '' : si(value, '', 4).trim()));
  }, [value]);
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_110px_28px] items-center gap-2 text-[11px] text-plant-300">
      <span>{label}</span>
      <input
        className={cn(inputCls, bad && 'border-signal-alarm/60')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseSI(e.target.value);
          setBad(v === null);
          if (v !== null) onChange(v);
        }}
      />
      <span className="font-mono text-[10px] text-plant-500">{unit}</span>
    </label>
  );
}

type Field =
  | { key: keyof CParams; label: string; unit: string }
  | { key: keyof CParams; label: string; options: { v: string | number; label: string }[] }
  | { key: keyof CParams; label: string; bool: true };

const FIELDS: Partial<Record<CKind, Field[]>> = {
  resistor: [{ key: 'R', label: 'Resistance R', unit: 'Ω' }, { key: 'Pmax', label: 'Power rating (optional)', unit: 'W' }],
  speaker: [{ key: 'R', label: 'Impedance', unit: 'Ω' }],
  pot: [{ key: 'R', label: 'Total resistance', unit: 'Ω' }, { key: 'pos', label: 'Wiper position (0…1)', unit: '' }],
  vsource: [{ key: 'V', label: 'Voltage U', unit: 'V' }],
  battery: [{ key: 'V', label: 'Open-circuit voltage', unit: 'V' }, { key: 'r', label: 'Internal resistance', unit: 'Ω' }],
  acsource: [
    { key: 'wave', label: 'Waveform', options: [{ v: 'sine', label: 'sine' }, { v: 'square', label: 'square' }, { v: 'triangle', label: 'triangle' }] },
    { key: 'amp', label: 'Amplitude', unit: 'V' },
    { key: 'freq', label: 'Frequency', unit: 'Hz' },
    { key: 'offset', label: 'DC offset', unit: 'V' },
  ],
  isource: [{ key: 'I', label: 'Current I', unit: 'A' }],
  capacitor: [{ key: 'C', label: 'Capacitance C', unit: 'F' }],
  inductor: [{ key: 'L', label: 'Inductance L', unit: 'H' }],
  transformer: [{ key: 'L', label: 'Primary inductance L₁', unit: 'H' }, { key: 'ratio', label: 'Turns ratio N₂/N₁', unit: '' }, { key: 'k', label: 'Coupling k', unit: '' }],
  lamp: [{ key: 'Vnom', label: 'Rated voltage', unit: 'V' }, { key: 'Pnom', label: 'Rated power', unit: 'W' }],
  fuse: [{ key: 'rating', label: 'Rated current', unit: 'A' }],
  ldr: [{ key: 'light', label: 'Light (0…1)', unit: '' }, { key: 'Rdark', label: 'Dark resistance', unit: 'Ω' }, { key: 'Rlight', label: 'Resistance in bright light', unit: 'Ω' }],
  thermistor: [{ key: 'T', label: 'Temperature', unit: '°C' }, { key: 'R25', label: 'R at 25 °C', unit: 'Ω' }, { key: 'B', label: 'B constant', unit: 'K' }],
  switch: [{ key: 'closed', label: 'Closed', bool: true }],
  spdt: [{ key: 'on', label: 'Position 2', bool: true }],
  dpdt: [{ key: 'on', label: 'Position 2', bool: true }],
  relay: [{ key: 'Rcoil', label: 'Coil resistance', unit: 'Ω' }, { key: 'Ipull', label: 'Pull-in current', unit: 'A' }],
  diode: [{ key: 'Is', label: 'Saturation current I_S', unit: 'A' }, { key: 'n', label: 'Emission coefficient n', unit: '' }],
  zener: [{ key: 'Vz', label: 'Zener voltage U_Z', unit: 'V' }],
  led: [
    { key: 'Vf', label: 'Forward voltage U_F', unit: 'V' },
    { key: 'Inom', label: 'Nominal current I_F', unit: 'A' },
    { key: 'color', label: 'Colour', options: ['red', 'green', 'blue', 'yellow', 'white'].map((c) => ({ v: c, label: c })) },
  ],
  photodiode: [{ key: 'light', label: 'Light (0…1)', unit: '' }, { key: 'Iph', label: 'Photocurrent at full light', unit: 'A' }],
  npn: [{ key: 'beta', label: 'Current gain β', unit: '' }, { key: 'Is', label: 'Saturation current I_S', unit: 'A' }],
  pnp: [{ key: 'beta', label: 'Current gain β', unit: '' }, { key: 'Is', label: 'Saturation current I_S', unit: 'A' }],
  nmos: [{ key: 'Vt0', label: 'Threshold voltage U_th', unit: 'V' }, { key: 'K', label: 'Transconductance K', unit: 'A/V²' }, { key: 'lambda', label: 'Channel-length modulation λ', unit: '1/V' }],
  pmos: [{ key: 'Vt0', label: 'Threshold voltage |U_th|', unit: 'V' }, { key: 'K', label: 'Transconductance K', unit: 'A/V²' }, { key: 'lambda', label: 'Channel-length modulation λ', unit: '1/V' }],
  njfet: [{ key: 'Idss', label: 'I_DSS', unit: 'A' }, { key: 'Vp', label: 'Pinch-off |U_P|', unit: 'V' }],
  pjfet: [{ key: 'Idss', label: 'I_DSS', unit: 'A' }, { key: 'Vp', label: 'Pinch-off |U_P|', unit: 'V' }],
  vcvs: [{ key: 'gain', label: 'Voltage gain μ', unit: '' }],
  vccs: [{ key: 'gain', label: 'Transconductance g', unit: 'S' }],
  ccvs: [{ key: 'gain', label: 'Transresistance r', unit: 'Ω' }],
  cccs: [{ key: 'gain', label: 'Current gain β', unit: '' }],
  opamp: [{ key: 'A', label: 'Open-loop gain A', unit: '' }, { key: 'Vsat', label: 'Output limit ±U_sat', unit: 'V' }],
  regulator: [{ key: 'Vreg', label: 'Output voltage', unit: 'V' }, { key: 'drop', label: 'Dropout voltage', unit: 'V' }],
  logicIn: [{ key: 'on', label: 'High (1)', bool: true }, { key: 'Vlogic', label: 'Logic level', unit: 'V' }],
  clock: [{ key: 'freq', label: 'Frequency', unit: 'Hz' }],
  and: [{ key: 'inputs', label: 'Inputs', options: [{ v: 2, label: '2' }, { v: 3, label: '3' }] }],
  nand: [{ key: 'inputs', label: 'Inputs', options: [{ v: 2, label: '2' }, { v: 3, label: '3' }] }],
  or: [{ key: 'inputs', label: 'Inputs', options: [{ v: 2, label: '2' }, { v: 3, label: '3' }] }],
  nor: [{ key: 'inputs', label: 'Inputs', options: [{ v: 2, label: '2' }, { v: 3, label: '3' }] }],
};

const HINT: Partial<Record<CKind, string>> = {
  vsource: 'Terminal + is on the side marked +.',
  acsource: 'Active in transient analysis; in DC only the offset is applied.',
  isource: 'The arrow shows the direction the current leaves the source.',
  diode: 'Shockley equation I = I_S·(e^(U/(n·U_T)) − 1); defaults: 1N4148.',
  led: 'Modelled as a diode that passes I_F at U_F (n = 2). Brightness follows the current.',
  lamp: 'Hot resistance R = U²/P from the rating; brightness follows the power.',
  capacitor: 'DC: open circuit. Transient: i = C·du/dt.',
  inductor: 'DC: short circuit. Transient: u = L·di/dt.',
  transformer: 'Coupled inductors; only meaningful in transient analysis (DC: both windings short).',
  ammeter: 'Ideal: no voltage drop. Insert it in series.',
  voltmeter: 'Ideal: no current. Connect it in parallel.',
  probe: 'Measures the node voltage against ground; shown on the oscilloscope.',
  switch: 'Click the switch on the sheet to toggle it.',
  spdt: 'Click on the sheet to change over.',
  dpdt: 'Click on the sheet to change over both poles.',
  pushNO: 'Press and hold on the sheet.',
  pushNC: 'Press and hold on the sheet to open it.',
  relay: 'Pulls in above the pull-in current, drops out below half of it. Contact COM switches from NC to NO.',
  fuse: 'Blows above its rated current; press “Reset flip-flops, relays, fuses” to replace it.',
  zener: 'Conducts forward like a diode and in reverse above U_Z.',
  photodiode: 'Light produces a reverse photocurrent.',
  bridge: 'Four diodes: AC in at ~, DC out at + and −.',
  npn: 'Ebers–Moll model. Pins: B left, C top, E bottom.',
  pnp: 'Ebers–Moll model. Pins: B left, C top, E bottom.',
  nmos: 'Square-law model. Pins: G left, D top, S bottom.',
  pmos: 'Square-law model. Pins: G left, D top, S bottom.',
  njfet: 'Shichman–Hodges model. Pins: G left, D top, S bottom.',
  pjfet: 'Shichman–Hodges model. Pins: G left, D top, S bottom.',
  vcvs: 'Control voltage at the left terminals, output at the right.',
  vccs: 'Control voltage at the left terminals; the current leaves the upper right terminal.',
  ccvs: 'The control current flows through the left terminals (a short circuit).',
  cccs: 'The control current flows through the left terminals (a short circuit).',
  opamp: 'High gain, output limited to ±U_sat; supply pins are implicit.',
  regulator: 'Output = min(U_reg, U_in − U_drop); input current = output current.',
  timer555: 'Comparators at 1/3 and 2/3 of VCC, flip-flop, discharge transistor. Use transient analysis.',
  logicIn: 'Click it on the sheet to switch between 0 and 1.',
  clock: 'Square wave in transient analysis.',
  logicOut: 'Shows H above half the logic level.',
  dff: 'Q takes D on the rising clock edge. In DC mode, clock it by toggling a logic input.',
  jkff: 'J=K=1 toggles on the rising edge.',
  tff: 'Toggles on the rising clock edge when T = 1.',
  srff: 'S sets, R resets (level-sensitive).',
  ground: 'Reference potential 0 V. All ground symbols are connected.',
};

function CompPanel({ n }: { n: CNode }) {
  const update = useCircuit((s) => s.update);
  const setParam = useCircuit((s) => s.setParam);
  const rotate = useCircuit((s) => s.rotate);
  const remove = useCircuit((s) => s.remove);
  const lastRotate = useCircuit((s) => s.lastRotate);
  const undoRotate = useCircuit((s) => s.undoRotate);
  const wired = useCircuit((s) => s.edges.some((e) => e.source === n.id || e.target === n.id));
  const { result } = useCircuitSolution();
  const r = result.comps.get(n.id);
  const d = n.data;
  return (
    <>
      <div className="space-y-2 border-b border-white/[0.04] px-4 py-3">
        <p className="tag text-plant-500">{t(KIND_LABEL[d.kind])}</p>
        <input aria-label={t('Name')} className={cn(inputCls, 'font-sans')} value={d.name} onChange={(e) => update(n.id, { name: e.target.value })} />
        <div className="flex gap-2">
          {d.kind !== 'ground' && (
            <button type="button" onClick={() => rotate(n.id)} className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-300 hover:text-signal-vapor">
              <RotateCw className="h-3 w-3" /> {t('Rotate')}
            </button>
          )}
          <button type="button" onClick={() => remove(n.id)} className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-300 hover:text-signal-alarm">
            <Trash2 className="h-3 w-3" /> {t('Delete')}
          </button>
        </div>
        {d.kind !== 'ground' && wired && <p className="text-[10px] text-plant-500">{t('Rotating detaches the wires of this part; reconnect them afterwards.')}</p>}
        {lastRotate?.id === n.id && lastRotate.edges.length > 0 && (
          <div className="flex items-center gap-2 rounded border border-signal-heat/30 bg-signal-heat/5 px-2 py-1 text-[10px] text-signal-heat">
            <span className="flex-1">{t('{n} wires detached: drag from the terminals to reconnect.', { n: lastRotate.edges.length })}</span>
            <button type="button" onClick={undoRotate} className="rounded border border-signal-heat/40 px-1.5 py-0.5 hover:bg-signal-heat/10">
              {t('Undo rotation')}
            </button>
          </div>
        )}
      </div>
      {FIELDS[d.kind] && (
        <div className="space-y-2 border-b border-white/[0.04] px-4 py-3">
          <p className="tag text-plant-500">{t('Parameters')}</p>
          {FIELDS[d.kind]!.map((f) =>
            'unit' in f ? (
              <SIInput key={f.key} label={t(f.label)} unit={f.unit} value={d.params[f.key] as number | undefined} onChange={(v) => setParam(n.id, f.key, v)} />
            ) : 'options' in f ? (
              <label key={f.key} className="grid grid-cols-[minmax(0,1fr)_138px] items-center gap-2 text-[11px] text-plant-300">
                <span>{t(f.label)}</span>
                <select
                  value={String(d.params[f.key] ?? f.options[0]!.v)}
                  onChange={(e) => setParam(n.id, f.key, (typeof f.options[0]!.v === 'number' ? Number(e.target.value) : e.target.value) as never)}
                  className="rounded border border-white/[0.08] bg-plant-950/70 px-2 py-1 text-xs text-plant-100"
                >
                  {f.options.map((o) => (
                    <option key={o.v} value={o.v}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label key={f.key} className="flex cursor-pointer items-center gap-2 text-[11px] text-plant-300">
                <input type="checkbox" checked={!!d.params[f.key]} onChange={(e) => setParam(n.id, f.key, e.target.checked as never)} />
                {t(f.label)}
              </label>
            ),
          )}
        </div>
      )}
      {HINT[d.kind] && <p className="border-b border-white/[0.04] px-4 py-3 text-[10px] leading-relaxed text-plant-500">{t(HINT[d.kind]!)}</p>}
      {r && result.ok && d.kind !== 'ground' && (
        <div className="space-y-1 px-4 py-3 font-mono text-[11px]">
          <p className="tag mb-1 font-sans text-plant-500">{t('Operating point')}</p>
          <Row k="U" v={si(r.V, 'V', 4)} />
          <Row k="I" v={si(r.I, 'A', 4)} />
          <Row k="P" v={`${si(Math.abs(r.P), 'W', 4)} ${r.P < -1e-15 ? t('delivered') : r.P > 1e-15 ? t('absorbed') : ''}`} />
          {Math.abs(r.I) > 1e-12 && <Row k="R = U/I" v={si(r.V / r.I, 'Ω', 4)} />}
          {r.level !== undefined && <Row k={t('Brightness')} v={`${Math.round(r.level * 100)} %`} />}
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-plant-400">{k}</span>
      <span className="text-plant-100">{v}</span>
    </div>
  );
}

export function CircuitInspector() {
  const node = useCircuit((s) => s.nodes.find((n) => n.selected));
  return (
    <aside className="glass flex w-72 shrink-0 flex-col overflow-y-auto">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <p className="tag text-plant-400">{t('Inspector')}</p>
        <p className="mt-0.5 text-xs text-plant-200">{node ? node.data.name : t('Select a component')}</p>
      </div>
      {node ? (
        <CompPanel key={node.id} n={node} />
      ) : (
        <div className="space-y-2 px-4 py-4 text-[11px] leading-relaxed text-plant-400">
          <p>{t('1. Drag components onto the sheet.')}</p>
          <p>{t('2. Drag from one terminal to another to draw a wire. Terminals joined by wires form one node.')}</p>
          <p>{t('3. Click a component to name it and set its values; SI prefixes work: 4k7, 330, 10m, 2,2µ.')}</p>
          <p>{t('4. Place a ground symbol to fix the 0 V reference. Results update instantly below.')}</p>
        </div>
      )}
    </aside>
  );
}

type Tab = 'table' | 'scope' | 'bode' | 'reduce' | 'nodes' | 'system' | 'power';

function AnalysisBar() {
  const a = useCircuit((s) => s.analysis);
  const setA = useCircuit((s) => s.setAnalysis);
  const resetStates = useCircuit((s) => s.resetStates);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-2 py-1.5 text-[11px]">
      <div role="group" aria-label={t('Analysis')} className="flex rounded border border-white/[0.08] p-0.5">
        {(['dc', 'tran', 'ac'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={a.mode === m}
            onClick={() => setA({ mode: m })}
            className={cn('rounded-sm px-2 py-0.5', a.mode === m ? 'bg-signal-vapor/15 text-signal-vapor' : 'text-plant-300 hover:text-plant-100')}
          >
            {t(m === 'dc' ? 'DC operating point' : m === 'tran' ? 'Transient' : 'AC / Bode')}
          </button>
        ))}
      </div>
      {a.mode === 'tran' && (
        <>
          <label className="flex items-center gap-1 text-plant-400">
            {t('duration')}
            <TimeInput value={a.tEnd} onChange={(tEnd) => setA({ tEnd })} />
            s
          </label>
          <label className="flex items-center gap-1 text-plant-400">
            {t('steps')}
            <select value={a.steps} onChange={(e) => setA({ steps: Number(e.target.value) })} className="rounded border border-white/[0.08] bg-plant-950/70 px-1 py-0.5 text-plant-100">
              {[500, 1000, 2000, 4000, 8000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-plant-400">
            <input type="checkbox" checked={a.fromDC} onChange={(e) => setA({ fromDC: e.target.checked })} />
            {t('start from DC operating point')}
          </label>
        </>
      )}
      <button type="button" onClick={resetStates} className="ml-auto rounded border border-white/[0.08] px-2 py-0.5 text-plant-300 hover:text-signal-vapor">
        {t('Reset flip-flops, relays, fuses')}
      </button>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(si(value, '', 3).trim());
  useEffect(() => setText((cur) => (parseSI(cur) === value ? cur : si(value, '', 3).trim())), [value]);
  return (
    <input
      aria-label={t('duration')}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseSI(e.target.value);
        if (v !== null && v > 0) onChange(v);
      }}
      className="w-16 rounded border border-white/[0.08] bg-plant-950/70 px-1 py-0.5 font-mono text-plant-100"
    />
  );
}

export function CircuitResults() {
  const [tab, setTab] = useState<Tab>('table');
  const { result } = useCircuitSolution();
  const mode = useCircuit((s) => s.analysis.mode);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'table', label: 'Currents & voltages' },
    ...(mode === 'tran' ? [{ id: 'scope' as Tab, label: 'Oscilloscope' }] : []),
    ...(mode === 'ac' ? [{ id: 'bode' as Tab, label: 'Bode (AC)' }] : []),
    { id: 'reduce', label: 'Simplify (equivalent)' },
    { id: 'nodes', label: 'Node potentials' },
    { id: 'system', label: 'Nodal equations' },
    { id: 'power', label: 'Power balance' },
  ];
  useEffect(() => {
    if (mode === 'tran') setTab('scope');
    else if (mode === 'ac') setTab('bode');
    else setTab((x) => (x === 'scope' || x === 'bode' ? 'table' : x));
  }, [mode]);
  return (
    <section className="glass flex h-[46%] min-h-[240px] shrink-0 flex-col overflow-hidden">
      <AnalysisBar />
      <div role="tablist" className="flex items-center gap-1 border-b border-white/[0.05] px-2 py-1.5">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            type="button"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={cn('rounded px-2.5 py-1 text-[11px] transition-colors', tab === tb.id ? 'bg-signal-vapor/15 text-signal-vapor' : 'text-plant-300 hover:bg-white/[0.04]')}
          >
            {t(tb.label)}
          </button>
        ))}
        <span className="ml-auto pr-2 font-mono text-[10px]">
          {mode === 'tran' ? (
            <TranStatus />
          ) : result.ok ? (
            <span className="text-signal-ok">
              {t('solved')} · {result.nets} {t('nodes')}
              {result.iterations > 1 ? ` · ${result.iterations} ${t('Newton iterations')}` : ''}
            </span>
          ) : (
            <span className="text-signal-alarm">{t('not solvable')}</span>
          )}
        </span>
      </div>
      <div data-export="circuit-results" className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'scope' ? (
          <Scope />
        ) : tab === 'bode' ? (
          <BodeTab />
        ) : tab === 'reduce' ? (
          <SimplifyTab />
        ) : (
          <>
            <Messages />
            {result.ok && (tab === 'table' ? <Table /> : tab === 'nodes' ? <Nodes /> : tab === 'system' ? <System /> : <Power />)}
          </>
        )}
      </div>
    </section>
  );
}

function TranStatus() {
  const tr = useTransient();
  if (!tr) return null;
  return tr.ok ? <span className="text-signal-ok">{t('transient solved')} · {tr.steps} {t('steps')}</span> : <span className="text-signal-alarm">{t('not solvable')}</span>;
}

function Scope() {
  const tr = useTransient();
  const { circuit } = useCircuitSolution();
  const [extra, setExtra] = useState<string[]>([]);
  if (!tr) return null;
  if (!tr.ok) return <Notice tone="error">{t('The transient analysis failed: the circuit has no unique solution at some time step.')}</Notice>;
  const step = Math.max(1, Math.floor(tr.t.length / 800));
  const pick = (arr: number[]) => tr.t.filter((_, i) => i % step === 0).map((x, k) => ({ x: x * 1000, y: arr[k * step]! }));
  const meters = circuit.components.filter((c) => ['probe', 'voltmeter', 'ammeter'].includes(c.kind) || extra.includes(c.id));
  const series = meters.map((c) => {
    const pins = pinsOf(c);
    const net = (p: string) => tr.netOf.get(`${c.id}:${p}`);
    let arr: number[];
    let unit = 'V';
    if (c.kind === 'ammeter' || (extra.includes(c.id) && !['probe', 'voltmeter'].includes(c.kind))) {
      arr = tr.currents.get(c.id) ?? [];
      unit = 'A';
    } else if (pins.length === 1) arr = tr.nets[net(pins[0]!)!] ?? [];
    else {
      const a = tr.nets[net('a')!] ?? [];
      const b = tr.nets[net('b')!] ?? [];
      arr = a.map((v, i) => v - (b[i] ?? 0));
    }
    return { name: `${c.name} [${unit}]`, data: pick(arr) };
  });
  // logic channels: one strip per logic output / clock, like a logic analyser
  const channels = circuit.components
    .filter((c) => c.kind === 'logicOut' || c.kind === 'clock')
    .map((c) => {
      const arr = c.kind === 'clock' ? (tr.nets[tr.netOf.get(`${c.id}:out`)!] ?? []).map((v) => (v > (c.params.Vlogic ?? 5) / 2 ? 1 : 0)) : tr.logic.get(c.id) ?? [];
      return { name: c.name, data: pick(arr) };
    });
  const candidates = circuit.components.filter((c) => !['probe', 'voltmeter', 'ammeter', 'logicOut', 'ground'].includes(c.kind) && pinsOf(c).length === 2);
  return (
    <div className="space-y-2">
      {series.length > 0 && <LineChartBox series={series} xLabel="t [ms]" yLabel="" height={channels.length ? 180 : 220} digits={2} />}
      {channels.length > 0 && (
        <div className="space-y-0.5">
          {channels.map((ch) => (
            <div key={ch.name} className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2">
              <span className="truncate font-mono text-[10px] text-plant-300">{ch.name}</span>
              <svg viewBox="0 0 1000 24" preserveAspectRatio="none" className="h-6 w-full" aria-label={ch.name}>
                <path
                  d={ch.data.map((p, i) => `${i ? 'L' : 'M'}${((p.x / (tr.t.at(-1)! * 1000)) * 1000).toFixed(1)},${p.y ? 3 : 21}`).join('')}
                  fill="none"
                  stroke="rgb(var(--sig-vapor))"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          ))}
          <p className="pl-[78px] font-mono text-[9px] text-plant-500">0 … {si(tr.t.at(-1)!, 's')}</p>
        </div>
      )}
      {!series.length && !channels.length && <Notice tone="info">{t('Place scope probes, voltmeters or ammeters to see waveforms, or add component currents below.')}</Notice>}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-plant-400">
        <span>{t('Add current of')}:</span>
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setExtra((x) => (x.includes(c.id) ? x.filter((i) => i !== c.id) : [...x, c.id]))}
            className={cn('rounded border px-1.5 py-0.5', extra.includes(c.id) ? 'border-signal-vapor/50 text-signal-vapor' : 'border-white/[0.08] hover:text-plant-100')}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-plant-500">{t('Backward-Euler integration with {n} steps of {h}; values at the end are in the table tab.', { n: tr.steps, h: si(tr.t[1] ?? 0, 's') })}</p>
    </div>
  );
}

function Messages() {
  const { result, circuit } = useCircuitSolution();
  const names = new Map(circuit.components.map((c) => [c.id, c.name]));
  const msgs: { tone: 'error' | 'warning' | 'info'; text: string }[] = [];
  if (result.error === 'empty') msgs.push({ tone: 'info', text: t('Drag components onto the sheet to start.') });
  if (result.error === 'singular')
    msgs.push({ tone: 'error', text: t('The circuit has no unique solution: ideal voltage sources (or ammeters) in a closed loop, or current sources in series with an open branch.') });
  if (result.error === 'noconverge') msgs.push({ tone: 'error', text: t('The Newton iteration did not converge.') });
  if (result.ok && result.groundAssumed) msgs.push({ tone: 'info', text: t('No ground placed: the minus terminal of the first source is taken as 0 V.') });
  if (result.ok && result.oscillating) msgs.push({ tone: 'warning', text: t('The logic does not settle (it oscillates, e.g. a ring of inverters). Use transient analysis to watch it.') });
  if (result.ok && result.floating.length) msgs.push({ tone: 'warning', text: t('Some terminals are not connected to the rest of the circuit; they carry no current.') });
  for (const [id, r] of result.comps) {
    if (r.warn === 'overload') msgs.push({ tone: 'warning', text: t('{name} is overloaded.', { name: names.get(id) ?? id }) });
    if (r.warn === 'short') msgs.push({ tone: 'error', text: t('{name} is short-circuited (more than 100 A).', { name: names.get(id) ?? id }) });
    if (r.warn === 'blown') msgs.push({ tone: 'error', text: t('{name} has blown.', { name: names.get(id) ?? id }) });
    if (r.warn === 'reverse') msgs.push({ tone: 'warning', text: t('{name} is reverse biased beyond 5 V — real LEDs break down here.', { name: names.get(id) ?? id }) });
  }
  if (!msgs.length) return null;
  return (
    <div className="mb-2 space-y-1">
      {msgs.map((m, i) => (
        <Notice key={i} tone={m.tone}>
          {m.text}
        </Notice>
      ))}
    </div>
  );
}

function Table() {
  const { result, circuit } = useCircuitSolution();
  const rows = circuit.components.filter((c) => c.kind !== 'ground');
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-white/[0.06] text-plant-500">
          {['Component', 'Type', 'Value', 'Voltage U', 'Current I', 'R = U/I', 'Power P', 'Details'].map((h) => (
            <th key={h} className="px-2 py-1 text-left font-normal">
              {t(h)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const r = result.comps.get(c.id)!;
          const multi = pinsOf(c).length !== 2;
          const Ropt = Math.abs(r.I) > 1e-12 ? si(r.V / r.I, 'Ω') : '∞';
          return (
            <tr key={c.id} className="border-b border-white/[0.03] font-mono">
              <td className="px-2 py-1 text-plant-100">{c.name}</td>
              <td className="px-2 py-1 font-sans text-plant-400">{t(KIND_LABEL[c.kind])}</td>
              <td className="px-2 py-1 text-plant-300">{valueLabel(c.kind, c.params)}</td>
              <td className="px-2 py-1 text-signal-vapor">{multi && c.kind !== 'probe' && c.kind !== 'logicOut' ? '–' : si(r.V, 'V', 4)}</td>
              <td className="px-2 py-1 text-signal-vapor">{multi ? '–' : si(r.I, 'A', 4)}</td>
              <td className="px-2 py-1 text-plant-300">{multi || ['vsource', 'isource', 'ammeter', 'battery', 'acsource'].includes(c.kind) ? '–' : Ropt}</td>
              <td className={cn('px-2 py-1', r.P < -1e-15 ? 'text-signal-ok' : 'text-plant-200')}>{si(r.P, 'W', 4)}</td>
              <td className="px-2 py-1 font-sans text-[10px]">
                {r.warn && <span className="mr-1 text-signal-alarm">{t(r.warn === 'overload' ? 'overload' : r.warn === 'short' ? 'short circuit' : r.warn === 'blown' ? 'blown' : 'reverse')}</span>}
                <span className="text-plant-400">{r.info ?? ''}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={8} className="px-2 pt-2 text-[10px] text-plant-500">
            {t('U and I use the passive sign convention from terminal a to b (+ terminal of sources); a negative power means the element delivers energy.')}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function Nodes() {
  const { result, circuit } = useCircuitSolution();
  const byNet = new Map<number, string[]>();
  for (const c of circuit.components) {
    for (const p of pinsOf(c)) {
      const n = result.netOf.get(`${c.id}:${p}`);
      if (n === undefined) continue;
      if (!byNet.has(n)) byNet.set(n, []);
      byNet.get(n)!.push(c.kind === 'ground' ? c.name : pinsOf(c).length === 2 ? `${c.name}.${p === 'a' ? (['vsource', 'battery'].includes(c.kind) ? '+' : '1') : ['vsource', 'battery'].includes(c.kind) ? '−' : '2'}` : `${c.name}.${p}`);
    }
  }
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-white/[0.06] text-plant-500">
          <th className="px-2 py-1 text-left font-normal">{t('Node')}</th>
          <th className="px-2 py-1 text-left font-normal">{t('Potential φ')}</th>
          <th className="px-2 py-1 text-left font-normal">{t('Connected terminals')}</th>
        </tr>
      </thead>
      <tbody>
        {[...byNet.keys()].sort((a, b) => a - b).map((n) => (
          <tr key={n} className="border-b border-white/[0.03]">
            <td className="px-2 py-1 font-mono text-plant-100">
              {n === result.ground ? `${n} (${t('ground')})` : n}
            </td>
            <td className="px-2 py-1 font-mono text-signal-vapor">{result.floating.includes(n) ? t('floating') : si(result.potentials[n]!, 'V', 5)}</td>
            <td className="px-2 py-1 text-plant-400">{byNet.get(n)!.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function System() {
  const { result, circuit } = useCircuitSolution();
  const sys = result.system;
  if (!sys || !sys.labels.length) return null;
  if (sys.labels.length > 14) return <Notice tone="info">{t('The system has {n} unknowns — too large to display.', { n: sys.labels.length })}</Notice>;
  const f = (v: number) => {
    if (Math.abs(v) < 1e-15) return '0';
    const s = Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3 ? v.toExponential(3).replace(/e([+-]?\d+)/, '\\cdot10^{$1}') : String(Number(v.toPrecision(5)));
    return comma() ? s.replace('.', '{,}') : s;
  };
  const lab = (l: string) => (l.startsWith('φ') ? `\\varphi_{${l.slice(1)}}` : `I_{\\text{${l.slice(2).replace(/[\\{}$&#%_^~]/g, '')}}}`);
  const M = `\\begin{pmatrix}${sys.G.map((r) => r.map(f).join(' & ')).join('\\\\')}\\end{pmatrix}`;
  const X = `\\begin{pmatrix}${sys.labels.map(lab).join('\\\\')}\\end{pmatrix}`;
  const B = `\\begin{pmatrix}${sys.rhs.map(f).join('\\\\')}\\end{pmatrix}`;
  const nonlinear = circuit.components.some((c) => c.kind === 'diode' || c.kind === 'led');
  return (
    <div className="space-y-2 text-plant-100">
      <p className="text-[11px] text-plant-400">
        {t('Modified nodal analysis: one Kirchhoff current equation per node (conductances in S), one equation per voltage source or ammeter (its current is an extra unknown).')}
      </p>
      <Tex math={`${M}\\,${X} = ${B}`} block />
      {nonlinear && <p className="text-[10px] text-plant-500">{t('Diodes appear linearised at the operating point: conductance g_D = dI/dU plus an equivalent current source (last Newton step).')}</p>}
      <p className="font-mono text-[10px] text-plant-400">
        {t('Solution')}:{' '}
        {[
          ...[...Array(result.nets).keys()].filter((n) => n !== result.ground).map((n) => `φ${n} = ${si(result.potentials[n]!, 'V', 5)}`),
          ...circuit.components.filter((c) => c.kind === 'vsource' || c.kind === 'ammeter' || c.kind === 'inductor').map((c) => `I_${c.name} = ${si(result.comps.get(c.id)!.I, 'A', 5)}`),
        ].join(' · ')}
      </p>
    </div>
  );
}

function Power() {
  const { result, circuit } = useCircuitSolution();
  const items = circuit.components.filter((c) => c.kind !== 'ground').map((c) => ({ c, r: result.comps.get(c.id)! }));
  const delivered = items.filter((i) => i.r.P < -1e-15);
  const absorbed = items.filter((i) => i.r.P > 1e-15);
  const sum = (a: typeof items) => a.reduce((s, i) => s + Math.abs(i.r.P), 0);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[
        { title: 'Delivered', list: delivered },
        { title: 'Absorbed', list: absorbed },
      ].map((g) => (
        <div key={g.title} className="rounded-md border border-white/[0.05] p-3">
          <p className="tag mb-2 text-plant-500">
            {t(g.title)} · {si(sum(g.list), 'W', 4)}
          </p>
          <ul className="space-y-0.5 font-mono text-[11px]">
            {g.list.map(({ c, r }) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-plant-200">
                  {c.name} <span className="font-sans text-plant-500">{t(KIND_LABEL[c.kind])}</span>
                </span>
                <span className="text-plant-100">{si(Math.abs(r.P), 'W', 4)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-plant-400 md:col-span-2">
        {t('Check: delivered − absorbed = {d}; largest Kirchhoff current residual {k}.', { d: si(-result.powerBalance, 'W', 3), k: si(result.kclResidual, 'A', 2) })}
      </p>
      <p className="text-[10px] text-plant-500 md:col-span-2">
        {circuit.components.some((c) => c.kind === 'lamp') && t('Lamps: R = U²/P = {r} for the first lamp.', { r: si(lampR(circuit.components.find((c) => c.kind === 'lamp')!.params), 'Ω') })}{' '}
        {circuit.components.some((c) => c.kind === 'diode' || c.kind === 'led') &&
          t('Diode model: I = I_S·(e^(U/(n·U_T)) − 1), U_T = 25.85 mV; first diode I_S = {is}, n = {n}.', {
            is: si(diodeParams(circuit.components.find((c) => c.kind === 'diode' || c.kind === 'led')!).Is, 'A'),
            n: diodeParams(circuit.components.find((c) => c.kind === 'diode' || c.kind === 'led')!).n.toFixed(2),
          })}
      </p>
    </div>
  );
}
