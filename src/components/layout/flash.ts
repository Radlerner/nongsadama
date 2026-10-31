/*
 * 뒤로 가기(navigate(-1))로 돌아가는 화면에 확인 토스트를 넘기는 한 번짜리 통로.
 * history state는 뒤로 가기에 실을 수 없어서 모듈 변수에 잠깐 둔다. AppLayout이 다음 이동 때 꺼내 보여 준다.
 * 수정 폼이 원래 화면으로 돌아갈 때 쓴다(replace로 같은 화면이 history에 두 번 쌓이지 않게).
 */
let pending: string | null = null

export function flashToast(key: string) {
  pending = key
}

export function takeFlash(): string | null {
  const key = pending
  pending = null
  return key
}

/** 수정 화면으로 가는 링크에 붙이는 state: 저장 후 navigate(-1)로 원래 화면에 돌아가도 된다는 표시 */
export const FROM_DETAIL_STATE = { fromDetail: true } as const

export function cameFromDetail(state: unknown): boolean {
  return (state as { fromDetail?: unknown } | null)?.fromDetail === true
}
