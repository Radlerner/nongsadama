import { cn } from './cn'
import logo66 from '../../assets/brand/logo-66.png'
import logo100 from '../../assets/brand/logo-100.png'
import logo240 from '../../assets/brand/logo-240.png'
import logo360 from '../../assets/brand/logo-360.png'

/*
 * 원본 로고 이미지(퍼즐 안 NONGSA / D / M). 다시 그리거나 색을 바꾸지 않는다.
 * 퍼즐 모양은 이 이미지에만 있다 — 다른 곳(아이콘·빈 화면·버튼)에 퍼즐 금지.
 */

export interface LogoMarkProps {
  /** header = 33.2×30(헤더) · large = 120×108(랜딩) */
  size?: 'header' | 'large'
  className?: string
}

/** 장식 이미지(alt=""). 링크·제목이 이름을 읽어 준다. */
export function LogoMark({ size = 'header', className }: LogoMarkProps) {
  if (size === 'large') {
    return (
      <img
        src={logo240}
        srcSet={`${logo240} 2x, ${logo360} 3x`}
        alt=""
        width={120}
        height={108}
        draggable={false}
        className={cn('block h-auto w-[120px] shrink-0', className)}
      />
    )
  }
  return (
    <img
      src={logo66}
      srcSet={`${logo66} 2x, ${logo100} 3x`}
      alt=""
      width={33}
      height={30}
      draggable={false}
      className={cn('block h-[30px] w-[33.2px] shrink-0', className)}
    />
  )
}

/** 글자 워드마크 농사·다·마(로고 3색, 800 20/24). 브랜드 표기라 언어와 무관하게 한글. aria-hidden */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('whitespace-nowrap text-[20px] font-extrabold leading-6 tracking-[-0.4px]', className)}
    >
      <span className="text-nong-500">농사</span>
      <span className="text-da-500">다</span>
      <span className="text-ma-500">마</span>
    </span>
  )
}
