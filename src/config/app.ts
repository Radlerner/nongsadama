// 앱 전역 설정.
//
// 국가·언어 비종속 원칙(PRD 0·6장):
// - 아래 supportedLocales / defaultLocale 은 "설정 데이터"이며 비즈니스 로직 분기가 아니다.
// - 특정 코드('vi', 'ko' 등)로 로직을 분기하지 않는다. 언어 추가는 이 배열과
//   src/i18n/dictionaries 에 사전 파일을 더하는 것만으로 가능해야 한다(DB 변경 불필요).
// - 파일럿 지역/검증 언어(PRD 14장)가 확정되면 이 값만 교체한다.

export type Locale = string

export interface AppConfig {
  /** 화면에 노출할 지원 언어 목록(ISO 639 언어 코드). */
  supportedLocales: Locale[]
  /** 사용자가 언어를 아직 고르지 않았을 때 사용할 기본 언어. */
  defaultLocale: Locale
}

export const appConfig: AppConfig = {
  supportedLocales: ['ko', 'en'],
  // 임시 기본값. 대상 사용자(한국어 미숙 외국인 근로자)를 고려하면 최종값이 아니며,
  // 파일럿 검증 언어(PRD 14장 미확정) 확정 시 교체한다. 사용자가 선택 화면에서
  // 언어를 고르면 이 값 대신 선택값이 사용된다. (docs/DECISIONS.md 참고)
  defaultLocale: 'ko',
}

// 각 언어를 그 언어 자체 이름(endonym)으로 표시하기 위한 라벨.
// UI 언어와 무관하게 고정 표기하여, 읽지 못하는 UI 언어와 상관없이 자신의 언어를 찾게 한다.
// 언어 추가 시 여기에도 라벨을 더한다(없으면 코드를 그대로 노출).
export const localeLabels: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
}

export function getLocaleLabel(code: Locale): string {
  return localeLabels[code] ?? code.toUpperCase()
}

// 간편(소셜) 로그인 제공자 목록 — 설정 데이터(하드코딩 금지 원칙).
// Supabase 대시보드(Authentication→Providers)에서 활성화된 것만 넣는다.
// 추가 시 i18n에 `auth.<provider>Start` 키와 Login.tsx의 브랜드 스타일만 더하면 된다.
export const oauthProviders = ['kakao'] as const
export type OAuthProvider = (typeof oauthProviders)[number]

/** 신고 접수용 운영자 연락처(설정값 — 코드 하드코딩 금지). */
export const operatorEmail = 'casualpe@gmail.com'

/** 계정 삭제 요청 전용 연락처(Google Play 계정 삭제 URL 제출용 — /delete-account, /privacy§4, 앱 내 실패 안내). */
export const deletionRequestEmail = 'dmkim@nongsadama.app'

/** 계정 삭제 요청 mailto 제목 — /delete-account·/privacy·Profile 세 곳이 같은 제목을 쓴다(D-032). */
export const deletionRequestMailto = `mailto:${deletionRequestEmail}?subject=${encodeURIComponent(
  '[NongsaDaMa] 계정 삭제 요청 / Account deletion request',
)}`

/** 아동 안전 신고·문의 연락처(Google Play 아동 안전 표준 제출용 — /child-safety). */
export const childSafetyEmail = 'dmkim@nongsadama.app'

/** 공식 서비스 주소(D-016). 공유·QR 등 외부 노출용. */
export const officialSiteUrl = 'https://nongsadama.app/'

/**
 * 지역·지도 설정(v1.1, D-033) — 특정 시·군에 종속되지 않는 폴백값.
 * 지역 목록·중심좌표는 DB(regions)가 유일한 출처이며, 여기에는 "지역을 모를 때"의 값만 둔다.
 */
export const regionConfig = {
  /** 선택 지역·부모 시군 어디에도 중심좌표가 없거나 지역 미선택일 때의 지도 중심(대한민국 전역 보기). */
  defaultMapCenter: { lat: 36.35, lng: 127.8 },
  /** 전역 보기 줌 — 카카오 level(클수록 넓게), Leaflet zoom(클수록 좁게). */
  defaultMapKakaoLevel: 13,
  defaultMapLeafletZoom: 7,
  /** 읍·면 단위 선택 지역의 줌. */
  regionMapKakaoLevel: 9,
  regionMapLeafletZoom: 11,
  /** 시·군 단위 선택(읍·면이 없는 시·군, 시·군청 중심)의 줌 — 시·군 전체가 담기도록 한 단계 넓게. */
  cityMapKakaoLevel: 10,
  cityMapLeafletZoom: 10,
  /** "내 위치" 이후 최소 확대 정도(전국 보기에서 눌러도 동네가 보이도록). 이미 더 가까우면 유지. */
  locateKakaoLevel: 8,
  locateLeafletZoom: 12,
  /** 이 거리(km)보다 멀면 "서비스 지역 밖" — 지역을 자동 선택하지 않고 안내만 한다. */
  outOfAreaKm: 30,
} as const

// 음성 인식(Web Speech API)용 BCP-47 태그. 설정 데이터이며 로직 분기가 아니다.
// 언어 추가 시 여기에 태그를 더한다(없으면 locale 코드를 그대로 사용).
export const speechLangTags: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
}
