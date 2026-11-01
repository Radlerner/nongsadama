import {
  LEGACY_REGION_KEY,
  REGION_CHOICE_KEY,
  SAVE_OFFER_KEY,
  addDismissal,
  emptyChoice,
  legacyValueFor,
  migrateLegacy,
  noneView,
  parseChoice,
  parseDismissals,
  removeDismissal,
  serializeChoice,
  type ChoiceWrite,
  type OfferDismissal,
  type RegionChoice,
  type ViewRecord,
} from './regionChoice.ts'

/**
 * 보는 지역 기록의 저장소(React 없음, v1.6 D-047). AuthContext와 RegionChoiceProvider가 같이 쓴다.
 * - 쓰기는 매번 저장소를 다시 읽고 고친다(다른 탭이 먼저 썼으면 자동 쓰기는 건너뜀).
 * - 같은 탭 변경은 구독자에게 바로 알리고, 다른 탭 변경은 'storage' 이벤트로 받는다.
 * - localStorage를 못 쓰면(사생활 모드·차단) 메모리에만 둔다 — 어떤 경우에도 예외를 밖으로 던지지 않는다.
 */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface RegionChoiceStore {
  getSnapshot(): RegionChoice
  subscribe(listener: () => void): () => void
  /** 이번 실행에서 사용자가 직접 고른 횟수(다른 탭의 변경 포함) — 늦은 비동기 결과가 덮어쓰지 않게 비교한다 */
  getChoiceRev(): number
  /** 이 탭에서 직접 고른 횟수만(다른 탭 변경 제외) — 지도를 다시 가운데 맞출지 정할 때 쓴다 */
  getLocalPickRev(): number
  /** 저장된 기록이 더 새 버전이 쓴 것인가(자동 쓰기 금지) */
  isFuture(): boolean
  pickUser(regionId: string, uid: string | null): void
  pickAll(uid: string | null): void
  /** 사용자가 "내 지역으로"를 눌렀거나 프로필에서 지역을 바꿨을 때 */
  followProfile(regionId: string, uid: string): void
  /** 판단 결과에 따른 자동 쓰기. 판단에 쓴 rev와 지금 rev가 다르면 건너뛴다. */
  apply(write: ChoiceWrite, expectRev: number): boolean
  /** 로그아웃: 프로필에서 온 보는 지역만 지운다(직접 고른 둘러보기 설정은 유지) */
  clearProfileView(): void
  /** 탈퇴: 그 계정이 남긴 기록과 "나중에"를 모두 지운다 */
  clearForUid(uid: string): void
  getDismissals(): OfferDismissal[]
  dismissOffer(uid: string, regionId: string): void
  undismissOffer(uid: string, regionId: string): void
  handleStorageEvent(key: string | null, newValue: string | null): void
}

