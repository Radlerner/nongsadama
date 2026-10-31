import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm, type NeighborRow } from '../lib/matching'
import { languageEndonym, languageEndonymLang } from '../lib/languageName'
import { Avatar, Icon, cn } from './ui'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

interface NeighborCardProps {
  neighbor: NeighborRow
  regionsById: Map<string, Region>
  viewerRegionId: string | null
  /** 마지막 줄이면 아래 구분선을 그리지 않는다 */
  last?: boolean
}

/**
 * 국가 코드 → 화면 언어로 된 나라 이름(Intl). 기기에 그 언어 자료가 없으면(일부 기기의 km·ne·mn 등 —
 * Intl은 조용히 기기 기본 언어로 바꿔 '베트남'처럼 내놓는다) resolvedOptions로 알아채 영어 이름(lang="en"),
 * 그것도 없으면 코드 그대로. languageName.ts의 strict 검사와 같은 규칙. 특정 국가 분기 없음.
 */
function countryName(code: string, locale: string): { text: string; lang?: string } {
  const upper = code.toUpperCase()
  for (const lang of [locale, 'en']) {
    try {
      const dn = new Intl.DisplayNames([lang], { type: 'region' })
      // 기기에 그 언어 자료가 없으면 Intl이 기기 기본 언어로 조용히 바꾼다 → 영어로 넘긴다
      if (dn.resolvedOptions().locale.toLowerCase().split(/[-_]/)[0] !== lang.toLowerCase().split(/[-_]/)[0]) continue
      const name = dn.of(upper)
      // 화면 언어가 아닌 이름(영어)이면 lang을 달아 읽기 프로그램이 그 말로 읽게 한다
      if (name && name.toUpperCase() !== upper) return { text: name, lang: lang === locale ? undefined : lang }
    } catch {
      // 잘못된 코드나 DisplayNames 미지원: 다음 단계로
    }
  }
  return { text: upper }
}

/**
 * 이웃 한 명(키트 4.8 사람 줄): 머리글자 아바타(마=황토) · 닉네임 · 지역 · 근사거리 · 언어/작목/국적 칩.
 * 연락처·정확 위치는 없다. 국적은 여기서만 보인다(로그인 + 서로 동의한 사람끼리의 neighbor_profiles —
 * 동의 문구 profileEdit.matchingConsentDetail이 알린 범위). 게시판(공개 화면)에는 국적이 없다.
 * 줄 전체를 누르면 그 이웃의 공개 게시글 목록(PRD v1.4 §2.1 연결 동선).
 */
export function NeighborCard({ neighbor, regionsById, viewerRegionId, last = false }: NeighborCardProps) {
  const { t, locale } = useTranslation()

  const region = neighbor.region_id ? regionsById.get(neighbor.region_id) : undefined
  const viewerRegion = viewerRegionId ? regionsById.get(viewerRegionId) : undefined
  // 지역(읍·면 또는 시·군) 중심좌표 사이의 대략 거리 — 정확한 위치는 쓰지 않는다
  const dist = regionDistanceKm(viewerRegion, region)

  const distanceLabel =
    dist === null
      ? null
      : dist === 0
        ? t('neighbors.sameTown')
        : t('neighbors.aboutKm').replace('{n}', String(Math.max(1, Math.round(dist))))

  const town = region ? regionLabel(region.id, region.names, locale) : ''
  const meta = [town, distanceLabel].filter(Boolean).join(' · ')

  // 언어 칩은 그 언어 자체 이름(endonym)이라 lang을 단다(읽기 프로그램 발음·글꼴)
  const chips: { text: string; lang?: string }[] = []
  if (neighbor.preferred_locale)
    chips.push({
      text: languageEndonym(neighbor.preferred_locale, locale),
      lang: languageEndonymLang(neighbor.preferred_locale, locale),
    })
  if (neighbor.crop_type) chips.push({ text: neighbor.crop_type })
  if (neighbor.country_code) chips.push(countryName(neighbor.country_code, locale))

  const nickname = neighbor.nickname ?? ''

  const body = (
    <>
      <Avatar name={nickname || '?'} tone="ma" />
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 self-stretch py-3',
          !last && 'border-b border-line',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-bold text-ink">{nickname}</span>
          {meta ? <span className="text-caption text-ink-muted">{meta}</span> : null}
          {chips.length > 0 ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((c, i) => (
                <span
                  key={`${i}-${c.text}`}
                  lang={c.lang}
                  className="inline-flex h-6 max-w-full items-center truncate rounded-full bg-surface px-2 text-caption text-ink-body"
                >
                  {c.text}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        {neighbor.id ? (
          // 줄 전체가 링크다 — 이 알약은 '글 보기'라는 표시일 뿐(따로 눌리는 칸이 아니다)
          <span
            aria-hidden="true"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface pl-3 pr-3.5 text-label text-ink max-[269px]:pr-3"
          >
            <Icon name="message" size={16} strokeWidth={2} />
            {/* 200% 확대(폭 270px 미만)에서는 아이콘만 — 링크 이름은 아래 sr-only neighbors.viewPosts */}
            <span className="max-[269px]:hidden">{t('neighbors.viewPostsShort')}</span>
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <li>
      {neighbor.id ? (
        <Link
          to={`/board?author=${neighbor.id}`}
          className="-mx-5 flex min-h-16 items-center gap-3 px-5 transition-colors active:bg-surface"
        >
          {body}
          <span className="sr-only">{t('neighbors.viewPosts')}</span>
        </Link>
      ) : (
        <div className="flex min-h-16 items-center gap-3">{body}</div>
      )}
    </li>
  )
}
