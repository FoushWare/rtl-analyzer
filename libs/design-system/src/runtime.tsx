import { useLayoutEffect, type ReactNode } from "react";
import { useLocale } from "@atlas/shared";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "@mui/stylis-plugin-rtl";

// The public English theme remains the sole LTR configuration owner.
export const theme = createTheme({
  direction: "ltr",
  palette: {
    primary: { main: "#4c58d6" },
    background: { default: "#f7f8fb" },
    text: { primary: "#202738", secondary: "#7a8294" },
  },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
    h4: { fontWeight: 700, fontSize: "1.8rem", letterSpacing: "-.7px" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { padding: "10px 18px" } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#edf0f5", padding: "17px 20px" },
        head: {
          fontSize: 11,
          fontWeight: 700,
          color: "#80889a",
          letterSpacing: ".6px",
          background: "#fafbfc",
        },
      },
    },
  },
});

export const rtlTheme = createTheme({
  direction: "rtl",
  palette: {
    primary: { main: "#4c58d6" },
    background: { default: "#f7f8fb" },
    text: { primary: "#202738", secondary: "#7a8294" },
  },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
    h4: { fontWeight: 700, fontSize: "1.8rem", letterSpacing: "-.7px" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { padding: "10px 18px" } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#edf0f5", padding: "17px 20px" },
        head: {
          fontSize: 11,
          fontWeight: 700,
          color: "#80889a",
          letterSpacing: ".6px",
          background: "#fafbfc",
        },
      },
    },
  },
});

const ltrCache = createCache({ key: "css", stylisPlugins: [prefixer] });
const rtlCache = createCache({ key: "atlas-rtl", stylisPlugins: [prefixer, rtlPlugin] });
export function Provider({ children }: { children: ReactNode }) {
  const { language } = useLocale();
  useLayoutEffect(() => {
    document.documentElement.lang = language === "ar" ? "ar-EG" : "en";
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  return <CacheProvider value={language === "ar" ? rtlCache : ltrCache}>
    <ThemeProvider theme={language === "ar" ? rtlTheme : theme}>
      <CssBaseline />{children}
    </ThemeProvider>
  </CacheProvider>;
}
