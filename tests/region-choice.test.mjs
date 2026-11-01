// 지역 동기화(v1.6 D-047): 보는 지역 판단·내 지역·저장 제안·기기 기록 저장소.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countyRegionIds,
  lifeInfoScope,
  lifeInfoScopeKey,
  regionStatus,
  sameCounty,
} from '../src/lib/regionScope.ts'
import {
  LEGACY_REGION_KEY,
  REGION_CHOICE_KEY,
  SAVE_OFFER_KEY,
  SAVE_OFFER_MAX,
  addDismissal,
  decideView,
  migrateLegacy,
  ownRegion,
  parseChoice,
  pendingWrite,
  recordApplies,
  safeReturnTo,
  saveOfferTarget,
  toOwnTarget,
} from '../src/lib/regionChoice.ts'
import { createRegionChoiceStore } from '../src/lib/regionChoiceStore.ts'

const region = (id, level, parent_id = null) => ({ id, level, parent_id, names: { ko: id }, is_active: true, centroid_lat: null, centroid_lng: null })
const REGIONS = [
  region('chungnam', 'province'),
  region('hongseong', 'city', 'chungnam'),
  region('hongseong-eup', 'town', 'hongseong'),
  region('hongbuk', 'town', 'hongseong'),
  region('yesan', 'city', 'chungnam'),
  region('gyeongnam', 'province'),
  region('miryang', 'city', 'gyeongnam'),
]

