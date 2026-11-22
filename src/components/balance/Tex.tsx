import { useMemo } from 'react';
import { texHtml } from '@/components/MathText';
import { cn } from '@/lib/utils';

/** KaTeX formula. Input is built by the app (user names are escaped in texFormat). */
export function Tex({ math, block = false, className }: { math: string; block?: boolean; className?: string }) {
  // HTML for the eye plus MathML for screen readers (KaTeX "htmlAndMathml")
  const html = useMemo(() => texHtml(math, block), [math, block]);
  return <span className={cn(block ? 'tex-block block overflow-x-auto overflow-y-hidden' : 'inline', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
