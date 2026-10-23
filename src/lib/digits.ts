// 여러 문자 체계의 숫자를 0~9로(D-046 — 계정 삭제 숫자 4개 확인). 사용자 언어 키보드가 자기 숫자를 넣어도 맞게.
// 각 문자 체계의 숫자 0 위치: 아랍·페르시아·데바나가리(네팔)·벵골·태국·라오·미얀마·크메르·몽골. 전각 숫자는 NFKC가 바꾼다.
const DIGIT_ZEROS = [0x660, 0x6f0, 0x966, 0x9e6, 0xe50, 0xed0, 0x1040, 0x17e0, 0x1810]

/** 입력에서 숫자만 남겨 0~9로 바꾼다. 다른 글자·공백·구분자는 버린다. */
export function toAsciiDigits(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\p{Nd}/gu, (d) => {
      const cp = d.codePointAt(0) ?? 0
      if (cp >= 0x30 && cp <= 0x39) return d
      const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9)
      return zero === undefined ? '' : String(cp - zero)
    })
    .replace(/\D/g, '')
}
