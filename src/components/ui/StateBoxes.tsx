/**
 * 공통 상태 박스(PRD v1.7 §3 — 피그마 이관 대비 컴포넌트 체계).
 * 기존 화면들의 로딩/오류/빈 상태 마크업을 클래스 변경 없이 그대로 추출했다(시각 동일).
 * 규칙: 오류에는 반드시 재시도를 제공(무언 실패 금지 원칙의 UI 표준형).
 */
interface TextProps {
  text: string
}

export function LoadingBox({ text }: TextProps) {
  return (
    <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{text}</p>
  )
}

export function EmptyBox({ text }: TextProps) {
  return (
    <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{text}</p>
  )
}

interface ErrorBoxProps {
  text: string
  retryLabel: string
  onRetry: () => void
  retrying?: boolean
}

export function ErrorBox({ text, retryLabel, onRetry, retrying = false }: ErrorBoxProps) {
  return (
    <div className="rounded-md bg-red-50 px-4 py-8 text-center text-sm text-red-700">
      <p className="mb-3">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
      >
        {retryLabel}
      </button>
    </div>
  )
}
