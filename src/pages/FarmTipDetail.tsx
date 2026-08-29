import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useFarmTip } from '../hooks/useFarmTips'
import { localizedContent } from '../lib/localizedContent'
import { isTtsAvailable, speak } from '../lib/tts'
import { Volume2 } from '../components/ui/icons'

/** 🌾 농사 도움 상세 — 비로그인·TTS 읽어주기(저문해력, PRD v1.5 §1 원칙 재사용). */
export function FarmTipDetail() {
  const { t, locale } = useTranslation()
  const { tipId } = useParams()
  const { data: tip, isLoading, isError, refetch, isFetching } = useFarmTip(tipId)

  if (isLoading) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {t('farm.loading')}
      </p>
    )
  }

  // 무언 실패 금지(재검수 P1-2): 네트워크 오류를 "정보 없음"으로 오표시하지 않는다.
  if (isError) {
    return (
      <div className="rounded-card bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        <p className="mb-3">{t('farm.error')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-[44px] rounded-full border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }
  if (!tip) {
    return (
      <div className="text-center">
        <p className="rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">{t('farm.empty')}</p>
        <Link to="/farm" className="mt-4 inline-block text-green-700 underline">
          {t('farm.back')}
        </Link>
      </div>
    )
  }

  const c = localizedContent(tip.localized_content, locale)

  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{c.name}</h1>
        {tip.crop_type ? (
          <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800">
            {tip.crop_type}
          </span>
        ) : null}
        {/* verified_at 검수 모델 표시(재검수 P2-5) — life_info와 동일 어휘 재사용 */}
        {!tip.verified_at ? (
          <p className="mt-1 text-[11px] text-gray-400">{t('lifeInfo.freshness.unverified')}</p>
        ) : null}
      </header>

      <p className="whitespace-pre-line text-base leading-relaxed text-gray-800">{c.description}</p>

      {isTtsAvailable() ? (
        <button
          type="button"
          onClick={() => speak(`${c.name}. ${c.description}`, locale)}
          className="min-h-[56px] rounded-card border border-gray-100 bg-white text-base font-semibold text-gray-800 shadow-card"
        >
          <Volume2 aria-hidden size={20} strokeWidth={2.25} className="mr-2 inline align-[-3px]" />
          {t('talk.readAloud')}
        </button>
      ) : null}

      <div className="rounded-card border border-gray-100 bg-white px-4 py-3 text-xs text-gray-600 shadow-card">
        <p>{t('farm.sourceNotice')}</p>
        {tip.source_url ? (
          <a
            href={tip.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block min-h-[44px] font-semibold text-green-700 underline"
          >
            {t('farm.source')}
          </a>
        ) : null}
      </div>

      <Link to="/farm" className="text-green-700 underline">
        {t('farm.back')}
      </Link>
    </article>
  )
}
