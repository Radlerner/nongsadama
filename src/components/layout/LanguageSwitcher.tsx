import { getLocaleLabel } from '../../config/app'
import { useTranslation } from '../../i18n/useTranslation'

export function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales, t } = useTranslation()

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="min-h-[44px] rounded border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        {supportedLocales.map((code) => (
          <option key={code} value={code}>
            {getLocaleLabel(code)}
          </option>
        ))}
      </select>
    </label>
  )
}
