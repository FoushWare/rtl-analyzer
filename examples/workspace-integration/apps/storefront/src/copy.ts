export const copy = {
  en: { title: 'Storefront', product: 'Linen shirt', badge: 'In stock', cardTitle: 'Delivery', cardBody: 'Free over 200 EGP.', promo: 'Weekend offer: 15% off', price: '450 EGP', language: 'Language', switchTo: 'العربية' },
  ar: { title: 'المتجر', product: 'قميص كتان', badge: 'متوفر', cardTitle: 'التوصيل', cardBody: 'مجاني فوق ٢٠٠ جنيه.', promo: 'عرض نهاية الأسبوع: خصم ١٥٪', price: '٤٥٠ جنيه', language: 'اللغة', switchTo: 'English' },
} as const;
export type Lang = keyof typeof copy;
