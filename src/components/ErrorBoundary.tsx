import { Component, type ReactNode } from 'react'

/**
 * 최상위 오류 경계(Play 심사 준비 7순위, D-024).
 * Provider(I18n 포함) 크래시까지 잡아야 하므로 번역 시스템에 의존하지 않고
 * 한국어+영어를 정적으로 병기한다(의도된 i18n 예외 — D-020과 같은 취지).
 */
interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // 원인 추적용 최소 로그(개인정보 미포함)
    console.error('[nongsadama] render crash:', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-4 bg-white px-6 text-center text-gray-900">
        <p className="text-4xl" aria-hidden>
          🧩
        </p>
        <h1 className="text-lg font-bold">문제가 생겼어요 / Something went wrong</h1>
        <p className="text-sm text-gray-600">
          화면을 다시 불러오면 대부분 해결됩니다.
          <br />
          Reloading usually fixes this.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-[56px] rounded-md bg-brand-greenDark px-8 py-3 text-base font-semibold text-white"
        >
          다시 불러오기 / Reload
        </button>
      </div>
    )
  }
}
