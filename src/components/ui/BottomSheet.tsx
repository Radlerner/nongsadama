import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from './icons'

/**
 * 공용 "아래에서 올라오는 창"(PRD v1.4 §3.3, D-040).
 * 말하기 고지·국적·언어 선택이 모두 이 구성 요소 위에 만든다.
 *
 * - open 이 거짓이면 아무것도 그리지 않는다.
 * - document.body 로 포털한다: 헤더(sticky z-10)가 쌓임 맥락을 만들어, 헤더 안에서 연 창이
 *   뒤따르는 하단 탭(z-10)에 가려지기 때문이다(PRD 는 포털 불필요로 가정 — 헤더 언어 버튼에서 반례).
 * - 열려 있는 동안 본문 스크롤을 막고, 닫히면 원래 값으로 되돌린다.
 * - 열리면 첫 버튼에 포커스, Escape 로 닫힘, Tab 은 창 안에서만 돈다(aria-modal).
 * - 닫히면 열기 전에 포커스가 있던 요소로 되돌린다. 다른 요소가 이미 포커스를 받았으면 뺏지 않는다.
 */
interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** 제목 요소 id. 생략하면 자동 생성한다. */
  titleId?: string
  children: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BottomSheet({ open, onClose, title, titleId, children }: BottomSheetProps) {
  const generatedId = useId()
  const labelId = titleId ?? `${generatedId}-title`
  const panelRef = useRef<HTMLDivElement>(null)
  // 최신 onClose 를 ref 로 읽어, 부모가 매 렌더마다 새 함수를 넘겨도 효과를 다시 걸지 않는다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const firstButton = panel?.querySelector<HTMLElement>('button:not([disabled])')
    ;(firstButton ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
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
      if (opener && opener.isConnected && (!current || current === document.body)) opener.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="nsd-sheet-backdrop absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="nsd-sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[78vh] max-w-screen-sm flex-col rounded-t-card bg-white px-4 pt-2 text-gray-900 outline-none"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div aria-hidden className="mx-auto h-1 w-9 shrink-0 rounded-full bg-gray-300" />
        <h2 id={labelId} className="shrink-0 pb-2 pt-3 text-lg font-extrabold tracking-tight">
          {title}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * 창을 여는 "입력 줄"(PRD v1.4 §3.2): 흰 줄, 테두리 gray-300, 오른쪽 화살표.
 * 값이 없으면 회색 안내 문구를 보인다. 긴 다국어는 두 줄까지 접힌다(자르지 않는다).
 */
interface PickerRowProps {
  /** 줄 위 라벨 요소의 id — 읽어주기에서 "라벨, 현재 값"으로 읽힌다. */
  labelId?: string
  value?: string | null
  /** 값 옆에 작게 덧붙이는 표기(예: 현지어 국가 이름). */
  secondary?: string | null
  placeholder: string
  onClick: () => void
}

export function PickerRow({ labelId, value, secondary, placeholder, onClick }: PickerRowProps) {
  const valueId = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
      className="flex min-h-[44px] w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-left text-base active:bg-gray-50"
    >
      <span id={valueId} className="flex-1">
        {value ? (
          <>
            <span className="text-gray-900">{value}</span>
            {secondary ? <span className="text-sm text-gray-500"> {secondary}</span> : null}
          </>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
      </span>
      <ChevronRight aria-hidden size={20} strokeWidth={2} className="shrink-0 text-gray-400" />
    </button>
  )
}
