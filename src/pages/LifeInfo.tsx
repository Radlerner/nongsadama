import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function LifeInfo() {
  const { t } = useTranslation()
  return <PagePlaceholder title={t('lifeInfo.title')} message={t('lifeInfo.empty')} />
}
