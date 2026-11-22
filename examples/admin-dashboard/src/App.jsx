import { useEffect, useState } from 'react';
import styles from './Dashboard.module.css';

const copy = {
  en: { title: 'Orders', tabs: ['Orders', 'Refunds'], order: 'Order', customer: 'Customer', amount: 'Amount', actions: 'Actions', details: 'Details', session: 'Order details', close: 'Close', dir: 'Direction', note: 'Customer asked for a delivery window.' },
  ar: { title: 'الطلبات', tabs: ['الطلبات', 'المرتجعات'], order: 'الطلب', customer: 'العميل', amount: 'المبلغ', actions: 'إجراءات', details: 'التفاصيل', session: 'تفاصيل الطلب', close: 'إغلاق', dir: 'الاتجاه', note: 'طلب العميل نافذة توصيل.' },
};
const rows = [
  { id: 'ORD-10492', name: 'Amina Hassan', ar: 'أمينة حسن', status: 'Paid', amount: '1,240.50' },
  { id: 'ORD-10493', name: 'Daniel Brooks', ar: 'دانيال بروكس', status: 'Pending', amount: '86.00' },
  { id: 'ORD-10494', name: 'Layla Farouk', ar: 'ليلى فاروق', status: 'Paid', amount: '9,310.25' },
];

function param(name, allowed, fallback) {
  const value = new URLSearchParams(window.location.search).get(name);
  return allowed.includes(value) ? value : fallback;
}

export function App() {
  const [direction, setDirection] = useState(() => param('direction', ['ltr', 'rtl'], 'ltr'));
  const [tab, setTab] = useState(0);
  const [dialog, setDialog] = useState(() => param('dialog', ['details'], '') === 'details');
  const lang = direction === 'rtl' ? 'ar' : 'en';
  const t = copy[lang];
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
  }, [direction, lang]);

  return (
    <main id="dashboard" className={styles.page}>
      {/* CASE ATD-OK-02 (ACCESSIBILITY-006): direction selector and tabs, logical CSS, no finding */}
      <div className={styles.toolbar}>
        <div role="tablist" aria-label={t.title} className={styles.tabs}>
          {t.tabs.map((label, index) => (
            <button key={label} role="tab" aria-selected={tab === index} className={styles.tab} onClick={() => setTab(index)}>{label}</button>
          ))}
        </div>
        <label htmlFor="direction">{t.dir}</label>
        <select id="direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
          <option value="ltr">Left to right</option>
          <option value="rtl">Right to left</option>
        </select>
      </div>

      {/* CASES ATD-FIX-01 (statusBadge), ATD-REVIEW-01 (stickyId), ATD-REVIEW-02 (amountCell), ATD-OK-01 (logical table) */}
      <div className={styles.tableScroll}>
        <table className={styles.orders}>
          <thead>
            <tr><th className={styles.stickyId} scope="col">{t.order}</th><th scope="col">{t.customer}</th><th scope="col">{t.amount}</th><th scope="col">{t.actions}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.stickyId} dir="ltr">{row.id}</th>
                <td>{lang === 'ar' ? row.ar : row.name}<span className={styles.statusBadge}>{row.status}</span></td>
                <td className={styles.amountCell}>{row.amount}</td>
                <td><button className={styles.linkButton} onClick={() => setDialog(true)}>{t.details}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CASE ATD-FIX-02 (OVERLAYS-004): session details dialog, dialogTitle margin */}
      {dialog && (
        <div className={styles.backdrop}>
          <section role="dialog" aria-modal="true" aria-labelledby="dlg-title" className={styles.dialog}>
            <header className={styles.dialogHeader}>
              <h2 id="dlg-title" className={styles.dialogTitle}>{t.session}</h2>
              <button className={styles.dialogClose} onClick={() => setDialog(false)}>{t.close}</button>
            </header>
            <p className={styles.dialogBody}>{t.note}</p>
          </section>
        </div>
      )}
    </main>
  );
}
