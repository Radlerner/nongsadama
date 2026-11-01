import { useTranslation } from '../i18n/useTranslation'
import { useRegionChoice } from '../context/RegionChoiceContext'
import { useRegions } from '../hooks/useRegions'
import { useTapGuard } from '../hooks/useTapGuard'
import { regionDisplayLabel } from '../lib/regionName'

/**
 * 화면 안에 끼워 넣는 "내 지역으로 저장" 제안(v1.6 D-047, D3·D5) — 글쓰기·이웃·내 정보에서 쓴다.
 * 조건(로그인·프로필 행 있음·프로필 지역 없음·직접 고른 지역을 보는 중·"나중에" 아님)은 RegionChoiceProvider가 정한다.
 * 저장 버튼은 form 밖에 type=button으로 둔다(글쓰기 제출과 섞이지 않게).
 */
export function RegionSaveOffer() {
  const { t, locale } = useTranslation()
  const { data: regions } = useRegions()
  const { saveOffer, savePhase, savedRegionId, saveOwn, dismissOffer } = useRegionChoice()
  const guard = useTapGuard(`${savePhase}:${saveOffer?.regionId ?? ''}`)
  const label = (id: string | null | undefined) => (id && regions ? regionDisplayLabel(regions, id, locale) : '')

  if (savePhase === 'saved' && savedRegionId) {
    return (
      <p role="status" className="rounded-card bg-green-50 px-4 py-3 text-sm text-green-800">
        {t('region.offer.saved').replace('{name}', label(savedRegionId))}
      </p>
    )
  }
  if (!saveOffer) return null
  const saving = savePhase === 'saving'
  return (
    <div className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
      <p className="font-semibold">{t('region.offer.question').replace('{name}', label(saveOffer.regionId))}</p>
      <p className="mt-1 text-xs text-green-800">{savePhase === 'error' ? t('region.offer.failed') : t('region.offer.why')}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={guard(() => void saveOwn())}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex min-h-[44px] items-center rounded-full bg-brand-greenDark px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t('region.offer.saving') : savePhase === 'error' ? t('common.retry') : t('region.offer.save')}
        </button>
        <button
          type="button"
          onClick={guard(dismissOffer)}
          disabled={saving}
          className="inline-flex min-h-[44px] items-center rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-700 disabled:opacity-50"
        >
          {t('region.offer.later')}
        </button>
      </div>
    </div>
  )
}
