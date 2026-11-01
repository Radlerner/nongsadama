import { regionStatus, sameCounty, type Region } from './regionScope.ts'

/**
 * 지금 보는 지역(view)의 기록과 판단 규칙(순수 함수, v1.6 D-047).
 *
 * - 기기 기록 하나(`nongsadama.regionChoice`)에 "보는 지역"과 그 출처를 함께 둔다.
 *   'user' = 사용자가 직접 고름, 'profile' = 프로필 지역을 따라감, 'all' = 직접 고른 전국 보기, 'none' = 없음(묘비).
 * - 내 지역은 기기에 따로 두지 않는다: 유효한 프로필 지역이 내 지역이다(D3). 게시판·글쓰기 대상은 D-045 그대로
 *   (프로필 지역 → 없으면 보는 'user' 지역).
 * - 구버전 키(`nongsadama.regionId`)는 1.5 이하 코드와 열린 옛 탭을 위해 같은 순간에 함께 맞춘다.
 */

export const REGION_CHOICE_KEY = 'nongsadama.regionChoice'
export const LEGACY_REGION_KEY = 'nongsadama.regionId'
export const SAVE_OFFER_KEY = 'nongsadama.regionSaveOffer'
export const SAVE_OFFER_MAX = 20

export type ViewKind = 'user' | 'profile' | 'all' | 'none'

export interface ViewRecord {
  kind: ViewKind
  /** 'all'·'none'이면 null */
  regionId: string | null
  /** 고를 때 로그인돼 있던 계정(비로그인 null). 'profile'은 그 계정이 아니면 쓰지 않는다. */
  uid: string | null
  at: number
}

export interface RegionChoice {
  v: 1
  view: ViewRecord
  /** 이 코드가 구버전 키에 마지막으로 쓴 값 — 다른 탭에서 돌아온 자기 메아리를 구별한다. */
  legacyMirror: string | null
  /** 구버전 키에서 옮겨 온 기록인가 */
  migrated: boolean
  rev: number
  writer: string
}

export type ParsedChoice =
  | { state: 'absent' }
  | { state: 'ok'; choice: RegionChoice }
  /** JSON이 깨졌거나 모양이 다름 — 없음으로 보고, 다음 쓰기에서 고쳐 쓴다 */
  | { state: 'corrupt' }
  /** 더 새 버전(v≠1)이 쓴 기록 — 없음으로 보되 자동 쓰기로 덮지 않는다 */
  | { state: 'future' }

const KINDS: readonly string[] = ['user', 'profile', 'all', 'none']

function isText(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0
}

export function noneView(at: number): ViewRecord {
  return { kind: 'none', regionId: null, uid: null, at }
}

export function emptyChoice(writer: string, at: number): RegionChoice {
  return { v: 1, view: noneView(at), legacyMirror: null, migrated: false, rev: 0, writer }
}

export function parseChoice(raw: string | null): ParsedChoice {
  if (raw === null) return { state: 'absent' }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { state: 'corrupt' }
  }
  if (!data || typeof data !== 'object') return { state: 'corrupt' }
  const d = data as Record<string, unknown>
  if (d.v !== 1) return typeof d.v === 'number' && d.v > 1 ? { state: 'future' } : { state: 'corrupt' }
  const view = d.view as Record<string, unknown> | undefined
  if (!view || typeof view !== 'object' || !KINDS.includes(view.kind as string)) return { state: 'corrupt' }
  const kind = view.kind as ViewKind
  const regionId = isText(view.regionId) ? view.regionId : null
  // 지역이 필요한 기록에 지역이 없으면 깨진 것으로 본다
  if ((kind === 'user' || kind === 'profile') && !regionId) return { state: 'corrupt' }
  if (kind === 'profile' && !isText(view.uid)) return { state: 'corrupt' }
  return {
    state: 'ok',
    choice: {
      v: 1,
      view: {
        kind,
        regionId: kind === 'all' || kind === 'none' ? null : regionId,
        uid: isText(view.uid) ? view.uid : null,
        at: typeof view.at === 'number' ? view.at : 0,
      },
      legacyMirror: isText(d.legacyMirror) ? d.legacyMirror : null,
      migrated: d.migrated === true,
      rev: typeof d.rev === 'number' && Number.isFinite(d.rev) ? d.rev : 0,
      writer: isText(d.writer) ? d.writer : '',
    },
  }
}

