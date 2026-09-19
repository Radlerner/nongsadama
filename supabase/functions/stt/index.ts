import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  MAX_AUDIO_BYTES,
  attachLanguageHint,
  isAllowedAudio,
  readLanguage,
  readRateLimitConfig,
  readSttModel,
} from './parse.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const MULTIPART_OVERHEAD = 16_384

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]
    if (!jwt) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user || userData.user.is_anonymous) return json({ error: 'unauthorized' }, 401)
    const userId = userData.user.id

    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD) {
      return json({ error: 'payload_too_large' }, 413)
    }

    if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      return json({ error: 'multipart_required' }, 400)
    }
    if (!req.body) return json({ error: 'file_missing' }, 400)
    let size = 0
    const chunks: Uint8Array[] = []
    const reader = req.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD) {
          await reader.cancel()
          return json({ error: 'payload_too_large' }, 413)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    let form: FormData
    try {
      form = await new Response(body, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData()
    } catch {
      return json({ error: 'multipart_invalid' }, 400)
    }

    const lang = readLanguage(form.get('language'))
    if ('error' in lang) return json({ error: lang.error }, 400)

    const fileField = form.get('file')
    if (fileField == null) return json({ error: 'file_missing' }, 400)
    if (typeof fileField === 'string') return json({ error: 'file_unsupported' }, 400)
    const file = fileField as File
    if (file.size <= 0) return json({ error: 'file_missing' }, 400)
    if (file.size > MAX_AUDIO_BYTES) return json({ error: 'payload_too_large' }, 413)
    if (!isAllowedAudio({ type: file.type, name: file.name || 'speech.webm' })) {
      return json({ error: 'file_unsupported' }, 400)
    }

    const rate = readRateLimitConfig((key) => Deno.env.get(key))
    if (rate.kind === 'invalid') {
      console.error('[stt] rate limit env invalid')
      return json({ error: 'server_error' }, 500)
    }
    if (rate.kind === 'on') {
      const { data, error } = await admin.rpc('stt_try_consume', {
        p_user_id: userId,
        p_max: rate.max,
        p_window_seconds: rate.windowSeconds,
      })
      if (error) {
        console.error('[stt] rate limit rpc failed')
        return json({ error: 'server_error' }, 500)
      }
      const allowed = data && typeof data === 'object' && (data as { allowed?: unknown }).allowed === true
      if (!allowed) return json({ error: 'rate_limited' }, 429)
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('[stt] transcription secret missing')
      return json({ error: 'server_error' }, 500)
    }

    const model = readSttModel((key) => Deno.env.get(key))
    const openaiForm = new FormData()
    openaiForm.append('file', file, file.name || 'speech.webm')
    openaiForm.append('model', model)
    attachLanguageHint(openaiForm, model, lang.iso639)

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: openaiForm,
      signal: AbortSignal.timeout(30_000),
    })
    if (!openaiRes.ok) {
      console.error('[stt] openai failed:', openaiRes.status)
      return json({ error: 'stt_failed' }, 502)
    }
    const payload = (await openaiRes.json()) as { text?: unknown }
    if (typeof payload?.text !== 'string') return json({ error: 'stt_failed' }, 502)
    return json({ text: payload.text })
  } catch (e) {
    console.error('[stt] unexpected:', e instanceof Error ? e.name : 'error')
    return json({ error: 'server_error' }, 500)
  }
})
