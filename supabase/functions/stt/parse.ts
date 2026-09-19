export const MAX_AUDIO_BYTES = 1_048_576
export const DEFAULT_STT_MODEL = 'gpt-transcribe'

const LANGUAGE_RE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/

export type RateLimitConfig =
  | { kind: 'on'; max: number; windowSeconds: number }
  | { kind: 'invalid' }

export type LanguageResult =
  | { error: 'language_missing' }
  | { error: 'language_invalid' }
  | { language: string; iso639: string }

function parsePositiveInt(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n < 1 || n > 2_147_483_647) return null
  return n
}

export function readRateLimitConfig(getEnv: (key: string) => string | undefined): RateLimitConfig {
  const maxRaw = getEnv('STT_RATE_LIMIT_MAX')
  const windowRaw = getEnv('STT_RATE_LIMIT_WINDOW_SECONDS')
  const maxUnset = maxRaw == null || maxRaw === ''
  const windowUnset = windowRaw == null || windowRaw === ''
  if (maxUnset || windowUnset) return { kind: 'invalid' }
  const max = parsePositiveInt(maxRaw)
  const windowSeconds = parsePositiveInt(windowRaw)
  if (max == null || windowSeconds == null) return { kind: 'invalid' }
  return { kind: 'on', max, windowSeconds }
}

export function readSttModel(getEnv: (key: string) => string | undefined): string {
  const raw = getEnv('STT_MODEL')?.trim()
  return raw ? raw : DEFAULT_STT_MODEL
}

export function readLanguage(raw: unknown): LanguageResult {
  if (raw == null) return { error: 'language_missing' }
  if (typeof raw !== 'string') return { error: 'language_invalid' }
  const language = raw.trim()
  if (language === '') return { error: 'language_missing' }
  if (language.length < 2 || language.length > 35 || !LANGUAGE_RE.test(language)) {
    return { error: 'language_invalid' }
  }
  return { language, iso639: language.split('-')[0].toLowerCase() }
}

export function isAllowedAudio(file: { type: string; name: string }): boolean {
  const type = (file.type || '').toLowerCase().split(';')[0].trim()
  const name = (file.name || '').toLowerCase()
  if (type === 'audio/webm' || type === 'video/webm') return true
  if ((type === '' || type === 'application/octet-stream') && name.endsWith('.webm')) return true
  return false
}

export function attachLanguageHint(form: FormData, model: string, iso639: string): void {
  if (model === 'whisper-1' || model.startsWith('gpt-4o-')) {
    form.append('language', iso639)
    return
  }
  form.append('languages[]', iso639)
}