export function serializeChoice(choice: RegionChoice): string {
  return JSON.stringify(choice)
}

/** 구버전 키 값 → 첫 기록. M1(D1): 프로필 지역과 같든 다르든 직접 고른 값으로 옮긴다(자동 전환 없음). */
export function migrateLegacy(legacy: string | null, writer: string, at: number): RegionChoice {
  const choice = emptyChoice(writer, at)
  if (!isText(legacy)) return choice
  return {
    ...choice,
    view: { kind: 'user', regionId: legacy, uid: null, at },
    legacyMirror: legacy,
    migrated: true,
  }
}

/** 구버전 키에 둘 값: 'user'·'profile'은 그 지역, 'all'·'none'은 지운다(null). */
export function legacyValueFor(view: ViewRecord): string | null {
  return view.kind === 'user' || view.kind === 'profile' ? view.regionId : null
}

export type AuthStatus = 'unknown' | 'signedIn' | 'signedOut'

/** 내 프로필 행의 지역(로그인했을 때만 의미가 있다). 불러오는 중·실패를 "지역 없음"으로 읽지 않는다. */
export type ProfileRegionState =
  | { state: 'pending' }
  | { state: 'error' }
  | { state: 'success'; exists: boolean; regionId: string | null }

/** 기록이 지금 세션에 적용되는가(지역의 유효성은 따로 본다). */
export function recordApplies(view: ViewRecord, auth: AuthStatus, uid: string | null): boolean {
  switch (view.kind) {
    case 'none':
      return false
    case 'profile':
      // 로그인 확인 중엔 일단 보여 준다(명시적 로그아웃이면 이미 지워졌다). 로그아웃 상태·다른 계정이면 쓰지 않는다.
      return auth === 'unknown' || (auth === 'signedIn' && view.uid === uid)
    default:
      // 직접 고른 둘러보기 설정: 로그아웃 상태에선 누구의 것이든 유지, 로그인하면 비회원 때 것이거나 내 것만
      return auth !== 'signedIn' || view.uid === null || view.uid === uid
  }
}

export type ViewState =
  | { status: 'deciding' }
  | { status: 'region'; regionId: string; kind: 'user' | 'profile' }
  | { status: 'all' }
  | { status: 'none'; reason: 'empty' | 'invalid' | 'profileFailed' | 'timeout' }
  /** 지역 목록을 못 불러와 판단할 수 없음(다시 시도) */
  | { status: 'error' }

export interface DecideInput {
  view: ViewRecord
  auth: AuthStatus
  uid: string | null
  /** undefined = 아직 못 읽음 */
  regions: Region[] | undefined
  /** 목록 조회 실패 또는 0행 */
  regionsFailed: boolean
  profile: ProfileRegionState
  /** 이번 판단(계정·로그인 상태별)의 5초 기한이 지났는가 */
  deadlinePassed: boolean
  offline: boolean
}

function regionsPending(i: Pick<DecideInput, 'regions' | 'regionsFailed'>): boolean {
  return !i.regionsFailed && (!i.regions || i.regions.length === 0)
}

/**
 * 지금 보는 지역. 우선순위: 적용되는 기록(직접 고른 지역·전국·이 계정의 프로필 동기화) → 프로필 지역(로그인) → 없음.
 * 어떤 실패 경로도 'all'을 만들지 않는다 — 'all'은 기록이 'all'일 때만(D2).
 */
