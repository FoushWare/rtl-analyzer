import { Fragment } from 'react';
import { content, type Lang } from '@/lib/content';
import { ForwardIcon } from './Icons';

/** NAVIGATION-004 / ICONS-003: Home > Products > Headphones. Spacing uses logical utilities (clean control SBF-OK-01). */
export function Breadcrumb({ lang }: { lang: Lang }) {
  const crumbs = content[lang].crumbs;
  return (
    <nav aria-label="Breadcrumb" className="px-4 py-3 text-sm text-slate-600" data-case="SBF-OK-01">
      <ol className="flex items-center gap-2 ps-1">
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb}>
            {i > 0 && <li aria-hidden="true"><ForwardIcon width={14} height={14} /></li>}
            <li className={i === crumbs.length - 1 ? 'font-semibold text-slate-900' : ''}>{crumb}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
