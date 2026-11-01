import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { useRegionChoice } from '../context/RegionChoiceContext'
import { useRegions } from '../hooks/useRegions'
import { useTapGuard } from '../hooks/useTapGuard'
import { regionDisplayLabel } from '../lib/regionName'
import { sameCounty } from '../lib/regionScope'
import { MapPin, Pencil } from './ui/icons'

/** 같은 계정에게 저장 제안을 한 탭 세션에 한 번만 읽어 준다(StrictMode·탭 복귀에도 반복하지 않게) */
const announcedOffer = new Set<string>()

/**
 * 지금 보는 지역 표시줄(v1.6, D-047). 지도·생활정보·게시판·/farm 위에 같은 모양으로 둔다.
 * - 1줄(두 줄 높이 예약): 지금 보는 지역 · 내 지역 여부 / 저장 제안 문구
 * - 2줄(44px 고정): [내 지역으로] 또는 [저장][나중에] + 늘 있는 [바꾸기]
 * 늦게 온 데이터로 내용이 바뀌어도 높이가 그대로이고, 바뀐 직후 350ms는 탭을 무시한다.
 */
export function RegionViewBar() {
  const { t, locale } = useTranslation()
  const location = useLocation()
  const { user } = useAuth()
  const { data: regions } = useRegions()
  const {
    view,
    profileRegionId,
    toOwnRegionId,
    saveOffer,
    savePhase,
    savedRegionId,
    showOwn,
    saveOwn,
    dismissOffer,
  } = useRegionChoice()
  const label = (id: string | null | undefined) => (id && regions ? regionDisplayLabel(regions, id, locale) : '')
  const returnTo = `${location.pathname}${location.search}`

  let line: string
  if (view.status === 'deciding') line = t('region.bar.deciding')
  else if (view.status === 'error') line = t('select.regionError')
  else if (view.status === 'none') line = t('region.needed.title')
  else if (view.status === 'all') line = t('region.bar.viewingAll')
  else if (profileRegionId && regions && sameCounty(regions, view.regionId, profileRegionId)) {
    line = t('region.bar.viewingOwn').replace('{name}', label(view.regionId))
  } else if (profileRegionId) {
    line = t('region.bar.viewingOther').replace('{name}', label(view.regionId)).replace('{own}', label(profileRegionId))
  } else line = t('region.bar.viewing').replace('{name}', label(view.regionId))

  // 버튼 자리: 저장 진행 상태 → 저장 제안 → 내 지역으로(D1) → 비움
  type Slot = 'saving' | 'saved' | 'error' | 'offer' | 'toOwn' | 'none'
  let slot: Slot = 'none'
  if (savePhase === 'saving') slot = 'saving'
  else if (savePhase === 'saved' && savedRegionId) slot = 'saved'
  else if (savePhase === 'error' && saveOffer) slot = 'error'
  else if (saveOffer) slot = 'offer'
  else if (toOwnRegionId) slot = 'toOwn'

  if (slot === 'offer' || slot === 'saving') line = t('region.offer.question').replace('{name}', label(saveOffer?.regionId))
  else if (slot === 'saved') line = t('region.offer.saved').replace('{name}', label(savedRegionId))
  else if (slot === 'error') line = t('region.offer.failed')

  const guard = useTapGuard(`${slot}:${saveOffer?.regionId ?? ''}:${toOwnRegionId ?? ''}`)

  // 저장 제안은 계정·지역마다 한 탭 세션에 한 번만 읽어 준다(포커스는 옮기지 않는다)
  const [announce, setAnnounce] = useState('')
  const offerKey = slot === 'offer' && user && saveOffer ? `${user.id}:${saveOffer.regionId}` : null
  useEffect(() => {
    if (offerKey && !announcedOffer.has(offerKey)) {
      announcedOffer.add(offerKey)
      setAnnounce(`${line} ${t('region.offer.why')}`)
    }
  }, [offerKey])
  useEffect(() => {
    if (slot === 'saved') setAnnounce(line)
    // 제안을 넘기거나 저장 상태가 끝나면 알림 칸을 비운다(지난 문구가 남지 않게)
    else if (slot !== 'offer') setAnnounce('')
  }, [slot])

  const buttonBase = 'inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold disabled:opacity-50'

  return (
    <section
      aria-label={t('region.bar.label')}
      className="mb-3 rounded-card border border-black/5 bg-white px-3 py-2 shadow-card"
    >
      <div className="flex min-h-[2.5rem] items-start gap-2">
        <MapPin aria-hidden size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-green-700" />
        <p className="line-clamp-2 flex-1 text-sm leading-5 text-gray-800">{line}</p>
      </div>
      <div className="mt-1 flex h-11 items-center gap-2">
        {slot === 'toOwn' && toOwnRegionId ? (
          <button
            type="button"
            onClick={guard(() => showOwn(toOwnRegionId))}
            aria-label={t('region.showOwn').replace('{name}', label(toOwnRegionId))}
            className={`${buttonBase} border border-green-700 bg-green-50 text-green-800`}
          >
            {t('region.bar.toOwn')}
          </button>
        ) : null}
        {slot === 'offer' || slot === 'saving' || slot === 'error' ? (
          <>
            <button
              type="button"
              onClick={guard(() => void saveOwn())}
              disabled={slot === 'saving'}
              aria-busy={slot === 'saving'}
              aria-describedby="region-offer-why"
              className={`${buttonBase} bg-brand-greenDark text-white`}
            >
              {slot === 'saving' ? t('region.offer.saving') : slot === 'error' ? t('common.retry') : t('region.offer.save')}
            </button>
            <button
              type="button"
              onClick={guard(dismissOffer)}
              disabled={slot === 'saving'}
              className={`${buttonBase} border border-gray-300 text-gray-700`}
            >
              {t('region.offer.later')}
            </button>
            <span id="region-offer-why" className="sr-only">{t('region.offer.why')}</span>
          </>
        ) : null}
        {/* 아주 좁은 화면(360px 미만)에서는 글자 대신 연필 아이콘 — 저장 제안의 버튼 셋이 한 줄에 들어가게(이름은 aria-label) */}
        <Link
          to="/select"
          state={{ returnTo }}
          aria-label={t('region.bar.changeLabel')}
          className={`${buttonBase} ml-auto border border-gray-300 text-gray-700 max-[359px]:w-11 max-[359px]:justify-center max-[359px]:px-0`}
        >
          <Pencil aria-hidden size={16} strokeWidth={2.25} className="hidden max-[359px]:block" />
          <span className="max-[359px]:sr-only">{t('region.bar.change')}</span>
        </Link>
      </div>
      <p role="status" className="sr-only">{announce}</p>
    </section>
  )
}
