import { t } from '@/i18n';
import { navigate } from '@/lib/route';

export default function PrivacyPage() {
  const P = ({ children }: { children: string }) => <p className="text-sm leading-relaxed text-plant-300">{t(children)}</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <h1 className="text-2xl font-semibold text-plant-100">{t('Privacy')}</h1>
      <section className="glass space-y-3 p-5">
        <h2 className="text-sm font-semibold text-plant-100">{t('In short')}</h2>
        <P>No tracking, no analytics, no cookies, no accounts. Fonts and all program code are delivered by this site itself; the page makes no requests to third parties such as Google.</P>
        <P>Everything you build (flowsheets, circuits, block diagrams, saved sheets, language and theme) is stored only in your browser (local storage). It never leaves your device unless you export a file yourself.</P>
      </section>
      <section className="glass space-y-3 p-5">
        <h2 className="text-sm font-semibold text-plant-100">{t('Hosting')}</h2>
        <P>The site is a static website. The hosting provider that delivers the files (e.g. GitHub Pages or Vercel) technically processes your IP address and may keep server logs for operation and security; see the provider's privacy policy.</P>
      </section>
      <section className="glass space-y-3 p-5">
        <h2 className="text-sm font-semibold text-plant-100">{t('Your data, your control')}</h2>
        <P>Clearing the browser data for this site deletes everything stored locally — export sheets you want to keep ("My sheets" → "Export file").</P>
      </section>
      <button type="button" onClick={() => navigate('home')} className="text-sm text-signal-liquid hover:underline">
        ← {t('Back to the start page')}
      </button>
    </div>
  );
}
