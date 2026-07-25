import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function BoardPostDetail() {
  const { t } = useTranslation()
  return <PagePlaceholder title={t('postDetail.title')} message={t('postDetail.empty')} />
}
