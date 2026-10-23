// 회원가입·계정 삭제 단계 점검(D-046). 빌드한 웹 번들(기본 dist)을 헤드리스 Chrome(375×812)으로 띄워 실제 입력 이벤트로 누른다.
// - 운영 Supabase로는 읽기만 나간다. 로그인 확인·계정 삭제·로그아웃 요청은 브라우저 안에서 가짜로 받아 준다(서버로 나가지 않음).
//   회원가입 요청은 막고 기록한다. 로그인은 서명 없는 가짜 세션(이메일 가입 / 카카오 가입 두 가지).
// 사용: npm run build && node tests/e2e/account-check.mjs   결과: $NSD_DATA_DIR/account-check/<날짜>/result.json + 화면
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
const OUT = outDir(join(DATA, 'account-check', day))
if (!existsSync(join(ROOT, 'index.html'))) throw new Error(`번들이 없다: ${ROOT} (npm run build 먼저)`)
const ko = JSON.parse(readFileSync(join(repo, 'src/i18n/dictionaries/ko.json'), 'utf8'))
const FAKE_USER = '00000000-0000-4000-8000-00000000d046'
const GOOD_PASSWORD = 'right-password-1'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file))
})
await new Promise((r) => server.listen(5196, 'localhost', r))
const BASE = 'http://localhost:5196'
const browser = await launch({ port: 9373, profileDir: join(DATA, 'account-check-profile') })
const results = { startedAt: new Date().toISOString(), bundle: ROOT, checks: [] }
// 전체 시간 제한 — 멈추면 기록을 남기고 끝낸다(조용히 매달리지 않게)
setTimeout(() => {
  console.error('time limit 240s', JSON.stringify(results.checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}`)))
  process.exit(2)
}, 240000).unref()
const check = (name, ok, detail) => { results.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`) }

function session(kind) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const user = {
    id: FAKE_USER, aud: 'authenticated', role: 'authenticated', email: 'account-check@example.test',
    app_metadata: kind === 'kakao' ? { provider: 'kakao', providers: ['kakao'] } : { provider: 'email', providers: ['email'] },
    user_metadata: {}, created_at: '2026-10-23T00:00:00Z',
  }
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: FAKE_USER, role: 'authenticated', exp })}.unsigned`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'unsigned', user }
}

async function newPage({ kind = null } = {}) {
  const log = { signins: [], deletes: 0, logouts: 0, signups: 0, blocked: [] }
  const page = await browser.newPage({ languages: ['ko'] })
  await page.interceptFetch((req, params) => {
    if (!/supabase\.co/.test(req.url)) return null
    const path = req.url.replace(/^https:\/\/[^/]+/, '')
    if (req.method === 'POST' && path.startsWith('/auth/v1/token?grant_type=password')) {
      const body = JSON.parse(params.request.postData ?? '{}')
      log.signins.push(body.password === GOOD_PASSWORD)
      return body.password === GOOD_PASSWORD
        ? { action: 'fulfill', body: session(kind ?? 'email') }
        : { action: 'fulfill', status: 400, body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }
    }
    if (req.method === 'POST' && path.startsWith('/functions/v1/delete-account')) { log.deletes++; return { action: 'fulfill', body: { ok: true } } }
    if (req.method === 'POST' && path.startsWith('/auth/v1/logout')) { log.logouts++; return { action: 'fulfill', status: 204, body: '' } }
    if (req.method === 'POST' && path.startsWith('/auth/v1/signup')) { log.signups++ }
    if (!['GET', 'OPTIONS', 'HEAD'].includes(req.method)) { log.blocked.push(`${req.method} ${path.slice(0, 60)}`); return { action: 'fail', reason: 'BlockedByClient' } }
    if (kind && req.headers?.apikey) return { action: 'continue', headers: { ...req.headers, Authorization: `Bearer ${req.headers.apikey}` } }
    return null
  }, [{ urlPattern: '*supabase.co/*' }])
  const init = [
    `localStorage.setItem('nongsadama.locale', 'ko')`, `localStorage.setItem('nongsadama.locale.explicit', 'true')`,
    `localStorage.setItem('nongsadama.regionId', 'a1000000-0000-4000-8000-000000001201')`,
    kind ? `localStorage.setItem('sb-ikusdwursvbdrznbcjtw-auth-token', ${JSON.stringify(JSON.stringify(session(kind)))})` : '',
  ].join(';')
  await page.addInitScript(`try { if (!sessionStorage.getItem('i')) { localStorage.clear(); ${init}; sessionStorage.setItem('i', '1') } } catch (e) {}`)
  return { page, log }
}
const has = (page, text) => page.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)
const setValue = (page, selector, value) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
const errors = []
// ONLY=2-email 처럼 주면 그 단계만 돌린다(문제 찾기용). 단계마다 시작을 찍어 멈춘 곳을 알 수 있게 한다.
const ONLY = process.env.ONLY
async function section(name, fn) {
  if (ONLY && !name.startsWith(ONLY)) return
  console.log(`--- ${name}`)
  let ctx = null
  try { ctx = await fn((c) => { ctx = c }) } catch (e) {
    check(`${name}: 중단`, false, { error: String(e).slice(0, 200) })
  }
  if (ctx?.page) { errors.push(...ctx.page.pageErrors); await ctx.page.shot(OUT(`${name}.png`)).catch(() => {}); await ctx.page.close().catch(() => {}) }
}

// ── 1. 계정 설정은 첫 화면 아래 ──
await section('1-placement', async (keep) => {
  const ctx = await newPage({ kind: 'email' }); keep(ctx)
  const { page } = ctx
  await page.goto(`${BASE}/profile`, { waitMs: 2500 })
  await page.waitFor(`!!document.getElementById('account-settings-title')`, { timeout: 20000 })
  const m = await page.evaluate(`(() => { const h = document.getElementById('account-settings-title'); const r = h.getBoundingClientRect();
    const w = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(ko['profile.withdraw'])});
    return { top: Math.round(r.top), vh: innerHeight, withdrawTop: w ? Math.round(w.getBoundingClientRect().top) : null, logout: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(ko['profile.logout'])} && b.getBoundingClientRect().bottom <= innerHeight) } })()`)
  check('계정 설정·회원탈퇴는 첫 화면에 보이지 않음(아래로 내려야 보임), 로그아웃은 첫 화면에 있음', m.top >= m.vh && m.withdrawTop >= m.vh && m.logout, m)
  await page.shot(OUT('1-profile-first-screen.png'))
  await page.evaluate(`document.getElementById('account-settings-title').scrollIntoView({ block: 'start' })`)
  await page.sleep(300)
  const closed = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(ko['profile.withdraw'])}); const cs = b ? getComputedStyle(b) : null;
    return { withdraw: !!b, expanded: b?.getAttribute('aria-expanded'), panel: !!document.getElementById('account-withdraw-panel'), deleteButton: document.body.innerText.includes(${JSON.stringify(ko['profile.deleteAccount'])}), color: cs?.color, border: cs?.borderTopWidth, background: cs?.backgroundColor } })()`)
  check('내려가도 "회원탈퇴" 글자만 — 빨간 칸·계정 삭제 버튼 없음', closed.withdraw && closed.expanded === 'false' && !closed.panel && !closed.deleteButton && closed.border === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(closed.background), closed)
  await page.shot(OUT('1-profile-scrolled.png'))
  await page.tap({ text: ko['profile.withdraw'], exact: true })
  await page.sleep(100)
  // 펼친 직후 같은 자리 근처의 계정 삭제를 곧장 눌러도 본인 확인으로 넘어가지 않는다
  const del = await page.rectOf({ text: ko['profile.deleteAccount'], exact: true })
  await page.tapAt(del.x, del.y)
  await page.sleep(100)
  check('회원탈퇴 → 그때 경고와 계정 삭제 버튼, 펼친 직후 누름은 무시', (await page.evaluate(`!!document.getElementById('account-withdraw-panel')`)) && (await has(page, ko['profile.deleteAccountWarn'])) && !(await page.evaluate(`!!document.querySelector('form input')`)))
  await page.shot(OUT('1-withdraw-open.png'))
  await page.tap({ text: ko['profile.withdraw'], exact: true })
  await page.sleep(200)
  check('회원탈퇴를 다시 누르면 접힘', !(await page.evaluate(`!!document.getElementById('account-withdraw-panel')`)))
  return ctx
})

