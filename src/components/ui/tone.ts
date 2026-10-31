/**
 * 로고 3색 정체성(tone). 농사=홈(green) · 다=게시판(purple) · 마=이웃(ochre).
 * Tailwind는 클래스 문자열을 정적으로 찾으므로 조합하지 말고 아래 표에서 꺼내 쓴다.
 */
export type Tone = 'nong' | 'da' | 'ma'

/** 링크·활성 글자(600) */
export const TONE_TEXT: Record<Tone, string> = {
  nong: 'text-nong-600',
  da: 'text-da-600',
  ma: 'text-ma-600',
}

/** 아바타·연한 배경(100) + 글자(600) */
export const TONE_SOFT: Record<Tone, string> = {
  nong: 'bg-nong-100 text-nong-600',
  da: 'bg-da-100 text-da-600',
  ma: 'bg-ma-100 text-ma-600',
}

/** 선택 테두리(600) */
export const TONE_BORDER: Record<Tone, string> = {
  nong: 'border-nong-600',
  da: 'border-da-600',
  ma: 'border-ma-600',
}

/** 문자열(id·닉네임)로 늘 같은 tone을 고른다(아바타 색 분산용). */
export function toneFromSeed(seed: string): Tone {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const tones: Tone[] = ['nong', 'da', 'ma']
  return tones[Math.abs(h) % 3]
}
