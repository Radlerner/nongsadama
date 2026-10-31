import { Component, type ReactNode } from 'react'
// 바렐(ui/index) 대신 개별 파일에서 가져온다: 이 셋은 컨텍스트 훅을 쓰지 않아 Provider 밖에서도 안전하다.
import { Button, buttonClasses } from './ui/Button'
import { Icon } from './ui/Icon'
import { LogoMark, Wordmark } from './ui/Logo'

/**
 * 최상위 오류 경계(Play 심사 준비 7순위, D-024).
 * Provider(I18n 포함) 크래시까지 잡아야 하므로 번역 시스템에 의존하지 않고
 * 한국어+영어를 정적으로 병기한다(의도된 i18n 예외 — D-020과 같은 취지).
 * 라우터 밖이라 홈 링크는 <a href>(BASE_URL)로 둔다.
 * 디자인 v5: 흰 바탕 + 원본 로고 머리줄 + 회색 원 안 느낌표 + 48px 다시 불러오기(주 버튼 하나) + 홈 링크.
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
      <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
        <header className="bg-white pt-[var(--safe-top)]">
          <div className="flex h-14 items-center gap-2 pl-4">
            <LogoMark />
            <Wordmark />
            <span className="sr-only">농사다마 NongsaDaMa</span>
          </div>
        </header>
        <main role="alert" className="flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger">
            <Icon name="alert" size={26} />
          </span>
          <h1 className="mt-4 text-title text-ink">
            문제가 생겼어요
            <span lang="en" className="mt-0.5 block text-section text-ink-body">
              Something went wrong
            </span>
          </h1>
          <p className="mt-3 max-w-[300px] text-body text-ink-body">
            화면을 다시 불러오면 대부분 해결돼요.
            <br />
            <span lang="en">Reloading usually fixes this.</span>
          </p>
          <Button icon="refresh" className="mt-6 min-w-[240px]" onClick={() => window.location.reload()}>
            다시 불러오기 / Reload
          </Button>
          <a
            href={import.meta.env.BASE_URL}
            className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-2' })}
          >
            홈으로 / Go home
          </a>
        </main>
      </div>
    )
  }
}
