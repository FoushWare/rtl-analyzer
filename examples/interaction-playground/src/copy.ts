export type Lang = 'en' | 'ar';

export const copy = {
  en: {
    title: 'Interaction playground', language: 'Language', menu: 'Open menu', close: 'Close menu',
    menuItems: ['Overview', 'Settings', 'Help'], tabs: ['Overview', 'Billing', 'Team'], tabsLabel: 'Account sections',
    ratingLabel: 'Rate this plan', ratingValue: (n: number) => `${n} of 5`, sliderLabel: 'Volume (custom)', nativeLabel: 'Volume (native)',
    toolbarLabel: 'Text alignment', toolbar: ['Start', 'Center', 'End'], cases: 'Cases',
  },
  ar: {
    title: 'ملعب التفاعل', language: 'اللغة', menu: 'فتح القائمة', close: 'إغلاق القائمة',
    menuItems: ['نظرة عامة', 'الإعدادات', 'المساعدة'], tabs: ['نظرة عامة', 'الفواتير', 'الفريق'], tabsLabel: 'أقسام الحساب',
    ratingLabel: 'قيّم هذه الخطة', ratingValue: (n: number) => `${n} من 5`, sliderLabel: 'مستوى الصوت (مخصص)', nativeLabel: 'مستوى الصوت (أصلي)',
    toolbarLabel: 'محاذاة النص', toolbar: ['البداية', 'الوسط', 'النهاية'], cases: 'الحالات',
  },
} as const;
