// 보는 지역 동기화 점검(v1.6, D-047). 빌드한 웹 번들(기본 dist)을 헤드리스 Chrome(375×812)으로 띄워 확인한다.
// - 운영 Supabase로는 읽기(GET·HEAD)만 나간다. 프로필 저장(PATCH)만 브라우저 안에서 가짜로 받아 주고, 나머지 쓰기는 막는다.
// - 로그인은 서명 없는 가짜 세션을 기기 저장소에 넣어 흉내 낸다. 프로필 행·지연·실패는 가짜 응답으로 정한다.
// - 운영 사이트(LIVE_URL)로는 돌리지 않는다(쓰기 흉내가 있어서).
// 사용: npm run build && node tests/e2e/region-sync-check.mjs   결과: $NSD_DATA_DIR/region-sync-check/<날짜>/result.json + 화면
import http from 'node:http'
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, outDir } from './lib/cdp.mjs'

if (process.env.LIVE_URL) throw new Error('region-sync-check는 쓰기를 흉내 내므로 LIVE_URL로 돌리지 않는다')
const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const ROOT = process.env.BUNDLE_ROOT ?? join(repo, 'dist')
const DATA = process.env.NSD_DATA_DIR ?? join(repo, '..', 'nongsadama_data')
const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const OUT = outDir(join(DATA, 'region-sync-check', day))
if (!existsSync(join(ROOT, 'index.html'))) throw new Error(`번들이 없다: ${ROOT} (npm run build 먼저)`)

