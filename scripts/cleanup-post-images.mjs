// 게시글 사진 정리(D-044, 오너가 실행). 공개 버킷 post-images 에서 "공개 글이 쓰지 않는 파일"을 찾아 지운다.
// 생기는 경우: 출시된 1.4.1 앱에서 사진 글을 지움(그 앱은 사진을 모른다), 올린 뒤 글 저장 응답을 못 받음, 앱이 올리는 도중 꺼짐,
// 대시보드에서 글·계정을 지움. 게시물 공개 상태와 상관없이 주소만 알면 열리므로 개인정보처리방침 §4의 "사진도 지운다"를 지키려고 돌린다.
//
// 사용(PowerShell 예): $env:SUPABASE_SERVICE_ROLE_KEY = '<서비스 롤 키>'; node scripts/cleanup-post-images.mjs
//   기본은 보고만 한다. 실제로 지우려면 --apply. 관리자가 숨긴 글(hidden)의 사진도 지우려면 --include-hidden.
//   주소는 SUPABASE_URL, 없으면 .env.local 의 VITE_SUPABASE_URL. 키는 환경변수로만 받고 출력·저장하지 않는다.
//   막 올라가는 중인 파일을 지우지 않도록 24시간이 안 된 파일은 건드리지 않는다.
import { existsSync, readFileSync } from 'node:fs'

const BUCKET = 'post-images'
const apply = process.argv.includes('--apply')
const includeHidden = process.argv.includes('--include-hidden')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = (process.env.SUPABASE_URL ?? (existsSync('.env.local') ? (readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL=(.+)$/m) ?? [])[1] : ''))?.trim()
if (!key || !url) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 와 SUPABASE_URL(또는 .env.local 의 VITE_SUPABASE_URL)이 필요하다.')
  process.exit(1)
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const api = async (path, init = {}) => {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

// 1) 버킷 파일 전부(작성자 폴더 → 파일)
async function list(prefix) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const page = await api(`/storage/v1/object/list/${BUCKET}`, { method: 'POST', body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) })
    out.push(...page)
    if (page.length < 1000) return out
  }
}
const files = []
for (const folder of await list('')) {
  if (folder.id) continue // 맨 위에는 폴더만 있어야 한다
  for (const f of await list(`${folder.name}/`)) if (f.id) files.push({ name: `${folder.name}/${f.name}`, created: f.created_at })
}

// 2) 글이 쓰는 경로(공개 글, --include-hidden 이 아니면 숨긴 글도 지킨다)
const keep = new Set()
const deletedWithPaths = []
for (let offset = 0; ; offset += 1000) {
  const rows = await api(`/rest/v1/posts?select=id,status,image_paths&order=id&limit=1000&offset=${offset}`)
  for (const r of rows) {
    const kept = r.status === 'published' || (r.status === 'hidden' && !includeHidden)
    if (kept) for (const p of r.image_paths ?? []) { keep.add(p); keep.add(p.replace(/\.jpg$/, '_t.jpg')) }
    else if ((r.image_paths ?? []).length) deletedWithPaths.push(r.id)
  }
  if (rows.length < 1000) break
}

const dayAgo = Date.now() - 24 * 3600e3
const orphans = files.filter((f) => !keep.has(f.name) && new Date(f.created).getTime() < dayAgo)
const young = files.filter((f) => !keep.has(f.name) && new Date(f.created).getTime() >= dayAgo).length
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', files: files.length, inUse: files.length - orphans.length - young, orphans: orphans.length, skippedUnder24h: young, postsNotPublicWithPaths: deletedWithPaths.length, sample: orphans.slice(0, 5).map((f) => f.name) }, null, 1))

if (apply) {
  for (let i = 0; i < orphans.length; i += 100) {
    await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes: orphans.slice(i, i + 100).map((f) => f.name) }) })
  }
  // 지운 글·숨긴 글의 경로 칸도 비운다(파일이 없는 주소를 가리키지 않게)
  for (const id of deletedWithPaths) {
    await api(`/rest/v1/posts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ image_paths: [] }), headers: { Prefer: 'return=minimal' } })
  }
  console.log(`지운 파일 ${orphans.length}개, 경로를 비운 글 ${deletedWithPaths.length}개`)
}
