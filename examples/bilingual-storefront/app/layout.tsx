import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { dirOf, type Lang } from '@/lib/content';
import './globals.css';
import './storefront.css';
import './icons.css';

export const metadata = { title: 'Souq Lane', description: 'Bilingual storefront example' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = ((await headers()).get('x-sf-lang') === 'ar' ? 'ar' : 'en') as Lang;
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
