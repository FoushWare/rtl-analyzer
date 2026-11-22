import { useState } from 'react';
import styles from './Interaction.module.css';

type Props = { label: string; valueText: (n: number) => string };

// IPG-FIX-02: radio-group rating. Spacing uses a physical `margin-left`; ArrowRight always
// increases the value (not direction-aware, a JS behaviour the scanner cannot see).
export function Rating({ label, valueText }: Props) {
  const [value, setValue] = useState(3);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next = value;
    if (event.key === 'ArrowRight') next = Math.min(5, value + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(1, value - 1);
    else return;
    event.preventDefault();
    setValue(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-star="${next}"]`)?.focus();
  }

  return (
    <div>
      <div role="radiogroup" aria-label={label} className={styles.rating} onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" data-star={n} aria-checked={n === value} aria-label={valueText(n)}
            tabIndex={n === value ? 0 : -1} className={n <= value ? `${styles.star} ${styles.starOn}` : styles.star}
            onClick={() => setValue(n)}>★</button>
        ))}
      </div>
      <output className={styles.valueText} data-testid="rating-value">{valueText(value)}</output>
    </div>
  );
}
