import { useEffect, useState } from 'react';
import { copy, type Lang } from './copy';
import { Drawer } from './Drawer';
import { Rating } from './Rating';
import { Slider } from './Slider';
import { Tabs } from './Tabs';
import { Toolbar } from './Toolbar';
import styles from './Interaction.module.css';

function param(name: string, allowed: string[], fallback: string) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value !== null && allowed.includes(value) ? value : fallback;
}

export function App() {
  const direction = param('direction', ['ltr', 'rtl'], 'ltr');
  const lang: Lang = direction === 'rtl' ? 'ar' : 'en';
  const t = copy[lang];
  const [drawer, setDrawer] = useState(param('drawer', ['open', 'closed'], 'closed') === 'open');

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
  }, [direction, lang]);

  return (
    <div id="playground" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <button type="button" id="menu-button" className={styles.button} aria-expanded={drawer} aria-controls="drawer"
          onClick={() => setDrawer(true)}>{t.menu}</button>
        <a className={styles.langLink} href={`?direction=${direction === 'rtl' ? 'ltr' : 'rtl'}`}>{t.language}: {direction === 'rtl' ? 'English' : 'العربية'}</a>
      </header>
      <Drawer open={drawer} items={t.menuItems} label={t.menu} closeLabel={t.close}
        onClose={() => { setDrawer(false); document.getElementById('menu-button')?.focus(); }} />
      <main id="cases" className={styles.main}>
        <section className={styles.card}><h2>Tabs</h2><Tabs label={t.tabsLabel} tabs={t.tabs} /></section>
        <section className={styles.card}><h2>Rating</h2><Rating label={t.ratingLabel} valueText={t.ratingValue} /></section>
        <section className={styles.card}><h2>Custom slider</h2><Slider label={t.sliderLabel} /></section>
        <section className={styles.card}>
          <h2>Controls</h2>
          <Toolbar label={t.toolbarLabel} items={t.toolbar} />
          <label className={styles.nativeLabel}>{t.nativeLabel}
            <input type="range" min={0} max={100} defaultValue={30} className={styles.native} data-testid="native-range" />
          </label>
        </section>
      </main>
    </div>
  );
}
