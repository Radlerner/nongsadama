// 게시글 카테고리(고정 도메인, PRD 8.1). 언어·국가 코드가 아니므로 코드에서 참조해도 된다.
// 'recommend'(우리 동네 추천, D-043)는 DB posts_category_check 에도 있어야 저장된다
// (supabase/migrations/20261023004038_posts_category_recommend.sql).
export const POST_CATEGORIES = ['question', 'info', 'recommend', 'daily', 'other', 'help'] as const

export type PostCategory = (typeof POST_CATEGORIES)[number]

export function postCategoryLabelKey(category: string): string {
  return `board.category.${category}`
}

/** 게시판 종류 버튼 순서 — 전국 어디서나 쓰는 "우리 동네 추천"을 맨 앞에 둔다(D-043). */
export const BOARD_FILTERS: readonly PostCategory[] = ['recommend', 'question', 'info', 'daily', 'help', 'other']

/** 주소의 ?category= 값 검사. 모르는 값이면 전체(null)로 본다. */
export function parseBoardCategory(value: string | null | undefined): PostCategory | null {
  return value && (POST_CATEGORIES as readonly string[]).includes(value) ? (value as PostCategory) : null
}

// 대시처럼 보이는 글자(유니코드 대시·마이너스·전각 하이픈·한글 'ㅡ'·장음 'ー'·물결)는 '-'로 바꾼 뒤 NFKC로 전각 숫자를 반각으로 만든다.
// 'ㅡ'는 NFKC가 다른 자모로 바꾸므로 반드시 먼저 바꾼다.
const DASH_LIKE = /[‐-―−－ㅡー~]/g
// 휴대전화 번호(010·011·016~019, +82 10). 앞에 숫자나 '+'가 붙은 긴 숫자와 섞지 않으려고 바로 앞 글자까지 함께 맞춘다.
// 뒤보기(lookbehind)는 iOS 16.4 전 Safari에서 앱 전체가 뜨지 않게 하므로 쓰지 않는다(tests/board.test.mjs가 검사).
// 구분자는 줄바꿈을 빼고 여러 개 허용(예: "010 - 1234 - 5678").
const MOBILE_SOURCE = String.raw`(?:^|[^\d+])((?:\+[ \t]?82[ \t.\-]*(?:\(0\))?[ \t]*0?|0)1[016789][ \t.)\-]*\d{3,4}[ \t.\-]*\d{4})(?!\d)`

/** 글 속 휴대전화 번호를 숫자만 남겨 정렬한 목록(+82 는 0으로). 같은 번호는 한 번만. */
export function mobileNumbers(text: string): string[] {
  const normalized = text.replace(DASH_LIKE, '-').normalize('NFKC')
  const found = new Set<string>()
  for (const m of normalized.matchAll(new RegExp(MOBILE_SOURCE, 'g'))) {
    found.add(m[1].replace(/\D/g, '').replace(/^82/, '0').replace(/^00/, '0'))
  }
  return [...found].sort()
}

/** 공개 글에 휴대전화 번호가 들어 있는지(가게 번호인지 개인 번호인지는 쓰는 사람이 확인한다). */
export function containsMobileNumber(text: string): boolean {
  return mobileNumbers(text).length > 0
}
