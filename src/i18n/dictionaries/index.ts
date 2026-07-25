import type { Locale } from '../../config/app'
import ko from './ko.json'
import en from './en.json'

export type Dictionary = Record<string, string>

// 언어 코드 -> 사전 매핑(정적 등록소).
// 언어 추가 시: dictionaries 폴더에 <locale>.json 을 만들고 여기 등록한 뒤
// src/config/app.ts 의 supportedLocales 에 코드를 더한다. (DB 변경 불필요)
export const dictionaries: Record<Locale, Dictionary> = {
  ko,
  en,
}
