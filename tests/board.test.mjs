// 게시판 글 종류(우리 동네 추천, D-043): 앱 목록 ↔ DB 제약, 주소 값 검사, 휴대전화 번호 감지.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BOARD_FILTERS,
  POST_CATEGORIES,
  containsMobileNumber,
  mobileNumbers,
  parseBoardCategory,
  postCategoryLabelKey,
} from '../src/lib/postCategories.ts'

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)

test('app categories match the latest posts_category_check migration', () => {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  let latest = null
  for (const f of files) {
    const sql = readFileSync(new URL(f, migrationsDir), 'utf8')
    const m = sql.match(/add constraint posts_category_check\s+check \(category in \(([^)]*)\)\)/)
    if (m) latest = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
  }
  assert.ok(latest, 'posts_category_check migration found')
  assert.deepEqual([...latest].sort(), [...POST_CATEGORIES].sort())
})

test('board filters show every category exactly once, local tips first', () => {
  assert.equal(BOARD_FILTERS[0], 'recommend')
  assert.deepEqual([...BOARD_FILTERS].sort(), [...POST_CATEGORIES].sort())
  assert.equal(new Set(BOARD_FILTERS).size, BOARD_FILTERS.length)
})

test('every category has copy in every dictionary', () => {
  for (const f of readdirSync(new URL('../src/i18n/dictionaries/', import.meta.url)).filter((x) => x.endsWith('.json'))) {
    const dict = JSON.parse(readFileSync(new URL(`../src/i18n/dictionaries/${f}`, import.meta.url), 'utf8'))
    for (const c of POST_CATEGORIES) assert.ok(dict[postCategoryLabelKey(c)]?.trim(), `${f} ${postCategoryLabelKey(c)}`)
  }
})

test('category query value: known values pass, anything else means all', () => {
  assert.equal(parseBoardCategory('recommend'), 'recommend')
  assert.equal(parseBoardCategory('help'), 'help')
  assert.equal(parseBoardCategory('Recommend'), null)
  assert.equal(parseBoardCategory('hospital'), null)
  assert.equal(parseBoardCategory(''), null)
  assert.equal(parseBoardCategory(null), null)
  assert.equal(parseBoardCategory(undefined), null)
})

test('mobile numbers are detected in common Korean formats', () => {
  for (const s of [
    '사장님 010-1234-5678 로 전화',
    '01012345678',
    '010 1234 5678',
    '010.1234.5678',
    '(010)1234-5678',
    '011-123-4567',
    '019-9876-5432',
    '+82 10-1234-5678',
    '+821012345678',
    'Call 010-1234-5678.',
    '010ㅡ1234ㅡ5678',
    '010 - 1234 - 5678',
    '010  1234  5678',
    '０１０－１２３４－５６７８',
    '010–1234–5678',
    '010−1234−5678',
    '010~1234~5678',
    '+82 (0)10-1234-5678',
  ]) assert.equal(containsMobileNumber(s), true, s)
})

test('landlines, prices and long ids are not mobile numbers', () => {
  for (const s of [
    '02-123-4567',
    '041-630-1234',
    '1577-1366',
    '1345',
    '가격 10,000원',
    '주문번호 2010123456789',
    '3010-1234-5678',
    '우편번호 01012',
    '',
  ]) assert.equal(containsMobileNumber(s), false, s)
})

test('the same number in any format gives one key; ticking one number does not cover another', () => {
  assert.deepEqual(mobileNumbers('010-1234-5678 / +82 10 1234 5678 / ０１０ㅡ１２３４ㅡ５６７８'), ['01012345678'])
  assert.deepEqual(mobileNumbers('010-1234-5678 그리고 010-9999-0000'), ['01012345678', '01099990000'])
  assert.notEqual(mobileNumbers('010-1234-5678').join('|'), mobileNumbers('010-1234-5678 010-9999-0000').join('|'))
  assert.deepEqual(mobileNumbers('010\n1234\n5678'), [], 'numbers split over lines are not joined')
})

// iOS 16.4 전 Safari는 정규식 뒤보기((?<= / (?<!)를 읽지 못해 앱 전체가 뜨지 않는다(D-043 검수에서 발견).
test('app source uses no regex lookbehind', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url))
  const offenders = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name) && /\(\?<[=!]/.test(readFileSync(full, 'utf8'))) offenders.push(full)
    }
  }
  walk(root)
  assert.deepEqual(offenders, [])
})

test('every column the app selects from posts exists in the migrations', () => {
  const hook = readFileSync(new URL('../src/hooks/usePosts.ts', import.meta.url), 'utf8')
  const cols = hook.match(/POST_COLUMNS =\s*'([^']+)'/)[1].split(',')
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(new URL(f, migrationsDir), 'utf8'))
    .join('\n')
  const createPosts = sql.match(/create table[^;(]*public\.posts\s*\(([\s\S]*?)\n\);/i)[1]
  for (const c of cols) {
    const created = new RegExp(`^\\s*${c}\\s`, 'm').test(createPosts)
    const added = new RegExp(`alter table public\\.posts add column (if not exists )?${c}\\b`, 'i').test(sql)
    assert.ok(created || added, c)
  }
})

