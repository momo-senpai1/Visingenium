import { Download, FolderOpen, Link2, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { sharedExamples } from '@/examples';
import { decodeSheet, downloadSheet, encodeSheet, parseSheet, useSheets, type SheetApp } from '@/store/sheetsStore';

/** "My sheets": save the current sheet under a name, reopen, delete, export and import as a file. */
export function SheetManager({ app, current, apply }: { app: SheetApp; current: () => unknown; apply: (payload: unknown) => boolean }) {
  const list = useSheets((s) => s.sheets[app]);
  const save = useSheets((s) => s.save);
  const remove = useSheets((s) => s.remove);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };
  // open a sheet shared by link (#/route?sheet=…), then remove it from the address bar
  useEffect(() => {
    const check = () => {
      const [path, query = ''] = window.location.hash.split('?');
      const q = new URLSearchParams(query);
      const code = q.get('sheet');
      if (!code) return;
      q.delete('sheet');
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${path}${q.size ? `?${q}` : ''}`);
      void decodeSheet(code).then((p) => flash(p && apply(p) ? t('Opened the shared sheet.') : t('The shared link is damaged; nothing was changed.')));
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const share = async () => {
    const code = await encodeSheet(current());
    const url = `${window.location.origin}${window.location.pathname}${window.location.hash.split('?')[0]}?sheet=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      flash(t('Link copied: anyone with the link opens this sheet.'));
    } catch {
      window.prompt(t('Copy this link:'), url);
    }
  };
  const doSave = () => {
    const n = name.trim() || `${t('Sheet')} ${list.length + 1}`;
    save(app, n, current());
    setName('');
    flash(t('Saved as "{name}".', { name: n }));
  };
  const btn = 'grid h-6 w-6 shrink-0 place-items-center rounded text-plant-400 hover:bg-white/[0.05]';
  return (
    <div className="space-y-1.5">
      <p className="tag text-plant-400">{t('My sheets')}</p>
      <div className="flex gap-1">
        <input
          aria-label={t('Sheet name')}
          placeholder={t('Name…')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSave()}
          className="min-w-0 flex-1 rounded border border-white/[0.08] bg-plant-950/70 px-2 py-1 text-[11px] text-plant-100 outline-none focus:border-signal-vapor/50"
        />
        <button type="button" onClick={doSave} className="flex items-center gap-1 rounded border border-signal-vapor/40 px-2 text-[11px] text-signal-vapor hover:bg-signal-vapor/10">
          <Save className="h-3 w-3" /> {t('Save')}
        </button>
      </div>
      {msg && <p className="text-[10px] text-signal-ok">{msg}</p>}
      <p className="text-[10px] leading-snug text-signal-heat/90">{t('Saved only in this browser: clearing the browser data deletes it. Export a file or share a link to keep your work.')}</p>
      {list.length === 0 ? (
        <p className="text-[10px] text-plant-500">{t('No saved sheets yet.')}</p>
      ) : (
        <ul className="space-y-0.5">
          {list.map((s) => (
            <li key={s.name} className="flex items-center gap-1 rounded border border-white/[0.06] px-1.5 py-0.5">
              <button type="button" onClick={() => flash(apply(s.payload) ? t('Opened "{name}".', { name: s.name }) : t('This sheet is damaged and cannot be opened.'))} className="min-w-0 flex-1 text-left" title={t('Open')}>
                <span className="block truncate text-[11px] text-plant-100">{s.name}</span>
                <span className="block font-mono text-[9px] text-plant-500">{new Date(s.savedAt).toLocaleString()}</span>
              </button>
              <button type="button" aria-label={`${t('Open')} ${s.name}`} onClick={() => flash(apply(s.payload) ? t('Opened "{name}".', { name: s.name }) : t('This sheet is damaged and cannot be opened.'))} className={btn}>
                <FolderOpen className="h-3 w-3" />
              </button>
              <button type="button" aria-label={`${t('Export')} ${s.name}`} onClick={() => downloadSheet(app, s.name, s.payload)} className={btn}>
                <Download className="h-3 w-3" />
              </button>
              <button type="button" aria-label={`${t('Delete')} ${s.name}`} onClick={() => remove(app, s.name)} className={`${btn} hover:text-signal-alarm`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <button type="button" onClick={() => downloadSheet(app, name.trim() || 'sheet', current())} className="flex flex-1 items-center justify-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[10px] text-plant-300 hover:text-signal-vapor">
          <Download className="h-3 w-3" /> {t('Export file')}
        </button>
        <button type="button" onClick={() => void share()} className="flex flex-1 items-center justify-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[10px] text-plant-300 hover:text-signal-vapor">
          <Link2 className="h-3 w-3" /> {t('Share link')}
        </button>
        <button type="button" onClick={() => file.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[10px] text-plant-300 hover:text-signal-vapor">
          <Upload className="h-3 w-3" /> {t('Import file')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label={t('Import file')}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const s = parseSheet(app, await f.text());
            if (!s) return flash(t('This file is not a sheet of this simulator.'));
            if (!apply(s.payload)) return flash(t('This file is damaged or not a valid sheet; nothing was changed.'));
            save(app, s.name, s.payload);
            flash(t('Opened "{name}".', { name: s.name }));
          }}
        />
      </div>
    </div>
  );
}

/** Sheets that ship with the website (src/examples/<app>/*.json). */
export function SharedExamples({ app, apply }: { app: SheetApp; apply: (payload: unknown) => boolean }) {
  const list = sharedExamples(app);
  if (!list.length) return null;
  return (
    <div className="space-y-1">
      <p className="tag mb-1 text-plant-400">{t('Shared examples')}</p>
      {list.map((s) => (
        <button key={s.name} type="button" onClick={() => apply(s.payload)} className="block w-full rounded border border-white/[0.08] px-2 py-1 text-left text-[11px] text-plant-200 hover:border-signal-vapor/40 hover:text-signal-vapor">
          {s.name}
        </button>
      ))}
    </div>
  );
}
