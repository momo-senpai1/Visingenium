import animate from 'tailwindcss-animate';

/** Theme-aware colour from a CSS variable holding an RGB triplet. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;


/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        // Control-room signal palette
        plant: Object.fromEntries([950, 900, 850, 800, 700, 600, 500, 400, 300, 200, 100].map((k) => [k, v(`plant-${k}`)])),
        signal: { liquid: v('sig-liquid'), vapor: v('sig-vapor'), heat: v('sig-heat'), alarm: v('sig-alarm'), ok: v('sig-ok') },
        // flips to dark ink in light mode, so white/[x] overlays and hairlines work in both themes
        white: v('white'),
      },
      borderRadius: {
        lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
      },
      boxShadow: {
        glass: '0 0 0 1px rgba(148,163,184,0.08), 0 12px 40px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
        glow: '0 0 0 1px rgba(45,212,191,0.5), 0 0 24px -4px rgba(45,212,191,0.45)',
      },
      keyframes: {
        flow: { to: { strokeDashoffset: '-24' } },
      },
      animation: { flow: 'flow 1.2s linear infinite' },
    },
  },
  plugins: [animate],
};
