import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function LifeInfoDetail() {
  const { t } = useTranslation()
  return (
    <PagePlaceholder title={t('lifeInfoDetail.title')} message={t('lifeInfoDetail.empty')} />
  )
}
