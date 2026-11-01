import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useRegionChoice } from '../context/RegionChoiceContext'
import { useRegions } from '../hooks/useRegions'
import { useTapGuard } from '../hooks/useTapGuard'
import { regionDisplayLabel } from '../lib/regionName'

/**
 * 보는 지역이 없을 때(v1.6 D-047, D2). 전국을 자동으로 보여 주지 않고 고르게 한다.
 * - [지역 고르기] → /select(돌아올 곳을 넘긴다), [지역 없이 전국 둘러보기] → 명시적 전국 보기
 * - 로그인했는데 내 지역을 5초 안에 못 받았으면, 늦게 도착했을 때 [내 지역(Y)으로 보기]를 켠다.
 *   그 자리는 처음부터 비워 두어 버튼이 생겨도 다른 버튼이 밀리지 않는다.
 */
export function RegionNeededBox({ returnTo, returnState }: { returnTo: string; returnState?: unknown }) {
  const { t, locale } = useTranslation()
  const { data: regions } = useRegions()
  const { view, lateOwnRegionId, pickAll, showOwn, retry } = useRegionChoice()
  const guard = useTapGuard(lateOwnRegionId ?? '')
  const reason = view.status === 'none' ? view.reason : 'empty'
  const lateName = lateOwnRegionId && regions ? regionDisplayLabel(regions, lateOwnRegionId, locale) : ''

  return (
    <div className="rounded-card border border-black/5 bg-white/90 px-4 py-6 text-center">
      <p className="text-base font-semibold text-gray-900">{t('region.needed.title')}</p>
      <p className="mt-1 text-sm text-gray-600" role={reason === 'profileFailed' ? 'status' : undefined}>
        {reason === 'invalid'
          ? t('region.needed.invalid')
          : reason === 'profileFailed'
            ? t('region.needed.profileFailed')
            : t('region.needed.body')}
      </p>
      <div className="mt-4 flex flex-col items-stretch gap-2">
        {/* 늦게 온 내 지역 버튼 자리(로그인 사용자만 쓰인다) — 없을 때도 높이를 둔다 */}
        <div className="min-h-[44px]" role="status">
          {lateOwnRegionId ? (
            <button
              type="button"
              onClick={guard(() => showOwn(lateOwnRegionId))}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-green-700 bg-green-50 px-4 text-sm font-semibold text-green-800"
            >
              {t('region.showOwn').replace('{name}', lateName)}
            </button>
          ) : reason === 'profileFailed' || reason === 'timeout' ? (
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-gray-300 px-4 text-sm text-gray-700"
            >
              {t('common.retry')}
            </button>
          ) : null}
        </div>
        <Link
          to="/select"
          state={{ returnTo, returnState }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-4 text-sm font-semibold text-white"
        >
          {t('region.needed.pick')}
        </Link>
        <button
          type="button"
          onClick={pickAll}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-700"
        >
          {t('region.needed.all')}
        </button>
      </div>
    </div>
  )
}
