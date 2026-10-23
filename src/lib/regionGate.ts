// 다른 지역 게시글 보기 제한(D-045, 오너 결정 2026-10-23): 내 지역에 글을 5개 이상 쓴 사람만 다른 지역 글을 본다.
// - 내 지역: 로그인하면 프로필 지역(없으면 기기에서 고른 지역), 로그인 전에는 기기에서 고른 지역.
// - 글 수: 내 지역(시·군 범위)에 쓴 공개 글. 지운 글·숨긴 글은 세지 않는다.
// - 앱 화면에서만 거른다(오너 선택). 게시글은 지금처럼 공개 읽기라 API를 직접 부르면 볼 수 있다.
// - 링크로 받은 글 하나(상세)는 연다 — 공유가 막히지 않게. 목록·이웃의 글·비슷한 글에서만 거른다.
export const OTHER_REGION_UNLOCK_POSTS = 5

export function inScope(scope: readonly string[] | null, regionId: string | null | undefined): boolean {
  return Boolean(scope && regionId && scope.includes(regionId))
}

export function isUnlocked(loggedIn: boolean, ownPostCount: number | undefined): boolean {
  return loggedIn && (ownPostCount ?? 0) >= OTHER_REGION_UNLOCK_POSTS
}

export interface BoardViewInput {
  loggedIn: boolean
  unlocked: boolean
  /** 기기에서 고른 지역 */
  selectedRegionId: string | null
  /** 내 지역(로그인: 프로필 지역 ?? 고른 지역) */
  ownRegionId: string | null
  /** 내 지역의 시·군 범위 */
  ownScope: readonly string[] | null
  /** ?region= 으로 고른 둘러볼 지역(검사 전) */
  browseRegionId: string | null
}

export interface BoardView {
  /** 이번에 보여 줄 지역 */
  regionId: string | null
  /** 고른 지역이 내 지역 밖인데 아직 못 봐서 내 지역으로 바꿨는가 */
  redirectedFrom: string | null
  /** 내 지역이 아닌 곳을 보고 있는가 */
  outside: boolean
}

/** 게시판에서 어느 지역 글을 보여 줄지 정한다(화면 규칙의 한 곳). */
export function boardView(i: BoardViewInput): BoardView {
  if (!i.loggedIn) return { regionId: i.selectedRegionId, redirectedFrom: null, outside: false }
  if (i.unlocked && i.browseRegionId) {
    return { regionId: i.browseRegionId, redirectedFrom: null, outside: !inScope(i.ownScope, i.browseRegionId) }
  }
  const selectedOutside = Boolean(i.selectedRegionId) && Boolean(i.ownScope) && !inScope(i.ownScope, i.selectedRegionId)
  if (selectedOutside && i.unlocked) return { regionId: i.selectedRegionId, redirectedFrom: null, outside: true }
  if (selectedOutside) return { regionId: i.ownRegionId, redirectedFrom: i.selectedRegionId, outside: false }
  return { regionId: i.ownRegionId ?? i.selectedRegionId, redirectedFrom: null, outside: false }
}
