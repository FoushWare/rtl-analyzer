import { useEffect, useState } from 'react';
import styles from './Checkout.module.css';

const copy = {
  en: { title: 'Order summary', edit: 'Edit order', coupon: 'Coupon code', hint: 'Codes are case-insensitive and apply to the subtotal.', card: 'Card number', total: 'Total', amount: '$128.00', dir: 'Direction', secure: 'Secure payment' },
  ar: { title: 'ملخص الطلب', edit: 'تعديل الطلب', coupon: 'رمز القسيمة', hint: 'الرموز غير حساسة لحالة الأحرف وتطبق على المجموع الفرعي.', card: 'رقم البطاقة', total: 'الإجمالي', amount: '١٢٨٫٠٠ $', dir: 'الاتجاه', secure: 'دفع آمن' },
};

function initialDirection() {
  const value = new URLSearchParams(window.location.search).get('direction');
  return value === 'rtl' ? 'rtl' : 'ltr';
}

export function App() {
  const [direction, setDirection] = useState(initialDirection);
  const lang = direction === 'rtl' ? 'ar' : 'en';
  const t = copy[lang];
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
  }, [direction, lang]);

  return (
    <main id="checkout" className={styles.page}>
      <div className={styles.toolbar}>
        <label htmlFor="direction">{t.dir}</label>
        <select id="direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
          <option value="ltr">Left to right</option>
          <option value="rtl">Right to left</option>
        </select>
      </div>

      {/* CASE ATC-FIX-01 (supported fix) */}
      <header className={styles.summaryHeader}>
        <h1 className={styles.summaryTitle}>{t.title}</h1>
        <a className={styles.editLink} href="#order">{t.edit}</a>
      </header>

      {/* CASE ATC-FIX-02 (supported fix: text-align left -> start) */}
      <section className={styles.coupon}>
        <label htmlFor="coupon">{t.coupon}</label>
        <input id="coupon" className={styles.field} defaultValue="WELCOME10" />
        <p className={styles.couponHint}>{t.hint}</p>
      </section>

      {/* CASES ATC-REVIEW-01 (secureBadge, manual review) and ATC-OK-01 (logical CSS, no finding) */}
      <section className={styles.payment}>
        <span className={styles.secureBadge}>{t.secure}</span>
        <label htmlFor="card">{t.card}</label>
        <input id="card" className={styles.cardNumber} dir="ltr" inputMode="numeric" defaultValue="4242 4242 4242 4242" />
        <div className={styles.totalRow}>
          <span>{t.total}</span>
          <strong>{t.amount}</strong>
        </div>
      </section>
    </main>
  );
}
