import { Fragment, type ReactNode } from 'react'
import type { Locale } from '../../config/app'
import { useTranslation } from '../../i18n/useTranslation'
import { languageEndonym, languageEndonymLang } from '../../lib/languageName'
import { regionDistanceKm } from '../../lib/matching'
import { postCategoryLabelKey } from '../../hooks/usePosts'
import { Icon, cn } from '../ui'
import type { Tables } from '../../types/database'

/*
 * 게시판·글 상세·비슷한 글·글쓰기가 함께 쓰는 작은 조각(디자인 v5, 게시판 = 다(보라)).
 * 작성자 국적은 공개 화면에 보여 주지 않는다.
 */

type Region = Tables<'regions'>

const intlTimeOk = new Map<string, boolean>()
/**
 * 기기 Intl에 이 화면 언어의 상대 시간 자료가 있는지(languageName.ts intlName의 strict와 같은 생각).
 * 자료가 없으면 기본 언어로 떨어지거나('yesterday') 뿌리 자료로 '-3 h'가 나온다(uz는 'uz'로 풀리지만 뿌리 자료).
 */
function intlHasTimeData(locale: Locale): boolean {
  let ok = intlTimeOk.get(locale)
  if (ok === undefined) {
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
      ok =
        rtf.resolvedOptions().locale.toLowerCase().split(/[-_]/)[0] === locale &&
        !rtf.format(-3, 'hour').trim().startsWith('-')
    } catch {
      ok = false
    }
    intlTimeOk.set(locale, ok)
  }
  return ok
}

/**
 * "지금 · 5분 전 · 3시간 전 · 어제 · 3일 전"(en "now · 5 minutes ago …"), 일주일이 지나면 날짜.
 * 분·시간은 내림(59분은 "59분 전"), 어제·그저께는 달력 날짜로 센다. 화면 언어(locale)로 쓴다.
 * 기기 Intl에 그 언어 자료가 없으면(km·ne·mn·uz 등) 사전 문구(board.time.*)를 쓰고, 일주일이 지나면
 * 숫자 날짜 "2026-10-23"(main의 중립 형식)을 쓴다.
 */
export function formatPostTime(
  iso: string,
  locale: Locale,
  t: (key: string) => string,
  now: Date = new Date(),
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  try {
    const sec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000)) // 휴대폰 시계가 늦어 미래 시각이면 '지금'
    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const calendarDays = () => Math.round((dayStart(now) - dayStart(d)) / 86400000) // 달력 날짜로 세어 '어제'가 정말 어제
    if (!intlHasTimeData(locale)) {
      const n = (key: string, value: number) => t(key).replace('{n}', String(value))
      if (sec < 60) return t('board.time.now')
      if (sec < 3600) return n('board.time.minutesAgo', Math.floor(sec / 60))
      if (sec < 86400) return n('board.time.hoursAgo', Math.floor(sec / 3600))
      const days = calendarDays()
      if (days <= 0) return t('board.time.now')
      if (days === 1) return t('board.time.yesterday')
      if (days < 7) return n('board.time.daysAgo', days)
      const pad = (v: number) => String(v).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (sec < 60) return rtf.format(0, 'second')
    if (sec < 3600) return rtf.format(-Math.floor(sec / 60), 'minute')
    if (sec < 86400) return rtf.format(-Math.floor(sec / 3600), 'hour')
    const days = calendarDays()
    if (days < 7) return rtf.format(-days, 'day')
    return new Intl.DateTimeFormat(locale, {
      year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * 글 메타 한 줄: "홍성읍 · 우리 동네 · 3시간 전". 조각 단위로만 줄을 바꾼다: "3 hours ago"가 쪼개지지 않고,
 * 줄 첫머리에 '·'가 오지 않게 구분점은 앞 조각 끝에 줄바꿈 없는 공백(nbsp)으로 붙인다.
 * 마지막 조각은 시간이며 timeIso가 있으면 <time>으로 감싼다.
 * nowrap이 아니라 inline-block이라 한 줄보다 긴 조각은 그 안에서 줄을 바꿀 수 있다.
 */
export function MetaLine({ parts, timeIso }: { parts: string[]; timeIso?: string }) {
  return (
    <>
      {parts.map((part, i) => {
        const last = i === parts.length - 1
        return (
          <Fragment key={i}>
            {i > 0 ? ' ' : null}
            <span className="inline-block">
              {last && timeIso ? <time dateTime={timeIso}>{part}</time> : part}
              {last ? null : ' ·'}
            </span>
          </Fragment>
        )
      })}
    </>
  )
}

/** 읍·면 거리 라벨(우리 동네 / 약 N km). 지역 중심끼리의 거리라 정확한 위치가 아니다. 모르면 null. */
export function useDistanceLabel() {
  const { t } = useTranslation()
  return (viewer: Region | undefined, region: Region | undefined): string | null => {
    const dist = regionDistanceKm(viewer, region)
    if (dist === null) return null
    if (dist === 0) return t('neighbors.sameTown')
    return t('neighbors.aboutKm').replace('{n}', String(Math.max(1, Math.round(dist))))
  }
}

/** 글 종류 표시. 도움요청만 채운 보라 알약(눈에 띄어야 하는 상태), 나머지는 굵은 글자. */
export function CategoryTag({ category, className }: { category: string; className?: string }) {
  const { t } = useTranslation()
  const label = t(postCategoryLabelKey(category))
  if (category === 'help') {
    return (
      <span
        className={cn(
          'inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full bg-da-600 px-2.5 text-caption font-bold text-white',
          className,
        )}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-caption font-bold text-ink-body',
        className,
      )}
    >
      {/* 우리 동네 추천(D-043)은 게시판 거르기 알약과 같은 핀 그림을 붙인다 */}
      {category === 'recommend' ? <Icon name="pin" size={16} className="text-ink-muted" /> : null}
      {label}
    </span>
  )
}

/**
 * 원문 언어 표시: "원문 · Tiếng Việt". 화면 언어와 다를 때만 쓴다.
 * 누를 수 없는 설명 글자(캡션)라 알약·버튼 모양을 쓰지 않는다(번역 보기는 없는 기능).
 */
export function SourceLocaleChip({ code, className }: { code: Locale; className?: string }) {
  const { t, locale } = useTranslation()
  const [before, after = ''] = t('board.originalLang').split('{lang}')
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 text-caption text-ink-muted', className)}>
      <Icon name="translate" size={16} className="text-ink-muted" />
      <span className="truncate">
        {before}
        <span lang={languageEndonymLang(code, locale)} className="font-bold">
          {languageEndonym(code, locale)}
        </span>
        {after}
      </span>
    </span>
  )
}

/** 실패 한 줄(빨간 글자 + 느낌표). role=alert라 나타나면 바로 읽힌다. */
export function ErrorLine({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" className={cn('flex items-start gap-1.5 text-small text-danger', className)}>
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** 쓰기 실패 문구 키: 오프라인이면 common.offline, 아니면 화면별 실패 문구. */
export function writeErrorKey(key: string): string {
  return typeof navigator !== 'undefined' && !navigator.onLine ? 'common.offline' : key
}

/** 안내 상자(회색 면 + 선 아이콘). 노란·크림 바탕 대신 v5 중립 면을 쓴다. */
export function NoteBox({
  icon,
  children,
  className,
}: {
  icon: 'info' | 'shield' | 'lock' | 'pin' | 'alert'
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex gap-3 rounded-xl bg-surface px-4 py-3', className)}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-ink-body" />
      <div className="min-w-0 flex-1 text-small text-ink-body">{children}</div>
    </div>
  )
}
