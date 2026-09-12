import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { listItem, cardTap, transitions } from '../../lib/motion'

/**
 * 카드 시스템(디자인 v0 토큰: rounded-card 16px · border-gray-100 · bg-white · shadow-card).
 * - CardLink: 탭 가능한 카드(목록 항목) — active:bg-gray-50 포함 + 탭 시 살짝 눌리는 모션(motion.ts)
 * - Card: 정적 컨테이너 — 현재는 동일 스타일(플랫 변형 분리는 v1, 재검수 P2-3 추적)
 * 클래스는 기존 화면들에서 쓰던 문자열과 동일(시각 동일 리팩토링). 모션은 시각 레이어만 추가되며
 * 기능/라우팅/hooks에는 영향이 없다.
 */
const BASE = 'rounded-card border border-gray-100 bg-white shadow-card'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={listItem}
      className={`${BASE} ${className}`}
    >
      {children}
    </motion.div>
  )
}

export function CardLink({
  to,
  children,
  className = '',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div variants={listItem} whileTap={cardTap} transition={transitions.fast}>
      <Link to={to} className={`block ${BASE} active:bg-gray-50 ${className}`}>
        {children}
      </Link>
    </motion.div>
  )
}
