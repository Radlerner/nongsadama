import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { appConfig } from '../config/app'
import type { Tables } from '../types/database'

export type Country = Tables<'countries'>

async function fetchCountries(): Promise<Country[]> {
  // 공개 읽기(countries_select_all) — 비로그인 /select 에서도 읽힌다. 화면은 읽기만 한다.
  // retry(false): supabase-js 는 GET 네트워크 실패를 1·2·4초 간격으로 세 번 다시 시도한다. 여기에 React Query 의
  // 재시도까지 겹치면 오프라인에서 오류가 15초쯤 뒤에야 보인다. 창에는 "다시 시도" 버튼이 있으니 빨리 실패시킨다.
  const { data, error } = await getSupabaseClient().from('countries').select('*').retry(false)
  if (error) throw new Error(error.message)
  // 한국어 이름순(결정적 정렬 — DB 정렬 규칙에 기대지 않는다).
  return (data ?? []).sort((a, b) => a.name_ko.localeCompare(b.name_ko, appConfig.defaultLocale))
}

/**
 * 국가 목록(PRD v1.4 §3.2). 국가 추가는 DB 행 추가만으로 화면에 반영된다.
 * 정적 데이터라 1시간 캐시(useRegions 와 같은 방식). 실패하면 예외를 던지고 창 안에서 다시 시도를 보인다.
 *
 * networkMode 'always': 기본값('online')은 기기가 오프라인이면 요청을 "일시 정지"로 두어 불러오는 중도
 * 오류도 아닌 빈 창이 된다. 항상 시도해서 실패를 오류·다시 시도로 보여 준다.
 */
export function useCountries(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['countries'],
    queryFn: fetchCountries,
    staleTime: 60 * 60_000,
    networkMode: 'always',
    enabled: options.enabled ?? true,
  })
}
