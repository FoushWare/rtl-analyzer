export const copy = {
  en: { title: 'Admin', order: 'Order 1042', badge: 'Paid', cardTitle: 'Customer', cardBody: 'Nour Hassan, Cairo.', refund: 'Refund pending', refundNote: 'Awaiting approval', language: 'Language', switchTo: 'العربية' },
  ar: { title: 'الإدارة', order: 'الطلب ١٠٤٢', badge: 'مدفوع', cardTitle: 'العميل', cardBody: 'نور حسن، القاهرة.', refund: 'استرداد قيد المراجعة', refundNote: 'بانتظار الموافقة', language: 'اللغة', switchTo: 'English' },
} as const;
export type Lang = keyof typeof copy;
