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
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        {supportedLocales.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}
