import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BottomSheet, TAP_GUARD_MS } from '../ui/BottomSheet'
import { AlertCircle, Check, Mic } from '../ui/icons'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * 말하기 음성 입력 팝업(PRD v1.4 §3.1, D-040).
 * 상태는 Talk.tsx 가 관리하고 여기서는 그리기만 한다: 고지(아래 창) · 듣는 중 · 완료 · 오류(화면 덮개).
 * 음성 라이브러리(speech.ts)는 건드리지 않으므로 파형은 음성 크기와 무관하게 일정하게 번진다.
 * 모션은 전부 CSS(src/index.css) — 감속 모션 설정이면 파형은 정지, 전이는 즉시.
 *
 * 탭 처리:
 * - 바깥 탭은 원과 카드를 뺀 화면 어디서나 통한다(내용 열은 탭을 통과시키고 원·카드만 받는다).
 * - 열린 직후 TAP_GUARD_MS 안의 바깥 탭은 무시한다("말로 하기"를 두 번 누른 경우 바로 취소되지 않게).
 * - 닫히는 동안에도 덮개가 탭을 삼킨다(닫기·그만하기를 두 번 눌러도 아래 화면의 전화 링크·카드가 눌리지 않게).
 */
export type VoicePhase = 'idle' | 'notice' | 'listening' | 'done' | 'error'
type OverlayPhase = 'listening' | 'done' | 'error'

interface VoicePopupProps {
  phase: VoicePhase
  /** 고지 문구 키 — talk.micNotice(브라우저 인식) 또는 talk.micNoticeExternal(외부 인식). 문구는 1.3.2 그대로. */
  noticeKey: string
  /** 오류 문구 키(원인별 3종). */
  errorKey: string
  onAgree: () => void
  onDecline: () => void
  onStop: () => void
  onRetry: () => void
  onClose: () => void
  /** 덮개가 닫히면 포커스를 돌려줄 요소(말로 하기 버튼). */
  returnFocusRef?: RefObject<HTMLElement>
}

