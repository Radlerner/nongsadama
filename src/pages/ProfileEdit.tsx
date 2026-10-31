import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { zodResolver } from '../lib/zodResolver'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useRegions, groupSelectableByProvince } from '../hooks/useRegions'
import { getSupabaseClient } from '../lib/supabase'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { appConfig, getLocaleLabel, type Locale } from '../config/app'
import { regionLabel } from '../lib/regionName'
import { CountrySheet } from '../components/CountrySheet'
import { useCountries, type Country } from '../hooks/useCountries'
import { pickLocaleForCountry } from '../lib/country'
import { cameFromDetail, flashToast } from '../components/layout/flash'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PickerRow,
  SkeletonBlock,
  SlowHint,
  Spinner,
  cn,
} from '../components/ui'

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

/**
 * 입력 칸(48px, 8px 모서리, 16px 글자 — iOS 확대 방지). 오류면 빨간 테두리.
 * 초점이 옮겨 갈 때 머리줄·아래 탭 줄에 가리지 않는 것은 index.css의 html scroll-padding이 맡는다.
 */
function fieldClass(invalid: boolean) {
  return cn(
    'h-12 w-full rounded-lg border bg-white px-3.5 text-body text-ink placeholder:text-ink-muted',
    invalid ? 'border-danger' : 'border-line-input',
  )
}

/** 칸 아래 오류 한 줄(빨강 + 아이콘). */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-small text-danger">
      <Icon name="alert" size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** 고르는 칸(select) 오른쪽의 아래 꺾쇠 */
function SelectChevron() {
  return (
    <Icon
      name="chevron-down"
      size={20}
      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
    />
  )
}

/** 켬/끔 모양(장식). 실제 입력은 줄 전체를 덮는 투명 checkbox[role=switch]. 켜지면 초록 + 체크. */
function SwitchVisual({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border transition-colors',
        checked ? 'border-nong-600 bg-nong-600' : 'border-line-input bg-surface-2',
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-white transition-transform',
          checked ? 'translate-x-5 text-nong-600' : 'border border-line-input',
        )}
      >
        {checked ? <Icon name="check-plain" size={14} strokeWidth={2.5} /> : null}
      </span>
    </span>
  )
}

