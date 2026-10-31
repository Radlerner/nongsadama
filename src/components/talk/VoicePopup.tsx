import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { BottomSheet, TAP_GUARD_MS } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { SlowHint } from '../ui/SlowHint'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * 말하기 음성 입력 창(PRD v1.4 §3.1, D-040 · 디자인 v5).
 * 상태는 Talk.tsx 가 관리하고 여기서는 그리기만 한다. 한 장의 바텀시트(BottomSheet)가 열린 채로 내용만 바뀐다:
 * 고지 → 듣는 중 → (외부 인식이면) 알아듣는 중 → 다 들었어요 / 오류. 음성 라이브러리(speech.ts)는 인식 결과만 주므로
 * 듣는 중 파형은 음성 크기와 무관하게 일정하게 번진다. 모션은 전부 CSS(src/index.css) — 움직임 줄이기면 멈춘다.
 *
 * 탭 처리(v1.4 그대로):
 * - 상태가 바뀐 직후 TAP_GUARD_MS 안의 탭(바깥·버튼)은 무시한다. "말로 하기"·"알겠어요, 말하기"·"다시 말하기"를
 *   두 번 누르면 둘째 탭이 방금 나타난 "그만하기"에 닿아 바로 취소되기 때문이다. 듣는 중 → 알아듣는 중은
 *   그만하기가 그대로라 가드를 다시 걸지 않는다. Escape는 탭이 아니라 가드 없이 바로 처리한다(v1.4 e4cc9f7).
 * - 바깥 탭·Escape: 고지 = 안 할래요, 듣는 중·알아듣는 중 = 그만하기, 오류 = 닫기, 완료 표시 중 = 무시.
 * - 창이 닫힌 뒤에도 잠깐 탭을 삼킨다(BottomSheet) — 닫기·그만하기를 두 번 눌러도 아래 화면이 눌리지 않게.
 * 포커스: 고지는 창 자체(동의 버튼에 Enter 실수 방지, 설명이 먼저 읽힘), 그 뒤 상태마다 그 상태의 첫 버튼
 * (듣는 중 = 그만하기, 오류 = 다시 말하기). 닫히면 말로 하기 버튼으로 돌아간다.
 */
export type VoicePhase = 'idle' | 'notice' | 'listening' | 'processing' | 'done' | 'error'

interface VoicePopupProps {
  phase: VoicePhase
  /** 고지 문구 키 — talk.micNotice(브라우저 인식) 또는 talk.micNoticeExternal(외부 인식). 문구는 1.3.2 그대로. */
  noticeKey: string
  /** 오류 문구 키(원인별: talk.speechError · talk.speechErrorPermission · talk.speechErrorLogin · 오프라인 common.offline). */
  errorKey: string
  /** 다 들었어요 상태에서 보여 줄 들은 말 */
  transcript?: string
  onAgree: () => void
  onDecline: () => void
  onStop: () => void
  onRetry: () => void
  onClose: () => void
  /** 로그인이 필요한 오류(외부 인식)에서 '로그인'을 누르면 */
  onLogin?: () => void
  /** 창이 닫히면 포커스를 돌려줄 요소(말로 하기 버튼). */
  returnFocusRef?: RefObject<HTMLElement>
}

/** 오류 문구 키 → 창 제목 키 */
function errorTitleKey(errorKey: string): string {
  if (errorKey === 'talk.speechErrorPermission') return 'talk.deniedTitle'
  if (errorKey === 'talk.speechErrorLogin') return 'talk.loginTitle'
  return 'talk.speechErrorTitle'
}

