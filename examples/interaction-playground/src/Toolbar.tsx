import { useRef, useState } from 'react';
import styles from './Interaction.module.css';

type Props = { label: string; items: readonly string[] };

// IPG-OK-01 (clean control): logical CSS only; arrow keys read the computed direction so
// ArrowRight means "visually right" in both LTR and RTL. Also hosts a native range input.
export function Toolbar({ label, items }: Props) {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    const rtl = getComputedStyle(root.current!).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = active;
    if (event.key === forward) next = (active + 1) % items.length;
    else if (event.key === backward) next = (active + items.length - 1) % items.length;
    else return;
    event.preventDefault();
    setActive(next);
    root.current?.querySelectorAll<HTMLElement>('button')[next]?.focus();
  }

  return (
    <div ref={root} role="toolbar" aria-label={label} className={styles.toolbar} onKeyDown={onKeyDown}>
      {items.map((item, i) => (
        <button key={item} type="button" tabIndex={i === active ? 0 : -1} aria-pressed={i === active}
          className={i === active ? `${styles.toolButton} ${styles.toolButtonOn}` : styles.toolButton}
          onClick={() => setActive(i)}>{item}</button>
      ))}
    </div>
  );
}
