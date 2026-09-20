import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import ts from 'typescript'

const harness = { client: null }
globalThis.integrationHarness = harness
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/lib/nativeOAuth.ts')
      || context.parentURL?.endsWith('/src/lib/speech.ts')
      || context.parentURL?.endsWith('/src/lib/kakaoMap.ts')) {
      if (specifier === './supabase') {
        return { url: 'data:text/javascript,export const isSupabaseConfigured = true; export const getSupabaseClient = () => globalThis.integrationHarness.client', shortCircuit: true }
      }
      if (specifier === '../config/app') {
        return { url: 'data:text/javascript,export const speechLangTags = { ko: "ko-KR", en: "en-US" }', shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/src/lib/nativeOAuth.ts') || url.endsWith('/src/lib/speech.ts') || url.endsWith('/src/lib/kakaoMap.ts')) {
      const source = readFileSync(new URL(url), 'utf8')
        .replaceAll('import.meta.env.VITE_STT_ENDPOINT', JSON.stringify('https://stt.test'))
        .replaceAll('import.meta.env.VITE_KAKAO_MAP_KEY', 'undefined')
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})
const { readNativeOAuthCode, completeNativeOAuth } = await import('../src/lib/nativeOAuth.ts')
const { listenOnce } = await import('../src/lib/speech.ts')
const { getKakaoMapKey } = await import('../src/lib/kakaoMap.ts')

test('Kakao map key falls back to read-only Supabase config', async () => {
  harness.client = {
    from(table) {
      assert.equal(table, 'map_config')
      return {
        select(columns) {
          assert.equal(columns, 'kakao_javascript_key')
          return {
            eq(column, value) {
              assert.equal(column, 'id')
              assert.equal(value, true)
              return {
                maybeSingle: async () => ({
                  data: { kakao_javascript_key: '0123456789abcdef0123456789abcdef' },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  }
  assert.equal(await getKakaoMapKey(), '0123456789abcdef0123456789abcdef')
})

test('native callback only accepts the exact route and one authorization code', () => {
  for (const value of ['invalid', 'https://auth/callback?code=x', 'com.nongsadama.myapp://evil/callback?code=x',
    'com.nongsadama.myapp://auth/other?code=x', 'com.nongsadama.myapp://name@auth/callback?code=x']) {
    assert.equal(readNativeOAuthCode(value), null)
  }
  for (const query of ['', '?code=', '?code=x&code=y', '?error=access_denied', '?code=x#access_token=example']) {
    assert.throws(() => readNativeOAuthCode(`com.nongsadama.myapp://auth/callback${query}`), /oauth-callback-invalid/)
  }
  assert.equal(readNativeOAuthCode('com.nongsadama.myapp://auth/callback?code=example-code'), 'example-code')
})

test('duplicate warm and cold callbacks exchange once; errors are sanitized', async () => {
  let calls = 0
  harness.client = { auth: { exchangeCodeForSession: async () => {
    calls++
    return { data: { session: { user: { id: 'test-user' } } }, error: null }
  } } }
  const url = 'com.nongsadama.myapp://auth/callback?code=duplicate-test'
  assert.deepEqual(await Promise.all([completeNativeOAuth(url), completeNativeOAuth(url)]), [true, true])
  assert.equal(await completeNativeOAuth(url), true)
  assert.equal(calls, 1)
  harness.client.auth.exchangeCodeForSession = async () => ({ data: {}, error: { message: 'private details' } })
  await assert.rejects(completeNativeOAuth('com.nongsadama.myapp://auth/callback?code=failed-test'), { message: 'oauth-exchange-failed' })
})

test('STT requires a session before recording, refreshes it before upload and releases the microphone', async (t) => {
  const originalFetch = globalThis.fetch
  const originalRecorder = globalThis.MediaRecorder
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let microphoneRequests = 0
  let stoppedTracks = 0
  let uploads = 0
  let sessions = []
  let failedUpload = false
  let recordingError = false
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.MediaRecorder = originalRecorder
    Object.defineProperty(globalThis, 'navigator', originalNavigator)
  })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: async () => {
      microphoneRequests++
      return { getTracks: () => [{ stop: () => { stoppedTracks++ } }] }
    } },
  } })
  globalThis.MediaRecorder = class {
    state = 'inactive'
    static isTypeSupported(type) { return type === 'audio/webm;codecs=opus' }
    constructor(_stream, options) { assert.equal(options.mimeType, 'audio/webm;codecs=opus') }
    start() {
      this.state = 'recording'
      queueMicrotask(() => {
        if (recordingError) { this.onerror(); return }
        this.ondataavailable({ data: new Blob(['test-audio']) })
        this.stop()
      })
    }
    stop() { this.state = 'inactive'; this.onstop() }
  }
  harness.client = { auth: { getSession: async () => ({ data: { session: sessions.shift() ?? null }, error: null }) } }
  globalThis.fetch = async (url, options) => {
    uploads++
    assert.equal(url, 'https://stt.test')
    assert.equal(options.headers.Authorization, 'Bearer refreshed-test-token')
    assert.equal(options.body.get('language'), 'ko-KR')
    assert.equal(options.body.get('file').type, 'audio/webm;codecs=opus')
    assert.equal(options.body.get('file').name, 'speech.webm')
    return Response.json(failedUpload ? { error: 'rate_limited' } : { text: '인식 결과' }, { status: failedUpload ? 429 : 200 })
  }
  const session = (token = 'refreshed-test-token') => ({ access_token: token, user: { id: 'test-user' } })
  await assert.rejects(listenOnce('ko'), /stt-login-required/)
  assert.equal(microphoneRequests, 0)
  sessions = [{ ...session(), user: { is_anonymous: true } }]
  await assert.rejects(listenOnce('ko'), /stt-login-required/)
  assert.equal(microphoneRequests, 0)
  sessions = [session('old-test-token'), session()]
  assert.equal(await listenOnce('ko'), '인식 결과')
  assert.equal(stoppedTracks, 1)
  sessions = [session()]
  await assert.rejects(listenOnce('ko'), /stt-login-required/)
  assert.equal(uploads, 1)
  assert.equal(stoppedTracks, 2)
  sessions = [session(), session()]
  failedUpload = true
  await assert.rejects(listenOnce('ko'), /stt-http-429/)
  assert.equal(stoppedTracks, 3)
  sessions = [session()]
  recordingError = true
  await assert.rejects(listenOnce('ko'), /stt-recording-failed/)
  assert.equal(stoppedTracks, 4)
})

test('PKCE uses the same persisted verifier and restores the resulting session after client recreation', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const expiry = Math.floor(Date.now() / 1000) + 3600
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: expiry, sub: 'test-user' })).toString('base64url')}.test`
  let challenge
  const options = {
    auth: { flowType: 'pkce', storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input))
      assert.equal(url.origin, 'https://supabase.test')
      if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 })
      assert.equal(url.searchParams.get('grant_type'), 'pkce')
      const body = JSON.parse(init.body)
      assert.equal(body.auth_code, 'test-authorization-code')
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.code_verifier))
      assert.equal(Buffer.from(digest).toString('base64url'), challenge)
      return Response.json({ access_token: token, refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer', user: { id: 'test-user' } })
    } },
  }
  const initial = createClient('https://supabase.test', 'test-anon-key', options)
  const { data: start, error: startError } = await initial.auth.signInWithOAuth({
    provider: 'kakao', options: { redirectTo: 'com.nongsadama.myapp://auth/callback', skipBrowserRedirect: true },
  })
  assert.equal(startError, null)
  const authorize = new URL(start.url)
  challenge = authorize.searchParams.get('code_challenge')
  assert.ok(challenge)
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256')
  assert.equal(authorize.searchParams.get('redirect_to'), 'com.nongsadama.myapp://auth/callback')
  const returned = createClient('https://supabase.test', 'test-anon-key', options)
  const events = []
  const { data: subscription } = returned.auth.onAuthStateChange((event) => { events.push(event) })
  const { data, error } = await returned.auth.exchangeCodeForSession('test-authorization-code')
  assert.equal(error, null)
  assert.equal(data.session.user.id, 'test-user')
  assert.ok(events.includes('SIGNED_IN'))
  const reopened = createClient('https://supabase.test', 'test-anon-key', options)
  assert.equal((await reopened.auth.getSession()).data.session.user.id, 'test-user')
  assert.equal((await reopened.auth.signOut()).error, null)
  assert.equal((await reopened.auth.getSession()).data.session, null)
  subscription.subscription.unsubscribe()
})
