// 최소 CDP(Chrome DevTools Protocol) 클라이언트 — 의존성 없음(Node 22 전역 WebSocket).
// 헤드리스 Chrome 을 375x812 모바일로 띄워 실제 입력 이벤트로 누르고, 스크린샷을 파일로 남긴다.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ port = 9333, profileDir, headless = true } = {}) {
  rmSync(profileDir, { recursive: true, force: true })
  mkdirSync(profileDir, { recursive: true })
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--mute-audio',
    '--window-size=375,812',
    'about:blank',
  ]
  if (headless) args.unshift('--headless=new')
  const child = spawn(CHROME, args, { stdio: 'ignore', detached: false })
  let version
  for (let i = 0; i < 60; i += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
      break
    } catch {
      await sleep(250)
    }
  }
  if (!version) throw new Error('chrome did not start')
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  const listeners = new Set()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(`${message.error.message} ${message.error.data ?? ''}`))
      else resolve(message.result)
      return
    }
    for (const listener of listeners) listener(message)
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })

  async function newPage({ width = 375, height = 812, languages = ['ko-KR', 'ko'] } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const page = createPage({ send, listeners, sessionId, targetId })
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Network.enable')
    await page.send('Log.enable')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await page.setLanguages(languages)
    return page
  }

  async function close() {
    try {
      await send('Browser.close')
    } catch {
      // already closed
    }
    try {
      child.kill()
    } catch {
      // ignore
    }
  }
  return { send, newPage, close }
}

