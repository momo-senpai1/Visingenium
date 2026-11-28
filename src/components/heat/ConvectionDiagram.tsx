import { useEffect, useRef } from 'react';
import type { Case } from '@/engine/heat/convection';
import { t } from '@/i18n';

interface Props {
  kind: Case;
  /** wall and fluid temperature [°C] */
  Tw: number;
  Tf: number;
  /** free-stream velocity [m/s] (forced cases) */
  u: number;
  Re: number;
  Ra: number;
  /** boundary-layer thickness at the end of the plate [mm] */
  deltaEnd?: number;
}

interface P {
  x: number;
  y: number;
  /** 0..1 temperature fraction (0 = fluid, 1 = wall) */
  th: number;
  seed: number;
}

const H = 270;
const N = 380;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = Math.random;

/** the flow field of every case: moves particle p by dt and returns false when it left the picture */
type Sim = { W: number; hot: boolean; u: number; Re: number; Ra: number };

export function ConvectionDiagram(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pr = useRef(props);
  pr.current = props;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let W = 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      W = Math.max(280, cv.clientWidth);
      cv.width = W * dpr;
      cv.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const kind0 = pr.current.kind;
    const ps: P[] = Array.from({ length: N }, () => ({ x: rnd() * 800, y: rnd() * H, th: 0, seed: rnd() }));
    let raf = 0;
    let last = performance.now();

    // ---- geometry of the cases
    const plateX0 = 40;
    const wallY = H - 40;
    const pipeTop = 44;
    const pipeBot = H - 44;
    const cylR = () => clamp(H * 0.15, 20, 40);

    /** boundary-layer thickness in px along the plate; laminar √x, turbulent x^0.8 after the transition */
    const plateDelta = (xn: number, turb: boolean, dmax: number) => {
      const xc = turb ? clamp(5e5 / Math.max(pr.current.Re, 1), 0.15, 0.9) : 2;
      const f = (x: number) => (x <= xc ? Math.sqrt(x) : Math.sqrt(xc) * 1.25 * (x / xc) ** 0.8);
      return (dmax * f(clamp(xn, 0, 1))) / f(1);
    };

    const respawn = (p: P, s: Sim, first: boolean) => {
      const k = kind0;
      if (k === 'plate') {
        p.x = first ? plateX0 + rnd() * (s.W - 80) : plateX0 - 5;
        p.y = wallY - 2 - rnd() * (H * 0.62);
      } else if (k === 'pipe') {
        p.x = first ? rnd() * s.W : 10;
        p.y = pipeTop + 2 + rnd() * (pipeBot - pipeTop - 4);
      } else if (k === 'cylinder') {
        p.x = first ? rnd() * s.W : -5;
        p.y = H / 2 + (rnd() - 0.5) * H * 0.9;
      } else if (k === 'freePlate') {
        // most of the fluid that the plate entrains starts close to it
        p.x = 72 + Math.min(s.W - 90, -Math.log(1 - rnd() * 0.98) * 60);
        p.y = first ? 10 + rnd() * (H - 20) : s.hot ? H - 12 : 12;
      } else {
        const cx = s.W / 2;
        const cy = H * 0.52;
        if (rnd() < 0.45) {
          const a = rnd() * Math.PI * 2;
          const rr = cylR() * 1.05 * (1.05 + rnd() * 0.35);
          p.x = cx + Math.cos(a) * rr;
          p.y = cy + Math.sin(a) * rr;
        } else {
          p.x = cx + (rnd() - 0.5) * s.W * 0.8;
          p.y = first ? 10 + rnd() * (H - 20) : s.hot ? H - 8 : 8;
        }
      }
    };
    ps.forEach((p) => respawn(p, { W, hot: true, u: 1, Re: 1, Ra: 1 }, true));

    const speedPx = (u: number) => 55 + 40 * Math.log10(1 + u * 3);

    const step = (p: P, dt: number, s: Sim) => {
      const k = kind0;
      const d = s.hot ? -1 : 1; // buoyant direction on screen (hot: up)
      if (k === 'plate') {
        const U = speedPx(s.u);
        const turb = s.Re > 5e5;
        const dm = Math.min(95, H * 0.36);
        const xn = (p.x - plateX0) / (s.W - 80);
        const dl = Math.max(2, plateDelta(xn, turb, dm));
        const yy = wallY - p.y;
        const eta = clamp(yy / dl, 0, 1);
        const prof = yy >= dl ? 1 : turb && xn > 5e5 / Math.max(s.Re, 1) ? eta ** (1 / 7) : Math.sin((Math.PI / 2) * eta);
        p.x += U * (0.06 + 0.94 * prof) * dt;
        if (yy < dl && turb && xn > 5e5 / Math.max(s.Re, 1)) p.y += (rnd() - 0.5) * 70 * dt;
        p.th = yy >= dl ? 0 : (1 - eta) ** 2;
        if (p.y > wallY - 1) p.y = wallY - 1 - rnd() * 3;
        return p.x < s.W - 10;
      }
      if (k === 'pipe') {
        const R = (pipeBot - pipeTop) / 2;
        const rr = clamp(Math.abs(p.y - (pipeTop + R)) / R, 0, 1);
        const turb = s.Re > 3000;
        const prof = turb ? (1 - rr) ** (1 / 7) * 1.12 : 2 * (1 - rr * rr) * 0.6;
        p.x += speedPx(s.u) * (0.05 + prof) * dt;
        if (turb) p.y += (rnd() - 0.5) * 90 * dt * (0.3 + rr);
        p.y = clamp(p.y, pipeTop + 1, pipeBot - 1);
        const xn = p.x / s.W;
        const dT = R * (0.08 + 0.9 * xn * (turb ? 1.4 : 0.8));
        p.th = Math.exp(-(1 - rr) * R / dT);
        return p.x < s.W - 6;
      }
      if (k === 'cylinder') {
        const R = cylR();
        const cx = s.W * 0.36;
        const cy = H / 2;
        const U = speedPx(s.u) * 1.1;
        const rx = p.x - cx;
        const ry = p.y - cy;
        const r2 = rx * rx + ry * ry;
        if (r2 < R * R * 1.02) return false;
        const R2 = R * R;
        // potential flow around the cylinder, damped and jittered in the wake
        let vx = U * (1 - (R2 * (rx * rx - ry * ry)) / (r2 * r2));
        let vy = U * ((-2 * R2 * rx * ry) / (r2 * r2));
        const wake = s.Re > 2e5 ? 0.55 : 1.05; // supercritical: narrower wake
        const inWake = rx > 0 && Math.abs(ry) < R * wake + rx * 0.16 && rx < R * 7;
        if (inWake) {
          vx *= 0.32 + 0.4 * (rx / (R * 7));
          vy += (rnd() - 0.5) * 120;
        }
        p.x += vx * dt;
        p.y += vy * dt;
        const dist = Math.sqrt(r2) - R;
        p.th = inWake ? 0.5 * Math.exp(-rx / (R * 5)) + 0.25 : Math.exp(-dist / (R * 0.45)) * (rx < 0 ? 0.8 : 0.5);
        return p.x < s.W + 8 && Math.abs(p.y - cy) < H;
      }
      if (k === 'freePlate') {
        const wx = 70;
        const dist = p.x - wx;
        const h = s.hot ? H - 12 - p.y : p.y - 12; // height above the leading edge
        const turb = s.Ra > 1e9;
        const dl = Math.max(5, Math.min(70, 8 + 62 * clamp(h / (H - 24), 0, 1) ** (turb ? 0.8 : 0.25)));
        const eta = dist / dl;
        if (eta < 1) {
          const v = 6.75 * eta * (1 - eta) ** 2; // 0 at wall and edge, 1 at η = 1/3
          p.y += d * (22 + 105 * v) * dt;
          if (turb && h > (H - 24) * 0.55) p.x += (rnd() - 0.45) * 60 * dt;
          p.th = (1 - eta) ** 2;
        } else {
          p.x -= (10 + 14 * rnd()) * dt; // entrainment towards the plate
          p.y += d * 3 * dt;
          p.th = 0;
        }
        if (p.x < wx + 1) p.x = wx + 1 + rnd() * 3;
        return p.y > 4 && p.y < H - 4;
      }
      // free convection at a horizontal cylinder
      const R = cylR() * 1.05;
      const cx = s.W / 2;
      const cy = H * 0.52;
      const rx = p.x - cx;
      const ry = p.y - cy;
      const r = Math.hypot(rx, ry);
      if (r < R) return false;
      // tangent that leads to the top (hot) or bottom (cold)
      const tx = (-ry / r) * Math.sign(rx || 1) * -1;
      const ty = (rx / r) * Math.sign(rx || 1) * -1;
      const toTop = s.hot ? (ty < 0 ? 1 : -1) : ty > 0 ? 1 : -1;
      if (r < R * 1.5) {
        const near = Math.exp(-(r - R) / (R * 0.3));
        p.x += tx * toTop * 70 * near * dt;
        p.y += ty * toTop * 70 * near * dt + d * 38 * dt;
        p.th = near;
      } else {
        // plume above the cylinder, inflow from the sides below
        const above = s.hot ? cy - p.y : p.y - cy;
        const pl = Math.exp(-(rx * rx) / (2 * (R * 0.6 + Math.max(0, above) * 0.12) ** 2));
        p.y += d * (22 + 95 * pl * (above > 0 ? 1 : 0.4)) * dt;
        p.x += -rx * 0.45 * dt * (above > -R ? 1 : 0.2);
        p.th = above > 0 ? 0.85 * pl * Math.exp(-above / (H * 0.55)) : 0;
      }
      return p.y > 3 && p.y < H - 3 && Math.abs(rx) < s.W / 2 + 10;
    };

    // ---- drawing
    const colWall = (hot: boolean): [number, number, number] => (hot ? [239, 68, 68] : [59, 130, 246]);
    const colFluid = (hot: boolean): [number, number, number] => (hot ? [96, 165, 250] : [251, 146, 60]);
    const mix = (a: number[], b: number[], f: number) => `rgb(${Math.round(a[0]! + (b[0]! - a[0]!) * f)},${Math.round(a[1]! + (b[1]! - a[1]!) * f)},${Math.round(a[2]! + (b[2]! - a[2]!) * f)})`;

    const arrowH = (x: number, y: number, len: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + len + 5, y);
      ctx.lineTo(x + len - 1, y - 3);
      ctx.lineTo(x + len - 1, y + 3);
      ctx.fill();
    };

    const drawStatic = (s: Sim) => {
      const wc = colWall(s.hot);
      const wallCol = `rgb(${wc.join(',')})`;
      const k = kind0;
      if (k === 'plate') {
        const turb = s.Re > 5e5;
        const dm = Math.min(95, H * 0.36);
        const L = s.W - 80;
        // thermal layer as a glow on the wall
        const g = ctx.createLinearGradient(0, wallY, 0, wallY - dm);
        g.addColorStop(0, `rgba(${wc.join(',')},0.38)`);
        g.addColorStop(1, `rgba(${wc.join(',')},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(plateX0, wallY);
        for (let i = 0; i <= 60; i++) ctx.lineTo(plateX0 + (i / 60) * L, wallY - plateDelta(i / 60, turb, dm));
        ctx.lineTo(plateX0 + L, wallY);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.8)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const x = plateX0 + (i / 60) * L;
          const y = wallY - plateDelta(i / 60, turb, dm);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = wallCol;
        ctx.fillRect(plateX0 - 10, wallY, L + 20, 12);
        // velocity profile at three stations
        for (const xn of [0.25, 0.6, 0.95]) {
          const x = plateX0 + xn * L;
          const dl = plateDelta(xn, turb, dm);
          for (let j = 1; j <= 7; j++) {
            const yy = (j / 7) * (dl + 14);
            const eta = clamp(yy / dl, 0, 1);
            const f = yy >= dl ? 1 : turb && xn > 5e5 / Math.max(s.Re, 1) ? eta ** (1 / 7) : Math.sin((Math.PI / 2) * eta);
            arrowH(x, wallY - yy, 4 + 28 * f, 'rgba(100,116,139,0.85)');
          }
        }
      } else if (k === 'pipe') {
        const R = (pipeBot - pipeTop) / 2;
        for (const y of [pipeTop - 12, pipeBot]) {
          ctx.fillStyle = wallCol;
          ctx.fillRect(0, y, s.W, 12);
        }
        const turb = s.Re > 3000;
        for (const xn of [0.2, 0.55, 0.9]) {
          const x = xn * s.W;
          for (let j = 1; j <= 9; j++) {
            const rr = Math.abs(j / 5 - 1);
            const f = turb ? (1 - rr) ** (1 / 7) * 1.12 : 2 * (1 - rr * rr) * 0.6;
            arrowH(x, pipeTop + (j / 10) * 2 * R, 4 + 30 * f, 'rgba(100,116,139,0.85)');
          }
        }
      } else if (k === 'cylinder') {
        const R = cylR();
        const cx = s.W * 0.36;
        ctx.fillStyle = wallCol;
        ctx.beginPath();
        ctx.arc(cx, H / 2, R, 0, Math.PI * 2);
        ctx.fill();
      } else if (k === 'freePlate') {
        const wx = 70;
        const turb = s.Ra > 1e9;
        const gl = ctx.createLinearGradient(wx, 0, wx + 72, 0);
        gl.addColorStop(0, `rgba(${wc.join(',')},0.4)`);
        gl.addColorStop(1, `rgba(${wc.join(',')},0)`);
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.moveTo(wx, s.hot ? H - 12 : 12);
        for (let i = 0; i <= 50; i++) {
          const f = i / 50;
          ctx.lineTo(wx + Math.max(5, Math.min(70, 8 + 62 * f ** (turb ? 0.8 : 0.25))), s.hot ? H - 12 - f * (H - 24) : 12 + f * (H - 24));
        }
        ctx.lineTo(wx, s.hot ? 12 : H - 12);
        ctx.fill();
        ctx.fillStyle = wallCol;
        ctx.fillRect(wx - 14, 8, 14, H - 16);
        ctx.strokeStyle = 'rgba(148,163,184,0.8)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 50; i++) {
          const f = i / 50;
          const y = s.hot ? H - 12 - f * (H - 24) : 12 + f * (H - 24);
          const dl = Math.max(5, Math.min(70, 8 + 62 * f ** (turb ? 0.8 : 0.25)));
          if (i === 0) ctx.moveTo(wx + dl, y);
          else ctx.lineTo(wx + dl, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const R = cylR() * 1.05;
        const cy = H * 0.52;
        const dir = s.hot ? -1 : 1;
        // thermal halo and the plume above (hot) or below (cold) the cylinder
        const halo = ctx.createRadialGradient(s.W / 2, cy, R, s.W / 2, cy, R * 2.4);
        halo.addColorStop(0, `rgba(${wc.join(',')},0.4)`);
        halo.addColorStop(1, `rgba(${wc.join(',')},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(s.W / 2, cy, R * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(s.W / 2, cy + dir * (R + 70));
        ctx.scale(R * 0.9, 95);
        const pl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        pl.addColorStop(0, `rgba(${wc.join(',')},0.3)`);
        pl.addColorStop(1, `rgba(${wc.join(',')},0)`);
        ctx.fillStyle = pl;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = wallCol;
        ctx.beginPath();
        ctx.arc(s.W / 2, cy, R, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cur = pr.current;
      const hot = cur.Tw >= cur.Tf;
      const s: Sim = { W, hot, u: Math.max(cur.u, 0.01), Re: cur.Re, Ra: cur.Ra };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const dT = Math.abs(cur.Tw - cur.Tf);
      const strength = clamp(0.35 + dT / 70, 0.4, 1);
      drawStatic(s);
      const wc = colWall(hot);
      const fc = colFluid(hot);
      for (const p of ps) {
        if (!reduce && !step(p, dt, s)) respawn(p, s, false);
        else if (reduce) step(p, 0, s);
        ctx.fillStyle = mix(fc, wc, clamp(p.th * strength, 0, 1));
        ctx.globalAlpha = 0.55 + 0.4 * p.th;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8 + 1.1 * p.th, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    if (reduce) {
      // static picture: let the particles settle once, then draw a single frame
      for (let i = 0; i < 40; i++) ps.forEach((p) => step(p, 0.05, { W, hot: pr.current.Tw >= pr.current.Tf, u: Math.max(pr.current.u, 0.01), Re: pr.current.Re, Ra: pr.current.Ra }));
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // the particle field is rebuilt per case; every other input is read live from the ref
  }, [props.kind]);

  const { kind, Re, Ra, Tw, Tf, deltaEnd } = props;
  const turb = kind === 'plate' ? Re > 5e5 : kind === 'pipe' ? Re > 3000 : Ra > 1e9;
  const hot = Tw >= Tf;
  const cap: { tl: string; tr: string[]; bl: string } = {
    plate: { tl: turb ? t('laminar → turbulent') : t('laminar'), tr: [`T_∞ = ${Tf} °C`, `δ(L) ≈ ${deltaEnd !== undefined ? deltaEnd.toFixed(1) : '—'} mm`], bl: `T_W = ${Tw} °C` },
    pipe: { tl: turb ? t('turbulent profile (flat)') : t('laminar profile (parabola)'), tr: [`T_m = ${Tf} °C`], bl: `T_W = ${Tw} °C` },
    cylinder: { tl: Re > 2e5 ? t('supercritical: narrow wake') : t('subcritical: separation at ≈ 80°, wide wake'), tr: [`T_∞ = ${Tf} °C`], bl: `T_W = ${Tw} °C` },
    freePlate: { tl: turb ? t('laminar → turbulent') : t('laminar'), tr: [`T_∞ = ${Tf} °C`], bl: `T_W = ${Tw} °C` },
    freeCylinder: { tl: hot ? t('thermal plume rises') : t('cold fluid sinks'), tr: [`T_∞ = ${Tf} °C`], bl: `T_W = ${Tw} °C` },
  }[kind];
  const capCls = 'pointer-events-none absolute font-mono text-[11px] leading-4 text-plant-400';
  return (
    <div className="relative">
      <canvas ref={ref} className="block w-full" style={{ height: H }} role="img" aria-label={t('Flow and boundary layer')} />
      <div className={`${capCls} left-2 top-1`}>{cap.tl}</div>
      <div className={`${capCls} right-2 top-1 text-right`}>
        {cap.tr.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      <div className={`${capCls} bottom-1 left-2`}>{cap.bl}</div>
    </div>
  );
}
