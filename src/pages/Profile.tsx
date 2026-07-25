import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function Profile() {
  const { t } = useTranslation()
  return <PagePlaceholder title={t('profile.title')} message={t('profile.empty')} />
}
