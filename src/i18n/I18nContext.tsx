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
const EXPLICIT_KEY = 'nongsadama.locale.explicit'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale, explicit?: boolean) => void
  localeExplicit: boolean
  localeSelection: number
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
  const [localeExplicit, setLocaleExplicit] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem(STORAGE_KEY))
      && window.localStorage.getItem(EXPLICIT_KEY) !== 'false',
  )
  const [localeSelection, setLocaleSelection] = useState(0)

  // 문서 언어 속성을 현재 locale과 동기화한다(접근성/브라우저 번역).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const setLocale = useCallback((next: Locale, explicit = true) => {
    if (!appConfig.supportedLocales.includes(next)) return
    setLocaleState(next)
    setLocaleExplicit(explicit)
    if (explicit) setLocaleSelection((value) => value + 1)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
      window.localStorage.setItem(EXPLICIT_KEY, String(explicit))
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
      localeExplicit,
      localeSelection,
      supportedLocales: appConfig.supportedLocales,
      t,
    }),
    [locale, setLocale, localeExplicit, localeSelection, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
