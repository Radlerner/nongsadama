import type { Locale } from '../config/app'

/**
 * 국적(선택) 저장과 국적 → 언어 결정(PRD v1.4 §3.2).
 * 국적은 기기(localStorage)에만 두며 확인하지 않는다. 국가 목록·기본 언어는 DB(countries)가 유일한 출처라
 * 여기에는 국가 코드를 적지 않는다(국가·언어 비종속 원칙).
 */
const STORAGE_KEY = 'nongsadama.country'
const ISO_ALPHA2 = /^[A-Z]{2}$/

/** 국적 기본 언어가 앱에 없을 때 두는 언어(PRD v1.4 §3.2 상태 B). */
export const COUNTRY_FALLBACK_LOCALE: Locale = 'en'

/** countries 행에서 언어 결정에 쓰는 부분. */
export interface CountryLocales {
  default_locale: string
  supported_locales: string[]
}

export function readStoredCountry(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && ISO_ALPHA2.test(stored) ? stored : null
  } catch {
    // 저장소 접근이 막힌 브라우저(사생활 보호 모드 등)에서는 "고르지 않음"으로 본다.
    return null
  }
}

export function writeStoredCountry(isoCode: string): void {
  if (typeof window === 'undefined' || !ISO_ALPHA2.test(isoCode)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, isoCode)
  } catch {
    // 저장 실패는 화면 동작을 막지 않는다(이번 방문 동안은 상태로 유지된다).
  }
}

export function clearStoredCountry(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 위와 같음
  }
}

/**
 * 국적을 골랐을 때 앱 언어로 둘 값.
 * 국적 기본 언어가 앱 지원 언어에 있으면 그 언어(matched=true), 없으면 English(matched=false).
 */
export function pickLocaleForCountry(
  country: CountryLocales,
  supportedLocales: readonly Locale[],
): { locale: Locale; matched: boolean } {
  if (supportedLocales.includes(country.default_locale)) {
    return { locale: country.default_locale, matched: true }
  }
  return { locale: COUNTRY_FALLBACK_LOCALE, matched: false }
}

/** 언어 창 맨 위 "내 국적 언어"에 고정할 언어들 — 기본 언어가 맨 앞, 앱이 지원하는 것만, 중복 없이. */
export function pinnedLocalesForCountry(
  country: CountryLocales,
  supportedLocales: readonly Locale[],
): Locale[] {
  const ordered = [country.default_locale, ...country.supported_locales]
  return ordered.filter(
    (code, index) => supportedLocales.includes(code) && ordered.indexOf(code) === index,
  )
}
