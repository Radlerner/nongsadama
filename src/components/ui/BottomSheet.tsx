import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cn } from './cn'
import { Icon } from './Icon'

/**
 * 공용 "아래에서 올라오는 창"(키트 4.11 모양 + v1.4 동작, D-040).
 * 말하기 고지·국적·언어 선택·삭제/동의 확인이 모두 이 구성 요소 위에 만든다.
 *
 * 모양(v5): 흰 판, 위쪽 둥근 16px, 손잡이(36×4 line-strong), 위로 향한 시트 그림자, 잉크 40% 어두운 바탕.
 * 제목 19/26 800, 설명 14/21. 좌우 20px, 바닥 28px + 홈 인디케이터.
 *
 * 동작(v1.4 그대로):
 * - open 이 거짓이면 아무것도 그리지 않는다. 단, 닫힌 직후 TAP_GUARD_MS 동안은 투명한 막을 남겨
 *   두 번 누름의 둘째 탭이 아래 화면(전화 링크·하단 탭 등)으로 새지 않게 한다.
 * - 열린 직후 TAP_GUARD_MS 안의 바깥 탭은 무시한다(여는 버튼을 두 번 눌러도 바로 닫히지 않게).
 * - 쌓임 순서 z-[1000]: 홈 지도의 "내 위치" 버튼(z-[500])·토스트(z-[900])·헤더/하단 탭(z-30)보다 위.
 * - document.body 로 포털한다(헤더 안에서 연 창이 하단 탭에 가려지지 않게).
 * - 열려 있는 동안 본문 스크롤을 막고, 닫히면 원래 값으로 되돌린다.
 * - 열리면 첫 버튼에 포커스(initialFocus="first", 기본) 또는 창 자체에(initialFocus="panel" — 첫 버튼이 삭제·동의처럼
 *   되돌릴 수 없는 행동이면 이쪽: Enter 실수를 막고 제목·설명이 먼저 읽힌다). Escape 로 닫힘, Tab 은 창 안에서만 돈다.
 * - 닫히면 열기 전에 포커스가 있던 요소로 되돌린다. 그 요소가 사라졌거나 비활성이면 returnFocusRef 로.
 *   다른 요소가 이미 포커스를 받았으면 뺏지 않는다.
 * - 열려 있는 동안 포커스를 가진 요소가 사라지면(예: "다시 시도" 버튼) 포커스를 창으로 되돌린다.
 * - footer 는 스크롤 영역 밖 바닥에 고정, fill 은 창 높이를 78vh로 고정 — 늦게 도착한 목록이 누르려던 자리로 들어오지 않게.
 */
export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** 시트 제목(19/26 800). aria-labelledby로 연결된다 */
  title: string
  /** 제목 요소 id. 생략하면 자동 생성한다. */
  titleId?: string
  /** 제목 아래 한 줄(14/21 ink-body). aria-describedby로 연결된다(v5) */
  description?: string
  /** 본문(children) 안 설명 요소의 id — 창이 열리면 읽어주기가 제목 다음에 읽는다(고지·안내 문구) */
  descriptionId?: string
  /** 주면 창 바닥에 닫기 버튼(tertiary, 48px)을 둔다. 값을 바꾸지 않고 닫을 길이 필요한 창(언어·국적)에 쓴다 */
  closeLabel?: string
  /**
   * 스크롤 영역 밖, 창 바닥에 고정하는 버튼들. 창은 아래에 붙어 위로 자라므로 본문(목록)이 늦게
   * 도착해도 이 버튼들의 화면 위치는 변하지 않는다(누르려던 자리에 다른 줄이 들어오지 않는다).
   */
  footer?: ReactNode
  /**
   * 창 높이를 78vh로 고정한다 — 본문이 짧아도 78vh다(fill 이 아닌 창은 본문만큼 자라고 85vh까지).
   * 본문이 늦게 도착하는 창에 쓴다 — 창이 위로 자라면서 어두운 배경이던
   * 자리(닫으려고 누르는 곳)에 줄이 들어오지 않게 한다.
   */
  fill?: boolean
  /** 열릴 때 포커스: first = 첫 버튼(기본, v1.4) · panel = 창 자체(확인 시트 권장) */
  initialFocus?: 'first' | 'panel'
  /** Escape 처리(생략하면 onClose) */
  onEscape?: () => void
  /**
   * 시트를 연 요소가 닫히는 순간 사라졌거나 비활성(disabled)일 때 초점이 갈 곳(v5).
   * 예: 신고를 마쳐 신고 버튼이 '신고함'으로 바뀐 뒤 → 글 제목. 코드가 연 시트(연 요소 없음)도 이것을 따른다.
   */
  returnFocusRef?: RefObject<HTMLElement>
  children?: ReactNode
}

