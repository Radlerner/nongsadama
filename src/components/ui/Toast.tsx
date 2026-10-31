import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

export interface ToastProps {
  open: boolean
  message: string
  /** 사라질 때(타이머·행동 누름) 부른다 — 부모가 open=false로 */
  onClose: () => void
  /** 오른쪽 글자 버튼 하나(예: 보기) */
  action?: { label: string; to?: string; onClick?: () => void }
  /** 기본 check(완료). 실패 안내면 alert */
  icon?: IconName
  /** 기본 4000ms. 0이면 자동으로 닫지 않는다 */
  durationMs?: number
  /**
   * 바뀌면 자동 닫힘 타이머를 다시 시작한다 — 같은 문구를 다시 보여 줄 때(예: Date.now()).
   * key=로 다시 마운트하지 말 것: aria-live 영역이 새로 들어가 읽히지 않을 수 있다.
   */
  showKey?: string | number
}

/**
 * 토스트(키트 4.10): 잉크 바탕 + 흰 글자 + 토스트 그림자. 솟은 말하기 버튼 위(--float-bottom)에 뜬다.
 * aria-live=polite로 읽힌다. 쌓임 z-[900]: 화면 안 떠 있는 버튼(홈 지도 z-[500])보다 위, 바텀시트·말하기 덮개(z-[1000])보다 아래.
 */
export function Toast({
  open,
  message,
  onClose,
  action,
  icon = 'check',
  durationMs = 4000,
  showKey,
}: ToastProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || durationMs <= 0) return
    const id = window.setTimeout(() => onCloseRef.current(), durationMs)
    return () => window.clearTimeout(id)
  }, [open, durationMs, message, showKey])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[var(--float-bottom)] z-[900] mx-auto max-w-screen-sm px-4"
    >
      {open ? (
        <div className="anim-fade pointer-events-auto flex min-h-[52px] items-center gap-2.5 rounded-xl bg-ink py-1 pl-4 pr-1 text-white shadow-float">
          <Icon name={icon} size={20} strokeWidth={2} className={icon === 'alert' ? 'text-ma-200' : 'text-nong-200'} />
          <span className="flex-1 py-2 text-label">{message}</span>
          {action ? (
            action.to ? (
              <Link
                to={action.to}
                onClick={() => {
                  action.onClick?.()
                  onClose()
                }}
                className="flex h-11 items-center rounded-lg px-3 text-label text-nong-200"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  action.onClick?.()
                  onClose()
                }}
                className="flex h-11 items-center rounded-lg px-3 text-label text-nong-200"
              >
                {action.label}
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
