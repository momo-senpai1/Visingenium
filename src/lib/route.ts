import { useEffect, useState } from 'react';

export type Route =
  | 'home'
  | 'privacy'
  | 'formulas'
  | 'cycles'
  | 'steam'
  | 'realgas'
  | 'mixtures'
  | 'humidair'
  | 'pipe'
  | 'units'
  | 'flowsheet'
  | 'mccabe-thiele'
  | 'batch'
  | 'distillation-lines'
  | 'extraction'
  | 'absorption'
  | 'evaporation'
  | 'crystallization'
  | 'drying'
  | 'circuits'
  | 'ee-ohm'
  | 'ee-divider'
  | 'ee-rc'
  | 'ee-phasor'
  | 'ee-rlc'
  | 'ee-power'
  | 'ee-3phase'
  | 'ee-transformer'
  | 'ee-diode'
  | 'ee-transistor'
  | 'ee-motor'
  | 'beam'
  | 'truss'
  | 'torsion'
  | 'mech-forces'
  | 'mech-friction'
  | 'mech-centroid'
  | 'mech-virtual-work'
  | 'mech-stress'
  | 'mech-bar'
  | 'mech-thinwalled'
  | 'mech-energy'
  | 'mech-buckling'
  | 'mech-kinematics'
  | 'mech-rigid'
  | 'mech-kinetics'
  | 'mech-impact'
  | 'mech-vibration'
  | 'conduction'
  | 'fin'
  | 'transient'
  | 'convection'
  | 'radiation'
  | 'exchanger'
  | 'diffusion'
  | 'control-sim'
  | 'control'
  | 'bode'
  | 'filters'
  | 'kalman'
  | 'fourier';
const ROUTES: readonly Route[] = ['home', 'privacy', 'formulas', 'units', 'cycles', 'steam', 'realgas', 'mixtures', 'humidair', 'pipe', 'flowsheet', 'mccabe-thiele', 'batch', 'distillation-lines', 'extraction', 'absorption', 'evaporation', 'crystallization', 'drying', 'circuits', 'ee-ohm', 'ee-divider', 'ee-rc', 'ee-phasor', 'ee-rlc', 'ee-power', 'ee-3phase', 'ee-transformer', 'ee-diode', 'ee-transistor', 'ee-motor', 'beam', 'truss', 'torsion', 'mech-forces', 'mech-friction', 'mech-centroid', 'mech-virtual-work', 'mech-stress', 'mech-bar', 'mech-thinwalled', 'mech-energy', 'mech-buckling', 'mech-kinematics', 'mech-rigid', 'mech-kinetics', 'mech-impact', 'mech-vibration', 'conduction', 'fin', 'transient', 'convection', 'radiation', 'exchanger', 'diffusion', 'control-sim', 'control', 'bode', 'filters', 'kalman', 'fourier'];

/** electrical-engineering explainer pages (section 'circuits') */
export const EE_ROUTES: readonly Route[] = ['ee-ohm', 'ee-divider', 'ee-rc', 'ee-phasor', 'ee-rlc', 'ee-power', 'ee-3phase', 'ee-transformer', 'ee-diode', 'ee-transistor', 'ee-motor'];

/** Engineering Mechanics 1–3 explainer pages (section 'mechanics') */
export const MECH_ROUTES: readonly Route[] = ['mech-forces', 'mech-friction', 'mech-centroid', 'mech-virtual-work', 'mech-stress', 'mech-bar', 'mech-thinwalled', 'mech-energy', 'mech-buckling', 'mech-kinematics', 'mech-rigid', 'mech-kinetics', 'mech-impact', 'mech-vibration'];

export type Section = 'thermal' | 'heat' | 'circuits' | 'mechanics' | 'control' | 'tools' | 'thermo' | 'fluid';
const THERMO: readonly Route[] = ['cycles', 'steam', 'realgas', 'mixtures', 'humidair'];
const CONTROL: readonly Route[] = ['control-sim', 'control', 'bode', 'filters', 'kalman', 'fourier'];
const HEAT: readonly Route[] = ['conduction', 'fin', 'transient', 'convection', 'radiation', 'exchanger', 'diffusion'];
export const SECTION_OF = (r: Route): Section | null =>
  r === 'home' || r === 'privacy' ? null : r === 'formulas' || r === 'units' ? 'tools' : THERMO.includes(r) ? 'thermo' : r === 'pipe' ? 'fluid' : CONTROL.includes(r) ? 'control' : HEAT.includes(r) ? 'heat' : r === 'circuits' || EE_ROUTES.includes(r) ? 'circuits' : r === 'beam' || r === 'truss' || r === 'torsion' || MECH_ROUTES.includes(r) ? 'mechanics' : 'thermal';

function parse(): { route: Route; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path = '', query = ''] = raw.split('?');
  const route = (ROUTES as readonly string[]).includes(path) ? (path as Route) : 'home';
  return { route, params: new URLSearchParams(query) };
}

/** Hash-based routing: works on static hosting (GitHub Pages) without rewrites. */
export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => setState(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}

export function navigate(route: Route, params?: Record<string, string | number>) {
  const q = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
  window.location.hash = `/${route}${q}`;
}

/** Read a numeric query parameter with a fallback. */
export const num = (p: URLSearchParams, key: string, fallback: number) => {
  const v = Number(p.get(key));
  return p.has(key) && Number.isFinite(v) ? v : fallback;
};
