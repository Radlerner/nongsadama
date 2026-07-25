import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'

export function Landing() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white px-6 text-gray-900">
      <div className="flex justify-end py-3">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
        <div>
          <h1 className="text-2xl font-bold text-green-700">{t('landing.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('landing.subtitle')}</p>
        </div>
        <Link
          to="/home"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('landing.enter')}
        </Link>
      </div>
    </div>
  )
}
