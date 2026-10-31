/** className 합치기(falsy 무시). 외부 의존성 없이 쓰는 최소 헬퍼. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
