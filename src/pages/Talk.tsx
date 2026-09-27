import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { Coffee, LifeBuoy, MapPin, MessageCircleQuestion, Mic, Volume2, type LucideIcon } from '../components/ui/icons'
import { SafetyBanner } from '../components/SafetyBanner'
import { VoicePopup, type VoicePhase } from '../components/talk/VoicePopup'
import { isSpeechAvailable, listenOnce, sttProvider } from '../lib/speech'
import { isTtsAvailable, speak } from '../lib/tts'

/**
 * 🎤 고민 라우터 — 단계 A (PRD v1.5 §3).
 * 분류 주체는 사용자 자신(큰 아이콘 4택). 음성은 텍스트를 미리 채워 주는 가산점 기능.
 * 안전장치: 상시 도움 배너(§3.2-1), 음성의 제3자 전송 고지(§3.2-4).
 *
 * v1.4(PRD_v1.4 §3.1): 음성 입력을 상태가 보이는 팝업으로 — 고지 · 듣는 중 · 완료 · 취소 · 오류.
 * 이 화면은 상태만 관리하고 그리기는 VoicePopup 이 한다. 음성 라이브러리(speech.ts)는 그대로다.
 */

/** 완료 표시(체크)를 보여 주는 시간. */
const DONE_HOLD_MS = 700

/** 오류 원인별 문구(라이브러리 무변경 — 던져진 오류의 이름·메시지로만 판정). */
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
  // "취소됨" 표식을 듣기 회차 번호로 둔다: 취소·다시 시작·화면 이탈 뒤에 늦게 도착한 결과·오류는
  // 회차가 달라 버려진다(인식 자체는 침묵 또는 5초 뒤 스스로 끝난다 — speech.ts 무변경).
  const runRef = useRef(0)
  const doneTimerRef = useRef<number | null>(null)
  const micButtonRef = useRef<HTMLButtonElement>(null)

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
    setPhase('listening')
    try {
      const text = await listenOnce(locale)
      if (run !== runRef.current) return
      if (!text) {
        // 아무 말도 안 들렸으면 오류 문구 없이 바로 대기로
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
      setErrorKey(speechErrorKey(error))
      setPhase('error')
    }
  }

  /** 듣는 중 그만하기·바깥 탭, 오류 닫기 — 이후 도착하는 결과는 버린다. */
  const stopListening = () => {
    runRef.current += 1
    setPhase('idle')
  }

  const options = [
    { icon: MessageCircleQuestion as LucideIcon, labelKey: 'talk.optAsk', descKey: 'talk.optAskDesc', color: 'bg-sky-50 border-sky-300',
      go: () => navigate('/board/new', { state: { prefill: transcript, category: 'question', fromTalk: true } }) },
    { icon: MapPin as LucideIcon, labelKey: 'talk.optPlace', descKey: 'talk.optPlaceDesc', color: 'bg-green-50 border-green-300',
      go: () => navigate('/life-info?from=talk') },
    { icon: LifeBuoy as LucideIcon, labelKey: 'talk.optHard', descKey: 'talk.optHardDesc', color: 'bg-amber-50 border-amber-400',
      go: () => navigate('/life-info?category=support&from=talk') },
    { icon: Coffee as LucideIcon, labelKey: 'talk.optChat', descKey: 'talk.optChatDesc', color: 'bg-rose-50 border-rose-300',
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">{t('talk.title')}</h1>
        {isTtsAvailable() ? (
          <button
            type="button"
            onClick={readAloud}
            className="flex min-h-[44px] items-center gap-1 rounded-full border border-gray-300 px-3 text-sm text-gray-700"
          >
            <Volume2 aria-hidden size={18} strokeWidth={2.25} />
            {t('talk.readAloud')}
          </button>
        ) : null}
      </div>
      <p className="text-sm text-gray-600">{t('talk.subtitle')}</p>

      {isSpeechAvailable() ? (
        <div className="rounded-card border border-gray-100 bg-white shadow-card px-4 py-3">
          <button
            ref={micButtonRef}
            type="button"
            onClick={() => (noticeAccepted ? void startListening() : setPhase('notice'))}
            disabled={phase !== 'idle'}
            aria-haspopup="dialog"
            className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full bg-brand-greenDark px-4 text-xl font-extrabold tracking-tight text-white transition-transform duration-100 ease-out active:scale-[0.96] motion-reduce:transition-none"
          >
            <Mic aria-hidden size={26} strokeWidth={2.25} />
            {t('talk.micButton')}
          </button>
          {transcript ? (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-gray-800">
              “{transcript}”
              <span className="mt-1 block text-xs text-gray-500">{t('talk.transcriptHint')}</span>
            </p>
          ) : null}
          <VoicePopup
            phase={phase}
            noticeKey={sttProvider() === 'external' ? 'talk.micNoticeExternal' : 'talk.micNotice'}
            errorKey={errorKey}
            onAgree={() => void startListening()}
            onDecline={() => setPhase('idle')}
            onStop={stopListening}
            onRetry={() => void startListening()}
            onClose={stopListening}
            returnFocusRef={micButtonRef}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {options.map((opt) => (
          <button
            key={opt.labelKey}
            type="button"
            onClick={opt.go}
            className={`flex min-h-[72px] items-center gap-4 rounded-card border-2 px-4 text-left ${opt.color}`}
          >
            <opt.icon aria-hidden size={30} strokeWidth={2} className="shrink-0 text-gray-800" />
            <span>
              <span className="block text-base font-bold text-gray-900">{t(opt.labelKey)}</span>
              <span className="block text-xs text-gray-600">{t(opt.descKey)}</span>
            </span>
          </button>
        ))}
      </div>

      <SafetyBanner />
    </section>
  )
}
