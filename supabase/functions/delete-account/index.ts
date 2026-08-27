// delete-account — 호출자 본인 계정을 영구 삭제(Google Play 계정 삭제 요건).
// 대상은 항상 JWT의 본인만(입력 바디 미사용 → 혼동 대리자 공격 불가).
// profiles·posts는 auth.users FK on delete cascade로 함께 삭제된다(initial_schema).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: cors })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
