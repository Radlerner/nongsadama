// rural-programs — 농촌진흥청 농촌지도사업정보 프록시(PRD v1.7 항목 2, D-028).
// 실검증된 스펙(2026-08-28): GET apis.data.go.kr/1390000/extension/getExtensionList
//   ?serviceKey&gdnbsYear&pageSize(최대 100)&pageNo&dataType=json
//   item: {gdnbsYear, gdnbsPlanEsntlNo, atptCenterCode, atptName(시도), centerCode,
//          centerName(센터), gdnbsName(사업명), businessCl1(분류), totAmt(천원)}
// 키는 private.api_keys(서비스롤 전용)에서 읽음 — 클라이언트·저장소 미노출.
// 연도 전체를 private.api_cache에 24h 캐시(31페이지 ≈ 3천행) → 공공 API 부하 최소화.
// verify_jwt=false: 공개 데이터·비로그인 원칙(§2). 남용은 캐시로 상류 보호.
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

interface Item {
  gdnbsYear: string
  gdnbsPlanEsntlNo: string
  atptName: string
  centerName: string
  gdnbsName: string
  businessCl1: string
  totAmt: string
}

const CACHE_HOURS = 24
const PAGE_SIZE = 100
const MAX_PAGES = 60 // 안전 상한(현재 31페이지)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const year = /^\d{4}$/.test(url.searchParams.get('year') ?? '')
      ? (url.searchParams.get('year') as string)
      : String(new Date().getFullYear())
    const sido = (url.searchParams.get('sido') ?? '').trim()
    const center = (url.searchParams.get('center') ?? '').trim()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'private' } },
    )

    const cacheName = `extension-${year}`
    const { data: cached } = await admin
      .from('api_cache')
      .select('payload, fetched_at')
      .eq('name', cacheName)
      .maybeSingle()

    let items: Item[] | null = null
    let fetchedAt = cached?.fetched_at ?? null
    const fresh =
      cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_HOURS * 3600_000
    if (fresh) items = cached.payload as Item[]

    if (!items) {
      const { data: keyRow } = await admin
        .from('api_keys')
        .select('value')
        .eq('name', 'datago_extension')
        .maybeSingle()
      if (!keyRow) return json({ error: 'not_configured' }, 503)
      const key = encodeURIComponent(keyRow.value)
      const all: Item[] = []
      let pages = 1
      for (let p = 1; p <= pages && p <= MAX_PAGES; p++) {
        const r = await fetch(
          `https://apis.data.go.kr/1390000/extension/getExtensionList?serviceKey=${key}&gdnbsYear=${year}&pageSize=${PAGE_SIZE}&pageNo=${p}&dataType=json`,
        )
        const d = await r.json()
        if (d?.response?.header?.resultCode !== '200') {
          // 301 = 데이터 없음(연초 등) — 빈 결과로 처리, 그 외는 상류 오류
          if (d?.response?.header?.resultCode === '301') break
          if (all.length === 0) return json({ error: 'upstream_error' }, 502)
          break
        }
        const body = d.response.body
        const chunk: Item[] = Array.isArray(body.items?.item)
          ? body.items.item
          : body.items?.item
            ? [body.items.item]
            : []
        all.push(...chunk)
        pages = Number(body.numOfPages) || 1
      }
      items = all
      fetchedAt = new Date().toISOString()
      await admin
        .from('api_cache')
        .upsert({ name: cacheName, payload: items, fetched_at: fetchedAt })
    }

    let filtered = items
    if (sido) filtered = filtered.filter((i) => (i.atptName ?? '').includes(sido))
    if (center) filtered = filtered.filter((i) => (i.centerName ?? '').includes(center))

    return json({
      year,
      total: filtered.length,
      fetched_at: fetchedAt,
      items: filtered.slice(0, 50).map((i) => ({
        year: i.gdnbsYear,
        id: i.gdnbsPlanEsntlNo,
        sido: i.atptName,
        center: i.centerName,
        name: i.gdnbsName,
        category: i.businessCl1,
        amount: i.totAmt,
      })),
    })
  } catch (e) {
    console.error('[rural-programs]', String(e))
    return json({ error: 'internal' }, 500)
  }
})
