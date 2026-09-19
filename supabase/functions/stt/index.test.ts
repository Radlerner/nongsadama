import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { MAX_AUDIO_BYTES } from './parse.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'jsr:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context)
  },
})

const env: Record<string, string> = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  OPENAI_API_KEY: 'test-openai-key',
  STT_RATE_LIMIT_MAX: '2',
  STT_RATE_LIMIT_WINDOW_SECONDS: '60',
}
let handler: (req: Request) => Promise<Response>
Object.assign(globalThis, {
  Deno: {
    env: { get: (key: string) => env[key] },
    serve: (callback: typeof handler) => { handler = callback },
  },
})
await import('./index.ts')

function request(fields: { file?: Blob; language?: string } = {}, token = 'valid') {
  const form = new FormData()
  if (fields.file) form.append('file', fields.file, 'speech.webm')
  if (fields.language !== undefined) form.append('language', fields.language)
  return new Request('https://edge.test/stt', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
}

const audio = new Blob(['audio'], { type: 'audio/webm' })

test('STT handler validates auth, uploads, quotas and upstream responses', async (t) => {
  let calls = 0
  let allowed = true
  let rpcFailed = false
  let upstreamStatus = 200
  let upstreamBody: unknown = { text: '인식 결과' }
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/auth/v1/user')) {
      const token = new Headers(init?.headers).get('authorization')
      if (token === 'Bearer invalid') return Response.json({ message: 'invalid token' }, { status: 401 })
      return Response.json({ id: 'a1111111-1111-1111-1111-111111111111', is_anonymous: token === 'Bearer anonymous' })
    }
    if (url.endsWith('/rest/v1/rpc/stt_try_consume')) {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_user_id: 'a1111111-1111-1111-1111-111111111111', p_max: 2, p_window_seconds: 60,
      })
      return Response.json(rpcFailed ? { message: 'private database error' } : { allowed }, { status: rpcFailed ? 500 : 200 })
    }
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-openai-key')
    const form = init?.body as FormData
    assert.equal(form.get('model'), 'gpt-transcribe')
    assert.equal(form.get('languages[]'), 'ko')
    assert.ok(form.get('file') instanceof File)
    calls++
    return Response.json(upstreamBody, { status: upstreamStatus })
  }
  for (const token of ['', 'invalid', 'anonymous']) {
    assert.equal((await handler(request({}, token))).status, 401)
  }
  const bare = request()
  bare.headers.set('Authorization', 'valid')
  assert.equal((await handler(bare)).status, 401)
  assert.equal((await handler(new Request('https://edge.test/stt'))).status, 405)
  assert.equal((await handler(new Request('https://edge.test/stt', { method: 'OPTIONS' }))).status, 200)
  assert.deepEqual(await (await handler(request({ language: 'ko' }))).json(), { error: 'file_missing' })
  assert.deepEqual(await (await handler(request({ file: audio }))).json(), { error: 'language_missing' })
  assert.equal((await handler(request({ file: audio, language: 'ko_KR' }))).status, 400)
  assert.equal((await handler(request({ file: new Blob(['x'], { type: 'text/plain' }), language: 'ko' }))).status, 400)
  assert.equal((await handler(request({ file: new Blob([], { type: 'audio/webm' }), language: 'ko' }))).status, 400)
  assert.equal((await handler(request({ file: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: 'audio/webm' }), language: 'ko' }))).status, 413)
  for (const declaredSize of [undefined, '1', String(MAX_AUDIO_BYTES * 2)]) {
    const headers = new Headers({ Authorization: 'Bearer valid', 'Content-Type': 'multipart/form-data; boundary=x' })
    if (declaredSize) headers.set('Content-Length', declaredSize)
    const oversized = new Request('https://edge.test/stt', {
      method: 'POST', headers, body: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 16_385)]),
    })
    assert.equal((await handler(oversized)).status, 413)
  }
  assert.equal((await handler(new Request('https://edge.test/stt', {
    method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: '{}',
  }))).status, 400)
  delete env.STT_RATE_LIMIT_MAX
  delete env.STT_RATE_LIMIT_WINDOW_SECONDS
  assert.equal((await handler(request({ file: audio, language: 'ko' }))).status, 500)
  env.STT_RATE_LIMIT_MAX = '2'
  env.STT_RATE_LIMIT_WINDOW_SECONDS = '60'
  allowed = false
  assert.equal((await handler(request({ file: audio, language: 'ko' }))).status, 429)
  allowed = true
  rpcFailed = true
  assert.equal((await handler(request({ file: audio, language: 'ko' }))).status, 500)
  rpcFailed = false
  assert.equal(calls, 0)
  const success = await handler(request({ file: audio, language: 'ko-KR' }))
  assert.equal(success.status, 200)
  assert.deepEqual(await success.json(), { text: '인식 결과' })
  upstreamStatus = 400
  upstreamBody = { error: 'private upstream details' }
  const failure = await handler(request({ file: audio, language: 'ko' }))
  assert.equal(failure.status, 502)
  assert.deepEqual(await failure.json(), { error: 'stt_failed' })
  upstreamStatus = 200
  assert.equal((await handler(request({ file: audio, language: 'ko' }))).status, 502)
})