/** 열린 직후 바깥 탭을 무시하는 시간이자, 닫힌 뒤 탭을 삼키는 시간. */
export const TAP_GUARD_MS = 350

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BottomSheet({
  open,
  onClose,
  title,
  titleId,
  description,
  descriptionId,
  closeLabel,
  footer,
  fill = false,
  initialFocus = 'first',
  onEscape,
  returnFocusRef,
  children,
}: BottomSheetProps) {
  const generatedId = useId()
  const labelId = titleId ?? `${generatedId}-title`
  const descId = `${generatedId}-desc`
  const describedBy = [description ? descId : null, descriptionId ?? null].filter(Boolean).join(' ') || undefined
  const panelRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(0)
  // 닫힌 직후의 투명한 막 — open 이 바뀐 바로 그 렌더에서 켜야 빈틈이 없다(렌더 중 상태 갱신 패턴).
  const [wasOpen, setWasOpen] = useState(open)
  const [shield, setShield] = useState(false)
  if (wasOpen !== open) {
    setWasOpen(open)
    setShield(!open)
  }
  useEffect(() => {
    if (!shield) return
    const timer = window.setTimeout(() => setShield(false), TAP_GUARD_MS)
    return () => window.clearTimeout(timer)
  }, [shield])
  // 최신 콜백·값을 ref 로 읽어, 부모가 매 렌더마다 새 함수를 넘겨도 효과를 다시 걸지 않는다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape
  const returnFocusRefRef = useRef(returnFocusRef)
  returnFocusRefRef.current = returnFocusRef
  const initialFocusRef = useRef(initialFocus)
  initialFocusRef.current = initialFocus

  useEffect(() => {
    if (!open) return
    openedAtRef.current = performance.now()
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const firstButton =
      initialFocusRef.current === 'first' ? panel?.querySelector<HTMLElement>('button:not([disabled])') : null
    ;(firstButton ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        ;(onEscapeRef.current ?? onCloseRef.current)()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !panel.contains(active)
      if (event.shiftKey && (active === first || active === panel || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      // 창이 사라져 포커스가 갈 곳을 잃었을 때만 되돌린다(창 안에서 새로 나타난 입력칸 등이 받았으면 그대로 둔다).
      const current = document.activeElement
      if (current && current !== document.body && current.isConnected) return
      const canReturn =
        opener && opener !== document.body && opener.isConnected && !opener.matches(':disabled')
      const target = canReturn ? opener : (returnFocusRefRef.current?.current ?? null)
      target?.focus?.()
    }
  }, [open])

  // 포커스를 가진 요소가 본문에서 사라지면 포커스가 창 밖(body)으로 떨어진다 — 창으로 되돌린다.
  useEffect(() => {
    if (!open) return
    const current = document.activeElement
    if (!current || current === document.body) panelRef.current?.focus()
  })

  if (typeof document === 'undefined') return null

  if (!open) {
    return shield
      ? createPortal(<div aria-hidden="true" className="fixed inset-0 z-[1000]" />, document.body)
      : null
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <div
        aria-hidden="true"
        className="nsd-sheet-backdrop absolute inset-0 bg-ink/40"
        onClick={() => {
          if (performance.now() - openedAtRef.current >= TAP_GUARD_MS) onClose()
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          'anim-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-w-screen-sm flex-col rounded-t-2xl bg-white px-5 pb-[calc(28px+var(--safe-bottom))] pt-2 text-ink shadow-sheet outline-none',
          fill ? 'h-[78vh]' : 'max-h-[85vh]',
        )}
      >
        <div aria-hidden="true" data-handle="" className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-sm bg-line-strong" />
        <h2 id={labelId} className="shrink-0 text-section text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-1 shrink-0 text-small text-ink-body">
            {description}
          </p>
        ) : null}
        {/* 본문만 스크롤한다. 좌우·위아래 여백은 초점 고리(2px + 2px)가 스크롤 가장자리에서 잘리지 않게 하는 몫 */}
        {children ? (
          <div className={cn('-mx-1 min-h-0 overflow-y-auto px-1 py-1', fill && 'flex-1', 'mt-3')}>{children}</div>
        ) : fill ? (
          <div className="flex-1" />
        ) : null}
        {footer ? <div className="shrink-0 pt-3">{footer}</div> : null}
        {closeLabel ? (
          <div className="shrink-0 pt-2">
            <Button fullWidth variant="tertiary" onClick={onClose}>
              {closeLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/**
 * 창을 여는 "입력 줄"(v1.4 §3.2, v5 입력칸 모양): 48px 흰 줄, 8px 모서리, 3:1 테두리(line-input), 오른쪽 화살표.
 * 값이 없으면 회색 안내 문구를 보인다. 긴 다국어는 줄을 바꿔 접힌다(자르지 않는다).
 */
interface PickerRowProps {
  /** 줄 위 라벨 요소의 id — 읽어주기에서 "라벨, 현재 값"으로 읽힌다. */
  labelId?: string
  value?: string | null
  /** 값 옆에 작게 덧붙이는 표기(예: 현지어 국가 이름). */
  secondary?: string | null
  /** 값·덧붙임이 화면 언어와 다른 언어일 때의 언어 코드(읽어주기가 맞는 음성으로 읽게 한다). */
  valueLang?: string
  secondaryLang?: string
  placeholder: string
  onClick: () => void
}

export function PickerRow({
  labelId,
  value,
  secondary,
  valueLang,
  secondaryLang,
  placeholder,
  onClick,
}: PickerRowProps) {
  const valueId = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
      className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-line-input bg-white py-2.5 pl-3.5 pr-3 text-left text-body transition-colors hover:bg-surface active:bg-surface-2"
    >
      <span id={valueId} className="min-w-0 flex-1">
        {value ? (
          <>
            <span lang={valueLang} className="text-ink">
              {value}
            </span>
            {secondary ? (
              <span lang={secondaryLang} className="text-small text-ink-muted">
                {' '}
                {secondary}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-ink-muted">{placeholder}</span>
        )}
      </span>
      <Icon name="chevron" size={20} className="text-ink-muted" />
    </button>
  )
}
