import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function Home() {
  const { t } = useTranslation()
  return <PagePlaceholder title={t('home.title')} message={t('home.empty')} />
}