export function VoicePopup({
  phase,
  noticeKey,
  errorKey,
  onAgree,
  onDecline,
  onStop,
  onRetry,
  onClose,
  returnFocusRef,
}: VoicePopupProps) {
  const { t } = useTranslation()
  const statusId = useId()
  const noticeId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(0)
  // 덮개는 닫힐 때 사라지는 모션(200ms)을 보여 주고, 그 뒤에도 잠깐 투명하게 남아 탭을 삼킨 다음 없어진다.
  const [shown, setShown] = useState<{ phase: OverlayPhase; closing: boolean } | null>(null)
  const active = phase === 'listening' || phase === 'done' || phase === 'error'

  useEffect(() => {
    if (phase === 'listening' || phase === 'done' || phase === 'error') {
      setShown((previous) => {
        if (!previous || previous.closing) openedAtRef.current = performance.now()
        return { phase, closing: false }
      })
      return
    }
    setShown((previous) => (previous ? { ...previous, closing: true } : previous))
    const timer = window.setTimeout(() => setShown(null), TAP_GUARD_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  // 최신 콜백을 ref 로 읽어 키보드 효과를 매 렌더마다 다시 걸지 않는다.
  const handlers = useRef({ onStop, onClose })
  handlers.current = { onStop, onClose }

  // 덮개가 떠 있는 동안: 본문 스크롤 잠금, Escape(듣는 중=그만하기, 오류=닫기), Tab 은 덮개 안에서만.
  useEffect(() => {
    if (!active) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (phase === 'listening') handlers.current.onStop()
        else if (phase === 'error') handlers.current.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const buttons = Array.from(
        overlayRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
      )
      if (buttons.length === 0) {
        event.preventDefault()
        return
      }
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      const current = document.activeElement
      const outside = !overlayRef.current?.contains(current)
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [active, phase])

  // 덮개가 닫히면(취소·완료·닫기) 포커스를 말로 하기 버튼으로 돌려준다.
  useEffect(() => {
    if (!active) return
    return () => {
      const current = document.activeElement
      if (!current || current === document.body || overlayRef.current?.contains(current)) {
        returnFocusRef?.current?.focus()
      }
    }
  }, [active, returnFocusRef])

  // 상태가 바뀌면 그 상태의 첫 버튼에 포커스(듣는 중=그만하기, 오류=다시 말하기).
  useEffect(() => {
    if (!shown || shown.closing) return
    overlayRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [shown])

  /** 덮개 바깥 탭: 듣는 중이면 그만하기, 오류면 닫기. 완료 표시 중·닫히는 중·열린 직후에는 무시한다. */
  const onOutsideTap = () => {
    if (!shown || shown.closing) return
    if (performance.now() - openedAtRef.current < TAP_GUARD_MS) return
    if (shown.phase === 'listening') onStop()
    else if (shown.phase === 'error') onClose()
  }

  const overlay = shown
    ? createPortal(
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={statusId}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-end"
        >
          <div
            aria-hidden
            className={[
              'absolute inset-0',
              shown.closing ? 'nsd-voice-backdrop-out' : 'nsd-voice-backdrop',
            ].join(' ')}
            onClick={onOutsideTap}
          />
          {/* 버튼은 하단 탭 위쪽 엄지 범위에 둔다(화면 아래에서 64px 이상 위). 빈 곳의 탭은 덮개로 통과시킨다. */}
          <div
            className="pointer-events-none relative flex w-full max-w-screen-sm flex-col items-center gap-8 px-6"
            style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
          >
            <div
              className={[
                'pointer-events-auto relative h-24 w-24',
                shown.closing ? 'nsd-voice-exit' : 'nsd-voice-enter',
              ].join(' ')}
            >
              {shown.phase === 'listening' && !shown.closing
                ? [0, 400, 800].map((delay) => (
                    <span
                      key={delay}
                      aria-hidden
                      className="nsd-voice-ring pointer-events-none absolute inset-0 rounded-full"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))
                : null}
              <div
                key={shown.phase === 'error' ? 'error' : 'steady'}
                className={[
                  'relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-greenDark text-white',
                  shown.phase === 'error' ? 'nsd-voice-shake' : '',
                ].join(' ')}
                style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}
              >
                <span key={shown.phase} aria-hidden className="nsd-voice-icon flex">
                  {shown.phase === 'done' ? (
                    <Check size={44} strokeWidth={2.5} />
                  ) : shown.phase === 'error' ? (
                    <AlertCircle size={44} strokeWidth={2.25} />
                  ) : (
                    <Mic size={44} strokeWidth={2.25} />
                  )}
                </span>
              </div>
            </div>

            <div
              className={[
                'pointer-events-auto w-full rounded-card border border-gray-100 bg-white px-4 py-4 text-center shadow-card',
                shown.closing ? 'nsd-voice-fade-out' : 'nsd-voice-fade-in',
              ].join(' ')}
            >
              <p
                id={statusId}
                role={shown.phase === 'error' ? 'alert' : 'status'}
                className={
                  shown.phase === 'error'
                    ? 'text-base leading-relaxed text-gray-900'
                    : 'text-xl font-extrabold tracking-tight text-gray-900'
                }
              >
                {shown.phase === 'listening'
                  ? t('talk.listening')
                  : shown.phase === 'done'
                    ? t('talk.popupDone')
                    : t(errorKey)}
              </p>
              {shown.phase === 'listening' ? (
                <button
                  type="button"
                  onClick={onStop}
                  disabled={shown.closing}
                  className="mt-4 min-h-[56px] w-full rounded-full border border-gray-300 px-6 py-2 text-base font-semibold text-gray-700 active:bg-gray-50"
                >
                  {t('talk.popupStop')}
                </button>
              ) : null}
              {shown.phase === 'error' ? (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={shown.closing}
                    className="min-h-[56px] w-full rounded-full bg-brand-greenDark px-6 py-2 text-base font-semibold text-white"
                  >
                    {t('talk.popupRetry')}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={shown.closing}
                    className="min-h-[44px] w-full rounded-full border border-gray-300 px-6 py-2 text-base text-gray-700 active:bg-gray-50"
                  >
                    {t('common.close')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <BottomSheet
        open={phase === 'notice'}
        onClose={onDecline}
        title={t('talk.sheetTitle')}
        descriptionId={noticeId}
      >
        <p id={noticeId} className="text-base leading-relaxed text-gray-800">
          {t(noticeKey)}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAgree}
            className="min-h-[56px] w-full rounded-full bg-brand-greenDark px-6 py-2 text-base font-semibold text-white"
          >
            {t('talk.micAgree')}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="min-h-[44px] w-full rounded-full border border-gray-300 px-6 py-2 text-base text-gray-700 active:bg-gray-50"
          >
            {t('talk.micCancel')}
          </button>
        </div>
      </BottomSheet>
      {overlay}
    </>
  )
}