// ── 1b. 다른 화면에서 아래로 내린 채 내 정보로 와도 맨 위에서 시작 ──
await section('1b-scroll', async (keep) => {
  const ctx = await newPage({ kind: 'email' }); keep(ctx)
  const { page } = ctx
  await page.goto(`${BASE}/life-info`, { waitMs: 3000 })
  await page.evaluate(`window.scrollTo(0, document.scrollingElement.scrollHeight)`)
  await page.sleep(300)
  const scrolled = await page.evaluate(`Math.round(window.scrollY)`)
  await page.tap({ selector: 'a[href="/profile"]' })
  await page.waitFor(`location.pathname === '/profile' && !!document.getElementById('account-settings-title')`, { timeout: 10000 })
  await page.sleep(300)
  const m = await page.evaluate(`({ y: Math.round(scrollY), top: Math.round(document.getElementById('account-settings-title').getBoundingClientRect().top), vh: innerHeight })`)
  check('스크롤한 화면에서 내 정보로 와도 맨 위(계정 설정은 화면 밖)', scrolled > 0 && m.y === 0 && m.top >= m.vh, { scrolled, ...m })
  return ctx
})

/** 회원탈퇴를 펼치고(눌림 무시 시간이 지나도록 기다린 뒤) 계정 삭제를 누른다 */
async function openDeletion(page) {
  await page.tap({ text: ko['profile.withdraw'], exact: true })
  await page.sleep(450)
  await page.tap({ text: ko['profile.deleteAccount'], exact: true })
}

