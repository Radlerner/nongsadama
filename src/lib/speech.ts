import type { Locale } from '../config/app'
import { speechLangTags } from '../config/app'

// Web Speech API 최소 타입(브라우저 내장, @types 미포함 환경 대비)
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** 이 브라우저에서 음성 입력을 쓸 수 있는가(없어도 아이콘 4택으로 완주 가능 — 가산점 기능). */
export function isSpeechAvailable(): boolean {
  return getCtor() !== null
}

/**
 * 한 번 듣고 최종 텍스트를 돌려준다.
 * 주의: Web Speech API는 음성을 브라우저 제공사 서버로 전송해 인식한다(기기 내 처리가 아님).
 * 호출 전 UI에서 이 사실을 고지해야 한다(PRD v1.5 §3.2-4). 우리 서버에는 아무것도 저장하지 않는다.
 */
export function listenOnce(locale: Locale): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = getCtor()
    if (!Ctor) {
      reject(new Error('speech-unavailable'))
      return
    }
    const rec = new Ctor()
    rec.lang = speechLangTags[locale] ?? locale
    rec.interimResults = false
    rec.maxAlternatives = 1
    let settled = false
    rec.onresult = (event) => {
      settled = true
      resolve(event.results[0]?.[0]?.transcript ?? '')
    }
    rec.onerror = (event) => {
      settled = true
      reject(new Error(event.error))
    }
    rec.onend = () => {
      if (!settled) resolve('')
    }
    rec.start()
  })
}
