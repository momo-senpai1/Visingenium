import { Moon, Sun } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const FlowsheetStatus = lazy(() => import('@/components/FlowsheetStatus'));
import { cn } from '@/lib/utils';
import { AnimControls } from '@/components/bg/AnimControls';
import { navigate, SECTION_OF, type Route, type Section } from '@/lib/route';
import { useTheme } from '@/lib/theme';
import { LANGS, t, useLang } from '@/i18n';

type NavItem = { route: Route; label: string };
type NavGroup = { label: string; items: NavItem[] };
const NAV: Record<Section, (NavItem | NavGroup)[]> = {
  thermal: [
    { route: 'flowsheet', label: 'Flowsheet' },
    {
      label: 'Distillation',
      items: [
        { route: 'mccabe-thiele', label: 'McCabe–Thiele' },
        { route: 'batch', label: 'Batch distillation' },
        { route: 'distillation-lines', label: 'Distillation lines' },
      ],
    },
    { route: 'extraction', label: 'Extraction' },
    { route: 'absorption', label: 'Absorption' },
    { route: 'evaporation', label: 'Evaporation' },
    { route: 'crystallization', label: 'Crystallization' },
    { route: 'drying', label: 'Drying' },
  ],
  heat: [
    { route: 'conduction', label: 'Conduction' },
    { route: 'fin', label: 'Fin / rod' },
    { route: 'transient', label: 'Transient' },
    { route: 'convection', label: 'Convection' },
    { route: 'radiation', label: 'Radiation' },
    { route: 'exchanger', label: 'Heat exchanger' },
    { route: 'diffusion', label: 'Mass transfer' },
  ],
  circuits: [
    { route: 'circuits', label: 'Circuit simulator' },
    {
      label: 'DC basics',
      items: [
        { route: 'ee-ohm', label: 'Ohm & Kirchhoff' },
        { route: 'ee-divider', label: 'Divider & bridge' },
        { route: 'ee-rc', label: 'RC & RL switching' },
      ],
    },
    {
      label: 'AC',
      items: [
        { route: 'ee-phasor', label: 'AC & phasors' },
        { route: 'ee-rlc', label: 'Resonant circuit' },
        { route: 'ee-power', label: 'AC power' },
        { route: 'ee-3phase', label: 'Three-phase' },
        { route: 'ee-transformer', label: 'Transformer' },
      ],
    },
    {
      label: 'Electronics & machines',
      items: [
        { route: 'ee-diode', label: 'Diode & rectifier' },
        { route: 'ee-transistor', label: 'Transistor' },
        { route: 'ee-motor', label: 'Induction motor' },
      ],
    },
  ],
  mechanics: [
    {
      label: 'TM 1 · Statics',
      items: [
        { route: 'mech-forces', label: 'Force systems' },
        { route: 'beam', label: 'Beam' },
        { route: 'truss', label: 'Truss' },
        { route: 'mech-centroid', label: 'Centroid & area moments' },
        { route: 'mech-friction', label: 'Friction' },
        { route: 'mech-virtual-work', label: 'Virtual work' },
      ],
    },
    {
      label: 'TM 2 · Strength of materials',
      items: [
        { route: 'mech-stress', label: "Stress & Mohr's circle" },
        { route: 'mech-bar', label: 'Tension & compression' },
        { route: 'torsion', label: 'Shaft & torsion' },
        { route: 'mech-thinwalled', label: 'Thin-walled profiles' },
        { route: 'mech-energy', label: 'Energy methods' },
        { route: 'mech-buckling', label: 'Buckling' },
      ],
    },
    {
      label: 'TM 3 · Dynamics',
      items: [
        { route: 'mech-kinematics', label: 'Particle kinematics' },
        { route: 'mech-rigid', label: 'Rigid-body kinematics' },
        { route: 'mech-kinetics', label: 'Kinetics & rolling' },
        { route: 'mech-impact', label: 'Impact' },
        { route: 'mech-vibration', label: 'Vibrations' },
      ],
    },
  ],
  control: [
    { route: 'control-sim', label: 'Simulator' },
    { route: 'control', label: 'Control loop' },
    { route: 'bode', label: 'Bode diagram' },
    { route: 'filters', label: 'Filters' },
    { route: 'kalman', label: 'Kalman filter' },
    { route: 'fourier', label: 'Fourier / FFT' },
  ],
  thermo: [
    { route: 'cycles', label: 'Cycles (T,s / p,v)' },
    { route: 'realgas', label: 'Real gases' },
    { route: 'mixtures', label: 'Mixtures' },
    { route: 'humidair', label: 'Humid air (h,x)' },
  ],
  fluid: [{ route: 'pipe', label: 'Pipe flow & Bernoulli' }],
  tools: [
    { route: 'pilot-plant', label: 'Pilot plant' },
    { route: 'formulas', label: 'Formula collection' },
    { route: 'units', label: 'Unit converter' },
  ],
};