export function decideView(i: DecideInput): ViewState {
  const v = i.view
  if (recordApplies(v, i.auth, i.uid)) {
    if (v.kind === 'all') return { status: 'all' }
    const st = regionStatus(i.regions, v.regionId)
    if (st === 'valid') return { status: 'region', regionId: v.regionId as string, kind: v.kind === 'profile' ? 'profile' : 'user' }
    if (st === 'unknown') return regionsPending(i) ? { status: 'deciding' } : { status: 'error' }
    return { status: 'none', reason: 'invalid' }
  }
  if (i.auth === 'unknown') return i.deadlinePassed ? { status: 'none', reason: 'empty' } : { status: 'deciding' }
  if (i.auth === 'signedOut') return { status: 'none', reason: 'empty' }
  // 로그인했고 적용되는 기록이 없다 → 프로필 지역을 기다린다(5초)
  if (i.profile.state === 'error') return { status: 'none', reason: 'profileFailed' }
  if (i.profile.state === 'pending') {
    if (i.offline) return { status: 'none', reason: 'profileFailed' }
    return i.deadlinePassed ? { status: 'none', reason: 'timeout' } : { status: 'deciding' }
  }
  if (!i.profile.regionId) return { status: 'none', reason: 'empty' }
  const st = regionStatus(i.regions, i.profile.regionId)
  if (st === 'invalid') return { status: 'none', reason: 'invalid' }
  if (i.deadlinePassed) return { status: 'none', reason: 'timeout' }
  if (st === 'unknown') return regionsPending(i) ? { status: 'deciding' } : { status: 'error' }
  return { status: 'region', regionId: i.profile.regionId, kind: 'profile' }
}

/** 판단에 따라 기기 기록에 써야 할 자동 변경(사용자 선택은 여기서 만들지 않는다). */
export type ChoiceWrite =
  | { type: 'claim'; uid: string }
  | { type: 'followProfile'; regionId: string; uid: string }
  | { type: 'demoteProfile' }
  | { type: 'tombstone' }

export function pendingWrite(i: DecideInput): ChoiceWrite | null {
  // 로그인 확인 중에는 읽기만 한다
  if (i.auth === 'unknown') return null
  const v = i.view
  if (i.auth === 'signedOut') return v.kind === 'profile' ? { type: 'tombstone' } : null
  const uid = i.uid as string
  const applies = recordApplies(v, i.auth, uid)
  // 지역 목록으로 무효가 확인된 기록은 묘비로(목록을 못 읽었으면 지우지 않는다)
  if (applies && (v.kind === 'user' || v.kind === 'profile') && regionStatus(i.regions, v.regionId) === 'invalid') {
    return { type: 'tombstone' }
  }
  // 비회원 때 고른 지역·전국 보기는 로그인한 계정으로 귀속(다음 계정에 넘어가지 않게)
  if ((v.kind === 'user' || v.kind === 'all') && v.uid === null) return { type: 'claim', uid }
  if (i.profile.state !== 'success') return null
  const p = i.profile.regionId
  const pStatus = regionStatus(i.regions, p)
  if (!applies) {
    // 첫 동기화: 기한 안에 도착한 유효한 프로필 지역만
    if (p && pStatus === 'valid' && !i.deadlinePassed) return { type: 'followProfile', regionId: p, uid }
    return null
  }
  if (v.kind === 'profile') {
    // 프로필을 따르는 중: 다른 기기에서 바뀌었으면 따라가고, 비었거나 무효가 되면 직접 고른 값으로 남긴다
    if (p && pStatus === 'valid' && p !== v.regionId) return { type: 'followProfile', regionId: p, uid }
    if (!p || pStatus === 'invalid') return { type: 'demoteProfile' }
  }
  return null
}

export type OwnRegion =
  | { state: 'pending' }
  | { state: 'error' }
  | {
      state: 'ready'
      /** 게시판 범위·글쓰기 대상(D-045): 프로필 지역 → 없으면 보는 'user' 지역 */
      regionId: string | null
      source: 'profile' | 'view' | null
      /** 유효한 프로필 지역 — "내 지역" 표시·이웃·거리(D4)에만 쓴다 */
      profileRegionId: string | null
    }

