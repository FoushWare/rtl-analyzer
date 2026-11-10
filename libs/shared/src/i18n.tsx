import { createContext, useContext, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { arabic, type TranslationKey } from "./translations";
import "./demo.css";

type Language = "en" | "ar";
type Params = Record<string, string | number>;
function translator(language: Language) {
  return (key: TranslationKey, params: Params = {}) => {
    const text = language === "ar" ? arabic[key] : key;
    return text.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
  };
}
const english = translator("en");
const LocaleContext = createContext({
  language: "en" as Language,
  demo: false,
  t: english,
  label: (value: string | number) => String(value),
  demoHref: (href: string) => href,
  setLanguage: (() => {}) as (language: Language) => void,
});
export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const demo = query.get("demo") === "unmigrated-rtl";
  const language: Language = demo && query.get("lang") === "ar" ? "ar" : "en";
  const t = translator(language);
  function demoHref(href: string) {
    if (!demo || /^(mailto:|tel:|#)/.test(href)) return href;
    const url = new URL(href, window.location.origin);
    url.searchParams.set("demo", "unmigrated-rtl");
    url.searchParams.set("lang", language);
    return /^https?:/.test(href) ? url.href : `${url.pathname}${url.search}${url.hash}`;
  }
  return (
    <LocaleContext.Provider value={{
      demo, language, t, demoHref,
      label: (value) => Object.hasOwn(arabic, String(value))
        ? t(String(value) as TranslationKey) : String(value),
      setLanguage: (next) => {
        const params = new URLSearchParams(location.search);
        params.set("demo", "unmigrated-rtl");
        params.set("lang", next);
        navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash });
      },
    }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function DemoControls() {
  const { demo, language, setLanguage } = useLocale();
  if (!demo) return null;
  return (
    <section className="atlas-demo-controls" aria-label="RTL demonstration controls">
      {language === "ar" && (
        <strong>Unmigrated RTL — demonstration only <span> / RTL غير مُرحّل — عرض تجريبي فقط</span></strong>
      )}
      <label>
        Language / اللغة{" "}
        <select aria-label="Language / اللغة" value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </label>
    </section>
  );
}
