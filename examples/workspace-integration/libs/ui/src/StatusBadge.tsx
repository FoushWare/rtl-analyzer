import styles from './StatusBadge.module.css';

export function StatusBadge({ children }: { children: string }) {
  return <span className={styles.badge}>{children}</span>;
}
