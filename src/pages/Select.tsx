import { Link } from 'react-router-dom'
import { getLocaleLabel } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'

/**
 * 언어·지역 선택 화면(PRD 5 IA, 4.1 흐름).
 * v0.1.0에서는 골격: 언어는 선택 가능하고, 지역은 regions 데이터가 아직 없으므로
 * 빈 상태로 자리만 둔다. 실제 지역 선택은 데이터 모델 작업 이후 채운다.
 */
export function Select() {
  const { t, locale, setLocale, supportedLocales } = useTranslation()

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white px-6 py-6 text-gray-900">
      <h1 className="text-xl font-bold text-green-700">{t('select.title')}</h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('select.language')}</h2>
        <ul className="flex flex-col gap-2">
          {supportedLocales.map((code) => {
            const active = locale === code
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={active}
                  className={[
                    'flex min-h-[44px] w-full items-center rounded-md border px-4 text-left text-base',
                    active
                      ? 'border-green-700 bg-green-50 font-semibold text-green-700'
                      : 'border-gray-300 text-gray-700',
                  ].join(' ')}
                >
                  {getLocaleLabel(code)}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('select.region')}</h2>
        <p className="rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t('select.regionEmpty')}
        </p>
      </section>

      <div className="mt-auto pt-8">
        <Link
          to="/home"
          className="flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('select.continue')}
        </Link>
      </div>
    </div>
  )
}
