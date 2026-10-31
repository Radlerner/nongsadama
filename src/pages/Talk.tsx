import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { SafetyBanner } from '../components/SafetyBanner'
import { VoicePopup, type VoicePhase } from '../components/talk/VoicePopup'
import { isSpeechAvailable, listenOnce, sttProvider } from '../lib/speech'
import { isTtsAvailable, speak } from '../lib/tts'
import { Button, cn, EmptyState, Icon, TONE_TEXT, type IconName, type Tone } from '../components/ui'

/**
 * 말하기(고민 라우터) — 단계 A (PRD v1.5 §3).
 * 분류 주체는 사용자 자신(큰 아이콘 4택). 음성은 텍스트를 미리 채워 주는 가산점 기능.
 * 안전장치: 상시 도움 배너(§3.2-1), 음성의 제3자 전송 고지(§3.2-4).
 *
 * v1.4(PRD_v1.4 §3.1): 음성 입력을 상태가 보이는 창으로 — 고지 · 듣는 중 · 알아듣는 중(외부 인식) · 완료 · 취소 · 오류.
 * 이 화면은 상태만 관리하고 그리기는 VoicePopup(바텀시트) 이 한다.
 * 디자인 v5: 가운데 큰 초록 마이크 + 한 줄 안내, 들은 말 카드, 아래 4택은 흰 카드 줄(아이콘 + 제목 + 설명 + 화살표).
 */

/** 완료 표시(체크)를 보여 주는 시간. */
const DONE_HOLD_MS = 700

/** 오류 원인별 문구(던져진 오류의 이름·메시지로만 판정). */
function speechErrorKey(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message === 'stt-login-required') return 'talk.speechErrorLogin'
  if (name === 'NotAllowedError' || message === 'not-allowed') return 'talk.speechErrorPermission'
  return 'talk.speechError'
}

