import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions } from '../hooks/useRegions'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { getLocaleLabel } from '../config/app'
import { regionLabel } from '../lib/regionName'

export function Profile() {
  const { t, locale } = useTranslation()
  const { user, initializing, signOut } = useAuth()
  const { data: profile, isLoading } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()

  if (initializing) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t('profile.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section>
        <h1 className="mb-4 text-lg font-bold">{t('profile.title')}</h1>
        <p className="mb-4 rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('profile.empty')}
        </p>
        <Link
          to="/login"
          className="flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  const region = profile?.region_id
    ? (regions ?? []).find((r) => r.id === profile.region_id)
    : undefined

  return (
    <section>
      <h1 className="mb-4 text-lg font-bold">{t('profile.title')}</h1>

      {isLoading ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('profile.loading')}
        </p>
      ) : (
        <dl className="flex flex-col gap-3 rounded-md border border-gray-200 px-4 py-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500">{t('profile.nicknameLabel')}</dt>
            <dd className="font-semibold text-gray-900">{profile?.nickname ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('profile.emailLabel')}</dt>
            <dd className="text-gray-900">{user.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('profile.localeLabel')}</dt>
            <dd className="text-gray-900">
              {profile ? getLocaleLabel(profile.preferred_locale) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('profile.regionLabel')}</dt>
            <dd className="text-gray-900">
              {region ? regionLabel(region.id, region.names, locale) : '—'}
            </dd>
          </div>
        </dl>
      )}

      <Link
        to="/profile/edit"
        className="mt-4 flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
      >
        {t('profile.editCta')}
      </Link>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-3 min-h-[44px] w-full rounded-md border border-gray-300 px-6 py-3 text-base text-gray-700"
      >
        {t('profile.logout')}
      </button>
    </section>
  )
}
