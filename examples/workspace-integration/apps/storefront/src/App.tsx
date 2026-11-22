import { useEffect } from 'react';
import { InfoCard, StatusBadge } from '@ws/ui';
import { copy, type Lang } from './copy';
import styles from './Storefront.module.css';

export function App() {
  const requested = new URLSearchParams(window.location.search).get('direction');
  const direction = requested === 'rtl' ? 'rtl' : 'ltr';
  const lang: Lang = direction === 'rtl' ? 'ar' : 'en';
  const t = copy[lang];

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
  }, [direction, lang]);

  return (
    <div id="storefront" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <a className={styles.langLink} href={`?direction=${direction === 'rtl' ? 'ltr' : 'rtl'}`}>{t.language}: {t.switchTo}</a>
      </header>
      <p id="promo" className={styles.promo}>{t.promo}</p>
      <h2 id="product" className={styles.product}>{t.product}<StatusBadge>{t.badge}</StatusBadge></h2>
      <p className={styles.price}>{t.price}</p>
      <InfoCard title={t.cardTitle}>{t.cardBody}</InfoCard>
    </div>
  );
}