const ko = JSON.parse(readFileSync(join(repo, 'src/i18n/dictionaries/ko.json'), 'utf8'))
const dicts = Object.fromEntries(['ko', 'en', 'vi', 'km', 'th', 'ne', 'mn', 'uz', 'ru'].map((l) => [l, JSON.parse(readFileSync(join(repo, `src/i18n/dictionaries/${l}.json`), 'utf8'))]))
// 운영 regions id
const MIRYANG = 'a1000000-0000-4000-8000-000000001201' // 경상남도 밀양시(생활정보 21건)
const HONGSEONG_TOWN = 'a2000000-0000-4000-8000-000000000001' // 충청남도 홍성군 홍성읍(홍성군 범위 26건)
const BUCHEON = 'a1000000-0000-4000-8000-000000001082' // 경기도 부천시(생활정보 0건 — 오너 사례)
const YESAN = 'a1000000-0000-4000-8000-000000000014' // 충청남도 예산군(12건)
const CHUNGNAM = 'a0000000-0000-4000-8000-000000000011'
const FAKE_USER = '00000000-0000-4000-8000-00000000d047'
const CHOICE_KEY = 'nongsadama.regionChoice'
const LEGACY_KEY = 'nongsadama.regionId'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file))
})
await new Promise((r) => server.listen(5197, 'localhost', r))
const BASE = 'http://localhost:5197'
const browser = await launch({ port: 9372, profileDir: join(DATA, 'region-sync-check-profile') })
const blocked = []
const results = { startedAt: new Date().toISOString(), bundle: ROOT, checks: [], blockedWrites: blocked }
const check = (name, ok, detail) => { results.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function fakeSession() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const user = { id: FAKE_USER, aud: 'authenticated', role: 'authenticated', email: 'region-sync-check@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-24T00:00:00Z' }
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: FAKE_USER, role: 'authenticated', exp })}.unsigned`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'unsigned', user }
}
const wantsObject = (req) => /vnd\.pgrst\.object/.test(req.headers?.Accept ?? req.headers?.accept ?? '')
function bodyOf(params) {
  const entries = params.request.postDataEntries ?? []
  const buf = entries.length ? Buffer.concat(entries.map((e) => Buffer.from(e.bytes ?? '', 'base64'))) : Buffer.from(params.request.postData ?? '', 'latin1')
  try { return JSON.parse(buf.toString('utf8') || '{}') } catch { return {} }
}

/**
 * @param o.legacy 구버전 키(nongsadama.regionId) 값 — 1.5 이하 기기 흉내
 * @param o.loggedIn 가짜 로그인
 * @param o.profile 'none'(행 없음) | { region: string|null } (행 있음)
 * @param o.profileDelayMs 프로필 조회 지연
 * @param o.profileFail 프로필 조회를 500으로
 * @param o.keepStorage 같은 브라우저의 두 번째 탭(저장소를 비우지 않음)
 */
async function newPage({ locale = 'ko', width = 375, legacy = null, loggedIn = false, profile = 'none', profileDelayMs = 0, profileFail = false, keepStorage = false } = {}) {
  const page = await browser.newPage({ languages: [locale], width })
  const state = { profileRegion: profile === 'none' ? undefined : profile.region, patches: [], inserts: [] }
  page.state = state
  await page.interceptFetch(async (req, params) => {
    if (!/supabase\.co/.test(req.url)) return null
    const path = req.url.replace(/^https:\/\/[^/]+/, '')
    const isProfiles = path.startsWith('/rest/v1/profiles')
    if (!['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
      if (loggedIn && isProfiles && req.method === 'PATCH' && path.includes(`id=eq.${FAKE_USER}`)) {
        const body = bodyOf(params)
        state.patches.push({ path, body })
        // 저장 제안의 비교 조건(region_id=is.null / eq.이전값)을 서버처럼 따진다
        const cond = path.match(/region_id=(is\.null|eq\.[^&]+)/)?.[1]
        const current = state.profileRegion ?? null
        const matches = !cond || (cond === 'is.null' ? current === null : cond === `eq.${current}`)
        if (matches && 'region_id' in body) state.profileRegion = body.region_id
        const row = { id: FAKE_USER, nickname: body.nickname ?? '점검', preferred_locale: locale, preferred_locale_explicit: true, region_id: state.profileRegion ?? null }
        return { action: 'fulfill', body: wantsObject(req) ? row : matches ? [row] : [] }
      }
      if (isProfiles && req.method === 'POST') state.inserts.push(path)
      blocked.push(`${req.method} ${path.slice(0, 80)}`)
      return { action: 'fail', reason: 'BlockedByClient' }
    }
    if (loggedIn && isProfiles && path.includes(`id=eq.${FAKE_USER}`)) {
      if (profileDelayMs) await sleep(profileDelayMs)
      if (profileFail) return { action: 'fulfill', status: 500, body: { message: 'simulated failure' } }
      if (state.profileRegion === undefined) return { action: 'fulfill', body: wantsObject(req) ? '' : [], status: wantsObject(req) ? 406 : 200 }
      const row = { id: FAKE_USER, nickname: '점검', preferred_locale: locale, preferred_locale_explicit: true, region_id: state.profileRegion, country_code: null, crop_type: null, is_matching_visible: false, role: 'user', auth_provider: 'email', created_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:00Z' }
      return { action: 'fulfill', body: wantsObject(req) ? row : [row] }
    }
    // 가짜 로그인 화면의 읽기는 서버가 가짜 토큰을 거절하므로 공개(anon) 키로 바꿔 보낸다 — 값은 요청에 이미 있고 출력하지 않는다
    if (loggedIn && req.headers?.apikey) return { action: 'continue', headers: { ...req.headers, Authorization: `Bearer ${req.headers.apikey}` } }
    return null
  }, [{ urlPattern: '*supabase.co/*' }])
  const init = [
    `localStorage.setItem('nongsadama.locale', ${JSON.stringify(locale)})`,
    `localStorage.setItem('nongsadama.locale.explicit', 'true')`,
    legacy ? `localStorage.setItem('${LEGACY_KEY}', ${JSON.stringify(legacy)})` : '',
    loggedIn ? `localStorage.setItem('sb-ikusdwursvbdrznbcjtw-auth-token', ${JSON.stringify(JSON.stringify(fakeSession()))})` : '',
  ].join(';')
  if (!keepStorage) await page.addInitScript(`try { if (!sessionStorage.getItem('nsd-init')) { localStorage.clear(); ${init}; sessionStorage.setItem('nsd-init', '1') } } catch (e) {}`)
  current = page
  return page
}
const pageErrors = []
let current = null
async function section(name, fn) {
  try { await fn() } catch (e) {
    check(`${name}: 중단`, false, { error: String(e).slice(0, 200), text: current ? (await current.text().catch(() => '')).slice(0, 400) : null })
    if (current) { await current.shot(OUT(`fail-${name}.png`)).catch(() => {}); await done(current).catch(() => {}) }
  }
}
async function done(page) { pageErrors.push(...page.pageErrors, ...page.consoleErrors); await page.close() }
const BAR = `section[aria-label=${JSON.stringify(ko['region.bar.label'])}]`
const barOf = (locale) => `section[aria-label=${JSON.stringify(dicts[locale]['region.bar.label'])}]`
const barText = (page) => page.evaluate(`(document.querySelector(${JSON.stringify(BAR)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`)
const bodyHas = (page, text) => page.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)
const choice = (page) => page.evaluate(`JSON.parse(localStorage.getItem('${CHOICE_KEY}') || 'null')`)
const legacyValue = (page) => page.evaluate(`localStorage.getItem('${LEGACY_KEY}')`)
const lifeRequests = (page) => page.requests.filter((r) => r.method === 'GET' && r.url.includes('/rest/v1/life_info') && !r.url.includes('id=eq.'))
const unscoped = (page) => lifeRequests(page).filter((r) => !decodeURIComponent(r.url).includes('region_id=in.('))
const cards = (page) => page.evaluate(`document.querySelectorAll('main ul li a[href^="/life-info/"]').length`)
const viewing = (name) => ko['region.bar.viewing'].replace('{name}', name)
const waitBar = (page, text, timeout = 20000) => page.waitFor(`(document.querySelector(${JSON.stringify(BAR)})?.innerText ?? '').replace(/\\s+/g, ' ').includes(${JSON.stringify(text)})`, { timeout, label: `bar "${text}"` })

// ── R1. 구버전 기기(홍성읍) 비회원: 기록이 옮겨지고, 지도와 목록이 같은 범위·같은 캐시 ──
await section('R1', async () => {
  const page = await newPage({ legacy: HONGSEONG_TOWN })
  await page.goto(`${BASE}/home`, { waitMs: 1500 })
  await waitBar(page, viewing('홍성군 홍성읍'))
  await page.waitFor(`!document.body.innerText.includes(${JSON.stringify(ko['lifeInfo.loading'])})`, { timeout: 20000 })
  const c = await choice(page)
  check('R1 구버전 값 → 직접 고른 값(M1)으로 옮김, 구버전 키 유지', c?.view?.kind === 'user' && c.view.regionId === HONGSEONG_TOWN && c.migrated === true && (await legacyValue(page)) === HONGSEONG_TOWN, c)
  const homeRequests = lifeRequests(page).length
  check('R1 지도: 생활정보 조회는 모두 시·군 범위', homeRequests >= 1 && unscoped(page).length === 0, lifeRequests(page).map((r) => decodeURIComponent(r.url).slice(-120)))
  await page.shot(OUT('R1-home-hongseong.png'))
  await page.tap({ text: ko['map.listView'] })
  await page.waitFor(`document.querySelectorAll('main ul li a[href^="/life-info/"]').length > 0`, { timeout: 20000 })
  check('R1 목록: 홍성군 범위 26건, 지도와 같은 캐시라 다시 조회하지 않음', (await cards(page)) === 26 && lifeRequests(page).length === homeRequests, { cards: await cards(page), requests: lifeRequests(page).length })
  await done(page)
})

// ── R2. 지역 없는 비회원: 전국을 자동으로 조회하지 않음 → 명시적 전국 보기 ──
await section('R2', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/home`, { waitMs: 3000 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['region.needed.all'])})`, { timeout: 20000 })
  check('R2 홈: 지역 고르기 안내, 생활정보 조회 0건', (await bodyHas(page, ko['region.needed.title'])) && lifeRequests(page).length === 0, lifeRequests(page).length)
  await page.shot(OUT('R2-home-none.png'))
  await page.goto(`${BASE}/life-info`, { waitMs: 3000 })
  check('R2 목록: 지역 고르기 안내, 생활정보 조회 0건', (await bodyHas(page, ko['region.needed.title'])) && lifeRequests(page).length === 0)
  await page.tap({ text: ko['region.needed.all'], exact: true })
  await page.waitFor(`document.querySelectorAll('main ul li a[href^="/life-info/"]').length > 0`, { timeout: 20000 })
  const reqs = lifeRequests(page)
  check('R2 전국 둘러보기 → 범위 없는 조회 1회(상한 501), 146건, 표시줄 전국', reqs.length === 1 && unscoped(page).length === 1 && decodeURIComponent(reqs[0].url).includes('limit=501') && (await cards(page)) === 146 && (await barText(page)).includes(ko['region.bar.viewingAll']), { requests: reqs.map((r) => decodeURIComponent(r.url).slice(-80)), cards: await cards(page) })
  check('R2 기록: all, 구버전 키 없음', (await choice(page))?.view?.kind === 'all' && (await legacyValue(page)) === null)
  await done(page)
})

// ── R3. 지역 선택 화면: 지역 없이 "계속"은 머물고, 전국은 명시적으로 ──
await section('R3', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/select`, { waitMs: 2500 })
  await page.waitFor(`!!document.querySelector('select') && document.querySelector('select').options.length > 1`, { timeout: 20000 })
  const before = await page.evaluate(`Math.round([...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(ko['select.continue'])}).getBoundingClientRect().top + scrollY)`)
  await page.tap({ text: ko['select.continue'], exact: true })
  await page.sleep(500)
  const after = await page.evaluate(`Math.round([...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(ko['select.continue'])}).getBoundingClientRect().top + scrollY)`)
  check('R3 지역 없이 계속 → 머물며 안내, "계속" 자리 그대로, 조회 0건', (await page.evaluate('location.pathname')) === '/select' && (await bodyHas(page, ko['select.needRegion'])) && before === after && lifeRequests(page).length === 0, { before, after })
  await page.shot(OUT('R3-select-need-region.png'))
  await page.evaluate(`(() => { const s = document.querySelector('select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(CHUNGNAM)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(500)
  await page.evaluate(`[...document.querySelectorAll('details')].forEach((d) => { d.open = true })`)
  await page.tap({ text: '예산군', exact: true })
  await page.sleep(300)
  await page.tap({ text: ko['select.continue'], exact: true })
  await page.waitFor(`location.pathname === '/home'`, { timeout: 5000 })
  const c = await choice(page)
  check('R3 예산군 고르고 계속 → 홈, 직접 고른 값', c?.view?.kind === 'user' && c.view.regionId === YESAN && (await legacyValue(page)) === YESAN, c)
  await done(page)
})

// ── R4. 회원, 기기 기록 없음, 프로필 밀양 → 프로필 지역을 따른다 ──
await section('R4', async () => {
  const page = await newPage({ loggedIn: true, profile: { region: MIRYANG } })
  await page.goto(`${BASE}/home`, { waitMs: 1500 })
  await waitBar(page, ko['region.bar.viewingOwn'].replace('{name}', '밀양시'))
  const c = await choice(page)
  check('R4 기록: profile·이 계정, 조회는 모두 범위 안', c?.view?.kind === 'profile' && c.view.regionId === MIRYANG && c.view.uid === FAKE_USER && unscoped(page).length === 0 && lifeRequests(page).length >= 1, c)
  check('R4 가입 처리(프로필 확인)는 쓰기를 보내지 않음', page.state.inserts.length === 0, page.state.inserts)
  await done(page)
})

// ── R5. M1: 구버전 부천 + 프로필 밀양 → 부천 유지 + "내 지역으로" ──
await section('R5', async () => {
  const page = await newPage({ legacy: BUCHEON, loggedIn: true, profile: { region: MIRYANG } })
  await page.goto(`${BASE}/life-info`, { waitMs: 1500 })
  const other = ko['region.bar.viewingOther'].replace('{name}', '부천시').replace('{own}', '밀양시')
  await waitBar(page, other)
  await page.waitFor(`!document.body.innerText.includes(${JSON.stringify(ko['lifeInfo.loading'])})`, { timeout: 20000 })
  const c = await choice(page)
  const miryangBefore = lifeRequests(page).filter((r) => r.url.includes(MIRYANG)).length
  check('R5 부천 그대로(직접 고른 값, 이 계정으로 귀속), 밀양 조회 없음, 버튼 있음', c?.view?.kind === 'user' && c.view.regionId === BUCHEON && c.view.uid === FAKE_USER && miryangBefore === 0 && (await bodyHas(page, ko['region.bar.toOwn'])), c)
  await page.shot(OUT('R5-m1-bucheon.png'))
  await page.sleep(400)
  await page.tap({ aria: ko['region.showOwn'].replace('{name}', '밀양시'), selector: 'button' })
  await waitBar(page, ko['region.bar.viewingOwn'].replace('{name}', '밀양시'))
  await page.waitFor(`document.querySelectorAll('main ul li a[href^="/life-info/"]').length > 0`, { timeout: 20000 })
  const c2 = await choice(page)
  check('R5 "내 지역으로" → 밀양(profile), 밀양 21건', c2?.view?.kind === 'profile' && c2.view.regionId === MIRYANG && (await cards(page)) === 21, { c2, cards: await cards(page) })
  await done(page)
})

// ── R6. 프로필이 8초 늦게 옴 → 5초에 안내, 늦은 응답은 버튼만 켬(자동 변경 없음) ──
await section('R6', async () => {
  const page = await newPage({ loggedIn: true, profile: { region: MIRYANG }, profileDelayMs: 8000 })
  await page.goto(`${BASE}/life-info`, { waitMs: 500 })
  const early = await bodyHas(page, ko['region.needed.title'])
  await page.sleep(5500)
  const atDeadline = { needed: await bodyHas(page, ko['region.needed.title']), requests: lifeRequests(page).length }
  check('R6 기한 전엔 안내 없음, 5초 뒤 안내·조회 0건', !early && atDeadline.needed && atDeadline.requests === 0, { early, atDeadline })
  const late = ko['region.showOwn'].replace('{name}', '밀양시')
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(late)})`, { timeout: 15000 })
  const c = await choice(page)
  check('R6 늦은 응답 → "내 지역(밀양시)으로 보기" 버튼만, 기록·조회 그대로', lifeRequests(page).length === 0 && (c?.view?.kind ?? 'none') === 'none', c)
  await page.shot(OUT('R6-late-profile.png'))
  await page.sleep(400)
  await page.tap({ text: late, exact: true })
  await page.waitFor(`document.querySelectorAll('main ul li a[href^="/life-info/"]').length > 0`, { timeout: 20000 })
  check('R6 버튼 → 밀양 21건', (await cards(page)) === 21 && (await choice(page))?.view?.kind === 'profile')
  await done(page)
})

