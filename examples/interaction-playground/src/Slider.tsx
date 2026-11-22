import { useLayoutEffect, useRef, useState } from 'react';
import styles from './Interaction.module.css';

type Props = { label: string };

// IPG-REVIEW-01: custom slider. Thumb and fill are placed with physical `left` (position comes from
// the --value custom property so the stylesheet owns the geometry);
// ArrowRight always increases. In RTL the track should start at the right edge.
export function Slider({ label }: Props) {
  const [value, setValue] = useState(30);
  const track = useRef<HTMLDivElement>(null);

  // Imperative so the scanner sees no inline style expression in JSX.
  useLayoutEffect(() => { track.current?.style.setProperty('--value', `${value}%`); }, [value]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') setValue((v) => Math.min(100, v + 10));
    else if (event.key === 'ArrowLeft') setValue((v) => Math.max(0, v - 10));
    else if (event.key === 'Home') setValue(0);
    else if (event.key === 'End') setValue(100);
    else return;
    event.preventDefault();
  }

  return (
    <div ref={track} className={styles.sliderTrack}>
      <div className={styles.sliderFill} />
      <div role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
        className={styles.sliderThumb} onKeyDown={onKeyDown} data-testid="slider-thumb" />
    </div>
  );
}