function randomWriter(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function createRegionChoiceStore(options: {
  storage: StorageLike | null
  now?: () => number
  writer?: string
}): RegionChoiceStore {
  const now = options.now ?? (() => Date.now())
  const writer = options.writer ?? randomWriter()
  const memory = new Map<string, string>()
  let storage: StorageLike | null = options.storage

  const getItem = (key: string): string | null => {
    if (storage) {
      try {
        return storage.getItem(key)
      } catch {
        storage = null
      }
    }
    return memory.get(key) ?? null
  }
  const setItem = (key: string, value: string) => {
    memory.set(key, value)
    if (!storage) return
    try {
      storage.setItem(key, value)
    } catch {
      storage = null
    }
  }
  const removeItem = (key: string) => {
    memory.delete(key)
    if (!storage) return
    try {
      storage.removeItem(key)
    } catch {
      storage = null
    }
  }

  const listeners = new Set<() => void>()
  const notify = () => {
    for (const l of [...listeners]) l()
  }
  let choiceRev = 0
  let localPickRev = 0
  let cacheRaw: string | null | undefined
  let cacheChoice: RegionChoice = emptyChoice(writer, 0)
  let future = false

  const persist = (next: RegionChoice) => {
    const legacy = legacyValueFor(next.view)
    const stored: RegionChoice = { ...next, legacyMirror: legacy, writer }
    setItem(REGION_CHOICE_KEY, serializeChoice(stored))
    // 구버전 키를 같은 순간에 맞춘다(1.5 이하 코드·옛 탭 호환)
    if (legacy) setItem(LEGACY_REGION_KEY, legacy)
    else removeItem(LEGACY_REGION_KEY)
  }

  /** 지금 저장된 값을 읽는다. 기록이 아예 없으면 구버전 키에서 한 번만 옮겨 저장한다. */
  const readFresh = (): RegionChoice => {
    const raw = getItem(REGION_CHOICE_KEY)
    if (raw === cacheRaw) return cacheChoice
    const parsed = parseChoice(raw)
    future = parsed.state === 'future'
    let choice: RegionChoice
    if (parsed.state === 'ok') choice = parsed.choice
    else if (parsed.state === 'absent') {
      choice = migrateLegacy(getItem(LEGACY_REGION_KEY), writer, now())
      persist(choice)
      cacheRaw = getItem(REGION_CHOICE_KEY)
      cacheChoice = { ...choice, legacyMirror: legacyValueFor(choice.view), writer }
      return cacheChoice
    } else choice = emptyChoice(writer, now())
    cacheRaw = raw
    cacheChoice = choice
    return choice
  }

  const write = (mutate: (current: RegionChoice) => ViewRecord | null, opts: { explicit: boolean; expectRev?: number }) => {
    const current = readFresh()
    if (opts.expectRev !== undefined && current.rev !== opts.expectRev) return false
    if (future && !opts.explicit) return false
    const view = mutate(current)
    if (!view) return false
    const next: RegionChoice = { ...current, v: 1, view, rev: current.rev + 1, migrated: current.migrated && !opts.explicit }
    persist(next)
    future = false
    if (opts.explicit) choiceRev += 1
    readFresh()
    notify()
    return true
  }

  readFresh()

  return {
    getSnapshot: () => readFresh(),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getChoiceRev: () => choiceRev,
    getLocalPickRev: () => localPickRev,
    isFuture: () => {
      readFresh()
      return future
    },
    pickUser(regionId, uid) {
      localPickRev += 1
      write(() => ({ kind: 'user', regionId, uid, at: now() }), { explicit: true })
    },
    pickAll(uid) {
      localPickRev += 1
      write(() => ({ kind: 'all', regionId: null, uid, at: now() }), { explicit: true })
    },
    followProfile(regionId, uid) {
      localPickRev += 1
      write(() => ({ kind: 'profile', regionId, uid, at: now() }), { explicit: true })
    },
    apply(w, expectRev) {
      return write((current) => {
        const v = current.view
        switch (w.type) {
          case 'claim':
            return (v.kind === 'user' || v.kind === 'all') && v.uid === null ? { ...v, uid: w.uid } : null
          case 'followProfile':
            return v.kind === 'profile' && v.regionId === w.regionId && v.uid === w.uid
              ? null
              : { kind: 'profile', regionId: w.regionId, uid: w.uid, at: now() }
          case 'demoteProfile':
            return v.kind === 'profile' ? { ...v, kind: 'user', at: now() } : null
          case 'tombstone':
            return v.kind === 'none' ? null : noneView(now())
        }
      }, { explicit: false, expectRev })
    },
    clearProfileView() {
      write((current) => (current.view.kind === 'profile' ? noneView(now()) : null), { explicit: false })
    },
    clearForUid(uid) {
      write((current) => (current.view.uid === uid ? noneView(now()) : null), { explicit: false })
      const list = parseDismissals(getItem(SAVE_OFFER_KEY))
      const next = removeDismissal(list, uid)
      if (next.length !== list.length) setItem(SAVE_OFFER_KEY, JSON.stringify(next))
      notify()
    },
    getDismissals: () => parseDismissals(getItem(SAVE_OFFER_KEY)),
    dismissOffer(uid, regionId) {
      setItem(SAVE_OFFER_KEY, JSON.stringify(addDismissal(parseDismissals(getItem(SAVE_OFFER_KEY)), uid, regionId, now())))
      notify()
    },
    undismissOffer(uid, regionId) {
      const list = parseDismissals(getItem(SAVE_OFFER_KEY))
      const next = removeDismissal(list, uid, regionId)
      if (next.length !== list.length) {
        setItem(SAVE_OFFER_KEY, JSON.stringify(next))
        notify()
      }
    },
    handleStorageEvent(key, newValue) {
      if (key === null || key === REGION_CHOICE_KEY || key === SAVE_OFFER_KEY) {
        // 다른 탭이 고쳤다 — 다시 읽고, 진행 중이던 자동 판단을 무효로(choiceRev)
        if (key !== SAVE_OFFER_KEY) choiceRev += 1
        cacheRaw = undefined
        readFresh()
        notify()
        return
      }
      if (key !== LEGACY_REGION_KEY) return
      // 1.5 코드가 열린 옛 탭: 지역을 지운 것(null)은 무시하고, 우리 거울 값이 돌아온 것도 무시한다
      if (!newValue) return
      const current = readFresh()
      if (newValue === current.legacyMirror) return
      write(() => ({ kind: 'user', regionId: newValue, uid: null, at: now() }), { explicit: true })
    },
  }
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** 앱 전체가 함께 쓰는 하나의 저장소 */
export const regionChoiceStore: RegionChoiceStore = createRegionChoiceStore({ storage: browserStorage() })
