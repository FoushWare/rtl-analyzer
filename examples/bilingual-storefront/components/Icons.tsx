import type { SVGProps } from 'react';

const join = (a: string, b?: string) => (b ? `${a} ${b}` : a);

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** ICONS-008: direction-neutral controls. Never mirrored. */
export const SearchIcon = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} className={join("icon-neutral", className)} data-case="SBF-OK-02"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const PlusIcon = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} className={join("icon-neutral", className)} data-case="SBF-OK-02"><path d="M12 5v14M5 12h14" /></svg>
);
/** ICONS-007: a down chevron stays down in both directions. */
export const ChevronDownIcon = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} className={join("icon-neutral", className)} data-case="SBF-OK-03"><path d="m6 9 6 6 6-6" /></svg>
);
/** ICONS-002 / ICONS-003: points toward "next". Meaning follows reading direction. */
export const ForwardIcon = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} className={join("icon-forward", className)} data-case="SBF-ICON-01"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
/** ICONS-001: points toward "previous". Deliberately not marked as a progression icon. */
export const BackIcon = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} className={join("icon-back", className)} data-case="SBF-MISS-01"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
