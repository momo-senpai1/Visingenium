import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Content Security Policy for the production build: scripts only from this site, no inline
 * scripts. Inline styles stay allowed (KaTeX, React Flow and the charts position elements with them);
 * data:/blob: images are needed for the PNG/PDF export. Dev mode is left alone (Vite injects inline scripts).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

/**
 * third-party-licenses.txt in the build output: name, version, license and license text of every
 * runtime dependency (from package-lock.json), as their licenses (MIT, Apache-2.0, OFL …) require.
 */
const thirdPartyLicenses = (): Plugin => ({
  name: 'third-party-licenses',
  apply: 'build',
  generateBundle() {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, { version?: string; license?: string; dev?: boolean }> };
    const out: string[] = ['Third-party software bundled with Visingenium', '='.repeat(56), ''];
    const entries = Object.entries(lock.packages)
      .filter(([k, v]) => k.startsWith('node_modules/') && !v.dev)
      .map(([k, v]) => ({ name: k.slice(k.lastIndexOf('node_modules/') + 13), dir: k, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const seen = new Set<string>();
    for (const e of entries) {
      const id = `${e.name}@${e.version}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const file = fs.existsSync(e.dir) ? fs.readdirSync(e.dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f)) : undefined;
      out.push(`${id} — ${e.license ?? 'see package'}`, '-'.repeat(60));
      out.push(file ? fs.readFileSync(path.join(e.dir, file), 'utf8').trim() : '(no license file shipped with the package)', '', '');
    }
    this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source: out.join('\n') });
  },
});

// GitHub Pages serves the site from /<repo>/ — the deploy workflow passes it in VITE_BASE.
const base = process.env.VITE_BASE ? `${process.env.VITE_BASE.replace(/\/$/, '')}/` : '/';

export default defineConfig({
  base,
  plugins: [react(), csp(), thirdPartyLicenses()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    // jsPDF (loaded only for the PDF export) is the largest chunk
    chunkSizeWarningLimit: 600,
  },
});
