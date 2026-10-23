// 게시판 점검: 우리 동네 추천(D-043)·사진(D-044)·다른 지역 보기 제한(D-045).
// 빌드한 웹 번들(기본 dist)을 헤드리스 Chrome(375×812)으로 띄워 실제 입력 이벤트로 누른다.
// - 운영 Supabase로는 읽기(GET·HEAD)만 나간다. 다른 메서드는 브라우저 안에서 막고 기록한다.
//   단, 7번(사진 전체 흐름)은 쓰기 요청을 브라우저 안에서 가짜로 받아 준다(서버로 나가지 않음) — 올린 파일·저장 내용을 검사하려고.
// - 로그인은 서명 없는 가짜 세션을 기기 저장소에 넣어 흉내 낸다. 읽기는 공개(anon) 키로 바꿔 보낸다.
// - 프로필 지역·내 지역 글 수는 가짜 응답으로 정한다(운영 DB에 그런 사용자는 없다).
// 사용: npm run build && node tests/e2e/local-tips-check.mjs   결과: $NSD_DATA_DIR/local-tips-check/<날짜>/result.json + 화면
import http from 'node:http'
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, outDir } from './lib/cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const ROOT = process.env.BUNDLE_ROOT ?? join(repo, 'dist')
const DATA = process.env.NSD_DATA_DIR ?? join(repo, '..', 'nongsadama_data')
const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const OUT = outDir(join(DATA, 'local-tips-check', day))
if (!existsSync(join(ROOT, 'index.html'))) throw new Error(`번들이 없다: ${ROOT} (npm run build 먼저)`)

const ko = JSON.parse(readFileSync(join(repo, 'src/i18n/dictionaries/ko.json'), 'utf8'))
const dicts = Object.fromEntries(['ko', 'en', 'vi', 'km', 'th', 'ne', 'mn', 'uz', 'ru'].map((l) => [l, JSON.parse(readFileSync(join(repo, `src/i18n/dictionaries/${l}.json`), 'utf8'))]))
// 운영 regions id
const MIRYANG = 'a1000000-0000-4000-8000-000000001201' // 경상남도 밀양시(운영 게시글 0건)
const HONGSEONG_TOWN = 'a2000000-0000-4000-8000-000000000001' // 충청남도 홍성군 홍성읍
const SEOUL = 'a0000000-0000-4000-8000-000000000001'
const GANGNAM = 'a1000000-0000-4000-8000-000000001023' // 서울 강남구(운영 게시글 1건)
const HONGDONG_AUTHOR = '79daa21b-9ab4-41d4-8eca-b274aa789080' // 홍동면에 공개 글 7건을 쓴 운영 계정
const FAKE_USER = '00000000-0000-4000-8000-00000000d043'
const FAKE_POST = {
  id: '00000000-0000-4000-8000-0000000d0431', author_id: '00000000-0000-4000-8000-0000000d0432', region_id: MIRYANG,
  category: 'recommend', title: '점검용 추천 글', body: '점검 스크립트가 만든 가짜 응답입니다.', source_locale: 'ko', status: 'published',
  image_paths: [], created_at: '2026-10-23T00:00:00Z', updated_at: '2026-10-23T00:00:00Z',
}
const SIM_POST_ID = '00000000-0000-4000-8000-0000000d0441'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file))
})
await new Promise((r) => server.listen(5199, 'localhost', r))
const BASE = 'http://localhost:5199'
const browser = await launch({ port: 9371, profileDir: join(DATA, 'local-tips-check-profile') })
const blocked = []
const results = { startedAt: new Date().toISOString(), bundle: ROOT, checks: [], blockedWrites: blocked }
const check = (name, ok, detail) => { results.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`) }

function fakeSession() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const user = { id: FAKE_USER, aud: 'authenticated', role: 'authenticated', email: 'local-tips-check@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-23T00:00:00Z' }
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: FAKE_USER, role: 'authenticated', exp })}.unsigned`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'unsigned', user }
}
const wantsObject = (req) => /vnd\.pgrst\.object/.test(req.headers?.Accept ?? req.headers?.accept ?? '')
const rows = (req, row) => ({ action: 'fulfill', body: wantsObject(req) ? row : [row] })
function requestBytes(params) {
  const entries = params.request.postDataEntries ?? []
  if (entries.length) return Buffer.concat(entries.map((e) => Buffer.from(e.bytes ?? '', 'base64')))
  return Buffer.from(params.request.postData ?? '', 'latin1')
}

