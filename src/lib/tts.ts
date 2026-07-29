import type { Locale } from '../config/app'
import { speechLangTags } from '../config/app'

/**
 * 브라우저 내장 TTS(speechSynthesis) — 무료·계정 불요·기기 내 처리.
 * 저문해력 사용자를 위한 "읽어주기"(PRD v1.5 §1). 실패해도 조용히 무시(가산점 기능).
 */
export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, locale: Locale): void {
  if (!isTtsAvailable() || !text.trim()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = speechLangTags[locale] ?? locale
  utter.rate = 0.95
  synth.speak(utter)
}

export function stopSpeaking(): void {
  if (isTtsAvailable()) window.speechSynthesis.cancel()
}
