/** Export a React Flow sheet (and its result panel) as PNG or PDF. */

import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react';
import { FileDown, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

const bg = () => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--plant-950').trim().replace(/\s+/g, ',')})`;

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

const fileName = (s: string) => s.replace(/[^\w\- ]+/g, '_').trim() || 'sheet';

/**
 * resultsSelector: CSS selector of the element holding the results (captured at its full height).
 */
export function ExportMenu({ title, resultsSelector }: { title: string; resultsSelector: string }) {
  const { getNodes } = useReactFlow();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as globalThis.Node) && setOpen(false);
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);

  /** The whole diagram (not just the visible part) as a PNG data URL, at 2× resolution. */
  const diagram = async () => {
    const { toPng } = await import('html-to-image');
    const nodes = getNodes();
    if (!nodes.length) return null;
    const b = getNodesBounds(nodes);
    const pad = 40;
    const width = Math.min(4000, Math.max(400, Math.ceil(b.width + 2 * pad + 120)));
    const height = Math.min(3000, Math.max(250, Math.ceil(b.height + 2 * pad + 60)));
    const vp = getViewportForBounds(b, width, height, 0.2, 2, 0.08);
    const el = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!el) return null;
    const url = await toPng(el, {
      backgroundColor: bg(),
      width,
      height,
      pixelRatio: 2,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
    });
    return { url, width, height };
  };
  const results = async () => {
    const { toPng } = await import('html-to-image');
    const el = document.querySelector<HTMLElement>(resultsSelector);
    if (!el) return null;
    const width = el.scrollWidth;
    const height = el.scrollHeight;
    const url = await toPng(el, { backgroundColor: bg(), width, height, pixelRatio: 2, style: { height: `${height}px`, maxHeight: 'none', overflow: 'visible' } });
    return { url, width, height };
  };

  const run = async (kind: 'png' | 'png-results' | 'pdf') => {
    setBusy(true);
    setErr(null);
    setOpen(false);
    try {
      const d = await diagram();
      if (kind === 'png') {
        if (d) download(d.url, `${fileName(title)}.png`);
      } else if (kind === 'png-results') {
        const r = await results();
        if (r) download(r.url, `${fileName(title)} – ${t('results')}.png`);
      } else {
        const r = await results();
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();
        const m = 12;
        pdf.setFontSize(16);
        pdf.text(title, m, m + 4);
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(`Visingenium · ${new Date().toLocaleString()}`, m, m + 10);
        // JPEG keeps the PDF small (PNG pages at 2× would be several MB each)
        const jpeg = async (url: string) => {
          const im = new Image();
          im.src = url;
          await im.decode();
          const c = document.createElement('canvas');
          c.width = im.naturalWidth;
          c.height = im.naturalHeight;
          const g = c.getContext('2d')!;
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0);
          return c.toDataURL('image/jpeg', 0.88);
        };
        const place = async (img: { url: string; width: number; height: number }, top: number) => {
          const maxW = W - 2 * m;
          const maxH = H - top - m;
          const s = Math.min(maxW / img.width, maxH / img.height);
          pdf.addImage(await jpeg(img.url), 'JPEG', m, top, img.width * s, img.height * s);
        };
        if (d) await place(d, m + 16);
        if (r) {
          // the results may be long: slice them over as many pages as needed
          const pageW = W - 2 * m;
          const scale = pageW / r.width;
          const sliceH = (H - 2 * m) / scale; // in CSS pixels
          const img = new Image();
          img.src = r.url;
          await img.decode();
          const px = img.naturalWidth / r.width;
          for (let y = 0; y < r.height; y += sliceH) {
            const h = Math.min(sliceH, r.height - y);
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = Math.ceil(h * px);
            c.getContext('2d')!.drawImage(img, 0, -y * px);
            pdf.addPage();
            pdf.addImage(c.toDataURL('image/jpeg', 0.88), 'JPEG', m, m, pageW, h * scale);
          }
        }
        pdf.save(`${fileName(title)}.pdf`);
      }
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const item = 'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] text-plant-200 hover:bg-white/[0.05]';
  return (
    <div ref={ref} className="absolute right-3 top-3 z-10">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn('flex items-center gap-1.5 rounded border border-white/[0.1] bg-plant-900 px-2 py-1 text-[11px] text-plant-200 shadow hover:text-signal-vapor', busy && 'opacity-70')}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} {t('Export')}
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-full mt-1 min-w-[220px] !bg-plant-900 p-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={() => run('png')}>
            <ImageIcon className="h-3 w-3" /> {t('Diagram as PNG')}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run('png-results')}>
            <ImageIcon className="h-3 w-3" /> {t('Results as PNG')}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run('pdf')}>
            <FileDown className="h-3 w-3" /> {t('PDF report (diagram + results)')}
          </button>
        </div>
      )}
      {err && <p className="mt-1 max-w-[220px] rounded bg-plant-900 p-1 text-[10px] text-signal-alarm">{t('Export failed')}: {err}</p>}
    </div>
  );
}
