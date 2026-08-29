import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-4 px-6 text-center text-gray-900">
      <h1 className="text-xl font-extrabold tracking-tight">{t('notFound.title')}</h1>
      <Link to="/home" className="text-green-700 underline">
        {t('notFound.back')}
      </Link>
    </div>
  )
}
