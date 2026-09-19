import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_STT_MODEL,
  MAX_AUDIO_BYTES,
  attachLanguageHint,
  isAllowedAudio,
  readLanguage,
  readRateLimitConfig,
  readSttModel,
} from './parse.ts'

test('rate limit fails closed when both env values are unset', () => {
  const env: Record<string, string | undefined> = {}
  assert.deepEqual(readRateLimitConfig((k) => env[k]), { kind: 'invalid' })
})

test('rate limit invalid when only one env value is set', () => {
  assert.equal(readRateLimitConfig((k) => (k === 'STT_RATE_LIMIT_MAX' ? '10' : undefined)).kind, 'invalid')
  assert.equal(
    readRateLimitConfig((k) => (k === 'STT_RATE_LIMIT_WINDOW_SECONDS' ? '60' : undefined)).kind,
    'invalid',
  )
})

test('rate limit on when both env values are positive integers', () => {
  const env: Record<string, string | undefined> = {
    STT_RATE_LIMIT_MAX: '20',
    STT_RATE_LIMIT_WINDOW_SECONDS: '3600',
  }
  assert.deepEqual(readRateLimitConfig((k) => env[k]), { kind: 'on', max: 20, windowSeconds: 3600 })
})

test('rate limit invalid for non-integer env', () => {
  const env: Record<string, string | undefined> = {
    STT_RATE_LIMIT_MAX: '20.5',
    STT_RATE_LIMIT_WINDOW_SECONDS: '3600',
  }
  assert.equal(readRateLimitConfig((k) => env[k]).kind, 'invalid')
})

test('language missing vs invalid vs bcp47', () => {
  assert.deepEqual(readLanguage(null), { error: 'language_missing' })
  assert.deepEqual(readLanguage(''), { error: 'language_missing' })
  assert.deepEqual(readLanguage('   '), { error: 'language_missing' })
  assert.deepEqual(readLanguage(1), { error: 'language_invalid' })
  assert.deepEqual(readLanguage('k'), { error: 'language_invalid' })
  assert.deepEqual(readLanguage('ko_KR'), { error: 'language_invalid' })
  assert.deepEqual(readLanguage('ko-KR'), { language: 'ko-KR', iso639: 'ko' })
  assert.deepEqual(readLanguage('en'), { language: 'en', iso639: 'en' })
})

test('webm types allowed, others rejected', () => {
  assert.equal(isAllowedAudio({ type: 'audio/webm', name: 'speech.webm' }), true)
  assert.equal(isAllowedAudio({ type: 'audio/webm;codecs=opus', name: 'speech.webm' }), true)
  assert.equal(isAllowedAudio({ type: 'video/webm', name: 'speech.webm' }), true)
  assert.equal(isAllowedAudio({ type: '', name: 'speech.webm' }), true)
  assert.equal(isAllowedAudio({ type: 'application/octet-stream', name: 'speech.webm' }), true)
  assert.equal(isAllowedAudio({ type: 'audio/mpeg', name: 'a.mp3' }), false)
  assert.equal(isAllowedAudio({ type: 'audio/wav', name: 'a.wav' }), false)
})

test('model comes from one env with a single default', () => {
  assert.equal(readSttModel(() => undefined), DEFAULT_STT_MODEL)
  assert.equal(readSttModel((k) => (k === 'STT_MODEL' ? 'whisper-1' : undefined)), 'whisper-1')
})

test('language hint field depends on model', () => {
  const a = new FormData()
  attachLanguageHint(a, 'gpt-transcribe', 'ko')
  assert.equal(a.get('languages[]'), 'ko')
  assert.equal(a.get('language'), null)

  const b = new FormData()
  attachLanguageHint(b, 'whisper-1', 'vi')
  assert.equal(b.get('language'), 'vi')
  assert.equal(b.get('languages[]'), null)

  const c = new FormData()
  attachLanguageHint(c, 'gpt-4o-mini-transcribe', 'en')
  assert.equal(c.get('language'), 'en')
})

test('size cap is 1 MiB', () => {
  assert.equal(MAX_AUDIO_BYTES, 1_048_576)
})

test('rate limit rejects values outside PostgreSQL integer range', () => {
  for (const value of ['0', '-1', '2147483648', '9007199254740992']) {
    assert.equal(readRateLimitConfig(() => value).kind, 'invalid')
  }
})