export function VoicePopup({
  phase,
  noticeKey,
  errorKey,
  transcript,
  onAgree,
  onDecline,
  onStop,
  onRetry,
  onClose,
  onLogin,
  returnFocusRef,
}: VoicePopupProps) {
  const { t } = useTranslation()
  const noticeId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const changedAtRef = useRef(0)
  const prevPhaseRef = useRef(phase)
  const open = phase !== 'idle'

  // 상태가 바뀐 시각(그리기 전) — 바로 뒤의 탭은 앞 상태를 두 번 누른 것의 둘째 탭으로 본다.
  // 듣는 중 → 알아듣는 중은 그만하기 버튼·바깥 탭 동작이 그대로라 가드를 다시 걸지 않는다.
  useLayoutEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (prev === 'listening' && phase === 'processing') return
    changedAtRef.current = performance.now()
  }, [phase])

  // 상태가 바뀌면 그 상태의 첫 버튼에 포커스(고지는 BottomSheet이 창 자체에 둔다, 완료는 버튼이 없어 창에 남는다).
  useEffect(() => {
    if (phase === 'idle' || phase === 'notice' || phase === 'done') return
    contentRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [phase])

  const guarded = (action: () => void) => () => {
    if (performance.now() - changedAtRef.current < TAP_GUARD_MS) return
    action()
  }

  const dismissNow = () => {
    if (phase === 'notice') onDecline()
    else if (phase === 'listening' || phase === 'processing') onStop()
    else if (phase === 'error') onClose()
  }
  /** 바깥 탭(가드) · Escape는 가드 없이(v1.4 e4cc9f7) */
  const dismiss = guarded(dismissNow)

  const title =
    phase === 'notice'
      ? t('talk.sheetTitle')
      : phase === 'processing'
        ? t('talk.processing')
        : phase === 'done'
          ? t('talk.popupDone')
          : phase === 'error'
            ? t(errorTitleKey(errorKey))
            : t('talk.listening')

  const statusText =
    phase === 'listening'
      ? t('talk.listeningHint')
      : phase === 'processing'
        ? t('talk.processingHint')
        : phase === 'done'
          ? transcript
            ? `“${transcript}”`
            : ''
          : phase === 'error'
            ? t(errorKey)
            : ''

  const loginError = errorKey === 'talk.speechErrorLogin' && Boolean(onLogin)

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      onEscape={dismissNow}
      title={title}
      descriptionId={phase === 'notice' ? noticeId : undefined}
      initialFocus={phase === 'notice' ? 'panel' : 'first'}
      returnFocusRef={returnFocusRef}
    >
      <div ref={contentRef}>
        {phase === 'notice' ? (
          <>
            <p id={noticeId} className="text-body text-ink-body">
              {t(noticeKey)}
            </p>
            <Button fullWidth wrap icon="mic" className="mt-5" onClick={guarded(onAgree)}>
              {t('talk.micAgree')}
            </Button>
            <Button fullWidth wrap variant="tertiary" className="mt-2" onClick={guarded(onDecline)}>
              {t('talk.micCancel')}
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <VoiceCircle phase={phase} />
            {/* 상태 줄은 상태가 바뀌어도 같은 요소로 남아 있어 바뀐 글이 읽힌다 */}
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'mt-4 min-h-[25px] max-w-[320px] text-body',
                phase === 'done' ? 'font-bold text-ink' : 'text-ink-body',
              )}
            >
              {statusText}
            </p>
            {/* 알아듣는 중이 8초를 넘으면 느린 연결 안내 */}
            <SlowHint busy={phase === 'processing'} className="mt-1" />
            <div className="mt-5 flex w-full flex-col gap-2">
              {phase === 'listening' || phase === 'processing' ? (
                <Button fullWidth wrap variant="secondary" icon="x" onClick={guarded(onStop)}>
                  {t('talk.popupStop')}
                </Button>
              ) : null}
              {phase === 'error' ? (
                <>
                  {loginError ? (
                    <Button fullWidth wrap onClick={guarded(() => onLogin?.())}>
                      {t('auth.submitLogin')}
                    </Button>
                  ) : (
                    <Button fullWidth wrap icon="mic" onClick={guarded(onRetry)}>
                      {t('talk.popupRetry')}
                    </Button>
                  )}
                  <Button fullWidth wrap variant="tertiary" onClick={guarded(onClose)}>
                    {t('common.close')}
                  </Button>
                </>
              ) : null}
              {/* 다 들었어요: 버튼 없이 잠깐 보인 뒤 닫힌다. 높이를 맞춰 창이 출렁이지 않게 자리만 둔다 */}
              {phase === 'done' ? <div aria-hidden="true" className="h-12" /> : null}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** 가운데 96px 원: 듣는 중 = 초록 원 + 번지는 테 · 알아듣는 중 = 스피너 · 완료 = 체크 · 오류 = 회색 원 안 느낌표(흔들림). */
function VoiceCircle({ phase }: { phase: VoicePhase }) {
  const error = phase === 'error'
  return (
    <div aria-hidden="true" className="relative mt-2 flex h-28 w-28 items-center justify-center">
      {phase === 'listening'
        ? [0, 400, 800].map((delay) => (
            <span
              key={delay}
              className="nsd-voice-ring pointer-events-none absolute inset-2 rounded-full"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))
        : null}
      <span
        key={error ? 'error' : 'steady'}
        className={cn(
          'relative flex h-24 w-24 items-center justify-center rounded-full',
          error
            ? 'nsd-voice-shake bg-surface text-danger'
            : phase === 'processing'
              ? 'bg-nong-700 text-white'
              : 'bg-nong-600 text-white',
        )}
      >
        <span key={phase} className="nsd-voice-icon flex">
          {phase === 'processing' ? (
            // 큰 원 안의 스피너(40px). 글자는 바로 아래 상태 줄과 창 제목이 함께 보인다
            <span className="block h-10 w-10 animate-spin rounded-full border-[3px] border-white/40 border-t-white [animation-duration:0.8s]" />
          ) : phase === 'done' ? (
            <Icon name="check-plain" size={44} strokeWidth={2.5} />
          ) : error ? (
            <Icon name="alert" size={44} strokeWidth={2} />
          ) : (
            <Icon name="mic" size={44} strokeWidth={2} />
          )}
        </span>
      </span>
    </div>
  )
}
