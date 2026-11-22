import Link from 'next/link';
import { content, type Lang } from '@/lib/content';

/** NAVIGATION-003: mobile navigation. Intended: opens from the reading-start edge. */
export function Drawer({ lang }: { lang: Lang }) {
  const t = content[lang];
  return (
    <aside id="nav-drawer" className="drawer" aria-label={t.menu} data-case="SBF-REVIEW-01">
      <Link href={`/?lang=${lang}`} className="block py-2 text-sm text-slate-500">{t.close}</Link>
      <ul className="space-y-2">
        <li><Link href={`/?lang=${lang}`}>{t.nav.home}</Link></li>
        <li><Link href={`/?lang=${lang}`}>{t.nav.products}</Link></li>
        <li><Link href={`/?lang=${lang}`}>{t.nav.account}</Link></li>
      </ul>
    </aside>
  );
}
