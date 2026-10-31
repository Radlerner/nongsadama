import type { ReactNode } from 'react'
import {
  Calendar,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Coffee,
  ExternalLink,
  ImagePlus,
  LifeBuoy,
  MessageCircleQuestion,
  School,
  Snowflake,
  Sprout,
  Sun,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'

/**
 * 선 아이콘 — 앱의 단 하나의 아이콘 API(디자인 v5).
 * 키트 아이콘(brand-v5/kit.md 5장)은 아래 경로를 그대로 그리고, 키트에 없는 이름(날씨·농사 도움 등 main 기능)만
 * lucide-react 글리프로 그린다. 모두 24 viewBox · 둥근 끝 · stroke=currentColor · 기본 굵기 1.75.
 * 색은 부모의 text-* 클래스로 정한다. filled는 활성 탭(홈·게시판·이웃·내 정보)용.
 * 퍼즐 모양은 없다(로고 이미지에만 있다).
 */
const KIT_ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  board: <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />,
  message: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
      <path d="M8.5 10.5h7" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>
  ),
  neighbors: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0z" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" fill="none" />
      <path d="M18 14a6.5 6.5 0 0 1 3.5 6" fill="none" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'arrow-up': (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" fill="none" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.5 1.1 5 3c1.5-1.9 3-3 5-3c3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20z" />
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13" />
      <path d="M12 16.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.5h.01" />
    </>
  ),
  /** 원 안의 체크(완료·확인됨) */
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.7 2.7L16 10" />
    </>
  ),
  /** 테두리 없는 체크(선택 표시) */
  'check-plain': <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'wifi-off': (
    <>
      <path d="m2 2 20 20" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M5 12.9a10 10 0 0 1 5.2-2.8" />
      <path d="M19 12.9a10 10 0 0 0-2.1-1.5" />
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
      <path d="M22 8.8A15 15 0 0 0 10.7 5" />
      <path d="M12 20h.01" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
      <path d="M9 4v13" />
      <path d="M15 6.5v13" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4.5 6h.01" />
      <path d="M4.5 12h.01" />
      <path d="M4.5 18h.01" />
    </>
  ),
  rows: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  expand: (
    <>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </>
  ),
  collapse: (
    <>
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="m14 10 7-7" />
      <path d="m3 21 7-7" />
    </>
  ),
  navigate: <path d="M3 11 21 3l-8 18-2-8z" />,
  photo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7.5 6.5H5A2 2 0 0 0 3 8.5v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  translate: (
    <>
      <path d="M4 5h9" />
      <path d="M8.5 3v2" />
      <path d="M11 5c-1 4-3.5 7-7 9" />
      <path d="M6.5 8.5c1.2 2 3 3.5 5 4.5" />
      <path d="m13 21 4-9 4 9" />
      <path d="M14.5 18h5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5.5" />
      <path d="M14 11v5.5" />
    </>
  ),
  /** 신고 */
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4.5L17 13H5" />
    </>
  ),
  /** 차단 */
  block: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  logout: (
    <>
      <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" />
      <path d="m16 16 4-4-4-4" />
      <path d="M20 12H10" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 21.5s8-3.8 8-10V5.2L12 2.5 4 5.2v6.3c0 6.2 8 10 8 10z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.2" fill="none" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6" />
      <path d="M14 9v6" />
    </>
  ),
  document: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  'mic-off': (
    <>
      <path d="m2 2 20 20" />
      <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <path d="M12 19v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
} satisfies Record<string, ReactNode>

/** 키트에 없는 이름: lucide-react로 그린다(같은 24 격자·둥근 끝이라 키트와 섞여도 어울린다). */
const LUCIDE_ICONS = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  cloudy: Cloudy,
  'cloud-rain': CloudRain,
  'cloud-sun-rain': CloudSunRain,
  'cloud-lightning': CloudLightning,
  snowflake: Snowflake,
  'cloud-fog': CloudFog,
  thermometer: Thermometer,
  /** 농사 도움(/farm) */
  sprout: Sprout,
  /** 지역 프로그램(교육) */
  school: School,
  calendar: Calendar,
  /** 말하기 — 그냥 이야기하기 */
  coffee: Coffee,
  /** 도움 요청 */
  help: LifeBuoy,
  question: MessageCircleQuestion,
  'photo-add': ImagePlus,
  external: ExternalLink,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof KIT_ICONS | keyof typeof LUCIDE_ICONS

export const ICON_NAMES = [...Object.keys(KIT_ICONS), ...Object.keys(LUCIDE_ICONS)] as IconName[]

export interface IconProps {
  name: IconName
  /** CSS px. 기본 24 */
  size?: number
  /** 기본 1.75(키트 .ico). 뒤로·더하기·말하기는 2 */
  strokeWidth?: number
  /** 활성 탭: 면을 currentColor로 채운다(키트 아이콘 전용 — lucide 글리프는 선으로만 그린다) */
  filled?: boolean
  className?: string
  /** 주면 role="img" + aria-label로 읽힌다. 없으면 aria-hidden(기본) */
  title?: string
}

export function Icon({ name, size = 24, strokeWidth = 1.75, filled = false, className, title }: IconProps) {
  const a11y = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': true as const, focusable: false as const }
  const cls = ['block shrink-0', className].filter(Boolean).join(' ')
  if (name in LUCIDE_ICONS) {
    const Glyph = LUCIDE_ICONS[name as keyof typeof LUCIDE_ICONS]
    return <Glyph size={size} strokeWidth={strokeWidth} className={cls} {...a11y} />
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      {...a11y}
    >
      {KIT_ICONS[name as keyof typeof KIT_ICONS]}
    </svg>
  )
}
