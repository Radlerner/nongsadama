// weather — koreaConnect 날씨 MCP 프록시(PRD v1.7 항목 3, D-028).
// 실검증(2026-08-28): SSE(/sse, header api_user_key_id) → endpoint 이벤트 →
// POST {endpoint}: initialize → notifications/initialized → tools/call
//   current_weather{lat,lon} → OpenWeather 형식 JSON(temp는 켈빈).
// 키는 public.api_keys(RLS 잠금·service_role 전용). 좌표 0.1° 반올림 30분 캐시.
// verify_jwt=false(공개 정보·비로그인 원칙 §2).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const MCP_BASE = 'https://mcp.koreaconnect.kr'
const CACHE_MIN = 30

async function mcpWeather(key: string, lat: number, lon: number): Promise<unknown> {
  const H = { api_user_key_id: key }
  const res = await fetch(`${MCP_BASE}/sse`, {
    headers: { ...H, Accept: 'text/event-stream' },
  })
  if (!res.ok || !res.body) throw new Error(`sse ${res.status}`)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let endpoint: string | null = null
  let result: unknown = null
  let done = false

  const pump = (async () => {
    while (!done) {
      const { done: d, value } = await reader.read()
      if (d) break
      buf += dec.decode(value, { stream: true })
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i)
        buf = buf.slice(i + 2)
        let event = ''
        let data = ''
        for (const l of raw.split('\n')) {
          if (l.startsWith('event:')) event = l.slice(6).trim()
          if (l.startsWith('data:')) data += l.slice(5).trim()
        }
        if (event === 'endpoint') endpoint = data
        else if (data) {
          try {
            const j = JSON.parse(data)
            if (j.id === 3) {
              result = j
              done = true
            }
          } catch {
            /* SSE 핑 등 무시 */
          }
        }
      }
    }
  })()

  const waitFor = async (cond: () => boolean, ms: number) => {
    const t0 = Date.now()
    while (!cond() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 100))
    return cond()
  }
  if (!(await waitFor(() => endpoint !== null, 5000))) throw new Error('no endpoint')
  const post = (b: unknown) =>
    fetch(`${MCP_BASE}${endpoint}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    })
  await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nongsadama-weather', version: '1.0' },
    },
  })
  await new Promise((r) => setTimeout(r, 800))
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
  await post({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'current_weather', arguments: { lat, lon } },
  })
  await waitFor(() => result !== null, 10000)
  done = true
  try {
    reader.cancel()
  } catch {
    /* no-op */
  }
  await Promise.race([pump, new Promise((r) => setTimeout(r, 300))])
  if (!result) throw new Error('no result')
  const r = result as { result?: { content?: { text?: string }[]; isError?: boolean } }
  if (r.result?.isError) throw new Error('tool error')
  const text = r.result?.content?.[0]?.text
  if (!text) throw new Error('empty content')
  return JSON.parse(text)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const lat = Number(url.searchParams.get('lat'))
    const lon = Number(url.searchParams.get('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json({ error: 'bad_coords' }, 400)
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    // 0.1°(≈11km) 반올림 캐시 — 동일 지역 사용자 공유, 위치 정밀도 미저장(프라이버시)
    const cacheName = `weather-${lat.toFixed(1)}-${lon.toFixed(1)}`
    const { data: cached } = await admin
      .from('api_cache')
      .select('payload, fetched_at')
      .eq('name', cacheName)
      .maybeSingle()
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MIN * 60_000) {
      return json(cached.payload)
    }
    const { data: keyRow } = await admin
      .from('api_keys')
      .select('value')
      .eq('name', 'koreaconnect_mcp')
      .maybeSingle()
    if (!keyRow) return json({ error: 'not_configured' }, 503)

    const raw = (await mcpWeather(keyRow.value, lat, lon)) as {
      weather?: { description?: string; icon?: string; main?: string }[]
      main?: { temp?: number; feels_like?: number; humidity?: number }
      wind?: { speed?: number }
      name?: string
    }
    const payload = {
      tempC: raw.main?.temp != null ? Math.round((raw.main.temp - 273.15) * 10) / 10 : null,
      feelsC:
        raw.main?.feels_like != null ? Math.round((raw.main.feels_like - 273.15) * 10) / 10 : null,
      humidity: raw.main?.humidity ?? null,
      windMs: raw.wind?.speed ?? null,
      main: raw.weather?.[0]?.main ?? null,
      desc: raw.weather?.[0]?.description ?? null,
      icon: raw.weather?.[0]?.icon ?? null,
      name: raw.name ?? null,
      fetched_at: new Date().toISOString(),
    }
    await admin.from('api_cache').upsert({
      name: cacheName,
      payload,
      fetched_at: payload.fetched_at,
    })
    return json(payload)
  } catch (e) {
    console.error('[weather]', String(e))
    return json({ error: 'internal' }, 500)
  }
})
