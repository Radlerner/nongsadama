import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 환경변수(공개 anon 값)가 모두 설정되어 있는지 여부. */
export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient<Database> | null = null

/**
 * Supabase 클라이언트를 지연 생성한다.
 * - anon 키만 사용한다. service_role 키는 브라우저/저장소에 절대 두지 않는다(PRD 7.3).
 * - 환경변수가 없으면 조용히 넘어가지 않고 명확한 오류를 던진다.
 *   (호출 시점에만 실패하므로, 아직 데이터를 읽지 않는 화면은 정상 동작한다.)
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase 환경변수가 없습니다. .env.local 에 VITE_SUPABASE_URL 과 ' +
        'VITE_SUPABASE_ANON_KEY 를 설정하세요. (.env.example 참고)',
    )
  }
  if (!client) {
    client = createClient<Database>(url as string, anonKey as string)
  }
  return client
}
