/** Unit conversion: each unit is a factor to the SI unit of its quantity (temperatures: offset too). */

export interface Unit {
  id: string;
  label: string;
  /** value_SI = value · factor + offset */
  factor: number;
  offset?: number;
}
export interface Quantity {
  id: string;
  label: string;
  units: Unit[];
}

const u = (id: string, factor: number, label = id, offset = 0): Unit => ({ id, label, factor, offset });

export const QUANTITIES: Quantity[] = [
  { id: 'length', label: 'Length', units: [u('m', 1), u('km', 1e3), u('cm', 1e-2), u('mm', 1e-3), u('µm', 1e-6), u('in', 0.0254), u('ft', 0.3048), u('mi', 1609.344)] },
  { id: 'area', label: 'Area', units: [u('m²', 1), u('cm²', 1e-4), u('mm²', 1e-6), u('km²', 1e6), u('ha', 1e4), u('in²', 0.0254 ** 2), u('ft²', 0.3048 ** 2)] },
  { id: 'volume', label: 'Volume', units: [u('m³', 1), u('L', 1e-3), u('mL', 1e-6), u('cm³', 1e-6), u('ft³', 0.3048 ** 3), u('gal (US)', 3.785411784e-3)] },
  { id: 'mass', label: 'Mass', units: [u('kg', 1), u('g', 1e-3), u('mg', 1e-6), u('t', 1e3), u('lb', 0.45359237)] },
  { id: 'time', label: 'Time', units: [u('s', 1), u('ms', 1e-3), u('min', 60), u('h', 3600), u('d', 86400)] },
  { id: 'temperature', label: 'Temperature', units: [u('K', 1), u('°C', 1, '°C', 273.15), u('°F', 5 / 9, '°F', 273.15 - (32 * 5) / 9)] },
  { id: 'tempdiff', label: 'Temperature difference', units: [u('K', 1), u('°C (difference)', 1), u('°F (difference)', 5 / 9)] },
  { id: 'pressure', label: 'Pressure', units: [u('Pa', 1), u('kPa', 1e3), u('MPa', 1e6), u('bar', 1e5), u('mbar', 1e2), u('atm', 101325), u('Torr (mmHg)', 101325 / 760), u('psi', 6894.757293168), u('mWS (mH₂O)', 9806.65)] },
  { id: 'energy', label: 'Energy', units: [u('J', 1), u('kJ', 1e3), u('MJ', 1e6), u('Wh', 3600), u('kWh', 3.6e6), u('cal', 4.184), u('kcal', 4184), u('eV', 1.602176634e-19), u('BTU', 1055.05585)] },
  { id: 'power', label: 'Power / heat flow', units: [u('W', 1), u('kW', 1e3), u('MW', 1e6), u('PS', 735.49875), u('hp', 745.6998716), u('kJ/h', 1e3 / 3600), u('kcal/h', 4184 / 3600), u('BTU/h', 1055.05585 / 3600)] },
  { id: 'force', label: 'Force', units: [u('N', 1), u('kN', 1e3), u('MN', 1e6), u('kp', 9.80665), u('lbf', 4.4482216152605)] },
  { id: 'stress', label: 'Stress / modulus', units: [u('Pa', 1), u('N/mm² (MPa)', 1e6), u('GPa', 1e9), u('kN/cm²', 1e7), u('psi', 6894.757293168)] },
  { id: 'torque', label: 'Torque / moment', units: [u('N·m', 1), u('kN·m', 1e3), u('N·mm', 1e-3), u('lbf·ft', 1.3558179483314)] },
  { id: 'velocity', label: 'Velocity', units: [u('m/s', 1), u('km/h', 1 / 3.6), u('cm/s', 1e-2), u('mph', 0.44704), u('kn', 1852 / 3600)] },
  { id: 'vflow', label: 'Volume flow', units: [u('m³/s', 1), u('m³/h', 1 / 3600), u('L/s', 1e-3), u('L/min', 1e-3 / 60), u('L/h', 1e-3 / 3600)] },
  { id: 'mflow', label: 'Mass flow', units: [u('kg/s', 1), u('kg/h', 1 / 3600), u('t/h', 1e3 / 3600), u('g/s', 1e-3)] },
  { id: 'nflow', label: 'Molar flow', units: [u('mol/s', 1), u('kmol/h', 1e3 / 3600), u('kmol/s', 1e3), u('mol/h', 1 / 3600)] },
  { id: 'density', label: 'Density', units: [u('kg/m³', 1), u('g/cm³', 1e3), u('kg/L', 1e3), u('lb/ft³', 16.01846337)] },
  { id: 'dynvisc', label: 'Dynamic viscosity', units: [u('Pa·s', 1), u('mPa·s', 1e-3), u('cP', 1e-3), u('P', 0.1)] },
  { id: 'kinvisc', label: 'Kinematic viscosity / diffusivity', units: [u('m²/s', 1), u('mm²/s (cSt)', 1e-6), u('cm²/s', 1e-4), u('St', 1e-4)] },
  { id: 'lambda', label: 'Thermal conductivity', units: [u('W/(m·K)', 1), u('kW/(m·K)', 1e3), u('mW/(m·K)', 1e-3), u('kcal/(m·h·K)', 4184 / 3600), u('BTU/(h·ft·°F)', 1.730734666)] },
  { id: 'alpha', label: 'Heat transfer coefficient', units: [u('W/(m²·K)', 1), u('kW/(m²·K)', 1e3), u('kcal/(m²·h·K)', 4184 / 3600), u('BTU/(h·ft²·°F)', 5.678263341)] },
  { id: 'cp', label: 'Specific heat capacity', units: [u('J/(kg·K)', 1), u('kJ/(kg·K)', 1e3), u('kcal/(kg·K)', 4184), u('BTU/(lb·°F)', 4186.8)] },
  { id: 'angle', label: 'Angle', units: [u('rad', 1), u('°', Math.PI / 180), u('gon', Math.PI / 200), u('rev', 2 * Math.PI)] },
  { id: 'freq', label: 'Frequency / angular velocity', units: [u('Hz', 1), u('kHz', 1e3), u('MHz', 1e6), u('1/min (rpm)', 1 / 60), u('rad/s (ω)', 1 / (2 * Math.PI))] },
];

export function convert(value: number, from: Unit, to: Unit): number {
  const si = value * from.factor + (from.offset ?? 0);
  return (si - (to.offset ?? 0)) / to.factor;
}