export function ownRegion(i: {
  auth: AuthStatus
  profile: ProfileRegionState
  regions: Region[] | undefined
  view: ViewState
}): OwnRegion {
  if (i.auth === 'unknown' || i.view.status === 'deciding') return { state: 'pending' }
  const viewPick = i.view.status === 'region' && i.view.kind === 'user' ? i.view.regionId : null
  if (i.auth === 'signedOut') {
    return { state: 'ready', regionId: viewPick, source: viewPick ? 'view' : null, profileRegionId: null }
  }
  if (i.profile.state === 'pending') return { state: 'pending' }
  if (i.profile.state === 'error') return { state: 'error' }
  const p = i.profile.regionId
  if (p) {
    const st = regionStatus(i.regions, p)
    if (st === 'unknown') return { state: 'pending' }
    if (st === 'valid') return { state: 'ready', regionId: p, source: 'profile', profileRegionId: p }
  }
  return { state: 'ready', regionId: viewPick, source: viewPick ? 'view' : null, profileRegionId: null }
}

/** D1: 보는 지역이 내 지역(유효한 프로필 지역)과 다른 시·군이거나 전국이면 "내 지역으로" 대상. */
export function toOwnTarget(regions: Region[] | undefined, view: ViewState, profileRegionId: string | null): string | null {
  if (!profileRegionId || !regions) return null
  if (view.status === 'all') return profileRegionId
  if (view.status === 'region' && !sameCounty(regions, view.regionId, profileRegionId)) return profileRegionId
  return null
}

export interface OfferDismissal {
  uid: string
  regionId: string
  at: number
}

export function parseDismissals(raw: string | null): OfferDismissal[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter((d): d is OfferDismissal => Boolean(d) && isText(d.uid) && isText(d.regionId))
      .map((d) => ({ uid: d.uid, regionId: d.regionId, at: typeof d.at === 'number' ? d.at : 0 }))
      .slice(-SAVE_OFFER_MAX)
  } catch {
    return []
  }
}

export function addDismissal(list: OfferDismissal[], uid: string, regionId: string, at: number): OfferDismissal[] {
  const rest = list.filter((d) => !(d.uid === uid && d.regionId === regionId))
  return [...rest, { uid, regionId, at }].slice(-SAVE_OFFER_MAX)
}

export function removeDismissal(list: OfferDismissal[], uid: string, regionId?: string): OfferDismissal[] {
  return list.filter((d) => !(d.uid === uid && (regionId === undefined || d.regionId === regionId)))
}

/**
 * "내 지역으로 저장" 제안 대상(D3·D5). 로그인했고, 프로필 행이 있고, 프로필 지역이 비었거나 무효이고,
 * 지금 직접 고른 유효한 지역을 보고 있으며, 그 지역을 "나중에"로 넘기지 않았을 때만.
 */
export function saveOfferTarget(i: {
  auth: AuthStatus
  uid: string | null
  profile: ProfileRegionState
  regions: Region[] | undefined
  view: ViewState
  dismissed: OfferDismissal[]
}): { regionId: string; previousRegionId: string | null } | null {
  if (i.auth !== 'signedIn' || !i.uid) return null
  if (i.profile.state !== 'success' || !i.profile.exists) return null
  const p = i.profile.regionId
  if (p) {
    const st = regionStatus(i.regions, p)
    if (st !== 'invalid') return null
  }
  if (i.view.status !== 'region' || i.view.kind !== 'user') return null
  if (regionStatus(i.regions, i.view.regionId) !== 'valid') return null
  const regionId = i.view.regionId
  if (i.dismissed.some((d) => d.uid === i.uid && d.regionId === regionId)) return null
  return { regionId, previousRegionId: p }
}

/** /select 등에서 돌아갈 곳. 앱 안의 경로만 받고 나머지는 /home(외부 주소·공개 페이지·고리 방지). */
const RETURN_BLOCKED = ['/', '/select', '/login', '/privacy', '/delete-account', '/child-safety', '/index.html']

export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/home'
  const path = value.split(/[?#]/)[0]
  return RETURN_BLOCKED.includes(path) ? '/home' : value
}
