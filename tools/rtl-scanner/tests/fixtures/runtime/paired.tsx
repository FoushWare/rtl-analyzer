import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { prefixer } from 'stylis';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { createTheme, ThemeProvider } from '@mui/material/styles';
const ltrCache = createCache({ key: 'css', stylisPlugins: [prefixer] });
const rtlCache = createCache({ key: 'atlas-rtl', stylisPlugins: [prefixer, rtlPlugin] });
const ltrTheme = createTheme({ direction: 'ltr' });
const rtlTheme = createTheme({ direction: 'rtl' });
export function Runtime({ direction }: { direction: string }) {
  document.documentElement.dir = direction === 'rtl' ? 'rtl' : 'ltr';
  return <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
    <ThemeProvider theme={direction === 'rtl' ? rtlTheme : ltrTheme}><div /></ThemeProvider>
  </CacheProvider>;
}