export function Talk() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [transcript, setTranscript] = useState('')
  const [phase, setPhase] = useState<VoicePhase>('idle')
  // 제3자 전송 고지를 이 화면에서 1회 이상 확인했는가(§3.2-4 — transcript 유무로 대신하지 않는다)
  const [noticeAccepted, setNoticeAccepted] = useState(false)
  const [errorKey, setErrorKey] = useState('talk.speechError')
  // 아무 말도 듣지 못하고 끝났을 때 마이크 아래에 한 줄로 알린다(창은 바로 닫는다)
  const [noSpeech, setNoSpeech] = useState(false)
  // "취소됨" 표식을 듣기 회차 번호로 둔다: 취소·다시 시작·화면 이탈 뒤에 늦게 도착한 결과·오류는
  // 회차가 달라 버려진다(인식 자체는 침묵 또는 5초 뒤 스스로 끝난다).
  const runRef = useRef(0)
  const doneTimerRef = useRef<number | null>(null)
  const micButtonRef = useRef<HTMLButtonElement>(null)
  const statusId = useId()
  const optionsHeadingId = useId()

  useEffect(
    () => () => {
      runRef.current += 1
      if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current)
    },
    [],
  )

  const startListening = async () => {
    const run = ++runRef.current
    if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current)
    setNoticeAccepted(true)
    setNoSpeech(false)
    setPhase('listening')
    try {
      // 외부 인식은 녹음이 정말 끝난 순간에 알려 준다 → 그때부터 "알아듣는 중". Web Speech는 결과가 올 때까지 "듣고 있어요".
      const text = await listenOnce(locale, {
        onProcessing: () => {
          if (run === runRef.current) setPhase('processing')
        },
      })
      if (run !== runRef.current) return
      if (!text) {
        // 아무 말도 안 들렸으면 오류 창 없이 대기로 — 마이크 아래 한 줄로만 알린다
        setNoSpeech(true)
        setPhase('idle')
        return
      }
      setTranscript(text)
      setPhase('done')
      doneTimerRef.current = window.setTimeout(() => {
        if (run === runRef.current) setPhase('idle')
      }, DONE_HOLD_MS)
    } catch (error) {
      if (run !== runRef.current) return
      const key = speechErrorKey(error)
      // 인식은 인터넷이 있어야 한다(브라우저 회사·외부 서버). 오프라인 실패는 연결 안내로 보인다.
      setErrorKey(key === 'talk.speechError' && !navigator.onLine ? 'common.offline' : key)
      setPhase('error')
    }
  }

  /** 듣는 중 그만하기·바깥 탭, 오류 닫기 — 이후 도착하는 결과는 버린다. */
  const stopListening = () => {
    runRef.current += 1
    setPhase('idle')
  }

  const options: { icon: IconName; tone: Tone; labelKey: string; descKey: string; go: () => void }[] = [
    { icon: 'edit', tone: 'da', labelKey: 'talk.optAsk', descKey: 'talk.optAskDesc',
      go: () => navigate('/board/new', { state: { prefill: transcript, category: 'question', fromTalk: true } }) },
    { icon: 'pin', tone: 'nong', labelKey: 'talk.optPlace', descKey: 'talk.optPlaceDesc',
      go: () => navigate('/life-info?from=talk') },
    { icon: 'shield', tone: 'nong', labelKey: 'talk.optHard', descKey: 'talk.optHardDesc',
      go: () => navigate('/life-info?category=support&from=talk') },
    { icon: 'message', tone: 'da', labelKey: 'talk.optChat', descKey: 'talk.optChatDesc',
      go: () => navigate('/board/new', { state: { prefill: transcript, category: 'help', fromTalk: true } }) },
  ]

  const readAloud = () => {
    // 화면 전체를 현재 언어로 읽어준다(기기 내 TTS, 전송 없음) — 저문해력 지원
    const lines = [
      t('talk.title'),
      ...options.map((o) => `${t(o.labelKey)}. ${t(o.descKey)}`),
    ]
    speak(lines.join('. '), locale)
  }

  const busy = phase !== 'idle'
  const statusLine = noSpeech ? t('talk.noSpeech') : transcript ? '' : t('talk.micHint')

  return (
    <section className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h1 className="flex-1 pt-1.5 text-title text-ink">{t('talk.title')}</h1>
        {isTtsAvailable() ? (
          <Button variant="secondary" size="sm" icon="speaker" onClick={readAloud} className="shrink-0">
            {t('talk.readAloud')}
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-body text-ink-body">{t('talk.subtitle')}</p>

      {isSpeechAvailable() ? (
        <div className="mt-6 flex flex-col items-center text-center">
          <button
            ref={micButtonRef}
            type="button"
            onClick={() => {
              // 창이 열려 있는 동안은 아무것도 하지 않는다. disabled 대신 aria-disabled라 초점이 버튼에 남는다
              // (창이 닫히면 여기로 돌아온다).
              if (busy) return
              if (noticeAccepted) void startListening()
              else setPhase('notice')
            }}
            aria-disabled={busy || undefined}
            aria-haspopup="dialog"
            aria-describedby={statusId}
            className="group flex flex-col items-center gap-3 rounded-2xl px-6 pb-1 pt-2 aria-disabled:cursor-default"
          >
            <span
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-full text-white transition-colors',
                busy ? 'bg-nong-700' : 'bg-nong-600 group-hover:bg-nong-700 group-active:bg-nong-700',
              )}
            >
              <Icon name="mic" size={40} strokeWidth={2} />
            </span>
            <span className="text-label text-ink">{t('talk.micButton')}</span>
          </button>
          <p id={statusId} role="status" aria-live="polite" className="mt-1 min-h-[21px] text-small text-ink-muted">
            {statusLine}
          </p>
          <VoicePopup
            phase={phase}
            noticeKey={sttProvider() === 'external' ? 'talk.micNoticeExternal' : 'talk.micNotice'}
            errorKey={errorKey}
            transcript={transcript}
            onAgree={() => void startListening()}
            onDecline={() => setPhase('idle')}
            onStop={stopListening}
            onRetry={() => void startListening()}
            onClose={stopListening}
            onLogin={() => navigate('/login')}
            returnFocusRef={micButtonRef}
          />
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon="mic-off"
          title={t('talk.unsupportedTitle')}
          body={t('talk.unsupportedBody')}
        />
      )}

      {transcript ? (
        <div className="mt-4 rounded-xl bg-surface px-4 py-3">
          <p className="text-caption font-bold text-ink-muted">{t('talk.heard')}</p>
          <p className="mt-1 text-body text-ink">“{transcript}”</p>
          <p className="mt-2 text-caption text-ink-muted">{t('talk.transcriptHint')}</p>
        </div>
      ) : null}

      <h2 id={optionsHeadingId} className="mt-8 text-section text-ink">
        {t('talk.chooseTitle')}
      </h2>
      <ul aria-labelledby={optionsHeadingId} className="mt-3 overflow-hidden rounded-xl border border-line">
        {options.map((opt, i) => (
          <li key={opt.labelKey}>
            <button
              type="button"
              onClick={opt.go}
              className="flex min-h-[72px] w-full items-center gap-3 pl-4 pr-3 text-left transition-colors hover:bg-surface focus-visible:-outline-offset-2 active:bg-surface-2"
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface',
                  TONE_TEXT[opt.tone],
                )}
              >
                <Icon name={opt.icon} size={22} />
              </span>
              <span
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 self-stretch py-3',
                  i < options.length - 1 && 'border-b border-line',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold text-ink">{t(opt.labelKey)}</span>
                  <span className="block text-caption text-ink-muted">{t(opt.descKey)}</span>
                </span>
                <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <SafetyBanner />
      </div>
    </section>
  )
}