/**
 * @param o.deviceRegion 기기에 저장된 지역(null이면 없음)
 * @param o.profileRegion 가짜 로그인의 프로필 지역(null이면 프로필 없음)
 * @param o.ownCount 내 지역 글 수 응답(null이면 운영 DB에 그대로 묻는다 → 가짜 사용자라 0)
 * @param o.sim 쓰기를 브라우저 안에서 받아 줄 기록 상자({ uploads, inserts, patches, removes })
 */
async function newPage({ locale = 'ko', loggedIn = false, deviceRegion = MIRYANG, profileRegion = null, ownCount = null, sim = null } = {}) {
  const page = await browser.newPage({ languages: [locale] })
  await page.interceptFetch((req, params) => {
    if (!/supabase\.co/.test(req.url)) return null
    const path = req.url.replace(/^https:\/\/[^/]+/, '')
    if (!['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
      if (sim) {
        if (req.method === 'POST' && path.startsWith('/storage/v1/object/post-images/')) {
          const name = decodeURIComponent(path.slice('/storage/v1/object/post-images/'.length).split('?')[0])
          sim.uploads.push({ name, bytes: requestBytes(params) })
          return { action: 'fulfill', body: { Key: `post-images/${name}`, Id: name } }
        }
        if (req.method === 'POST' && path.startsWith('/rest/v1/posts')) {
          sim.inserts.push(JSON.parse(requestBytes(params).toString('utf8') || '{}'))
          return { action: 'fulfill', status: 201, body: wantsObject(req) ? { id: SIM_POST_ID } : [{ id: SIM_POST_ID }] }
        }
        if (req.method === 'PATCH' && path.startsWith('/rest/v1/posts')) {
          sim.patches.push(JSON.parse(requestBytes(params).toString('utf8') || '{}'))
          return { action: 'fulfill', status: 204, body: '' }
        }
        if (req.method === 'DELETE' && path.startsWith('/storage/v1/object/post-images')) {
          sim.removes.push(JSON.parse(requestBytes(params).toString('utf8') || '{}'))
          return { action: 'fulfill', body: [] }
        }
      }
      blocked.push(`${req.method} ${path.slice(0, 80)}`)
      return { action: 'fail', reason: 'BlockedByClient' }
    }
    if (loggedIn && profileRegion && path.startsWith('/rest/v1/profiles') && path.includes(`id=eq.${FAKE_USER}`)) {
      return rows(req, { id: FAKE_USER, nickname: '점검', preferred_locale: locale, preferred_locale_explicit: true, region_id: profileRegion, country_code: null, crop_type: null, is_matching_visible: false, role: 'user', auth_provider: 'email', created_at: '2026-10-23T00:00:00Z', updated_at: '2026-10-23T00:00:00Z' })
    }
    if (loggedIn && ownCount !== null && path.startsWith('/rest/v1/posts') && path.includes(`author_id=eq.${FAKE_USER}`)) {
      return { action: 'fulfill', body: req.method === 'HEAD' ? '' : [], extraHeaders: [{ name: 'Content-Range', value: `*/${ownCount}` }] }
    }
    if (path.startsWith('/rest/v1/posts') && path.includes(`id=eq.${FAKE_POST.id}`)) return rows(req, FAKE_POST)
    if (sim && path.startsWith('/rest/v1/posts') && path.includes(`id=eq.${SIM_POST_ID}`)) {
      const ins = sim.inserts.at(-1) ?? {}
      return rows(req, { ...FAKE_POST, ...ins, id: SIM_POST_ID, author_id: FAKE_USER, status: 'published' })
    }
    if (sim && path.includes('/storage/v1/object/public/post-images/')) {
      const name = decodeURIComponent(path.split('/storage/v1/object/public/post-images/')[1].split('?')[0])
      const up = sim.uploads.find((u) => u.name === name)
      const jpeg = up ? extractJpeg(up.bytes) : null
      if (jpeg) return { action: 'fulfill', bodyBase64: jpeg.toString('base64'), contentType: 'image/jpeg' }
    }
    // 가짜 로그인 화면의 읽기는 서버가 가짜 토큰을 거절하므로 공개(anon) 키로 바꿔 보낸다 — 값은 요청에 이미 있고 출력하지 않는다
    if (loggedIn && req.headers?.apikey) return { action: 'continue', headers: { ...req.headers, Authorization: `Bearer ${req.headers.apikey}` } }
    return null
  }, [{ urlPattern: '*supabase.co/*' }])
  const init = [
    `localStorage.setItem('nongsadama.locale', ${JSON.stringify(locale)})`,
    `localStorage.setItem('nongsadama.locale.explicit', 'true')`,
    deviceRegion ? `localStorage.setItem('nongsadama.regionId', ${JSON.stringify(deviceRegion)})` : '',
    loggedIn ? `localStorage.setItem('sb-ikusdwursvbdrznbcjtw-auth-token', ${JSON.stringify(JSON.stringify(fakeSession()))})` : '',
  ].join(';')
  await page.addInitScript(`try { if (!sessionStorage.getItem('nsd-init')) { localStorage.clear(); ${init}; sessionStorage.setItem('nsd-init', '1') } } catch (e) {}`)
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
const pressed = (page) => page.evaluate(`[...document.querySelectorAll('[role=group] button')].map((b) => b.getAttribute('aria-pressed') === 'true' ? 1 : 0).join('')`)
const bodyHas = (page, text) => page.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)
const viewing = (name) => ko['board.viewing'].replace('{region}', name)
const listCount = (page) => page.evaluate(`document.querySelectorAll('main ul li a[href^="/board/"]').length`)
const setSelect = (page, selector, value) => page.evaluate(`(() => { const s = document.querySelectorAll('select')[${selector}]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)

// ── 테스트 사진: 1600×1200 JPEG에 GPS·설명 EXIF를 넣는다(올라간 파일에 이 표시가 없어야 한다) ──
function exifWithGps() {
  const tiff = Buffer.alloc(104)
  tiff.write('II', 0, 'latin1'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(2, 8) // IFD0 항목 2개
  tiff.writeUInt16LE(0x010e, 10); tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(11, 14); tiff.writeUInt32LE(38, 18) // ImageDescription
  tiff.writeUInt16LE(0x8825, 22); tiff.writeUInt16LE(4, 24); tiff.writeUInt32LE(1, 26); tiff.writeUInt32LE(50, 30) // GPS IFD
  tiff.writeUInt32LE(0, 34)
  tiff.write('NSDGPSMARK\0', 38, 'latin1')
  tiff.writeUInt16LE(2, 50) // GPS 항목 2개
  tiff.writeUInt16LE(0x0001, 52); tiff.writeUInt16LE(2, 54); tiff.writeUInt32LE(2, 56); tiff.write('N\0', 60, 'latin1')
  tiff.writeUInt16LE(0x0002, 64); tiff.writeUInt16LE(5, 66); tiff.writeUInt32LE(3, 68); tiff.writeUInt32LE(80, 72)
  tiff.writeUInt32LE(0, 76)
  for (const [i, v] of [35, 29, 0].entries()) { tiff.writeUInt32LE(v, 80 + i * 8); tiff.writeUInt32LE(1, 84 + i * 8) }
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const head = Buffer.alloc(4); head.writeUInt16BE(0xffe1, 0); head.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([head, payload])
}
function extractJpeg(bytes) {
  const start = bytes.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
  const end = bytes.lastIndexOf(Buffer.from([0xff, 0xd9]))
  return start >= 0 && end > start ? bytes.subarray(start, end + 2) : null
}
function jpegSize(jpeg) {
  for (let i = 2; i < jpeg.length - 9;) {
    if (jpeg[i] !== 0xff) return null
    const marker = jpeg[i + 1]
    const len = jpeg.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc3) return { height: jpeg.readUInt16BE(i + 5), width: jpeg.readUInt16BE(i + 7) }
    i += 2 + len
  }
  return null
}

// ── 1. 게시판 종류 버튼(로그인 전) ──
await section('1', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/board`, { waitMs: 2500 })
  await page.waitFor(`document.querySelectorAll('[role=group] button').length === 7`, { timeout: 20000 })
  check('종류 버튼 7개, 처음엔 전체', (await pressed(page)) === '1000000')
  await page.tap({ text: ko['board.category.recommend'], within: '[role=group] button' })
  await page.sleep(400)
  const url = await page.evaluate('location.href')
  check('추천 버튼 → 주소 ?category=recommend, 눌림 표시', url.endsWith('/board?category=recommend') && (await pressed(page)) === '0100000', url)
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['board.recommendEmpty'])})`, { timeout: 15000 })
  check('추천 0건 안내와 쓰기 버튼', await bodyHas(page, ko['board.recommendWrite']))
  await page.shot(OUT('1-board-recommend-empty-ko.png'))
  await page.tap({ text: ko['board.recommendWrite'], exact: true })
  await page.sleep(600)
  check('로그인 전 추천 쓰기 → 로그인 화면', (await page.evaluate('location.pathname')) === '/login')
  await page.goto(`${BASE}/board?category=nonsense`, { waitMs: 1500 })
  check('모르는 종류 값은 전체로', (await pressed(page)) === '1000000')
  await done(page)
})

// ── 2. 긴 번역에서 종류 버튼·지역 줄 ──
for (const locale of ['ru', 'uz', 'km', 'ne', 'mn', 'th', 'vi', 'en']) await section(`2-${locale}`, async () => {
  const page = await newPage({ locale })
  await page.goto(`${BASE}/board`, { waitMs: 2500 })
  await page.waitFor(`document.querySelectorAll('[role=group] button').length === 7`, { timeout: 20000 })
  const m = await page.evaluate(`(() => {
    const g = document.querySelector('[role=group]'); const bs = [...g.querySelectorAll('button')]
    const other = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-expanded') !== null)
    return { overflow: document.scrollingElement.scrollWidth - innerWidth, rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      minH: Math.min(...bs.map((b) => b.getBoundingClientRect().height)), clipped: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
      label: bs[1].textContent, groupLabel: g.getAttribute('aria-label'), other: other?.textContent, otherH: other ? Math.round(other.getBoundingClientRect().height) : 0,
      otherClipped: other ? other.scrollWidth > other.clientWidth + 1 : null }
  })()`)
  check(`${locale}: 종류 버튼·다른 지역 버튼 — 가로 넘침 없음·44px 이상·잘린 글자 없음`, m.overflow <= 0 && m.minH >= 44 && m.clipped.length === 0 && m.label === dicts[locale]['board.category.recommend'] && m.groupLabel === dicts[locale]['board.filterLabel'] && m.other === dicts[locale]['board.otherRegions'] && m.otherH >= 44 && !m.otherClipped, m)
  await page.shot(OUT(`2-board-chips-${locale}.png`))
  await done(page)
})

// ── 3. 생활정보 → 이웃 추천 칸 ──
await section('3', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/life-info`, { waitMs: 2500 })
  const top = `(() => { const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/board?category=recommend'); return a ? Math.round(a.getBoundingClientRect().top) : null })()`
  const before = await page.evaluate(top)
  await page.waitFor(`!document.body.innerText.includes(${JSON.stringify(ko['lifeInfo.loading'])})`, { timeout: 20000 })
  const after = await page.evaluate(top)
  check('생활정보: 이웃 추천 칸이 있고 목록이 와도 자리가 그대로', before !== null && before === after, { before, after })
  await page.shot(OUT('3-lifeinfo-ko.png'))
  await page.tap({ text: ko['lifeInfo.neighborTips'] })
  await page.sleep(600)
  check('이웃 추천 칸 → 게시판 추천', (await page.evaluate('location.pathname + location.search')) === '/board?category=recommend')
  await page.goto(`${BASE}/life-info?category=support&from=talk`, { waitMs: 2000 })
  check('상담·도움 길에서는 이웃 추천 칸을 숨김', (await page.evaluate(top)) === null)
  await done(page)
})

