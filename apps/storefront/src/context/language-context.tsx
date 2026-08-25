"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "bn" | "en";
type Copy = { en: string; bn: string };

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: (copy: Copy) => string;
}>({ locale: "en", setLocale: () => undefined, text: (copy) => copy.en });

const STORAGE_KEY = "sellpilot-language";

export function LanguageProvider({ children, detectedLocale = "en" }: { children: React.ReactNode; detectedLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(detectedLocale);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "bn" || saved === "en") { setLocaleState(saved); return; }
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const browserLanguage = navigator.language.toLowerCase();
      if (detectedLocale === "bn" || zone === "Asia/Dhaka" || browserLanguage.startsWith("bn")) setLocaleState("bn");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detectedLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === "bn" ? "bn-BD" : "en";
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale(next: Locale) {
      window.localStorage.setItem(STORAGE_KEY, next);
      setLocaleState(next);
    },
    text(copy: Copy) { return copy[locale]; },
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageSwitch({ inverse = false }: { inverse?: boolean }) {
  const { locale, setLocale } = useLanguage();
  return <div className={`language-switch ${inverse ? "is-inverse" : ""}`} role="group" aria-label="Language">
    <button type="button" aria-pressed={locale === "bn"} onClick={() => setLocale("bn")}>বাংলা</button>
    <span aria-hidden="true">/</span>
    <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
  </div>;
}
