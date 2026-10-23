// 게시판 규칙: 다른 지역 보기 제한(D-045)과 사진 경로(D-044)가 SQL 마이그레이션과 맞는지.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { OTHER_REGION_UNLOCK_POSTS, boardView, inScope, isUnlocked } from '../src/lib/regionGate.ts'
import { MAX_POST_IMAGES, imageSize, isPostImagePath, newImagePath, thumbPath } from '../src/lib/postImagePaths.ts'

const OWN = 'own-city'
const OWN_TOWN = 'own-town'
const OTHER = 'other-city'
const ownScope = [OWN, OWN_TOWN]
const base = { loggedIn: true, unlocked: false, selectedRegionId: OWN, ownRegionId: OWN, ownScope, browseRegionId: null }

test('unlock needs a signed-in user with at least 5 own-area posts', () => {
  assert.equal(OTHER_REGION_UNLOCK_POSTS, 5)
  assert.equal(isUnlocked(false, 99), false)
  assert.equal(isUnlocked(true, undefined), false)
  assert.equal(isUnlocked(true, 4), false)
  assert.equal(isUnlocked(true, 5), true)
  assert.equal(inScope(ownScope, OWN_TOWN), true)
  assert.equal(inScope(ownScope, OTHER), false)
  assert.equal(inScope(null, OWN), false)
})

test('logged out: always the region picked on the device, ?region= ignored', () => {
  assert.deepEqual(boardView({ ...base, loggedIn: false, selectedRegionId: OTHER, ownRegionId: OTHER, browseRegionId: OWN }), { regionId: OTHER, redirectedFrom: null, outside: false })
  assert.deepEqual(boardView({ ...base, loggedIn: false, selectedRegionId: null, ownRegionId: null }), { regionId: null, redirectedFrom: null, outside: false })
})

test('signed in, locked: own area; a picked region elsewhere is replaced with a notice; browse ignored', () => {
  assert.deepEqual(boardView(base), { regionId: OWN, redirectedFrom: null, outside: false })
  assert.deepEqual(boardView({ ...base, selectedRegionId: OWN_TOWN }), { regionId: OWN, redirectedFrom: null, outside: false })
  assert.deepEqual(boardView({ ...base, selectedRegionId: OTHER }), { regionId: OWN, redirectedFrom: OTHER, outside: false })
  assert.deepEqual(boardView({ ...base, browseRegionId: OTHER }), { regionId: OWN, redirectedFrom: null, outside: false })
})

test('signed in, unlocked: browse wins, then the picked region, then own area', () => {
  const u = { ...base, unlocked: true }
  assert.deepEqual(boardView({ ...u, browseRegionId: OTHER }), { regionId: OTHER, redirectedFrom: null, outside: true })
  assert.deepEqual(boardView({ ...u, browseRegionId: OWN_TOWN }), { regionId: OWN_TOWN, redirectedFrom: null, outside: false })
  assert.deepEqual(boardView({ ...u, selectedRegionId: OTHER }), { regionId: OTHER, redirectedFrom: null, outside: true })
  assert.deepEqual(boardView(u), { regionId: OWN, redirectedFrom: null, outside: false })
})

test('signed in without a profile region: the picked region is the own area', () => {
  assert.deepEqual(boardView({ ...base, ownRegionId: OTHER, selectedRegionId: OTHER, ownScope: [OTHER] }), { regionId: OTHER, redirectedFrom: null, outside: false })
})

// ── 사진 경로: 앱 규칙과 SQL(글 제약·Storage 정책)이 같은 것을 받는다 ──
const sql = readFileSync(new URL('../supabase/migrations/20261023004059_post_images.sql', import.meta.url), 'utf8')
const AUTHOR = '11111111-2222-4333-8444-555555555555'
const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const postCheck = (() => {
  // '^(' || author_id::text || '<p>' || '(,' || author_id::text || '<p>)*)?$' → 작성자 id를 넣어 JS 정규식으로
  const parts = [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1])
  const i = parts.indexOf('^(')
  assert.ok(i >= 0, 'posts_image_paths_check pattern found')
  const [open, p1, mid, p2] = parts.slice(i, i + 4)
  return new RegExp(`${open}${AUTHOR}${p1}${mid}${AUTHOR}${p2}`)
})()
const storageName = new RegExp(sql.match(/and name ~ '([^']+)'/)[1])
const sqlAccepts = (paths) => paths.length <= MAX_POST_IMAGES && postCheck.test(paths.join(','))

test('app and SQL agree on which photo paths a post may hold', () => {
  const ok = newImagePath(AUTHOR, ID, 1280, 960)
  assert.equal(ok, `${AUTHOR}/${ID}_1280x960.jpg`)
  const samples = [
    [[], true],
    [[ok], true],
    [[ok, newImagePath(AUTHOR, ID.replace('e', 'f'), 10, 10), newImagePath(AUTHOR, ID.replace('a', 'b'), 1, 1)], true],
    [[ok, ok, ok, ok], false],
    [[newImagePath('99999999-2222-4333-8444-555555555555', ID, 10, 10)], false],
    [[thumbPath(ok)], false],
    [[ok.replace('.jpg', '.png')], false],
    [[`${AUTHOR}/../x_10x10.jpg`], false],
    [[ok, ''], false],
  ]
  for (const [paths, want] of samples) {
    assert.equal(sqlAccepts(paths), want, `SQL ${JSON.stringify(paths)}`)
    const app = paths.length <= MAX_POST_IMAGES && paths.every((p) => isPostImagePath(p, AUTHOR))
    assert.equal(app, want, `app ${JSON.stringify(paths)}`)
  }
})

test('storage accepts the full photo and its thumbnail name, nothing else', () => {
  const ok = newImagePath(AUTHOR, ID, 640, 480)
  assert.ok(storageName.test(ok))
  assert.ok(storageName.test(thumbPath(ok)))
  assert.ok(!storageName.test(`${AUTHOR}/${ID}.jpg`))
  assert.ok(!storageName.test(`${AUTHOR}/sub/${ID}_1x1.jpg`))
  assert.deepEqual(imageSize(ok), { width: 640, height: 480 })
  assert.equal(imageSize('nope.jpg'), null)
})
