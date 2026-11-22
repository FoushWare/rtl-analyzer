import Link from 'next/link';
import { content, type Lang } from '@/lib/content';
import { BackIcon, ForwardIcon } from './Icons';

/** NAVIGATION-005 / ICONS-001 / ICONS-002: Previous 1 2 Next. */
export function Pagination({ lang, page }: { lang: Lang; page: 1 | 2 }) {
  const t = content[lang];
  const href = (p: number) => `/?lang=${lang}&page=${p}`;
  return (
    <nav aria-label={t.pageLabel} id="pager" className="flex items-center justify-center gap-3 py-6 text-sm">
      <Link href={href(1)} className="flex items-center gap-1" aria-disabled={page === 1} data-case="SBF-MISS-01">
        <BackIcon width={16} height={16} />
        <span>{t.previous}</span>
      </Link>
      <Link href={href(1)} aria-current={page === 1 ? 'page' : undefined} className="rounded px-2 py-1 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white">1</Link>
      <Link href={href(2)} aria-current={page === 2 ? 'page' : undefined} className="rounded px-2 py-1 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white">2</Link>
      <Link href={href(2)} className="flex items-center" data-case="SBF-FIX-02">
        <span>{t.next}</span>
        <ForwardIcon width={16} height={16} className="pager-arrow" />
      </Link>
    </nav>
  );
}