// ── R7. 프로필 조회 실패 → 안내(불러오지 못함), 전국 조회 없음 ──
await section('R7', async () => {
  const page = await newPage({ loggedIn: true, profile: { region: MIRYANG }, profileFail: true })
  await page.goto(`${BASE}/life-info`, { waitMs: 500 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['region.needed.title'])})`, { timeout: 15000 })
  check('R7 실패: 안내(불러오지 못함·다시 시도), 생활정보 조회 0건', ((await bodyHas(page, ko['region.needed.profileFailed'])) || (await bodyHas(page, ko['common.retry']))) && lifeRequests(page).length === 0)
  await done(page)
})

// ── R8. 저장 제안: 행은 있고 지역 없음 + 직접 고른 홍성읍 → 비교 조건이 붙은 PATCH만, insert 없음 ──
await section('R8', async () => {
  const page = await newPage({ legacy: HONGSEONG_TOWN, loggedIn: true, profile: { region: null } })
  await page.goto(`${BASE}/home`, { waitMs: 1500 })
  const question = ko['region.offer.question'].replace('{name}', '홍성군 홍성읍')
  await waitBar(page, question)
  await page.shot(OUT('R8-offer.png'))
  await page.sleep(400)
  await page.tap({ text: ko['region.offer.save'], exact: true, within: `${BAR} button` })
  await waitBar(page, ko['region.offer.saved'].replace('{name}', '홍성군 홍성읍'), 10000)
  const p = page.state.patches[0]
  check('R8 저장: PATCH 1번(region_id=is.null 조건, 지역만), insert 0번', page.state.patches.length === 1 && decodeURIComponent(p.path).includes('region_id=is.null') && JSON.stringify(p.body) === JSON.stringify({ region_id: HONGSEONG_TOWN }) && page.state.inserts.length === 0, page.state.patches)
  const c = await choice(page)
  check('R8 저장 뒤 보는 지역 = 프로필(내 지역)', c?.view?.kind === 'profile' && c.view.regionId === HONGSEONG_TOWN, c)
  await done(page)
})

// ── R9. "나중에" → 다시 열어도 안 보임 ──
await section('R9', async () => {
  const page = await newPage({ legacy: HONGSEONG_TOWN, loggedIn: true, profile: { region: null } })
  await page.goto(`${BASE}/home`, { waitMs: 1500 })
  await waitBar(page, ko['region.offer.question'].replace('{name}', '홍성군 홍성읍'))
  await page.sleep(400)
  await page.tap({ text: ko['region.offer.later'], exact: true, within: `${BAR} button` })
  await page.sleep(500)
  const hidden = !(await bodyHas(page, ko['region.offer.question'].replace('{name}', '홍성군 홍성읍')))
  await page.goto(`${BASE}/home`, { waitMs: 3000 })
  check('R9 나중에 → 숨김, 새로 열어도 숨김, 저장 요청 0', hidden && !(await bodyHas(page, ko['region.offer.question'].replace('{name}', '홍성군 홍성읍'))) && page.state.patches.length === 0)
  await done(page)
})

// ── R10. 프로필 수정에서 닉네임만 저장(지역 비어 있음) → 보는 지역 그대로 ──
await section('R10', async () => {
  const page = await newPage({ legacy: HONGSEONG_TOWN, loggedIn: true, profile: { region: null } })
  await page.goto(`${BASE}/profile/edit`, { waitMs: 2500 })
  await page.waitFor(`!!document.querySelector('input[type=text]')`, { timeout: 20000 })
  await page.evaluate(`(() => { const i = document.querySelector('input[type=text]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '점검2'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.tap({ selector: 'button[type=submit]' })
  await page.waitFor(`location.pathname === '/profile'`, { timeout: 10000 })
  const c = await choice(page)
  check('R10 닉네임만 저장 → 보는 지역(홍성읍)·구버전 키 그대로', page.state.patches.length === 1 && c?.view?.kind === 'user' && c.view.regionId === HONGSEONG_TOWN && (await legacyValue(page)) === HONGSEONG_TOWN, { c, patches: page.state.patches.length })
  await done(page)
})

// ── R11. 로그아웃: 프로필에서 온 보는 지역은 지우고, 직접 고른 지역은 남긴다 ──
await section('R11', async () => {
  const a = await newPage({ loggedIn: true, profile: { region: MIRYANG } })
  await a.goto(`${BASE}/home`, { waitMs: 1500 })
  await waitBar(a, ko['region.bar.viewingOwn'].replace('{name}', '밀양시'))
  await a.goto(`${BASE}/profile`, { waitMs: 2500 })
  await a.tap({ text: ko['profile.logout'], exact: true })
  await a.waitFor(`!localStorage.getItem('sb-ikusdwursvbdrznbcjtw-auth-token')`, { timeout: 10000 })
  await a.sleep(500)
  const c = await choice(a)
  check('R11 프로필에서 온 밀양 → 로그아웃 뒤 없음(묘비)·구버전 키 없음', c?.view?.kind === 'none' && (await legacyValue(a)) === null, c)
  const before = lifeRequests(a).length
  await a.goto(`${BASE}/home`, { waitMs: 3000 })
  check('R11 로그아웃 뒤 홈: 지역 안내, 전국 조회 없음', (await bodyHas(a, ko['region.needed.title'])) && unscoped(a).length === 0 && lifeRequests(a).length === before)
  await done(a)
  const b = await newPage({ legacy: BUCHEON, loggedIn: true, profile: { region: MIRYANG } })
  await b.goto(`${BASE}/profile`, { waitMs: 3000 })
  await b.tap({ text: ko['profile.logout'], exact: true })
  await b.waitFor(`!localStorage.getItem('sb-ikusdwursvbdrznbcjtw-auth-token')`, { timeout: 10000 })
  await b.sleep(500)
  const c2 = await choice(b)
  check('R11 직접 고른 부천 → 로그아웃 뒤에도 둘러보기 설정으로 남음', c2?.view?.kind === 'user' && c2.view.regionId === BUCHEON, c2)
  await done(b)
})

// ── R12. 두 탭: 한 탭에서 바꾸면 다른 탭이 따라온다(storage 이벤트) ──
await section('R12', async () => {
  const a = await newPage({ legacy: HONGSEONG_TOWN })
  await a.goto(`${BASE}/life-info`, { waitMs: 2500 })
  await waitBar(a, viewing('홍성군 홍성읍'))
  const b = await newPage({ keepStorage: true })
  await b.goto(`${BASE}/life-info`, { waitMs: 2500 })
  await waitBar(b, viewing('홍성군 홍성읍'))
  current = a
  await a.tap({ text: ko['region.bar.change'], exact: true })
  await a.waitFor(`location.pathname === '/select' && !!document.querySelector('select')`, { timeout: 10000 })
  await a.evaluate(`(() => { const s = document.querySelector('select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(CHUNGNAM)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await a.sleep(400)
  await a.evaluate(`[...document.querySelectorAll('details')].forEach((d) => { d.open = true })`)
  await a.tap({ text: '예산군', exact: true })
  await a.sleep(300)
  await a.tap({ text: ko['select.continue'], exact: true })
  await a.waitFor(`location.pathname === '/life-info'`, { timeout: 5000 })
  await waitBar(a, viewing('예산군'))
  await waitBar(b, viewing('예산군'), 5000)
  check('R12 탭 A에서 예산군 → A는 /life-info로 돌아오고, 탭 B 표시줄도 예산군', true)
  await done(b)
  await done(a)
})

// ── R13. 긴 번역: 표시줄이 넘치지 않고 버튼 44px 이상 ──
for (const [locale, width] of [['ru', 320], ['mn', 320], ['km', 375], ['ne', 375], ['uz', 320], ['th', 375]]) await section(`R13-${locale}`, async () => {
  const page = await newPage({ locale, width, legacy: BUCHEON, loggedIn: true, profile: { region: MIRYANG } })
  await page.goto(`${BASE}/life-info`, { waitMs: 1500 })
  const SEL = JSON.stringify(barOf(locale))
  await page.waitFor(`(document.querySelector(${SEL})?.querySelectorAll('button, a').length ?? 0) === 2`, { timeout: 20000, label: 'bar with two buttons' }).catch(() => {})
  const m = await page.evaluate(`(() => {
    const bar = document.querySelector(${SEL}); if (!bar) return null
    const bs = [...bar.querySelectorAll('button, a')]
    return { overflow: document.scrollingElement.scrollWidth - innerWidth, barH: Math.round(bar.getBoundingClientRect().height),
      minH: Math.min(...bs.map((b) => b.getBoundingClientRect().height)), clipped: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
      inside: bs.every((b) => b.getBoundingClientRect().right <= bar.getBoundingClientRect().right + 0.5), n: bs.length }
  })()`)
  check(`R13 ${locale}@${width}: 가로 넘침 없음·버튼 44px 이상·잘림 없음·표시줄 안`, m && m.overflow <= 0 && m.minH >= 44 && m.clipped.length === 0 && m.inside && m.n === 2, m)
  await page.shot(OUT(`R13-bar-${locale}-${width}.png`))
  await done(page)
})
for (const [locale, width] of [['ru', 320], ['mn', 320], ['uz', 320], ['ne', 320], ['km', 320], ['ru', 375]]) await section(`R13-offer-${locale}-${width}`, async () => {
  const page = await newPage({ locale, width, legacy: HONGSEONG_TOWN, loggedIn: true, profile: { region: null } })
  await page.goto(`${BASE}/life-info`, { waitMs: 1500 })
  const SEL = JSON.stringify(barOf(locale))
  await page.waitFor(`(document.querySelector(${SEL})?.querySelectorAll('button, a').length ?? 0) === 3`, { timeout: 20000, label: 'offer buttons' })
  const m = await page.evaluate(`(() => {
    const bar = document.querySelector(${SEL}); const bs = [...bar.querySelectorAll('button, a')]
    return { overflow: document.scrollingElement.scrollWidth - innerWidth, minH: Math.min(...bs.map((b) => b.getBoundingClientRect().height)),
      clipped: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent), inside: bs.every((b) => b.getBoundingClientRect().right <= bar.getBoundingClientRect().right + 0.5),
      line: bar.querySelector('p')?.textContent }
  })()`)
  const [head, tail] = dicts[locale]['region.offer.question'].split('{name}')
  check(`R13 저장 제안 ${locale}@${width}: 문구 + 버튼 3개가 한 줄에 들어감`, m.overflow <= 0 && m.minH >= 44 && m.clipped.length === 0 && m.inside && m.line.startsWith(head) && m.line.endsWith(tail), m)
  await page.shot(OUT(`R13-offer-${locale}-${width}.png`))
  await done(page)
})

// ── R14. /farm: 보는 지역 기준, 지역 없으면 안내(무한 로딩 아님) ──
await section('R14', async () => {
  const none = await newPage()
  await none.goto(`${BASE}/farm`, { waitMs: 3000 })
  check('R14 지역 없음: /farm에 표시줄과 "지역을 고르면" 안내', (await none.evaluate(`!!document.querySelector(${JSON.stringify(BAR)})`)) && (await bodyHas(none, ko['farm.pickRegionHint'])))
  await done(none)
  const page = await newPage({ legacy: HONGSEONG_TOWN })
  await page.goto(`${BASE}/farm`, { waitMs: 1500 })
  await waitBar(page, viewing('홍성군 홍성읍'))
  check('R14 보는 지역(홍성읍): /farm 표시줄이 보는 지역을 보여 줌', true)
  await page.shot(OUT('R14-farm.png'))
  await done(page)
})

// ── R15. 게시판(비회원·지역 없음): 게시판 전용 안내(D-045 유지) ──
await section('R15', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/board`, { waitMs: 3000 })
  check('R15 게시판 지역 없음 → 게시판 전용 안내, 글 0건', (await bodyHas(page, ko['board.regionRequired'])) && (await page.evaluate(`document.querySelectorAll('main ul li a[href^="/board/"]').length`)) === 0)
  await done(page)
})

// ── R16. 첫 화면(Landing): 고른 지역이 있으면 홈으로, 없으면 머묾, 회원은 지역이 없어도 홈으로 ──
await section('R16', async () => {
  const withRegion = await newPage({ legacy: HONGSEONG_TOWN })
  await withRegion.goto(`${BASE}/`, { waitMs: 3000 })
  const p1 = await withRegion.evaluate('location.pathname')
  await done(withRegion)
  const none = await newPage()
  await none.goto(`${BASE}/`, { waitMs: 3000 })
  const p2 = await none.evaluate('location.pathname')
  await done(none)
  const member = await newPage({ loggedIn: true, profile: { region: null } })
  await member.goto(`${BASE}/`, { waitMs: 4000 })
  const p3 = await member.evaluate('location.pathname')
  check('R16 지역 있음 → /home, 지역 없음(비회원) → /, 회원(지역 없음) → /home', p1 === '/home' && p2 === '/' && p3 === '/home', { p1, p2, p3 })
  await done(member)
})

results.pageErrors = pageErrors
results.finishedAt = new Date().toISOString()
results.summary = { pass: results.checks.filter((c) => c.ok).length, fail: results.checks.filter((c) => !c.ok).length, blockedWrites: blocked.length }
writeFileSync(OUT('result.json'), JSON.stringify(results, null, 1))
console.log(JSON.stringify(results.summary), '\n', blocked.join('\n'))
await browser.close()
server.close()
process.exit(results.summary.fail ? 1 : 0)