// ── 4. 글쓰기(가짜 로그인): 안내, 휴대전화 경고, 체크 전에는 저장 요청 없음 ──
await section('4', async () => {
  const page = await newPage({ loggedIn: true })
  await page.goto(`${BASE}/board?category=recommend`, { waitMs: 2500 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['board.recommendWrite'])})`, { timeout: 20000 })
  await page.tap({ text: ko['board.recommendWrite'], exact: true })
  await page.waitFor(`location.pathname === '/board/new' && !!document.querySelector('select')`, { timeout: 15000 })
  check('추천 쓰기 → 글쓰기 종류가 우리 동네 추천', (await page.evaluate(`document.querySelector('select').value`)) === 'recommend')
  check('추천 안내 문구', await bodyHas(page, ko['postForm.recommendGuide']))
  await page.tap({ selector: 'input[type=text]' })
  await page.type('밀양 시장 국밥집')
  await page.tap({ selector: 'textarea' })
  await page.type('시장 안에 있어요. 사장님 010-1234-5678')
  await page.sleep(300)
  check('휴대전화 번호 → 경고 체크 상자', await bodyHas(page, ko['postForm.mobileWarning']))
  await page.shot(OUT('4-form-mobile-warning-ko.png'))
  const postsBefore = blocked.filter((b) => b.includes('/rest/v1/posts')).length
  await page.tap({ selector: 'button[type=submit]' })
  await page.sleep(600)
  check('체크 전 게시 → 번호 안내, 저장 요청 없음', (await bodyHas(page, ko['postForm.mobileRequired'])) && blocked.filter((b) => b.includes('/rest/v1/posts')).length === postsBefore)
  await page.tap({ text: ko['postForm.mobileWarning'], within: 'label' })
  await page.sleep(200)
  check('체크하면 번호 안내가 사라짐', !(await bodyHas(page, ko['postForm.mobileRequired'])))
  // 다른 번호를 더 쓰면 체크가 풀린다
  await page.tap({ selector: 'textarea' })
  await page.type(' 010-9999-0000')
  await page.sleep(200)
  check('새 번호를 쓰면 체크가 풀림', (await page.evaluate(`[...document.querySelectorAll('input[type=checkbox]')].every((c) => !c.checked)`)))
  await page.tap({ text: ko['postForm.mobileWarning'], within: 'label' })
  await page.tap({ selector: 'button[type=submit]' })
  await page.sleep(1200)
  const postsAfter = blocked.filter((b) => b.includes('/rest/v1/posts')).length
  check('체크 후 게시 → 저장 요청이 나감(점검에서는 차단) + 실패 안내', postsAfter === postsBefore + 1 && (await bodyHas(page, ko['postForm.error.saveFailed'])), { postsBefore, postsAfter })
  await page.evaluate(`(() => { const t = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, '시장 안에 있어요.'); t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.sleep(300)
  check('번호를 지우면 경고가 사라짐', !(await bodyHas(page, ko['postForm.mobileWarning'])))
  await page.evaluate(`(() => { const t = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, '010-1234-5678'); t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await setSelect(page, 0, 'question')
  await page.sleep(300)
  check('질문 종류에는 추천 안내·번호 경고 없음', !(await bodyHas(page, ko['postForm.recommendGuide'])) && !(await bodyHas(page, ko['postForm.mobileWarning'])))
  await done(page)
})

// ── 5. 추천 글 상세(가짜 응답) ──
await section('5', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/board/${FAKE_POST.id}`, { waitMs: 2500 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(FAKE_POST.title)})`, { timeout: 20000 })
  check('상세: 종류 이름과 "확인하지 않은 추천" 안내', (await bodyHas(page, ko['board.category.recommend'])) && (await bodyHas(page, ko['postDetail.recommendNote'])))
  await page.shot(OUT('5-detail-recommend-ko.png'))
  await done(page)
})

// ── 6. 다른 지역 보기 제한(D-045) ──
await section('6a', async () => {
  // 로그인 · 프로필 지역 밀양 · 기기 지역 홍성읍 · 내 지역 글 3개 → 홍성 글 대신 밀양 글 + 안내
  const page = await newPage({ loggedIn: true, deviceRegion: HONGSEONG_TOWN, profileRegion: MIRYANG, ownCount: 3 })
  await page.goto(`${BASE}/board`, { waitMs: 2500 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(viewing('밀양시'))})`, { timeout: 20000 })
  await page.waitFor(`!document.body.innerText.includes(${JSON.stringify(ko['board.loading'])})`, { timeout: 20000 })
  const notice = ko['board.lockedShowingOwn'].replace('{region}', '홍성읍').replace('{own}', '밀양시').replace('{need}', '5').replace('{count}', '3')
  check('잠김: 기기 지역(홍성읍) 대신 내 지역(밀양시) 글 + 안내', (await bodyHas(page, notice)) && (await listCount(page)) === 0)
  await page.shot(OUT('6a-locked-redirect-ko.png'))
  await page.tap({ text: ko['board.otherRegions'] })
  await page.sleep(300)
  check('잠김: 다른 지역 보기 → 3/5 안내', await bodyHas(page, ko['board.lockedBody'].replace('{need}', '5').replace('{count}', '3')))
  await done(page)
})
await section('6b', async () => {
  // 같은 사람이 5개를 쓰면 → 홍성읍 글이 보이고, 내 지역·다른 지역(서울 강남구)으로 오갈 수 있다
  const page = await newPage({ loggedIn: true, deviceRegion: HONGSEONG_TOWN, profileRegion: MIRYANG, ownCount: 5 })
  await page.goto(`${BASE}/board`, { waitMs: 2500 })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(viewing('홍성군'))})`, { timeout: 20000 })
  await page.waitFor(`document.querySelectorAll('main ul li').length > 0`, { timeout: 20000 })
  check('열림: 기기 지역(홍성읍 → 홍성군 범위) 글이 보임', (await listCount(page)) >= 1, await listCount(page))
  await page.tap({ text: ko['board.backToOwn'], exact: true })
  await page.sleep(500)
  check('열림: 내 지역으로 → 밀양시', (await bodyHas(page, viewing('밀양시'))) && (await page.evaluate('location.search')).includes(`region=${MIRYANG}`))
  await page.tap({ text: ko['board.otherRegions'] })
  await page.waitFor(`document.querySelectorAll('select').length === 2`, { timeout: 5000 })
  await setSelect(page, 0, SEOUL)
  await page.sleep(200)
  await setSelect(page, 1, GANGNAM)
  await page.sleep(200)
  await page.shot(OUT('6b-browse-panel-ko.png'))
  await page.tap({ text: ko['board.pickApply'], exact: true })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(viewing('강남구'))})`, { timeout: 10000 })
  await page.waitFor(`document.querySelectorAll('main ul li').length > 0`, { timeout: 20000 })
  check('열림: 다른 지역(강남구) 글 보기', (await listCount(page)) >= 1 && (await page.evaluate('location.search')).includes(`region=${GANGNAM}`))
  await done(page)
})
await section('6c', async () => {
  const locked = await newPage({ loggedIn: true, deviceRegion: MIRYANG, profileRegion: MIRYANG, ownCount: 3 })
  await locked.goto(`${BASE}/board?author=${HONGDONG_AUTHOR}`, { waitMs: 3000 })
  await locked.waitFor(`!document.body.innerText.includes(${JSON.stringify(ko['board.loading'])})`, { timeout: 20000 })
  check('이웃의 글(잠김): 다른 지역 글 7개는 숨기고 안내', (await bodyHas(locked, ko['board.authorHidden'].replace('{n}', '7').replace('{need}', '5'))) && (await listCount(locked)) === 0)
  await done(locked)
  const open = await newPage({ loggedIn: true, deviceRegion: MIRYANG, profileRegion: MIRYANG, ownCount: 5 })
  await open.goto(`${BASE}/board?author=${HONGDONG_AUTHOR}`, { waitMs: 3000 })
  await open.waitFor(`document.querySelectorAll('main ul li').length > 0`, { timeout: 20000 })
  check('이웃의 글(열림): 7개 모두 보임', (await listCount(open)) === 7, await listCount(open))
  await done(open)
})
await section('6d', async () => {
  const page = await newPage({ deviceRegion: HONGSEONG_TOWN })
  await page.goto(`${BASE}/board`, { waitMs: 2500 })
  await page.waitFor(`document.querySelectorAll('main ul li').length > 0`, { timeout: 20000 })
  check('로그인 전: 고른 지역(홍성읍 → 홍성군 범위) 글이 보임', (await bodyHas(page, viewing('홍성군'))) && (await listCount(page)) >= 1)
  await page.goto(`${BASE}/board?region=${GANGNAM}`, { waitMs: 2500 })
  await page.waitFor(`document.querySelectorAll('main ul li').length > 0`, { timeout: 20000 })
  check('로그인 전: ?region= 으로 다른 지역을 열 수 없음', (await bodyHas(page, viewing('홍성군'))) && !(await bodyHas(page, viewing('강남구'))))
  await page.tap({ text: ko['board.otherRegions'] })
  await page.sleep(300)
  check('로그인 전: 다른 지역 보기 → 로그인 + 5개 안내', await bodyHas(page, ko['board.lockedLoggedOut'].replace('{need}', '5')))
  await done(page)
  const none = await newPage({ deviceRegion: null })
  await none.goto(`${BASE}/board`, { waitMs: 3000 })
  check('로그인 전·지역 없음: 전국 글 대신 지역 고르기 안내', (await bodyHas(none, ko['postForm.regionRequired'])) && (await listCount(none)) === 0)
  await done(none)
})

