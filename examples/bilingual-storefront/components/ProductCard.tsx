import { content, type Lang, type Product } from '@/lib/content';
import { ForwardIcon } from './Icons';

export function ProductCard({ product, lang }: { product: Product; lang: Lang }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4" data-case="SBF-TW-02">
      <div className="mb-3 h-24 rounded bg-gradient-to-br from-slate-200 to-slate-300" aria-hidden="true" />
      <h3 className="font-semibold">{product.name}</h3>
      <p className="text-sm text-slate-900">{product.price}</p>
      {/* SBF-TW-02: forced left alignment of locale-dependent text. */}
      <p className="mt-2 text-left text-sm text-slate-600">{product.blurb}</p>
      <a href={`/?lang=${lang}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700">
        {content[lang].details}
        <ForwardIcon width={16} height={16} />
      </a>
    </article>
  );
}
