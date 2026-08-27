// delete-account — 호출자 본인 계정을 영구 삭제(Google Play 계정 삭제 요건).
// 대상은 항상 JWT의 본인만(입력 바디 미사용 → 혼동 대리자 공격 불가).
// profiles·posts는 auth.users FK on delete cascade로 함께 삭제된다(initial_schema).
// 오류는 내부 원문을 노출하지 않고 일반 코드만 반환한다(재검수 P2-3·P2-4).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'unauthorized' }, 401)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
    if (delErr) {
      console.error('[delete-account] failed:', delErr.message)
      return json({ error: 'delete_failed' }, 500)
    }
    return json({ ok: true })
  } catch (e) {
    console.error('[delete-account] unexpected:', String(e))
    return json({ error: 'delete_failed' }, 500)
  }
})