export const SECTIONS: { id: Section; label: string; home: Route }[] = [
  { id: 'thermal', label: 'Thermal Separation', home: 'flowsheet' },
  { id: 'heat', label: 'Heat & Mass Transfer', home: 'conduction' },
  { id: 'circuits', label: 'Electrical Circuits', home: 'circuits' },
  { id: 'mechanics', label: 'Mechanics', home: 'mech-forces' },
  { id: 'control', label: 'Control Engineering', home: 'control-sim' },
  { id: 'thermo', label: 'Thermodynamics', home: 'cycles' },
  { id: 'fluid', label: 'Fluid Mechanics', home: 'pipe' },
  { id: 'tools', label: 'Tools', home: 'pilot-plant' },
];

const tab = (active: boolean) =>
  cn(
    'whitespace-nowrap rounded px-2.5 py-1 text-[11px] transition-colors',
    active
      ? 'bg-signal-liquid/15 text-signal-liquid shadow-[inset_0_0_0_1px_rgb(var(--sig-liquid)/0.35)]'
      : 'text-plant-300 hover:bg-white/[0.04] hover:text-plant-100',
  );

/** Dropdown state: closes on a click outside or Escape (not on mouse-leave, which fired in the gap below the button). */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as globalThis.Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Group({ g, route }: { g: NavGroup; route: Route }) {
  const { open, setOpen, ref } = useDropdown();
  const active = g.items.find((i) => i.route === route);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={tab(!!active)}>
        {active ? `${t(g.label)} · ${t(active.label)}` : t(g.label)} ▾
      </button>
      {open && (
        <div role="menu" className="glass absolute left-0 top-full z-50 mt-1 shadow-lg min-w-[190px] !bg-plant-900/95 p-1">
          {g.items.map((i) => (
            <button
              key={i.route}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(i.route);
              }}
              className={cn('block w-full rounded px-2.5 py-1.5 text-left text-[11px]', i.route === route ? 'text-signal-liquid' : 'text-plant-200 hover:bg-white/[0.05]')}
            >
              {t(i.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppHeader({ route }: { route: Route }) {
  const section = SECTION_OF(route);
  return (
    <header className="glass relative z-30 flex h-11 shrink-0 items-center gap-4 px-4">
      <button type="button" onClick={() => navigate('home')} className="flex items-center gap-2.5" aria-label={t('Visingenium — home')}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-7 w-auto dark:brightness-[1.9] dark:saturate-[1.15]" draggable={false} />
        <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-plant-100">Visingenium</span>
      </button>
      {section && <SectionMenu section={section} />}
      <nav aria-label={t('Modules')} className="flex min-w-0 items-center gap-0.5">
        {section &&
          NAV[section].map((n) =>
            'items' in n ? (
              <Group key={n.label} g={n} route={route} />
            ) : (
              <button key={n.route} type="button" onClick={() => navigate(n.route)} aria-current={route === n.route ? 'page' : undefined} className={tab(route === n.route)}>
                {t(n.label)}
              </button>
            ),
          )}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        {route === 'flowsheet' && (
          <Suspense fallback={null}>
            <FlowsheetStatus />
          </Suspense>
        )}
        <AnimControls />
        <LangSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Section chooser: Thermal Separation / Electrical Circuits / Mechanics. */
function SectionMenu({ section }: { section: Section }) {
  const { open, setOpen, ref } = useDropdown();
  const cur = SECTIONS.find((s) => s.id === section)!;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Section')}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-200 hover:border-signal-liquid/40"
      >
        <span className="text-plant-500">/</span> {t(cur.label)} ▾
      </button>
      {open && (
        <div role="menu" className="glass absolute left-0 top-full z-50 mt-1 shadow-lg min-w-[200px] !bg-plant-900/95 p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(s.home);
              }}
              className={cn('block w-full rounded px-2.5 py-1.5 text-left text-[11px]', s.id === section ? 'text-signal-liquid' : 'text-plant-200 hover:bg-white/[0.05]')}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LangSwitch() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  return (
    <div role="group" aria-label={t('Language')} className="flex rounded border border-white/[0.08] p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          title={l.name}
          aria-pressed={lang === l.id}
          onClick={() => setLang(l.id)}
          className={cn(
            'rounded-sm px-1.5 py-0.5 font-mono text-[10px] transition-colors',
            lang === l.id ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-400 hover:text-plant-100',
          )}
        >
          {l.label}
          {l.beta && <sup className="ml-px text-[7px] text-signal-heat">β</sup>}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
      title={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
      className="grid h-7 w-7 place-items-center rounded border border-white/[0.08] text-plant-300 transition-colors hover:border-signal-liquid/40 hover:text-signal-liquid"
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

