// rural-programs — 농촌진흥청 농촌지도사업정보 프록시(PRD v1.7 후속, D-028).
// 실검증 스펙(2026-08-28): GET apis.data.go.kr/1390000/extension/getExtensionList
//   ?serviceKey&gdnbsYear&pageSize(최대 100)&pageNo&dataType=json
// 키·캐시는 public.api_keys/api_cache — RLS(정책 0)+grant 회수로 잠금(service_role만 접근).
// verify_jwt=false: 공개 데이터·비로그인 원칙(§2). 남용은 24h 캐시+연도 클램프로 상한.
// 배포: MCP deploy_edge_function(verify_jwt=false) — 이 파일과 배포본을 항상 동기화할 것(재검수 P1-1).
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
const MIN_YEAR = 2015 // 연도 클램프(재검수 P1-3) — 캐시 행 수 상한 확정

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const maxYear = new Date().getFullYear() + 1
    // 미지정은 올해(주의: Number(null)=0이라 4자리 검사 필수 — v3 회귀 수정)
    const rawYearStr = url.searchParams.get('year') ?? ''
    const year = String(
      /^\d{4}$/.test(rawYearStr)
        ? Math.min(maxYear, Math.max(MIN_YEAR, Number(rawYearStr)))
        : new Date().getFullYear(),
    )
    const sido = (url.searchParams.get('sido') ?? '').trim()
    const center = (url.searchParams.get('center') ?? '').trim()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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
      const { data: keyRow, error: keyErr } = await admin
        .from('api_keys')
        .select('value')
        .eq('name', 'datago_extension')
        .maybeSingle()
      if (keyErr || !keyRow) return json({ error: 'not_configured' }, 503)
      const key = encodeURIComponent(keyRow.value)
      const all: Item[] = []
      let pages = 1
      let complete = true // 부분 수집은 캐시하지 않는다(재검수 P2-1 — 잘린 데이터 24h 고착 방지)
      for (let p = 1; p <= pages; p++) {
        if (p > MAX_PAGES) {
          complete = false
          break
        }
        const r = await fetch(
          `https://apis.data.go.kr/1390000/extension/getExtensionList?serviceKey=${key}&gdnbsYear=${year}&pageSize=${PAGE_SIZE}&pageNo=${p}&dataType=json`,
        )
        const d = await r.json()
        if (d?.response?.header?.resultCode !== '200') {
          if (d?.response?.header?.resultCode === '301') break // 데이터 없음(정상 종료)
          if (all.length === 0) return json({ error: 'upstream_error' }, 502)
          complete = false
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
      if (complete) {
        await admin
          .from('api_cache')
          .upsert({ name: cacheName, payload: items, fetched_at: fetchedAt })
      }
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
    // 예외 문자열에 serviceKey가 실릴 수 있어 마스킹 후 기록(재검수 P2-7)
    console.error('[rural-programs]', String(e).replace(/serviceKey=[^&\s]+/g, 'serviceKey=***'))
    return json({ error: 'internal' }, 500)
  }
})
