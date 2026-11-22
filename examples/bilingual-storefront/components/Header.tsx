import Link from 'next/link';
import { CART_COUNT, content, type Lang } from '@/lib/content';
import { ChevronDownIcon, SearchIcon } from './Icons';

export function Header({ lang }: { lang: Lang }) {
  const t = content[lang];
  const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <header id="site-header" className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <Link href={`/?lang=${lang}&drawer=open`} data-case="SBF-REVIEW-01" className="rounded border border-slate-300 px-3 py-1 text-sm md:hidden">
        {t.menu}
      </Link>
      <strong className="text-lg">{t.brand}</strong>
      {/* NAVIGATION-001: primary navigation; item spacing is a physical Tailwind margin (SBF-TW-01). */}
      <nav aria-label={t.menu} className="hidden items-center md:flex" data-case="SBF-TW-01">
        <Link href={`/?lang=${lang}`} className="font-semibold text-slate-900" aria-current="page">{t.nav.home}</Link>
        <Link href={`/?lang=${lang}`} className="ml-6 text-slate-600">{t.nav.products}</Link>
        <Link href={`/?lang=${lang}`} className="ml-6 text-slate-600">{t.nav.account}</Link>
      </nav>
      <div className="ms-auto flex items-center gap-3">
        <button type="button" aria-label={t.search} className="rounded p-1 text-slate-700" data-case="SBF-OK-02"><SearchIcon /></button>
        <Link href={`/?lang=${lang}`} className="flex items-center text-sm" data-case="SBF-FIX-01">
          <span>{t.cart}</span>
          <span className="cart-count">{CART_COUNT}</span>
        </Link>
        {/* Plain anchor on purpose: a full document load re-renders <html lang dir>. A client-side
            <Link> navigation keeps the root layout, so the document direction would not change. */}
        <a href={`/?lang=${other}`} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm" lang={other} id="language-switch">
          {t.language}
          <ChevronDownIcon width={16} height={16} />
        </a>
      </div>
    </header>
  );
}
