// Framer Motion 프리셋 — 디자인 v0 모션 토큰(Motion Lab 리포트 기반, public/motion-lab.html 참고).
// 기능/라우팅/hooks에는 영향 없음: 시각적 트랜지션에만 사용.
import type { Transition, Variants } from 'framer-motion'

/** Easing curve — Motion Lab 표준 커브. */
export const easings = {
  standard: [0.25, 1, 0.5, 1] as const,
}

/** Duration presets(초). */
export const durations = {
  fast: 0.15,
  md: 0.3,
  slow: 0.54,
}

/** Spring preset — 탭/눌림 피드백용. */
export const springs = {
  soft: { type: 'spring', stiffness: 320, damping: 30, mass: 1 } as Transition,
}

export const transitions = {
  base: { duration: durations.md, ease: easings.standard } as Transition,
  fast: { duration: durations.fast, ease: easings.standard } as Transition,
  slow: { duration: durations.slow, ease: easings.standard } as Transition,
  spring: springs.soft,
}

/** 페이지 전환(라우트 변경 시 콘텐츠 영역) — 부드러운 슬라이드업 + 페이드. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
}

/** 리스트 아이템 stagger-in(카드 목록 등장). */
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: transitions.base },
}

/** 카드 탭 피드백. */
export const cardTap = { scale: 0.98 }
