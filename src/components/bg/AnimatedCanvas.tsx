/**
 * <canvas> that fills its container and draws a scene as a function of the global clock.
 * Sizes itself with a ResizeObserver, tracks mouse and touch (pointer events), stops drawing
 * while hidden (tab in the background or scrolled out of view) and redraws on scrubbing.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { clockNow, useAnimClock } from '@/store/animClock';
import { SCENES, type SceneId } from './scenes';

/** theme colours from CSS variables (RGB triplets), re-read when the theme changes */
let palette: Map<string, string> = new Map();
let themeDark = true;
function readTheme() {
  palette = new Map();
  themeDark = !document.documentElement.classList.contains('light');
}
if (typeof window !== 'undefined') {
  readTheme();
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}
function color(name: string, a = 1) {
  let v = palette.get(name);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ',') || '128,128,128';
    palette.set(name, v);
  }
  return `rgba(${v},${a})`;
}

export function AnimatedCanvas({
  scene,
  className,
  fps = 30,
  resolution = 1,
  pointer = 'self',
  opacity = 1,
}: {
  scene: SceneId;
  className?: string;
  /** frame-rate cap */
  fps?: number;
  /** render scale (≤ 1 for cheap full-screen backgrounds) */
  resolution?: number;
  /** where pointer input comes from: the canvas itself, the whole window, or none */
  pointer?: 'self' | 'window' | 'none';
  opacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let visible = true;
    let raf = 0;
    let last = -1;
    let lastT = NaN;
    let dirty = true;
    const ptr = { x: null as number | null, y: null as number | null };
    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * resolution;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      dirty = true;
    });
    io.observe(cv);
    const onMove = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      ptr.x = inside ? x : null;
      ptr.y = inside ? y : null;
      dirty = true;
    };
    const onLeave = () => {
      ptr.x = null;
      ptr.y = null;
      dirty = true;
    };
    const target: HTMLElement | Window | null = pointer === 'window' ? window : pointer === 'self' ? cv : null;
    target?.addEventListener('pointermove', onMove as EventListener);
    target?.addEventListener('pointerdown', onMove as EventListener);
    if (pointer === 'self') cv.addEventListener('pointerleave', onLeave);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      if (now - last < 1000 / fps - 1) return;
      const c = useAnimClock.getState();
      // backgrounds switched off: one still frame
      const t = c.mode === 'off' ? 12 : clockNow(c);
      if (!dirty && t === lastT) return; // paused and nothing changed
      last = now;
      lastT = t;
      dirty = false;
      ctx.clearRect(0, 0, w, h);
      SCENES[scene](ctx, { w, h, t, px: ptr.x, py: ptr.y, dark: themeDark, c: color });
    };
    resize();
    raf = requestAnimationFrame(frame);
    const unsub = useAnimClock.subscribe(() => (dirty = true));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unsub();
      target?.removeEventListener('pointermove', onMove as EventListener);
      target?.removeEventListener('pointerdown', onMove as EventListener);
      cv.removeEventListener('pointerleave', onLeave);
    };
  }, [scene, fps, resolution, pointer]);
  return <canvas ref={ref} aria-hidden className={cn('block h-full w-full', pointer === 'self' ? 'touch-pan-y' : 'pointer-events-none', className)} style={{ opacity }} />;
}
