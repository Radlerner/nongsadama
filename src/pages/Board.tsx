import { PagePlaceholder } from '../components/PagePlaceholder'
import { useTranslation } from '../i18n/useTranslation'

export function Board() {
  const { t } = useTranslation()
  return <PagePlaceholder title={t('board.title')} message={t('board.empty')} />
}