const view = (kind, regionId = null, uid = null) => ({ kind, regionId, uid, at: 1 })
const success = (regionId, exists = true) => ({ state: 'success', exists, regionId })
const base = {
  view: view('none'),
  auth: 'signedOut',
  uid: null,
  regions: REGIONS,
  regionsFailed: false,
  profile: { state: 'pending' },
  deadlinePassed: false,
  offline: false,
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

test('regionStatus: unknown while the list is missing or empty, invalid for provinces and unknown ids', () => {
  assert.equal(regionStatus(undefined, 'hongseong'), 'unknown')
  assert.equal(regionStatus([], 'hongseong'), 'unknown')
  assert.equal(regionStatus(REGIONS, 'hongseong'), 'valid')
  assert.equal(regionStatus(REGIONS, 'hongbuk'), 'valid')
  assert.equal(regionStatus(REGIONS, 'chungnam'), 'invalid')
  assert.equal(regionStatus(REGIONS, 'bucheon'), 'invalid')
  assert.equal(regionStatus(REGIONS, null), 'invalid')
})

test('life info scope never turns a missing region into a nationwide query', () => {
  assert.equal(lifeInfoScope(REGIONS, { status: 'none' }), null)
  assert.equal(lifeInfoScope(REGIONS, { status: 'deciding' }), null)
  assert.equal(lifeInfoScope(REGIONS, { status: 'error' }), null)
  assert.equal(lifeInfoScope(undefined, { status: 'region', regionId: 'hongseong' }), null)
  assert.equal(lifeInfoScope(REGIONS, { status: 'region', regionId: 'chungnam' }), null)
  assert.equal(lifeInfoScope(REGIONS, { status: 'region', regionId: 'bucheon' }), null)
  assert.deepEqual(lifeInfoScope(REGIONS, { status: 'all' }), { kind: 'all' })
  const scope = lifeInfoScope(REGIONS, { status: 'region', regionId: 'hongbuk' })
  assert.equal(scope.kind, 'county')
  assert.deepEqual([...scope.ids].sort(), ['hongbuk', 'hongseong', 'hongseong-eup'])
  assert.equal(lifeInfoScopeKey(scope), 'county:hongbuk,hongseong,hongseong-eup')
  assert.equal(lifeInfoScopeKey({ kind: 'all' }), 'all')
  assert.deepEqual(countyRegionIds(REGIONS, 'miryang'), ['miryang'])
  assert.equal(sameCounty(REGIONS, 'hongseong-eup', 'hongbuk'), true)
  assert.equal(sameCounty(REGIONS, 'hongseong', 'yesan'), false)
})

test('parseChoice: absent, corrupt, future and valid records', () => {
  assert.deepEqual(parseChoice(null), { state: 'absent' })
  assert.deepEqual(parseChoice('{oops'), { state: 'corrupt' })
  assert.deepEqual(parseChoice('{"v":1,"view":{"kind":"user"}}'), { state: 'corrupt' })
  assert.deepEqual(parseChoice('{"v":1,"view":{"kind":"profile","regionId":"miryang"}}'), { state: 'corrupt' })
  assert.deepEqual(parseChoice('{"v":2,"view":{}}'), { state: 'future' })
  const ok = parseChoice(JSON.stringify({ v: 1, view: { kind: 'all', regionId: 'x', uid: null, at: 5 }, rev: 3 }))
  assert.equal(ok.state, 'ok')
  assert.equal(ok.choice.view.regionId, null)
  assert.equal(ok.choice.rev, 3)
})

test('M1: a legacy value becomes a user pick whether or not it matches the profile', () => {
  const m = migrateLegacy('bucheon', 'w', 7)
  assert.deepEqual(m.view, { kind: 'user', regionId: 'bucheon', uid: null, at: 7 })
  assert.equal(m.migrated, true)
  assert.equal(migrateLegacy(null, 'w', 7).view.kind, 'none')
})

test('recordApplies: profile only for its own account; user picks survive sign-out but not another account', () => {
  assert.equal(recordApplies(view('profile', 'miryang', 'A'), 'signedIn', 'A'), true)
  assert.equal(recordApplies(view('profile', 'miryang', 'A'), 'signedIn', 'B'), false)
  assert.equal(recordApplies(view('profile', 'miryang', 'A'), 'signedOut', null), false)
  assert.equal(recordApplies(view('profile', 'miryang', 'A'), 'unknown', null), true)
  assert.equal(recordApplies(view('user', 'hongseong', 'A'), 'signedOut', null), true)
  assert.equal(recordApplies(view('user', 'hongseong', 'A'), 'signedIn', 'B'), false)
  assert.equal(recordApplies(view('user', 'hongseong', null), 'signedIn', 'B'), true)
  assert.equal(recordApplies(view('none'), 'signedIn', 'A'), false)
})

test('decideView: a direct pick is kept after login and never replaced by the profile region', () => {
  const v = decideView({ ...base, view: view('user', 'hongseong', null), auth: 'signedIn', uid: 'A', profile: success('miryang') })
  assert.deepEqual(v, { status: 'region', regionId: 'hongseong', kind: 'user' })
  assert.equal(pendingWrite({ ...base, view: view('user', 'hongseong', 'A'), auth: 'signedIn', uid: 'A', profile: success('miryang') }), null)
})

test('decideView: no region → none (no nationwide); explicit all → all', () => {
  assert.deepEqual(decideView(base), { status: 'none', reason: 'empty' })
  assert.deepEqual(decideView({ ...base, auth: 'signedIn', uid: 'A', profile: success(null) }), { status: 'none', reason: 'empty' })
  assert.deepEqual(decideView({ ...base, view: view('all', null, null) }), { status: 'all' })
  assert.deepEqual(decideView({ ...base, view: view('profile', 'miryang', 'A') }), { status: 'none', reason: 'empty' })
})

test('decideView: sync waits for the profile up to the deadline, then never auto-applies', () => {
  const s = { ...base, auth: 'signedIn', uid: 'A' }
  assert.deepEqual(decideView(s), { status: 'deciding' })
  assert.deepEqual(decideView({ ...s, profile: success('miryang') }), { status: 'region', regionId: 'miryang', kind: 'profile' })
  assert.deepEqual(pendingWrite({ ...s, profile: success('miryang') }), { type: 'followProfile', regionId: 'miryang', uid: 'A' })
  assert.deepEqual(decideView({ ...s, deadlinePassed: true }), { status: 'none', reason: 'timeout' })
  assert.deepEqual(decideView({ ...s, deadlinePassed: true, profile: success('miryang') }), { status: 'none', reason: 'timeout' })
  assert.equal(pendingWrite({ ...s, deadlinePassed: true, profile: success('miryang') }), null)
  assert.deepEqual(decideView({ ...s, profile: { state: 'error' } }), { status: 'none', reason: 'profileFailed' })
  assert.deepEqual(decideView({ ...s, offline: true }), { status: 'none', reason: 'profileFailed' })
  assert.deepEqual(decideView({ ...s, profile: success('chungnam') }), { status: 'none', reason: 'invalid' })
})

test('decideView: region list missing → deciding, failed → error; never deletes on unknown', () => {
  const stored = { ...base, view: view('user', 'hongseong', null) }
  assert.deepEqual(decideView({ ...stored, regions: undefined }), { status: 'deciding' })
  assert.deepEqual(decideView({ ...stored, regions: undefined, regionsFailed: true }), { status: 'error' })
  assert.equal(pendingWrite({ ...stored, auth: 'signedIn', uid: 'A', regions: [] }).type, 'claim')
  assert.equal(pendingWrite({ ...stored, view: view('user', 'hongseong', 'A'), auth: 'signedIn', uid: 'A', regions: [] }), null)
  assert.deepEqual(decideView({ ...stored, view: view('user', 'bucheon', null) }), { status: 'none', reason: 'invalid' })
  assert.deepEqual(pendingWrite({ ...stored, view: view('user', 'bucheon', null), auth: 'signedIn', uid: 'A' }), { type: 'tombstone' })
})

test('pendingWrite: auth unknown writes nothing; sign-out drops only the profile view; guest picks are claimed', () => {
  assert.equal(pendingWrite({ ...base, auth: 'unknown', view: view('profile', 'miryang', 'A') }), null)
  assert.deepEqual(pendingWrite({ ...base, view: view('profile', 'miryang', 'A') }), { type: 'tombstone' })
  assert.equal(pendingWrite({ ...base, view: view('user', 'hongseong', 'A') }), null)
  assert.deepEqual(pendingWrite({ ...base, view: view('all', null, null), auth: 'signedIn', uid: 'A' }), { type: 'claim', uid: 'A' })
})

test('pendingWrite: a followed profile region follows edits elsewhere and is demoted when cleared', () => {
  const s = { ...base, view: view('profile', 'miryang', 'A'), auth: 'signedIn', uid: 'A' }
  assert.deepEqual(pendingWrite({ ...s, profile: success('yesan') }), { type: 'followProfile', regionId: 'yesan', uid: 'A' })
  assert.deepEqual(pendingWrite({ ...s, profile: success(null) }), { type: 'demoteProfile' })
  assert.deepEqual(pendingWrite({ ...s, profile: success('chungnam') }), { type: 'demoteProfile' })
  assert.equal(pendingWrite({ ...s, profile: success('miryang') }), null)
  assert.equal(pendingWrite({ ...s, profile: { state: 'error' } }), null)
})

test('ownRegion (D-045): profile region first, else the viewed direct pick; never on pending/error', () => {
  const v = { status: 'region', regionId: 'hongseong', kind: 'user' }
  assert.deepEqual(ownRegion({ auth: 'signedIn', profile: success('miryang'), regions: REGIONS, view: v }), { state: 'ready', regionId: 'miryang', source: 'profile', profileRegionId: 'miryang' })
  assert.deepEqual(ownRegion({ auth: 'signedIn', profile: success(null), regions: REGIONS, view: v }), { state: 'ready', regionId: 'hongseong', source: 'view', profileRegionId: null })
  assert.deepEqual(ownRegion({ auth: 'signedIn', profile: success('chungnam'), regions: REGIONS, view: v }), { state: 'ready', regionId: 'hongseong', source: 'view', profileRegionId: null })
  assert.deepEqual(ownRegion({ auth: 'signedIn', profile: { state: 'pending' }, regions: REGIONS, view: v }), { state: 'pending' })
  assert.deepEqual(ownRegion({ auth: 'signedIn', profile: { state: 'error' }, regions: REGIONS, view: v }), { state: 'error' })
  assert.deepEqual(ownRegion({ auth: 'signedOut', profile: { state: 'pending' }, regions: REGIONS, view: { status: 'all' } }), { state: 'ready', regionId: null, source: null, profileRegionId: null })
  assert.equal(toOwnTarget(REGIONS, v, 'miryang'), 'miryang')
  assert.equal(toOwnTarget(REGIONS, { status: 'region', regionId: 'hongbuk', kind: 'user' }, 'hongseong-eup'), null)
  assert.equal(toOwnTarget(REGIONS, { status: 'all' }, 'miryang'), 'miryang')
  assert.equal(toOwnTarget(REGIONS, v, null), null)
})

test('saveOfferTarget (D3·D5): only for an existing row with no valid region, a direct pick, not dismissed', () => {
  const v = { status: 'region', regionId: 'hongseong', kind: 'user' }
  const s = { auth: 'signedIn', uid: 'A', profile: success(null), regions: REGIONS, view: v, dismissed: [] }
  assert.deepEqual(saveOfferTarget(s), { regionId: 'hongseong', previousRegionId: null })
  assert.deepEqual(saveOfferTarget({ ...s, profile: success('chungnam') }), { regionId: 'hongseong', previousRegionId: 'chungnam' })
  assert.equal(saveOfferTarget({ ...s, profile: success('miryang') }), null)
  assert.equal(saveOfferTarget({ ...s, profile: success(null, false) }), null)
  assert.equal(saveOfferTarget({ ...s, profile: { state: 'pending' } }), null)
  assert.equal(saveOfferTarget({ ...s, profile: { state: 'error' } }), null)
  assert.equal(saveOfferTarget({ ...s, view: { status: 'all' } }), null)
  assert.equal(saveOfferTarget({ ...s, view: { status: 'region', regionId: 'miryang', kind: 'profile' } }), null)
  assert.equal(saveOfferTarget({ ...s, auth: 'signedOut', uid: null }), null)
  assert.equal(saveOfferTarget({ ...s, dismissed: [{ uid: 'A', regionId: 'hongseong', at: 1 }] }), null)
  assert.deepEqual(saveOfferTarget({ ...s, dismissed: [{ uid: 'B', regionId: 'hongseong', at: 1 }] }), { regionId: 'hongseong', previousRegionId: null })
  let list = []
  for (let i = 0; i < SAVE_OFFER_MAX + 5; i += 1) list = addDismissal(list, 'A', `r${i}`, i)
  assert.equal(list.length, SAVE_OFFER_MAX)
  assert.equal(list[0].regionId, 'r5')
})

test('safeReturnTo keeps in-app paths only', () => {
  assert.equal(safeReturnTo('/board/new'), '/board/new')
  assert.equal(safeReturnTo('/life-info?category=support&from=talk'), '/life-info?category=support&from=talk')
  assert.equal(safeReturnTo('//evil.example'), '/home')
  assert.equal(safeReturnTo('https://evil.example'), '/home')
  assert.equal(safeReturnTo('/select'), '/home')
  assert.equal(safeReturnTo('/'), '/home')
  assert.equal(safeReturnTo(undefined), '/home')
})

test('store: migrates the legacy key once and keeps it in step', () => {
  const storage = fakeStorage({ [LEGACY_REGION_KEY]: 'bucheon' })
  const store = createRegionChoiceStore({ storage, now: () => 10, writer: 't1' })
  const first = store.getSnapshot()
  assert.equal(first.view.kind, 'user')
  assert.equal(first.view.regionId, 'bucheon')
  assert.equal(first.migrated, true)
  assert.ok(storage.map.has(REGION_CHOICE_KEY))
  store.pickAll(null)
  assert.equal(storage.map.has(LEGACY_REGION_KEY), false)
  // 묘비 뒤 재시작: 구버전 키가 다시 생겨도 다시 옮기지 않는다
  storage.map.set(LEGACY_REGION_KEY, 'bucheon')
  const again = createRegionChoiceStore({ storage, now: () => 11, writer: 't2' })
  assert.equal(again.getSnapshot().view.kind, 'all')
})

test('store: same-tab writes notify and snapshots are stable', () => {
  const store = createRegionChoiceStore({ storage: fakeStorage(), writer: 't1' })
  let calls = 0
  const off = store.subscribe(() => { calls += 1 })
  assert.equal(store.getSnapshot(), store.getSnapshot())
  store.pickUser('hongseong', null)
  assert.equal(calls, 1)
  assert.equal(store.getSnapshot(), store.getSnapshot())
  assert.equal(store.getChoiceRev(), 1)
  off()
  store.pickUser('yesan', null)
  assert.equal(calls, 1)
})

test('store: automatic writes are skipped when the record changed since the decision', () => {
  const store = createRegionChoiceStore({ storage: fakeStorage(), writer: 't1' })
  const rev = store.getSnapshot().rev
  store.pickUser('hongseong', 'A')
  assert.equal(store.apply({ type: 'followProfile', regionId: 'miryang', uid: 'A' }, rev), false)
  assert.equal(store.getSnapshot().view.regionId, 'hongseong')
  assert.equal(store.apply({ type: 'followProfile', regionId: 'miryang', uid: 'A' }, store.getSnapshot().rev), true)
  assert.equal(store.getSnapshot().view.kind, 'profile')
})

test('store: sign-out clears only the profile view; account deletion clears that account', () => {
  const storage = fakeStorage()
  const store = createRegionChoiceStore({ storage, writer: 't1' })
  store.followProfile('miryang', 'A')
  assert.equal(storage.map.get(LEGACY_REGION_KEY), 'miryang')
  store.clearProfileView()
  assert.equal(store.getSnapshot().view.kind, 'none')
  assert.equal(storage.map.has(LEGACY_REGION_KEY), false)
  store.pickUser('hongseong', 'A')
  store.clearProfileView()
  assert.equal(store.getSnapshot().view.regionId, 'hongseong')
  store.dismissOffer('A', 'hongseong')
  store.dismissOffer('B', 'yesan')
  store.clearForUid('A')
  assert.equal(store.getSnapshot().view.kind, 'none')
  assert.deepEqual(store.getDismissals().map((d) => d.uid), ['B'])
})

test('store: another tab’s legacy echo is ignored, a real old-tab write is taken, a removal is ignored', () => {
  const storage = fakeStorage()
  const store = createRegionChoiceStore({ storage, writer: 't1' })
  store.pickUser('hongseong', null)
  const rev = store.getChoiceRev()
  store.handleStorageEvent(LEGACY_REGION_KEY, 'hongseong')
  assert.equal(store.getChoiceRev(), rev)
  store.handleStorageEvent(LEGACY_REGION_KEY, null)
  assert.equal(store.getSnapshot().view.regionId, 'hongseong')
  storage.map.set(LEGACY_REGION_KEY, 'yesan')
  store.handleStorageEvent(LEGACY_REGION_KEY, 'yesan')
  assert.deepEqual([store.getSnapshot().view.kind, store.getSnapshot().view.regionId], ['user', 'yesan'])
  // 다른 탭이 새 기록을 썼다 → 다시 읽고 진행 중 판단 무효
  const before = store.getChoiceRev()
  storage.map.set(REGION_CHOICE_KEY, JSON.stringify({ v: 1, view: { kind: 'all', regionId: null, uid: null, at: 1 }, rev: 99 }))
  store.handleStorageEvent(REGION_CHOICE_KEY, storage.map.get(REGION_CHOICE_KEY))
  assert.equal(store.getSnapshot().view.kind, 'all')
  assert.ok(store.getChoiceRev() > before)
})

test('store: a future-version record is read as none and not overwritten automatically; storage failures stay in memory', () => {
  const storage = fakeStorage({ [REGION_CHOICE_KEY]: '{"v":2,"view":{"kind":"x"}}' })
  const store = createRegionChoiceStore({ storage, writer: 't1' })
  assert.equal(store.getSnapshot().view.kind, 'none')
  assert.equal(store.isFuture(), true)
  assert.equal(store.apply({ type: 'tombstone' }, store.getSnapshot().rev), false)
  assert.equal(storage.map.get(REGION_CHOICE_KEY), '{"v":2,"view":{"kind":"x"}}')
  store.pickUser('hongseong', null)
  assert.equal(store.getSnapshot().view.regionId, 'hongseong')
  const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
  const mem = createRegionChoiceStore({ storage: broken, writer: 't1' })
  mem.pickUser('yesan', null)
  assert.equal(mem.getSnapshot().view.regionId, 'yesan')
  assert.equal(JSON.parse(storage.map.get(SAVE_OFFER_KEY) ?? '[]').length, 0)
})
