import { useRef, useState } from 'react';
import styles from './Interaction.module.css';

type Props = { label: string; tabs: readonly string[] };

// IPG-KEY-01: roving-tabindex tab list. CSS is logical (flex follows direction), but ArrowRight
// always means "next tab" in the handler, so in RTL the focus moves against the visual order.
// This is a JavaScript behaviour: the scanner is not expected to detect it.
export function Tabs({ label, tabs }: Props) {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  function move(index: number) {
    setActive(index);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') move((active + 1) % tabs.length);
    else if (event.key === 'ArrowLeft') move((active + tabs.length - 1) % tabs.length);
    else return;
    event.preventDefault();
  }

  return (
    <div>
      <div ref={list} role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button key={tab} type="button" role="tab" id={`tab-${i}`} aria-selected={i === active} aria-controls="tabpanel"
            tabIndex={i === active ? 0 : -1} className={i === active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActive(i)}>{tab}</button>
        ))}
      </div>
      <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${active}`} className={styles.panel} data-testid="tab-panel">{tabs[active]}</div>
    </div>
  );
}
