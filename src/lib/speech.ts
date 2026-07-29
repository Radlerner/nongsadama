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

// ── 외부 STT 어댑터(환경변수 게이트) ──────────────────────────────────────
// VITE_STT_ENDPOINT 가 설정되면 브라우저 Web Speech 대신 지정 엔드포인트로 전환한다.
// 계약: POST multipart(form field "file"=audio/webm, "language"=BCP-47) → JSON {"text": string}
// (예: 운영자가 띄운 Whisper 프록시. 키가 없으면 이 코드는 어떤 요청도 만들지 않는다.)
const sttEndpoint = import.meta.env.VITE_STT_ENDPOINT as string | undefined
const sttKey = import.meta.env.VITE_STT_KEY as string | undefined

export type SttProvider = 'external' | 'webspeech' | 'none'

export function sttProvider(): SttProvider {
  if (sttEndpoint && typeof navigator !== 'undefined' && navigator.mediaDevices) return 'external'
  if (getCtor() !== null) return 'webspeech'
  return 'none'
}

/** 이 브라우저에서 음성 입력을 쓸 수 있는가(없어도 아이콘 4택으로 완주 가능 — 가산점 기능). */
export function isSpeechAvailable(): boolean {
  return sttProvider() !== 'none'
}

const EXTERNAL_RECORD_MS = 5000

async function listenViaExternal(locale: Locale): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  try {
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.start()
    await new Promise((r) => setTimeout(r, EXTERNAL_RECORD_MS))
    recorder.stop()
    await stopped
    const form = new FormData()
    form.append('file', new Blob(chunks, { type: 'audio/webm' }), 'speech.webm')
    form.append('language', speechLangTags[locale] ?? locale)
    const res = await fetch(sttEndpoint as string, {
      method: 'POST',
      headers: sttKey ? { Authorization: `Bearer ${sttKey}` } : undefined,
      body: form,
    })
    if (!res.ok) throw new Error(`stt-http-${res.status}`)
    const data = (await res.json()) as { text?: string }
    return data.text ?? ''
  } finally {
    for (const track of stream.getTracks()) track.stop()
  }
}

/**
 * 한 번 듣고 최종 텍스트를 돌려준다.
 * 주의: Web Speech API는 음성을 브라우저 제공사 서버로 전송해 인식한다(기기 내 처리가 아님).
 * 호출 전 UI에서 이 사실을 고지해야 한다(PRD v1.5 §3.2-4). 우리 서버에는 아무것도 저장하지 않는다.
 */
export function listenOnce(locale: Locale): Promise<string> {
  if (sttProvider() === 'external') {
    return listenViaExternal(locale)
  }
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
