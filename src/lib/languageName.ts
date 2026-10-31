import { localeLabels, type Locale } from '../config/app'

/*
 * 언어 이름을 그 언어 자체 이름(endonym)으로: 원문 알약(게시판)과 이웃 카드의 언어 칩이 함께 쓴다.
 * 결과가 기기마다 달라지지 않게 고정 표를 먼저 본다 — 기기 Intl 자료에 따라 'km'이 '크메르어'처럼
 * 화면 언어로 나오는 일을 막는다.
 *  1. 앱 UI 언어 9개(ko·en·vi·km·th·ne·mn·uz·ru): config/app.ts의 localeLabels — 언어 바꾸기 창과 같은 이름
 *  2. 그 밖에 농촌에서 자주 보는 언어: 아래 ENDONYMS
 *  3. 표에 없는 코드만 Intl로 찾는다.
 */
const ENDONYMS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  vi: 'Tiếng Việt',
  km: 'ខ្មែរ',
  ne: 'नेपाली',
  th: 'ไทย',
  tl: 'Filipino',
  id: 'Bahasa Indonesia',
  my: 'မြန်မာ',
  uz: 'Oʻzbekcha',
  mn: 'Монгол',
  zh: '中文',
  si: 'සිංහල',
  bn: 'বাংলা',
  lo: 'ລາວ',
  ru: 'Русский',
  kk: 'Қазақ тілі',
  ky: 'Кыргызча',
  ja: '日本語',
  tet: 'Tetun',
  ur: 'اردو',
  hi: 'हिन्दी',
}

/** 'km-KH' · 'KM' · 'zh_Hant' → 'km' · 'km' · 'zh' */
function normalise(code: string): string {
  return code.trim().toLowerCase().split(/[-_]/)[0] ?? ''
}

function capitalise(name: string, lang: string): string {
  try {
    return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1)
  } catch {
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
}

/**
 * Intl로 찾은 이름. 잘못된 태그면 null.
 * strict면 기기에 displayLocale 자료가 없어 기본 언어로 떨어진 결과(예: 'km' → '크메르어')도 null.
 */
function intlName(code: string, displayLocale: string, strict: boolean): string | null {
  try {
    const dn = new Intl.DisplayNames([displayLocale], { type: 'language' })
    if (strict && normalise(dn.resolvedOptions().locale) !== normalise(displayLocale)) return null
    const name = dn.of(code)
    if (name && name.toLowerCase() !== code.toLowerCase()) return capitalise(name, displayLocale)
  } catch {
    // 잘못된 언어 태그 또는 DisplayNames 미지원: 다음 단계로
  }
  return null
}

function resolve(code: string, uiLocale?: Locale): { text: string; lang: string | undefined } {
  const c = normalise(code)
  const fixed = localeLabels[c] ?? ENDONYMS[c]
  if (fixed) return { text: fixed, lang: c }
  if (c) {
    const own = intlName(c, c, true)
    if (own) return { text: own, lang: c }
    if (uiLocale) {
      const inUi = intlName(c, uiLocale, false)
      if (inUi) return { text: inUi, lang: uiLocale }
    }
  }
  return { text: (c || code).toUpperCase(), lang: undefined }
}

/** 언어 코드 → 그 언어로 쓴 이름. 예: 'km' → 'ខ្មែរ', 'vi-VN' → 'Tiếng Việt'. 모르는 코드는 화면 언어 이름, 그것도 없으면 대문자 코드 */
export function languageEndonym(code: string, uiLocale?: Locale): string {
  return resolve(code, uiLocale).text
}

/** languageEndonym이 돌려준 글자가 쓰인 언어(BCP-47) — lang 속성용. 대문자 코드로 떨어지면 undefined */
export function languageEndonymLang(code: string, uiLocale?: Locale): string | undefined {
  return resolve(code, uiLocale).lang
}
