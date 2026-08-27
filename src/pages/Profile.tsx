import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions } from '../hooks/useRegions'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { getSupabaseClient } from '../lib/supabase'
import { getLocaleLabel } from '../config/app'
import { regionLabel } from '../lib/regionName'

export function Profile() {
  const { t, locale } = useTranslation()
  const { user, initializing, signOut } = useAuth()
  const { data: profile, isLoading } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()
  const navigate = useNavigate()
  // 계정 삭제(Play 요건): 2단계 확인 → Edge Function(본인만) → 로그아웃(D-021)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const onDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(false)
    const { data, error } = await getSupabaseClient().functions.invoke('delete-account')
    if (error || !data?.ok) {
      setDeleteError(true)
      setDeleting(false)
      return
    }
    await signOut()
    navigate('/', { replace: true })
  }

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

      {/* 계정 삭제(Google Play 요건) — 게시글·프로필 영구 삭제 경고 + 2단계 확인 */}
      <div className="mt-8 rounded-md border border-red-200 px-4 py-3">
        <p className="text-xs text-gray-600">{t('profile.deleteAccountWarn')}</p>
        {confirmingDelete ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void onDeleteAccount()}
              className="min-h-[44px] flex-1 rounded-md bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? t('auth.loading') : t('profile.deleteAccountConfirm')}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
              className="min-h-[44px] flex-1 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
            >
              {t('postDetail.deleteCancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-2 min-h-[44px] w-full rounded-md border border-red-300 text-sm font-semibold text-red-700"
          >
            {t('profile.deleteAccount')}
          </button>
        )}
        {deleteError ? (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {t('profile.deleteAccountError')}
          </p>
        ) : null}
      </div>

      <Link to="/privacy" className="mt-6 inline-block min-h-[44px] text-xs text-gray-500 underline">
        {t('common.privacy')}
      </Link>
    </section>
  )
}
