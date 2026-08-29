/**
 * 아이콘 단일 기준(디자인 v1.6, DESIGN.md §7) — 이모지 전면 대체.
 * lucide 라인 아이콘: stroke 2 · round cap · currentColor. 이모지는 기기마다 렌더가 달라
 * 급조된 인상을 주므로 UI 크롬에서 금지, 여기 등록된 아이콘만 사용한다.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Map,
  MessagesSquare,
  Mic,
  Users,
  UserRound,
  Cross,
  ShoppingCart,
  Landmark,
  Bus,
  LifeBuoy,
  Info,
  Sprout,
  LayoutGrid,
  MapPin,
  List,
  Sun,
  CloudSun,
  Cloud,
  Cloudy,
  CloudRain,
  CloudSunRain,
  CloudLightning,
  Snowflake,
  CloudFog,
  Thermometer,
  Volume2,
  Flag,
  Ban,
  Phone,
  MessageCircleQuestion,
  Coffee,
  School,
  Share2,
  Puzzle,
} from 'lucide-react'

/** 하단 5탭(nav) — BottomNav 전용 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  '/home': Map,
  '/board': MessagesSquare,
  '/talk': Mic,
  '/neighbors': Users,
  '/profile': UserRound,
}

/** 생활정보 카테고리(색 틴트와 짝 — categories.ts LIFE_INFO_CATEGORY_TINTS) */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hospital: Cross,
  market: ShoppingCart,
  government: Landmark,
  transport: Bus,
  support: LifeBuoy,
  other: Info,
}

/** OpenWeather 아이콘 코드 앞 2자리 → 날씨 아이콘 */
export const WEATHER_ICONS: Record<string, LucideIcon> = {
  '01': Sun,
  '02': CloudSun,
  '03': Cloud,
  '04': Cloudy,
  '09': CloudRain,
  '10': CloudSunRain,
  '11': CloudLightning,
  '13': Snowflake,
  '50': CloudFog,
}

export {
  Map,
  Info,
  Sprout,
  LayoutGrid,
  MapPin,
  List,
  Mic,
  Volume2,
  Flag,
  Ban,
  Phone,
  Users,
  MessageCircleQuestion,
  Coffee,
  LifeBuoy,
  School,
  Share2,
  Thermometer,
  Puzzle,
  MessagesSquare,
}
export type { LucideIcon }
