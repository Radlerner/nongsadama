/* 농사다마 서비스워커 — PWA 설치 요건(TWA/Play 등록 전제, D-023).
 * 전략(보수적):
 * - 내비게이션: network-first → 오프라인 시 캐시된 앱 셸(index) 폴백.
 *   (index를 cache-first로 하면 배포가 전파되지 않으므로 금지)
 * - 동일 출처 정적 자산(해시 파일명): cache-first (불변이므로 안전)
 * - 교차 출처(Supabase·지도 타일·분석)는 관여하지 않음(원본 동작 유지)
 */
const CACHE = 'nongsadama-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request('./', { cache: 'reload' }))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // SPA 내비게이션: network-first, 실패 시 캐시된 셸
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          void caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }

  // 해시된 정적 자산: cache-first
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
  }
})
