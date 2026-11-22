import { useEffect, useRef } from 'react';
import styles from './Interaction.module.css';

type Props = { open: boolean; onClose: () => void; label: string; closeLabel: string; items: readonly string[] };

// IPG-FIX-01: slides in with translateX; anchored with a physical `left: 0`.
export function Drawer({ open, onClose, label, closeLabel, items }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = ref.current!.querySelectorAll<HTMLElement>('a, button');
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <aside ref={ref} id="drawer" className={open ? `${styles.drawer} ${styles.drawerOpen}` : styles.drawer}
      role="dialog" aria-label={label} aria-hidden={!open} inert={!open} onKeyDown={onKeyDown}>
      <nav>
        {items.map((item) => <a key={item} href="#cases" className={styles.drawerLink} onClick={onClose}>{item}</a>)}
      </nav>
      <button type="button" className={styles.button} onClick={onClose}>{closeLabel}</button>
    </aside>
  );
}
