import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { SafetyBanner } from '../components/SafetyBanner'
import { isSpeechAvailable, listenOnce } from '../lib/speech'
import { isTtsAvailable, speak } from '../lib/tts'

/**
 * 🎤 고민 라우터 — 단계 A (PRD v1.5 §3).
 * 분류 주체는 사용자 자신(큰 아이콘 4택). 음성은 텍스트를 미리 채워 주는 가산점 기능.
 * 안전장치: 상시 도움 배너(§3.2-1), 음성의 제3자 전송 고지(§3.2-4).
 */
export function Talk() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [showMicNotice, setShowMicNotice] = useState(false)
  // 제3자 전송 고지를 이 화면에서 1회 이상 확인했는가(§3.2-4 — transcript 유무로 대신하지 않는다)
  const [noticeAccepted, setNoticeAccepted] = useState(false)
  const [speechError, setSpeechError] = useState(false)

  const startListening = async () => {
    setShowMicNotice(false)
    setNoticeAccepted(true)
    setSpeechError(false)
    setListening(true)
    try {
      const text = await listenOnce(locale)
      if (text) setTranscript(text)
    } catch {
      setSpeechError(true)
    } finally {
      setListening(false)
    }
  }

  const options = [
    { icon: '💬', labelKey: 'talk.optAsk', descKey: 'talk.optAskDesc', color: 'bg-sky-50 border-sky-300',
      go: () => navigate('/board/new', { state: { prefill: transcript, category: 'question', fromTalk: true } }) },
    { icon: '📍', labelKey: 'talk.optPlace', descKey: 'talk.optPlaceDesc', color: 'bg-green-50 border-green-300',
      go: () => navigate('/life-info?from=talk') },
    { icon: '🆘', labelKey: 'talk.optHard', descKey: 'talk.optHardDesc', color: 'bg-amber-50 border-amber-400',
      go: () => navigate('/life-info?category=support&from=talk') },
    { icon: '☕', labelKey: 'talk.optChat', descKey: 'talk.optChatDesc', color: 'bg-rose-50 border-rose-300',
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
            <span aria-hidden>🔊</span>
            {t('talk.readAloud')}
          </button>
        ) : null}
      </div>
      <p className="text-sm text-gray-600">{t('talk.subtitle')}</p>

      {isSpeechAvailable() ? (
        <div className="rounded-card border border-gray-100 bg-white shadow-card px-4 py-3">
          <button
            type="button"
            onClick={() => (noticeAccepted ? void startListening() : setShowMicNotice(true))}
            disabled={listening}
            className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full bg-brand-greenDark text-xl font-extrabold tracking-tight text-white disabled:opacity-60"
          >
            <span aria-hidden className="text-2xl">🎤</span>
            {listening ? t('talk.listening') : t('talk.micButton')}
          </button>
          {showMicNotice ? (
            <div className="mt-3 rounded-md bg-gray-50 px-3 py-3 text-xs text-gray-700">
              {/* §3.2-4: Web Speech는 브라우저 제공사 서버로 음성을 전송한다 — 사용 전 고지 */}
              <p>{t('talk.micNotice')}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void startListening()}
                  className="min-h-[44px] flex-1 rounded-full bg-brand-greenDark font-semibold text-white"
                >
                  {t('talk.micAgree')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMicNotice(false)}
                  className="min-h-[44px] flex-1 rounded-full border border-gray-300 text-gray-700"
                >
                  {t('talk.micCancel')}
                </button>
              </div>
            </div>
          ) : null}
          {transcript ? (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-gray-800">
              “{transcript}”
              <span className="mt-1 block text-xs text-gray-500">{t('talk.transcriptHint')}</span>
            </p>
          ) : null}
          {speechError ? (
            <p className="mt-3 text-xs text-red-700">{t('talk.speechError')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {options.map((opt) => (
          <button
            key={opt.labelKey}
            type="button"
            onClick={opt.go}
            className={`flex min-h-[72px] items-center gap-4 rounded-xl border-2 px-4 text-left ${opt.color}`}
          >
            <span aria-hidden className="text-3xl">{opt.icon}</span>
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
