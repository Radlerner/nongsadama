import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { appConfig, type Locale } from '../config/app'
import { dictionaries } from './dictionaries'

const STORAGE_KEY = 'nongsadama.locale'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  supportedLocales: Locale[]
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

function resolveInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && appConfig.supportedLocales.includes(stored)) {
      return stored
    }
  }
  return appConfig.defaultLocale
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale)

  // 문서 언어 속성을 현재 locale과 동기화한다(접근성/브라우저 번역).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    if (!appConfig.supportedLocales.includes(next)) return
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      const active = dictionaries[locale] ?? dictionaries[appConfig.defaultLocale]
      const fallback = dictionaries[appConfig.defaultLocale]
      return active?.[key] ?? fallback?.[key] ?? key
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      supportedLocales: appConfig.supportedLocales,
      t,
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
