// Google Analytics 4 (환경변수 게이트)
// - VITE_GA_MEASUREMENT_ID 가 설정된 빌드에서만 로드된다(로컬 dev는 미설정 → 요청 0,
//   개발 트래픽이 통계를 오염시키지 않음).
// - SPA 라우팅이므로 자동 page_view를 끄고(send_page_view:false) 라우트 변경마다
//   수동 전송한다(AnalyticsListener).
// - 개인정보: GA는 제3자(Google) 전송이다 — 개인정보 처리방침(§10-J)에 고지 항목 필요.
//   PII(이메일·닉네임 등)는 이벤트로 보내지 않는다. 측정 ID는 공개값이다.

export const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let initialized = false

export function initAnalytics(): void {
  if (!gaMeasurementId || initialized || typeof window === 'undefined') return
  initialized = true

  window.dataLayer = window.dataLayer ?? []
  // 공식 스니펫과 동일하게 arguments 객체를 push해야 gtag.js가 인식한다(배열 불가).
  function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag = gtag as (...args: unknown[]) => void

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`
  document.head.appendChild(script)

  window.gtag('js', new Date())
  window.gtag('config', gaMeasurementId, { send_page_view: false })
}

/** 현재 문서 상태 기준으로 page_view 1건 전송(초기 로드 + 라우트 변경마다 호출). */
export function trackPageView(): void {
  if (!initialized || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  })
}
