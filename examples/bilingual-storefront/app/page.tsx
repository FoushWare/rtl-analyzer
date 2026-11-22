import { Breadcrumb } from '@/components/Breadcrumb';
import { Drawer } from '@/components/Drawer';
import { Header } from '@/components/Header';
import { Pagination } from '@/components/Pagination';
import { ProductCard } from '@/components/ProductCard';
import { ChevronDownIcon, PlusIcon } from '@/components/Icons';
import { content, type Lang } from '@/lib/content';

type Search = { lang?: string; page?: string; drawer?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const lang: Lang = q.lang === 'ar' ? 'ar' : 'en';
  const page = q.page === '2' ? 2 : 1;
  const t = content[lang];
  const products = page === 1 ? t.products : t.products.slice(0, 1);
  return (
    <div id="storefront">
      <Header lang={lang} />
      {q.drawer === 'open' && <Drawer lang={lang} />}
      <main className="mx-auto max-w-4xl">
        <Breadcrumb lang={lang} />
        <div className="flex items-center justify-between px-4">
          <h1 className="text-2xl font-bold">{t.heading}</h1>
          <button type="button" className="flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1 text-sm" data-case="SBF-OK-03">
            {t.filter}
            <ChevronDownIcon width={16} height={16} />
          </button>
        </div>
        <section aria-label={t.heading} className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
        </section>
        <Pagination lang={lang} page={page} />
      </main>
      <button type="button" aria-label={t.cart} className="fixed bottom-4 end-4 rounded-full bg-blue-700 p-3 text-white" data-case="SBF-OK-02">
        <PlusIcon />
      </button>
    </div>
  );
}
