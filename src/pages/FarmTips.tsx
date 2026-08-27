import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useFarmTips } from '../hooks/useFarmTips'
import { localizedContent } from '../lib/localizedContent'
import { norm } from '../lib/matching'
import { CardLink } from '../components/ui/Card'
import { EmptyBox, ErrorBox, LoadingBox } from '../components/ui/StateBoxes'

/**
 * 🌾 농사 도움 목록(PRD v1.7 §1·§2) — 비로그인 열람.
 * 로그인+작목 설정 시 내 작목 팁이 맨 위(훅에서 정렬).
 */
export function FarmTips() {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useOwnProfile(user?.id)
  const myCrop = profile?.crop_type ?? null
  const { data: tips, isLoading, isError, refetch, isFetching } = useFarmTips(myCrop)

  return (
    <section>
      <h1 className="mb-1 text-lg font-bold">🌾 {t('farm.title')}</h1>
      <p className="mb-4 text-xs text-gray-500">{t('farm.subtitle')}</p>

      {isLoading ? (
        <LoadingBox text={t('farm.loading')} />
      ) : isError ? (
        <ErrorBox
          text={t('farm.error')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : (tips ?? []).length === 0 ? (
        <EmptyBox text={t('farm.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {(tips ?? []).map((tip) => {
            const c = localizedContent(tip.localized_content, locale)
            const isMine = Boolean(
              myCrop && norm(tip.crop_type) === norm(myCrop) && norm(myCrop) !== '',
            )
            return (
              <li key={tip.id}>
                <CardLink to={`/farm/${tip.id}`} className="px-4 py-3">
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="flex-1">{c.name}</span>
                    {isMine ? (
                      <span className="rounded-full bg-brand-greenDark px-2 py-0.5 text-[11px] font-semibold text-white">
                        {t('farm.myCrop')}
                      </span>
                    ) : tip.crop_type ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800">
                        {tip.crop_type}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{c.description}</p>
                </CardLink>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