// ── 2. 이메일 가입자: 비밀번호로 본인 확인 ──
await section('2-email', async (keep) => {
  const ctx = await newPage({ kind: 'email' }); keep(ctx)
  const { page, log } = ctx
  await page.goto(`${BASE}/profile`, { waitMs: 2500 })
  await openDeletion(page)
  await page.waitFor(`!!document.querySelector('form input[type=password]')`, { timeout: 5000 })
  check('계정 삭제 → 비밀번호 입력 단계(바로 지우는 버튼 없음)', (await has(page, ko['profile.deleteVerifyPassword'])) && !(await has(page, ko['profile.deleteAccountConfirm'])))
  check('비밀번호를 모를 때 이메일 요청 줄이 늘 보임', (await has(page, ko['profile.deleteVerifyNoPassword'])) && (await page.evaluate(`!!document.querySelector('#account-withdraw-panel a[href^="mailto:"]')`)))
  await page.tap({ selector: 'form input[type=password]' })
  await page.type('wrong-password')
  await page.tap({ text: ko['profile.deleteVerifyNext'], exact: true })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['profile.deleteVerifyWrongPassword'])})`, { timeout: 8000 })
  check('틀린 비밀번호 → 안내, 삭제 요청 없음', log.deletes === 0 && log.signins[0] === false, log)
  await setValue(page, 'form input[type=password]', GOOD_PASSWORD)
  await page.tap({ text: ko['profile.deleteVerifyNext'], exact: true })
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(ko['profile.deleteVerified'])})`, { timeout: 8000 })
  check('맞는 비밀번호 → 확인됨 + 영구 삭제 버튼(아직 삭제 요청 없음)', log.deletes === 0 && (await has(page, ko['profile.deleteAccountConfirm'])))
  const order = await page.evaluate(`(() => { const bs = [...document.querySelectorAll('#account-withdraw-panel button')]; const c = bs.find((b) => b.textContent.trim() === ${JSON.stringify(ko['postDetail.deleteCancel'])}); const d = bs.find((b) => b.textContent.trim() === ${JSON.stringify(ko['profile.deleteAccountConfirm'])}); return { cancelLeft: c.getBoundingClientRect().left < d.getBoundingClientRect().left, finalDisabled: d.disabled } })()`)
  check('확정 단계: 취소가 왼쪽(확인이 있던 자리), 영구 삭제는 처음 1초 눌리지 않음', order.cancelLeft && order.finalDisabled, order)
  await page.shot(OUT('2-email-confirm.png'))
  await page.sleep(1200)
  await page.tap({ text: ko['profile.deleteAccountConfirm'], exact: true })
  await page.waitFor(`location.pathname !== '/profile'`, { timeout: 10000 })
  check('영구 삭제 → 삭제 요청 1번 + 로그아웃 + 내 정보에서 나감', log.deletes === 1 && log.logouts >= 1, log)
  return ctx
})