export function ProfileEdit() {
  const { t, locale, setLocale } = useTranslation()
  const { user, initializing } = useAuth()
  const { setRegionId } = useSelectedRegion()
  const {
    data: regions,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
  } = useRegions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [localeChosen, setLocaleChosen] = useState(false)
  // v1.4(PRD_v1.4 §3.2 화면 4): 국적은 창에서 고른다. 목록에 없는 나라만 코드를 직접 적는다.
  const [countryOpen, setCountryOpen] = useState(false)
  const [manualCountry, setManualCountry] = useState(false)
  // 창에서 국적을 골라 언어가 국적 기본 언어를 따르는 중인가(P1). 사용자가 언어를 직접 바꾸면 풀린다.
  const [localeFollow, setLocaleFollow] = useState<{ locale: Locale; matched: boolean } | null>(null)

  const { data: profile, isPending, isError, refetch, isFetching } = useOwnProfile(user?.id)
  const { data: countries } = useCountries({ enabled: Boolean(user) })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // 국적 입력칸은 필요할 때만 그리므로(등록되지 않은 채로 제출될 수 있다) 빈 기본값을 둔다.
    defaultValues: { country_code: '', is_matching_visible: false },
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

  const title = <h1 className="text-title text-ink">{t('profileEdit.title')}</h1>

  // 오프라인으로 멈춘 조회(paused)도 isPending이다 — 빈 폼을 보여 주거나 빈 값으로 저장하지 않게 기다린다.
  // 행이 아직 없으면(null) 아래 폼으로 간다(저장할 때 행을 만든다).
  if (initializing || (user && isPending && !isError)) {
    return (
      <section>
        {title}
        <LoadingState
          variant="inline"
          label={t('profile.loading')}
          offlineLabel={t('profile.waitingNetwork')}
          className="mt-3"
        >
          <div className="mt-2 flex flex-col gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <SkeletonBlock className="h-3.5 w-1/3 rounded-full" />
                <SkeletonBlock className="mt-3 h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </LoadingState>
      </section>
    )
  }

  if (!user) {
    return (
      <section>
        {title}
        <EmptyState
          className="mt-4"
          icon="me"
          title={t('profile.empty')}
          action={{ label: t('profile.loginCta'), to: '/login', primary: true }}
        />
      </section>
    )
  }

  // 돌아가기: 내 정보(또는 이웃)에서 왔으면 그 화면으로 뒤로 — 같은 화면이 history에 두 번 쌓이지 않게.
  // 아니면 replace: 뒤로 가기가 끝난 수정 폼으로 돌아가지 않게(PostForm과 같게).
  const fromDetail = cameFromDetail(location.state)
  const leave = (toast?: string) => {
    if (fromDetail) {
      if (toast) flashToast(toast)
      navigate(-1)
    } else {
      navigate('/profile', { replace: true, state: toast ? { toast } : undefined })
    }
  }

  if (isError && !profile) {
    return (
      <section>
        {title}
        <ErrorState
          className="mt-4"
          title={t('profile.loadError')}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
        <Button variant="secondary" fullWidth className="mt-3" onClick={() => leave()}>
          {t('profileEdit.cancel')}
        </Button>
      </section>
    )
  }

  // 국적 표시: 폼 값(country_code)이 유일한 기준 — 저장 로직·zod 검사·DB 컬럼은 1.3.2 그대로다.
  const countryValue = (watch('country_code') ?? '').trim().toUpperCase()
  const pickedCountry = (countries ?? []).find((row) => row.iso_code === countryValue)
  // 목록에 없는 코드가 이미 저장돼 있으면(다른 국적 사용자) 직접 입력칸을 처음부터 보여 준다.
  const showManualCountry =
    manualCountry || (countryValue !== '' && countries !== undefined && !pickedCountry)
  const applyCountry = (code: string) => {
    setValue('country_code', code, { shouldDirty: true, shouldValidate: true })
    setManualCountry(false)
    setCountryOpen(false)
  }
  /** 국적 기본 언어 따르기를 그만두고 언어 칸을 프로필 값으로 되돌린다(국적 지우기·직접 입력). */
  const stopLocaleFollow = () => {
    if (localeFollow && profile) setValue('preferred_locale', profile.preferred_locale)
    setLocaleFollow(null)
  }
  const pickCountry = (country: Country) => {
    applyCountry(country.iso_code)
    // 이 화면에서 언어를 이미 직접 골랐으면 그 선택을 지킨다.
    if (localeChosen) return
    const picked = pickLocaleForCountry(country, appConfig.supportedLocales)
    setValue('preferred_locale', picked.locale, { shouldDirty: true })
    setLocaleFollow(picked)
  }

  // v1.2(D-035): 시·도별 optgroup — 읍·면이 있으면 "시·군 읍·면", 없으면 시·군·구 자체(Select와 같은 규칙·순서).
  const provinceGroups = groupSelectableByProvince(regions ?? [])
  const consentOn = Boolean(watch('is_matching_visible'))

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const countryCode = values.country_code.trim().toUpperCase()
    const cropType = values.crop_type.trim()
    const regionIdValue = values.region_id || null
    const changes = {
      nickname: values.nickname.trim(),
      country_code: countryCode === '' ? null : countryCode,
      crop_type: cropType === '' ? null : cropType,
      // 직접 고른 언어는 그대로 저장(1.3.2). 국적을 따르는 중이면 explicit=false 만 보내 트리거
      // (profiles_apply_country_locale)가 국적 기본 언어를 채우게 한다 — 언어 값까지 보내면 이미
      // explicit=false 인 프로필에서 트리거가 "직접 고른 언어"로 되돌려 버린다.
      ...(localeChosen
        ? { preferred_locale: values.preferred_locale, preferred_locale_explicit: true }
        : localeFollow
          ? { preferred_locale_explicit: false }
          : {}),
      region_id: regionIdValue,
      is_matching_visible: values.is_matching_visible,
    }
    const profiles = getSupabaseClient().from('profiles')
    // 드문 경우 profiles 행이 아직 없으면(첫 로그인 때 생성 실패 등) 행을 만든다(RLS가 본인 id만 허용).
    const mutation = profile
      ? profiles.update(changes).eq('id', user.id)
      : profiles.insert({ id: user.id, ...changes })
    const { data: saved, error } = await mutation.select('preferred_locale, preferred_locale_explicit').single()
    if (error) {
      setSubmitError(navigator.onLine ? 'profileEdit.error.saveFailed' : 'common.offline')
      return
    }
    // 프로필의 언어·지역 선택을 앱 상태에도 반영한다(PRD P0-10).
    if (localeChosen || localeFollow || saved.preferred_locale !== locale) {
      // 서버가 정한 언어가 앱에 없으면(국가 추가 대비) 화면에 보여 준 언어로 둔다.
      const next =
        localeFollow && !appConfig.supportedLocales.includes(saved.preferred_locale)
          ? localeFollow.locale
          : saved.preferred_locale
      setLocale(next, saved.preferred_locale_explicit)
    }
    setRegionId(regionIdValue)
    await queryClient.invalidateQueries({ queryKey: ['profiles', 'own', user.id] })
    // 이웃 목록(neighbor_profiles 뷰)은 내 지역·동의에 따라 달라진다 — 남은 목록(0명·다른 시·군)을 보여 주지 않게 비운다
    if (profile?.region_id !== regionIdValue || profile?.is_matching_visible !== values.is_matching_visible) {
      void queryClient.resetQueries({ queryKey: ['neighbor_profiles'] })
    }
    leave('state.saved')
  })

  const labelClass = 'mb-2 block text-label text-ink'

  // "국적에 맞춰 {lang}로 바꿨어요. 위에서 바꿀 수 있어요" — 안내는 언어 칸 아래(가입 화면 Select와 같은 자리).
  // 언어 이름은 그 언어 글자라 lang을 단다
  let followNote: ReactNode = null
  if (localeFollow) {
    if (localeFollow.matched) {
      const [before, after = ''] = t('select.nationalityLangSet').split('{lang}')
      followNote = (
        <>
          {before}
          <span lang={localeFollow.locale} className="font-bold text-ink">
            {getLocaleLabel(localeFollow.locale)}
          </span>
          {after}
        </>
      )
    } else {
      followNote = t('select.nationalityLangEnglish')
    }
  }

  return (
    <section>
      {title}

      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 flex flex-col gap-6" noValidate>
        <div>
          <label className="block">
            <span className={labelClass}>{t('auth.nickname')}</span>
            <input
              id="pe-nickname"
              type="text"
              autoComplete="nickname"
              aria-invalid={errors.nickname ? true : undefined}
              aria-describedby={errors.nickname ? 'pe-nickname-err' : undefined}
              className={fieldClass(Boolean(errors.nickname))}
              {...register('nickname')}
            />
          </label>
          {errors.nickname?.message ? (
            <FieldError id="pe-nickname-err">{t(errors.nickname.message)}</FieldError>
          ) : null}
        </div>

        <div>
          <span id="pe-country-label" className={labelClass}>
            {t('profileEdit.country')}
          </span>
          <PickerRow
            labelId="pe-country-label"
            value={pickedCountry ? pickedCountry.name_ko : countryValue || null}
            secondary={
              pickedCountry && pickedCountry.name_native !== pickedCountry.name_ko
                ? pickedCountry.name_native
                : null
            }
            valueLang={pickedCountry ? 'ko' : undefined}
            secondaryLang={pickedCountry?.default_locale}
            placeholder={t('profileEdit.countryPick')}
            onClick={() => setCountryOpen(true)}
          />
          {showManualCountry ? (
            <>
              <input
                id="pe-country"
                type="text"
                autoFocus={manualCountry}
                autoCapitalize="characters"
                aria-labelledby="pe-country-label"
                aria-invalid={errors.country_code ? true : undefined}
                aria-describedby={cn('pe-country-help', errors.country_code && 'pe-country-err')}
                placeholder={t('profileEdit.countryPlaceholder')}
                className={cn(fieldClass(Boolean(errors.country_code)), 'mt-2')}
                {...register('country_code', { onChange: () => setManualCountry(true) })}
              />
              <p id="pe-country-help" className="mt-1.5 text-small text-ink-muted">
                {t('profileEdit.countryHelp')}
              </p>
            </>
          ) : null}
          {errors.country_code?.message ? (
            <FieldError id="pe-country-err">{t(errors.country_code.message)}</FieldError>
          ) : null}
        </div>

        <div>
          <label className="block">
            <span className={labelClass}>{t('profileEdit.crop')}</span>
            <input
              id="pe-crop"
              type="text"
              placeholder={t('profileEdit.cropPlaceholder')}
              aria-invalid={errors.crop_type ? true : undefined}
              aria-describedby={errors.crop_type ? 'pe-crop-err' : undefined}
              className={fieldClass(Boolean(errors.crop_type))}
              {...register('crop_type')}
            />
          </label>
          {errors.crop_type?.message ? (
            <FieldError id="pe-crop-err">{t(errors.crop_type.message)}</FieldError>
          ) : null}
        </div>

        <div>
          <label className="block">
            <span className={labelClass}>{t('profile.localeLabel')}</span>
            <span className="relative block">
              <select
                id="pe-locale"
                className={cn(fieldClass(false), 'appearance-none pr-11')}
                {...register('preferred_locale', {
                  onChange: () => {
                    setLocaleChosen(true)
                    setLocaleFollow(null)
                  },
                })}
              >
                {appConfig.supportedLocales.map((code) => (
                  <option key={code} value={code} lang={code}>
                    {getLocaleLabel(code)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </span>
          </label>
          {followNote ? (
            <p
              role="status"
              className="mt-2 flex items-start gap-2 rounded-xl bg-surface px-3.5 py-3 text-small text-ink-body"
            >
              <Icon name="info" size={18} className="mt-0.5 shrink-0 text-ink-muted" />
              <span className="min-w-0">{followNote}</span>
            </p>
          ) : null}
        </div>

        <div>
          {regions ? (
            <label className="block">
              <span className={labelClass}>{t('profile.regionLabel')}</span>
              <span className="relative block">
                <select
                  id="pe-region"
                  className={cn(fieldClass(false), 'appearance-none pr-11')}
                  {...register('region_id')}
                >
                  <option value="">{t('profileEdit.regionNone')}</option>
                  {provinceGroups.map((g) => (
                    <optgroup
                      key={g.province?.id ?? '__none__'}
                      label={
                        g.province
                          ? regionLabel(g.province.id, g.province.names, locale)
                          : t('select.regionOther')
                      }
                    >
                      {g.members.map(({ region, county }) => (
                        <option key={region.id} value={region.id}>
                          {county
                            ? `${regionLabel(county.id, county.names, locale)} ${regionLabel(region.id, region.names, locale)}`
                            : regionLabel(region.id, region.names, locale)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <SelectChevron />
              </span>
            </label>
          ) : (
            // 지역 목록이 오기 전에는 고르는 칸을 그리지 않는다(빈 목록이 저장된 지역을 지운 것처럼 보이지 않게).
            // 폼 값(region_id)은 그대로 남아 있어 이 사이에 저장해도 지역이 바뀌지 않는다.
            <div>
              <span className={labelClass}>{t('profile.regionLabel')}</span>
              {regionsError ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p role="alert" className="flex min-w-0 flex-1 items-start gap-1.5 text-small text-danger">
                    <Icon name="alert" size={18} className="mt-px shrink-0" />
                    <span>{navigator.onLine ? t('state.errorTitle') : t('common.offline')}</span>
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="refresh"
                    loading={regionsFetching}
                    loadingLabel={t('state.retrying')}
                    onClick={() => void refetchRegions()}
                  >
                    {t('common.retry')}
                  </Button>
                </div>
              ) : (
                <div
                  role="status"
                  className="flex h-12 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 text-body text-ink-muted"
                >
                  <Spinner />
                  {t('state.loading')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 이웃 공개 동의: 스위치(role=switch) + 동의 범위 고지를 바로 아래에(재검수 이월 요건).
            투명한 checkbox가 줄 전체를 덮어 어디를 눌러도 켜고 끈다(누르는 칸 44px 이상). */}
        <div className="rounded-xl border border-line px-4 py-3">
          <label className="relative flex min-h-12 cursor-pointer items-center gap-3 rounded-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-nong-600">
            <input
              type="checkbox"
              role="switch"
              aria-describedby="pe-consent-detail"
              className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
              {...register('is_matching_visible')}
            />
            <span className="min-w-0 flex-1 text-body font-bold text-ink">
              {t('profileEdit.matchingConsent')}
            </span>
            <SwitchVisual checked={consentOn} />
          </label>
          <p id="pe-consent-detail" className="mt-2 text-small text-ink-body">
            {t('profileEdit.matchingConsentDetail')}
          </p>
        </div>

        <div>
          {submitError ? (
            <p role="alert" className="mb-3 flex items-start gap-1.5 text-small text-danger">
              <Icon name="alert" size={18} className="mt-px shrink-0" />
              <span>{t(submitError)}</span>
            </p>
          ) : null}
          <Button
            type="submit"
            fullWidth
            disabled={profile === undefined}
            loading={isSubmitting}
            loadingLabel={t('state.saving')}
          >
            {t('profileEdit.save')}
          </Button>
          <SlowHint busy={isSubmitting} className="mt-2" />
          <Button
            variant="secondary"
            fullWidth
            className="mt-3"
            disabled={isSubmitting}
            onClick={() => leave()}
          >
            {t('profileEdit.cancel')}
          </Button>
        </div>
      </form>

      {/* 폼 밖에 둔다 — 창 안 버튼이 폼 제출·라벨 동작에 섞이지 않게 */}
      <CountrySheet
        open={countryOpen}
        onClose={() => setCountryOpen(false)}
        selected={pickedCountry ? pickedCountry.iso_code : null}
        onSelect={pickCountry}
        otherLabel={t('profileEdit.countryOther')}
        onOther={() => {
          stopLocaleFollow()
          setManualCountry(true)
          setCountryOpen(false)
        }}
        noneLabel={t('profileEdit.countryClear')}
        onNone={() => {
          stopLocaleFollow()
          applyCountry('')
        }}
      />
    </section>
  )
}
