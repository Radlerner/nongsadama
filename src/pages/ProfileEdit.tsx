import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { zodResolver } from '../lib/zodResolver'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useRegions } from '../hooks/useRegions'
import { getSupabaseClient } from '../lib/supabase'
import { appConfig, getLocaleLabel } from '../config/app'
import { regionLabel } from '../lib/regionName'
import type { Tables } from '../types/database'

// zod 메시지는 번역 키(PRD 6.1). 국가 코드는 ISO alpha-2/3 형식만 검사(특정 국가 하드코딩 없음).
const schema = z.object({
  nickname: z.string().min(1, 'auth.error.nicknameRequired').max(40, 'auth.error.nicknameLong'),
  country_code: z
    .string()
    .regex(/^([A-Za-z]{2,3})?$/, 'profileEdit.error.countryFormat'),
  crop_type: z.string().max(60, 'profileEdit.error.cropLong'),
  preferred_locale: z.string().min(2),
  region_id: z.string(),
  is_matching_visible: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function ProfileEdit() {
  const { t, locale, setLocale } = useTranslation()
  const { user, initializing } = useAuth()
  const { setRegionId } = useSelectedRegion()
  const { data: regions } = useRegions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profiles', 'own', user?.id],
    queryFn: async (): Promise<Tables<'profiles'> | null> => {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('*')
        .eq('id', user?.id as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: Boolean(user?.id),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profile
      ? {
          nickname: profile.nickname,
          country_code: profile.country_code ?? '',
          crop_type: profile.crop_type ?? '',
          preferred_locale: profile.preferred_locale,
          region_id: profile.region_id ?? '',
          is_matching_visible: profile.is_matching_visible,
        }
      : undefined,
  })

  if (initializing || (user && isLoading)) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t('profile.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section className="text-center">
        <p className="mb-4 rounded-md bg-gray-50 px-4 py-8 text-sm text-gray-500">
          {t('profile.empty')}
        </p>
        <Link to="/login" className="text-green-700 underline">
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  const towns = (regions ?? []).filter((r) => r.level === 'town')

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const countryCode = values.country_code.trim().toUpperCase()
    const cropType = values.crop_type.trim()
    const regionIdValue = values.region_id || null
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({
        nickname: values.nickname.trim(),
        country_code: countryCode === '' ? null : countryCode,
        crop_type: cropType === '' ? null : cropType,
        preferred_locale: values.preferred_locale,
        region_id: regionIdValue,
        is_matching_visible: values.is_matching_visible,
      })
      .eq('id', user.id)
    if (error) {
      setSubmitError('profileEdit.error.saveFailed')
      return
    }
    // 프로필의 언어·지역 선택을 앱 상태에도 반영한다(PRD P0-10).
    if (values.preferred_locale !== locale) setLocale(values.preferred_locale)
    setRegionId(regionIdValue)
    await queryClient.invalidateQueries({ queryKey: ['profiles', 'own', user.id] })
    navigate('/profile')
  })

  const inputClass =
    'w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900'

  return (
    <section>
      <h1 className="mb-4 text-lg font-bold">{t('profileEdit.title')}</h1>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('auth.nickname')}
          <input type="text" className={inputClass} {...register('nickname')} />
          {errors.nickname?.message ? (
            <span className="font-normal text-red-700">{t(errors.nickname.message)}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('profileEdit.country')}
          <input
            type="text"
            placeholder={t('profileEdit.countryPlaceholder')}
            className={inputClass}
            {...register('country_code')}
          />
          <span className="font-normal text-xs text-gray-500">{t('profileEdit.countryHelp')}</span>
          {errors.country_code?.message ? (
            <span className="font-normal text-red-700">{t(errors.country_code.message)}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('profileEdit.crop')}
          <input
            type="text"
            placeholder={t('profileEdit.cropPlaceholder')}
            className={inputClass}
            {...register('crop_type')}
          />
          {errors.crop_type?.message ? (
            <span className="font-normal text-red-700">{t(errors.crop_type.message)}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('profile.localeLabel')}
          <select className={inputClass} {...register('preferred_locale')}>
            {appConfig.supportedLocales.map((code) => (
              <option key={code} value={code}>
                {getLocaleLabel(code)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('profile.regionLabel')}
          <select className={inputClass} {...register('region_id')}>
            <option value="">{t('profileEdit.regionNone')}</option>
            {towns.map((town) => (
              <option key={town.id} value={town.id}>
                {regionLabel(town.id, town.names, locale)}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-md border border-gray-200 px-4 py-3">
          <label className="flex items-start gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-green-700"
              {...register('is_matching_visible')}
            />
            <span>
              <span className="font-semibold">{t('profileEdit.matchingConsent')}</span>
              <br />
              {/* 동의 범위 고지(재검수 이월 요건): 이웃 노출 + 게시글 국적의 비로그인 공개 */}
              <span className="text-xs text-gray-600">{t('profileEdit.matchingConsentDetail')}</span>
            </span>
          </label>
        </div>

        {submitError ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t(submitError)}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? t('auth.loading') : t('profileEdit.save')}
        </button>
      </form>

      <Link to="/profile" className="mt-4 inline-block text-sm text-gray-500 underline">
        {t('profileEdit.cancel')}
      </Link>
    </section>
  )
}
