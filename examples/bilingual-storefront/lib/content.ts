export type Lang = 'en' | 'ar';

export function dirOf(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export interface Product { id: string; name: string; price: string; blurb: string }

const en = {
  brand: 'Souq Lane',
  nav: { home: 'Home', products: 'Products', account: 'Account' },
  search: 'Search',
  cart: 'Cart',
  menu: 'Menu',
  close: 'Close',
  language: 'العربية',
  languageName: 'Arabic',
  crumbs: ['Home', 'Products', 'Headphones'],
  heading: 'Headphones',
  details: 'View details',
  previous: 'Previous',
  next: 'Next',
  filter: 'Sort by popularity',
  pageLabel: 'Page',
  products: [
    { id: 'p1', name: 'Studio Pro', price: '$129.00', blurb: 'Closed-back headphones with a flat, even response for long listening sessions.' },
    { id: 'p2', name: 'Lite Wireless', price: '$79.00', blurb: 'Lightweight wireless headphones with thirty hours of battery life.' },
    { id: 'p3', name: 'Travel ANC', price: '$159.00', blurb: 'Noise-cancelling headphones that fold flat for a carry-on bag.' },
  ] satisfies Product[],
};

const ar: typeof en = {
  brand: 'سوق لين',
  nav: { home: 'الرئيسية', products: 'المنتجات', account: 'حسابي' },
  search: 'بحث',
  cart: 'السلة',
  menu: 'القائمة',
  close: 'إغلاق',
  language: 'English',
  languageName: 'English',
  crumbs: ['الرئيسية', 'المنتجات', 'سماعات الرأس'],
  heading: 'سماعات الرأس',
  details: 'عرض التفاصيل',
  previous: 'السابق',
  next: 'التالي',
  filter: 'الترتيب حسب الشعبية',
  pageLabel: 'صفحة',
  products: [
    { id: 'p1', name: 'ستوديو برو', price: '١٢٩٫٠٠ دولار', blurb: 'سماعات مغلقة باستجابة متوازنة تناسب جلسات الاستماع الطويلة.' },
    { id: 'p2', name: 'لايت لاسلكية', price: '٧٩٫٠٠ دولار', blurb: 'سماعات لاسلكية خفيفة بعمر بطارية يصل إلى ثلاثين ساعة.' },
    { id: 'p3', name: 'ترافل لإلغاء الضوضاء', price: '١٥٩٫٠٠ دولار', blurb: 'سماعات تلغي الضوضاء وتُطوى لتناسب حقيبة السفر.' },
  ],
};

export const content = { en, ar };
export const CART_COUNT = 3;
