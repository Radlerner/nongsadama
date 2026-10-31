import { useEffect, useId, useRef } from 'react'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { ChoiceRow } from './ui/ChoiceRow'
import { ErrorState } from './ui/ErrorState'
import { LoadingState } from './ui/LoadingState'
import { SkeletonBlock } from './ui/Skeleton'
import { useCountries, type Country } from '../hooks/useCountries'
import { useTranslation } from '../i18n/useTranslation'

/**
 * 국적 선택 창(PRD v1.4 §3.2 화면 3). 목록은 DB(countries) 그대로 — 화면 코드에 국가 코드를 적지 않는다.
 * 국기는 쓰지 않는다(이미지 자산·이모지 금지). 고른 나라 = 2px nong-600 테두리 + 체크 원(ChoiceRow, 56px).
 * 나라 이름은 한국어(lang="ko") + 그 나라 말(lang=기본 언어) 두 줄.
 * 보조 버튼(다른 나라·고르지 않기·닫기)은 창 바닥에 고정하고 창 높이도 고정한다 — 느린 망에서 목록이
 * 늦게 도착해도 누르려던 자리(바닥 버튼, 창 위 어두운 배경)에 나라 줄이 들어와 언어가 바뀌는 일이 없게 한다.
 * 이 창은 기기에서만 쓰는 국적 선택이다 — 국적은 공개 화면(게시판·이웃 목록)에 보이지 않는다.
 */
interface CountrySheetProps {
  open: boolean
  onClose: () => void
  /** 현재 고른 국적(ISO 2자). 없으면 null. */
  selected: string | null
  onSelect: (country: Country) => void
  /** 창 바닥의 보조 버튼(예: "고르지 않을래요", "국적 지우기"). */
  noneLabel: string
  onNone: () => void
  /** 목록에 없는 나라를 위한 줄(프로필 수정 전용). 주지 않으면 그리지 않는다. */
  otherLabel?: string
  onOther?: () => void
}

export function CountrySheet({
  open,
  onClose,
  selected,
  onSelect,
  noneLabel,
  onNone,
  otherLabel,
  onOther,
}: CountrySheetProps) {
  const { t } = useTranslation()
  const { data: countries, isLoading, isError, refetch, isFetching } = useCountries({ enabled: open })
  const helpId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const hasList = Boolean(countries && countries.length > 0)

  // 창이 열릴 때 BottomSheet 가 자동으로 초점을 둔 요소(자식의 효과가 먼저 실행된다).
  const autoFocusedRef = useRef<Element | null>(null)
  useEffect(() => {
    autoFocusedRef.current = open ? document.activeElement : null
  }, [open])

  // 창을 연 뒤에 목록이 도착했으면 목록(고른 나라가 있으면 그 줄)으로 초점을 옮긴다.
  // 자동으로 놓인 바닥 버튼이나 창 자체에 초점이 있을 때만 — 사용자가 직접 옮겨 둔 초점은 건드리지 않는다.
  useEffect(() => {
    if (!open || !hasList) return
    const current = document.activeElement
    const list = listRef.current
    const onAutoFocused =
      current === autoFocusedRef.current && Boolean(footerRef.current?.contains(current))
    const onPanel = current === list?.closest('[role="dialog"]')
    if (!onAutoFocused && !onPanel && current !== document.body) return
    const target =
      list?.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      list?.querySelector<HTMLElement>('button')
    target?.focus()
  }, [open, hasList])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('select.nationalitySheetTitle')}
      descriptionId={helpId}
      fill
      footer={
        <div ref={footerRef} className="flex flex-col gap-2">
          {otherLabel && onOther ? (
            <Button fullWidth wrap variant="secondary" onClick={onOther}>
              {otherLabel}
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button fullWidth wrap variant="secondary" onClick={onNone}>
              {noneLabel}
            </Button>
            <Button fullWidth wrap variant="tertiary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      }
    >
      <p id={helpId} className="mb-3 text-small text-ink-body">
        {t('select.nationalitySheetHelp')}
      </p>

      {isLoading ? (
        <LoadingState variant="inline" label={t('select.countryLoading')}>
          {/* 나라 줄(56px) 모양 자리 */}
          <div className="mt-2 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </LoadingState>
      ) : null}

      {/* 받아 둔 목록이 있으면 다시 읽기에 실패해도 목록을 보여 준다 */}
      {isError && !countries ? (
        <ErrorState title={t('select.countryError')} onRetry={() => void refetch()} retrying={isFetching} />
      ) : null}

      {countries && countries.length > 0 ? (
        <ul ref={listRef} className="flex flex-col gap-2">
          {countries.map((country) => (
            <li key={country.iso_code}>
              <ChoiceRow selected={selected === country.iso_code} onClick={() => onSelect(country)}>
                <span lang="ko" className="block">
                  {country.name_ko}
                </span>
                {country.name_native !== country.name_ko ? (
                  <span lang={country.default_locale} className="block text-small font-normal text-ink-muted">
                    {country.name_native}
                  </span>
                ) : null}
              </ChoiceRow>
            </li>
          ))}
        </ul>
      ) : null}
    </BottomSheet>
  )
}