// ── 7. 사진 전체 흐름(쓰기는 브라우저 안에서 가짜로 받음) ──
await section('7', async () => {
  const maker = await newPage()
  await maker.goto(`${BASE}/privacy`, { waitMs: 1000 })
  const base64 = await maker.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1600, 1200); g.addColorStop(0, '#2a7'); g.addColorStop(1, '#fc3'); x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
    x.fillStyle = '#123'; x.font = 'bold 160px sans-serif'; x.fillText('NSD 1600x1200', 120, 640); return c.toDataURL('image/jpeg', 0.9).split(',')[1] })()`)
  await done(maker)
  const plain = Buffer.from(base64, 'base64')
  const withExif = Buffer.concat([plain.subarray(0, 2), exifWithGps(), plain.subarray(2)])
  const photoFile = OUT('test-photo-with-gps.jpg')
  writeFileSync(photoFile, withExif)
  check('시험 사진에 GPS EXIF가 들어 있음', withExif.includes('NSDGPSMARK') && withExif.includes('Exif'))

  const sim = { uploads: [], inserts: [], patches: [], removes: [] }
  const page = await newPage({ loggedIn: true, deviceRegion: HONGSEONG_TOWN, profileRegion: MIRYANG, ownCount: 0, sim })
  await page.goto(`${BASE}/board/new`, { waitMs: 2500 })
  await page.waitFor(`!!document.querySelector('input[type=file]')`, { timeout: 20000 })
  check('글쓰기: 기기 지역이 아니라 내 지역(밀양시) 게시판에 올라간다고 표시', await bodyHas(page, ko['postForm.targetRegion'].replace('{region}', '밀양시')))
  await page.tap({ selector: 'input[type=text]' })
  await page.type('사진 점검')
  await page.tap({ selector: 'textarea' })
  await page.type('사진이 붙은 글')
  const setFiles = async (files) => {
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input[type=file]')` })
    await page.send('DOM.setFileInputFiles', { files, objectId: result.objectId })
  }
  await setFiles([photoFile, photoFile, photoFile, photoFile])
  await page.waitFor(`document.querySelectorAll('form img[src^="blob:"]').length === 3`, { timeout: 20000 })
  check('사진 4장 고르기 → 3장만 + 안내', await bodyHas(page, ko['postForm.photoTooMany'].replace('{max}', '3')))
  await page.tap({ aria: `${ko['postForm.removePhoto']} 3` , selector: 'button' })
  await page.tap({ aria: `${ko['postForm.removePhoto']} 2`, selector: 'button' })
  await page.sleep(300)
  check('사진 빼기 → 1장', (await page.evaluate(`document.querySelectorAll('form img[src^="blob:"]').length`)) === 1)
  await page.shot(OUT('7-form-photo-ko.png'))
  await page.tap({ selector: 'button[type=submit]' })
  await page.waitFor(`location.pathname === '/board/${SIM_POST_ID}'`, { timeout: 20000 })
  const full = sim.uploads.find((u) => !u.name.endsWith('_t.jpg'))
  const thumb = sim.uploads.find((u) => u.name.endsWith('_t.jpg'))
  check('올린 파일: 큰 그림 + 작은 그림 각 1개, 내 폴더·정해진 이름', sim.uploads.length === 2 && full && thumb && full.name.startsWith(`${FAKE_USER}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}_\d+x\d+\.jpg$/.test(full.name) && thumb.name === full.name.replace(/\.jpg$/, '_t.jpg'), sim.uploads.map((u) => u.name))
  const fullJpeg = extractJpeg(full.bytes)
  const thumbJpeg = extractJpeg(thumb.bytes)
  check('올린 파일에 EXIF·GPS가 없음', fullJpeg && thumbJpeg && !full.bytes.includes('NSDGPSMARK') && !thumb.bytes.includes('NSDGPSMARK') && !fullJpeg.includes('Exif') && !thumbJpeg.includes('Exif'))
  const fs1 = jpegSize(fullJpeg)
  const fs2 = jpegSize(thumbJpeg)
  check('크기: 큰 그림 1280×960, 작은 그림 360×270, 이름의 크기와 같음', fs1?.width === 1280 && fs1?.height === 960 && fs2?.width === 360 && fs2?.height === 270 && full.name.includes('_1280x960.jpg'), { full: fs1, thumb: fs2, bytes: [fullJpeg.length, thumbJpeg.length] })
  const ins = sim.inserts[0] ?? {}
  check('저장 내용: 내 지역(밀양시)에, 사진 경로 1개', ins.region_id === MIRYANG && JSON.stringify(ins.image_paths) === JSON.stringify([full.name]), { region_id: ins.region_id, image_paths: ins.image_paths })
  await page.waitFor(`!!document.querySelector('article img') && document.querySelector('article img').complete && document.querySelector('article img').naturalWidth > 0`, { timeout: 20000 })
  const img = await page.evaluate(`(() => { const i = document.querySelector('article img'); return { alt: i.alt, w: i.naturalWidth, h: i.naturalHeight, ratio: i.style.aspectRatio } })()`)
  check('상세: 사진이 보이고 자리(가로세로 비)가 먼저 잡힘', img.w === 1280 && img.h === 960 && img.alt === ko['postDetail.photo'].replace('{n}', '1') && Math.abs(img.ratio.split('/').reduce((a, b) => Number(a) / Number(b)) - 4 / 3) < 0.001, img)
  await page.shot(OUT('7-detail-photo-ko.png'))
  await page.tap({ text: ko['postDetail.delete'], exact: true })
  await page.tap({ text: ko['postDetail.deleteConfirm'], exact: true })
  await page.waitFor(`location.pathname === '/board'`, { timeout: 10000 })
  const removed = (sim.removes[0]?.prefixes ?? []).sort()
  check('글 삭제: 상태 deleted + 사진 경로 비움 + 큰·작은 그림 파일 삭제', sim.patches.some((p) => p.status === 'deleted' && Array.isArray(p.image_paths) && p.image_paths.length === 0) && JSON.stringify(removed) === JSON.stringify([full.name, thumb.name].sort()), { patches: sim.patches, removed })
  await done(page)
})

results.pageErrors = pageErrors
results.finishedAt = new Date().toISOString()
results.summary = { pass: results.checks.filter((c) => c.ok).length, fail: results.checks.filter((c) => !c.ok).length, blockedWrites: blocked.length }
writeFileSync(OUT('result.json'), JSON.stringify(results, null, 1))
console.log(JSON.stringify(results.summary), '\n', blocked.join('\n'))
await browser.close()
server.close()
process.exit(results.summary.fail ? 1 : 0)