function createPage({ send, listeners, sessionId, targetId }) {
  const consoleErrors = []
  const pageErrors = []
  const requests = []
  const handlers = new Map()
  let fetchHandler = null

  listeners.add((message) => {
    if (message.sessionId !== sessionId) return
    const { method, params } = message
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      consoleErrors.push(params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    } else if (method === 'Runtime.exceptionThrown') {
      pageErrors.push(
        (params.exceptionDetails.exception?.description ?? params.exceptionDetails.text ?? '').slice(0, 300),
      )
    } else if (method === 'Network.requestWillBeSent') {
      requests.push({ method: params.request.method, url: params.request.url })
    } else if (method === 'Fetch.requestPaused') {
      void handlePaused(params)
    }
    const list = handlers.get(method)
    if (list) for (const fn of list) fn(params)
  })

  const psend = (method, params = {}) => send(method, params, sessionId)

  async function handlePaused(params) {
    try {
      const decision = fetchHandler ? await fetchHandler(params.request, params) : null
      if (!decision || decision.action === 'continue') {
        await psend('Fetch.continueRequest', {
          requestId: params.requestId,
          ...(decision?.headers
            ? { headers: Object.entries(decision.headers).map(([name, value]) => ({ name, value })) }
            : {}),
        })
      } else if (decision.action === 'fail') {
        await psend('Fetch.failRequest', { requestId: params.requestId, errorReason: decision.reason ?? 'BlockedByClient' })
      } else if (decision.action === 'fulfill') {
        const body = decision.body === undefined ? '' : typeof decision.body === 'string' ? decision.body : JSON.stringify(decision.body)
        await psend('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: decision.status ?? 200,
          responseHeaders: [
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
            { name: 'Access-Control-Expose-Headers', value: '*' },
            { name: 'Content-Type', value: decision.contentType ?? 'application/json' },
            ...(decision.extraHeaders ?? []),
          ],
          // 그림 같은 이진 응답은 bodyBase64 로 넘긴다
          body: decision.bodyBase64 ?? Buffer.from(body, 'utf8').toString('base64'),
        })
      }
    } catch (error) {
      try {
        await psend('Fetch.continueRequest', { requestId: params.requestId })
      } catch {
        // request already gone
      }
      pageErrors.push(`harness fetch handler: ${String(error).slice(0, 200)}`)
    }
  }

  async function evaluate(expression) {
    const { result, exceptionDetails } = await psend('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  async function waitFor(expression, { timeout = 8000, interval = 100, label } = {}) {
    const started = Date.now()
    for (;;) {
      let value
      try {
        value = await evaluate(expression)
      } catch {
        value = null
      }
      if (value) return value
      if (Date.now() - started > timeout) throw new Error(`timeout waiting for ${label ?? expression}`)
      await sleep(interval)
    }
  }

  // 화면에 보이는 요소를 글자·선택자로 찾는 페이지 쪽 도우미
  const FIND = `
    (function(spec){
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      let list
      if (spec.selector) list = Array.from(document.querySelectorAll(spec.selector))
      else list = Array.from(document.querySelectorAll(spec.within || 'button, a, [role=button], summary, select, input'))
      list = list.filter(visible)
      if (spec.text !== undefined) {
        const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim()
        list = list.filter((el) => spec.exact ? norm(el.innerText || el.textContent) === spec.text : norm(el.innerText || el.textContent).includes(spec.text))
      }
      if (spec.aria) list = list.filter((el) => (el.getAttribute('aria-label') || '').includes(spec.aria))
      return list[spec.index || 0] || null
    })
  `

  async function rectOf(spec) {
    return evaluate(`(function(){
      const el = ${FIND}(${JSON.stringify(spec)})
      if (!el) return null
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      const hit = document.elementFromPoint(x, y)
      return { x, y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, hitOk: !!hit && (hit === el || el.contains(hit) || hit.contains(el)), hitTag: hit ? hit.tagName + '.' + String(hit.className).slice(0, 60) : null, text: (el.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 80) }
    })()`)
  }

  /** 실제 입력 이벤트로 누른다. 요소가 다른 것에 가려져 있으면(hit-test 실패) 오류. */
  async function tap(spec, { allowCovered = false } = {}) {
    let rect = await waitFor(`(${rectOfExpr(spec)})`, { label: `element ${JSON.stringify(spec)}` })
    // 창이 닫힌 직후에는 투명한 막이 잠깐(350ms) 탭을 삼킨다 — 사람처럼 막이 걷힐 때까지 기다렸다 누른다
    const started = Date.now()
    while (!rect.hitOk && !allowCovered && Date.now() - started < 1500) {
      await sleep(50)
      rect = (await evaluate(`(${rectOfExpr(spec)})`)) ?? rect
    }
    if (!rect.hitOk && !allowCovered) {
      throw new Error(`element ${JSON.stringify(spec)} is covered by ${rect.hitTag}`)
    }
    await tapAt(rect.x, rect.y)
    return rect
  }
  function rectOfExpr(spec) {
    return `(function(){
      const el = ${FIND}(${JSON.stringify(spec)})
      if (!el) return null
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      const hit = document.elementFromPoint(x, y)
      return { x, y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, hitOk: !!hit && (hit === el || el.contains(hit) || hit.contains(el)), hitTag: hit ? hit.tagName + '.' + String(hit.className).slice(0, 60) : null }
    })()`
  }

  async function tapAt(x, y) {
    await psend('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await psend('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await psend('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }

  async function key(name, { shift = false } = {}) {
    const codes = { Escape: 27, Tab: 9, Enter: 13 }
    const base = { key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name], modifiers: shift ? 8 : 0 }
    // Enter 는 글자 입력(keypress)이 있어야 버튼이 눌린다
    const down = name === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' }
    await psend('Input.dispatchKeyEvent', { ...base, ...down })
    await psend('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }

  async function type(text) {
    await psend('Input.insertText', { text })
  }

  async function goto(url, { waitMs = 600 } = {}) {
    const loaded = new Promise((resolve) => {
      const fn = () => {
        const list = handlers.get('Page.loadEventFired') ?? []
        handlers.set('Page.loadEventFired', list.filter((x) => x !== fn))
        resolve()
      }
      handlers.set('Page.loadEventFired', [...(handlers.get('Page.loadEventFired') ?? []), fn])
    })
    await psend('Page.navigate', { url })
    await Promise.race([loaded, sleep(15000)])
    await sleep(waitMs)
  }

  async function shot(file, { fullPage = false } = {}) {
    let clip
    if (fullPage) {
      const { contentSize } = await psend('Page.getLayoutMetrics')
      clip = { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 }
    }
    const { data } = await psend('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) })
    writeFileSync(file, Buffer.from(data, 'base64'))
    return file
  }

  return {
    send: psend,
    targetId,
    evaluate,
    waitFor,
    rectOf,
    tap,
    tapAt,
    key,
    type,
    goto,
    shot,
    sleep,
    consoleErrors,
    pageErrors,
    requests,
    on(method, fn) {
      handlers.set(method, [...(handlers.get(method) ?? []), fn])
    },
    async setLanguages(languages) {
      await psend('Emulation.setUserAgentOverride', {
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        acceptLanguage: languages.join(','),
        platform: 'Android',
      })
    },
    async setReducedMotion(reduce) {
      await psend('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
      })
    },
    async setOffline(offline) {
      await psend('Network.emulateNetworkConditions', {
        offline,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
    },
    async interceptFetch(handler, patterns = [{ urlPattern: '*' }]) {
      fetchHandler = handler
      await psend('Fetch.enable', { patterns })
    },
    async addInitScript(source) {
      await psend('Page.addScriptToEvaluateOnNewDocument', { source })
    },
    async text(selector = 'body') {
      return evaluate(`(document.querySelector(${JSON.stringify(selector)})?.innerText ?? '').replace(/\\s+\\n/g, '\\n').trim()`)
    },
    async close() {
      await send('Target.closeTarget', { targetId })
    },
  }
}

export function outDir(dir) {
  mkdirSync(dir, { recursive: true })
  return (name) => join(dir, name)
}
