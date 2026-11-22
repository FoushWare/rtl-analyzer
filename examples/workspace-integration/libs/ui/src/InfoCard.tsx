import type { ReactNode } from 'react';
import styles from './InfoCard.module.css';

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}