// ── 3. 카카오 가입자: 숫자 4개 + 두 번 누름 막기 ──
await section('3-kakao', async (keep) => {
  const ctx = await newPage({ kind: 'kakao' }); keep(ctx)
  const { page, log } = ctx
  await page.goto(`${BASE}/profile`, { waitMs: 2500 })
  await openDeletion(page)
  await page.waitFor(`!!document.querySelector('form input[inputmode=numeric]')`, { timeout: 5000 })
  const code = await page.evaluate(`document.querySelector('form span[aria-hidden]').textContent.trim()`)
  check('카카오 가입자 → 숫자 4개 단계(비밀번호 칸 없음)', /^\d{4}$/.test(code) && !(await page.evaluate(`!!document.querySelector('form input[type=password]')`)), code)
  await page.tap({ selector: 'form input[inputmode=numeric]' })
  await page.type(code === '1234' ? '4321' : '1234')
  await page.tap({ text: ko['profile.deleteVerifyNext'], exact: true })
  await page.sleep(200)
  check('틀린 숫자 → 안내', await has(page, ko['profile.deleteVerifyWrongCode']))
  // 크메르 숫자로 쳐도 받는다(전각·태국·네팔 숫자도 같은 방식)
  await setValue(page, 'form input[inputmode=numeric]', code.replace(/\d/g, (d) => String.fromCharCode(0x17e0 + Number(d))))
  // "확인" 바로 뒤 영구 삭제 버튼 자리를 곧장 누른다(두 번 누름 흉내) → 무시돼야 한다
  const r = await page.rectOf({ text: ko['profile.deleteVerifyNext'], exact: true })
  await page.tapAt(r.x, r.y)
  const fin = await page.waitFor(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(ko['profile.deleteAccountConfirm'])}); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 } })()`, { timeout: 3000, interval: 10 })
  await page.tapAt(fin.x, fin.y)
  await page.sleep(150)
  check('크메르 숫자 통과 + 나타난 직후 영구 삭제를 눌러도 무시(두 번 누름 사고 방지)', log.deletes === 0 && (await has(page, ko['profile.deleteVerified'])), log)
  await page.sleep(1200)
  await page.tapAt(fin.x, fin.y)
  await page.waitFor(`location.pathname !== '/profile'`, { timeout: 10000 })
  check('잠시 뒤 영구 삭제 → 삭제 요청 1번 + 로그아웃', log.deletes === 1 && log.logouts >= 1, log)
  return ctx
})

// ── 4. 취소하면 처음으로 ──
await section('4-cancel', async (keep) => {
  const ctx = await newPage({ kind: 'kakao' }); keep(ctx)
  const { page, log } = ctx
  await page.goto(`${BASE}/profile`, { waitMs: 2500 })
  await openDeletion(page)
  // 취소를 두 번 누른 것처럼 곧장 같은 자리 근처의 계정 삭제를 누른다 → 본인 확인이 다시 열리지 않아야 한다
  const cancelRect = await page.rectOf({ text: ko['postDetail.deleteCancel'], exact: true })
  await page.tapAt(cancelRect.x, cancelRect.y)
  const again = await page.rectOf({ text: ko['profile.deleteAccount'], exact: true })
  await page.tapAt(again.x, again.y)
  await page.sleep(200)
  check('본인 확인에서 취소 → "계정 삭제" 버튼만(펼친 채), 곧장 다시 눌러도 열리지 않음', (await has(page, ko['profile.deleteAccount'])) && !(await page.evaluate(`!!document.querySelector('form input')`)) && log.deletes === 0)
  return ctx
})

// ── 5. 회원가입 비밀번호 확인 ──
await section('5-signup', async (keep) => {
  const ctx = await newPage(); keep(ctx)
  const { page, log } = ctx
  await page.goto(`${BASE}/login`, { waitMs: 2500 })
  await page.tap({ text: ko['auth.orEmail'], exact: true })
  await page.tap({ text: ko['auth.toSignup'], exact: true })
  await page.waitFor(`document.querySelectorAll('input[type=password]').length === 2`, { timeout: 5000 })
  check('회원가입: 비밀번호 칸 2개(비밀번호 + 비밀번호 확인)', await has(page, ko['auth.passwordConfirm']))
  await setValue(page, 'input[type=email]', 'account-check@example.test')
  await setValue(page, 'input[autocomplete="new-password"]', 'abcdef1')
  await page.evaluate(`(() => { const el = document.querySelectorAll('input[type=password]')[1]; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, 'abcdef2'); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await setValue(page, 'input[autocomplete="nickname"]', '점검')
  await page.tap({ selector: 'button[type=submit]' })
  await page.sleep(500)
  check('두 비밀번호가 다르면 안내, 가입 요청 없음', (await has(page, ko['auth.error.passwordMismatch'])) && log.signups === 0, log)
  await page.shot(OUT('5-signup-mismatch.png'))
  await page.evaluate(`(() => { const el = document.querySelectorAll('input[type=password]')[1]; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, 'abcdef1'); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.tap({ selector: 'button[type=submit]' })
  await page.sleep(1200)
  check('같으면 가입 요청이 나감(점검에서는 막음)', log.signups === 1, log)
  await page.tap({ text: ko['auth.toLogin'], exact: true })
  await page.sleep(200)
  check('로그인 화면에는 비밀번호 확인 칸 없음', (await page.evaluate(`document.querySelectorAll('input[type=password]').length`)) === 1)
  return ctx
})

results.pageErrors = errors
results.summary = { pass: results.checks.filter((c) => c.ok).length, fail: results.checks.filter((c) => !c.ok).length }
writeFileSync(OUT('result.json'), JSON.stringify(results, null, 1))
console.log(JSON.stringify(results.summary), errors.length ? `pageErrors ${errors.length}` : '')
await browser.close()
server.close()
process.exit(results.summary.fail ? 1 : 0)
