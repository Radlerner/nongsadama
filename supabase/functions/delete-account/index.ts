// delete-account — 호출자 본인 계정을 영구 삭제(Google Play 계정 삭제 요건).
// 대상은 항상 JWT의 본인만(입력 바디 미사용 → 혼동 대리자 공격 불가).
// profiles·posts는 auth.users FK on delete cascade로 함께 삭제된다(initial_schema).
// 게시글 사진(D-044, Storage post-images/<사용자 id>/…)은 FK로 지워지지 않으므로 먼저 폴더를 비운다 —
// 비우지 못하면 계정을 지우지 않고 오류를 돌려준다(사진만 남는 일이 없게, 이용자는 다시 시도).
// 오류는 내부 원문을 노출하지 않고 일반 코드만 반환한다(재검수 P2-3·P2-4).
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const POST_IMAGES_BUCKET = 'post-images'

async function removeUserImages(admin: SupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(POST_IMAGES_BUCKET)
  // 한 번에 최대 1000개씩. 글 하나에 사진 3장 × 2파일이라 보통 한두 번이면 끝난다(무한 반복 방지로 100번까지).
  for (let round = 0; round < 100; round++) {
    const { data, error } = await bucket.list(userId, { limit: 1000 })
    if (error) {
      // 버킷이 아직 없으면(마이그레이션 전) 지울 사진도 없다
      if (/not.?found/i.test(error.message)) return
      throw new Error(`list: ${error.message}`)
    }
    const names = (data ?? []).filter((o) => o.id).map((o) => `${userId}/${o.name}`)
    if (names.length === 0) return
    const { error: rmErr } = await bucket.remove(names)
    if (rmErr) throw new Error(`remove: ${rmErr.message}`)
  }
  throw new Error('remove: too many files')
}

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
    try {
      await removeUserImages(admin, userData.user.id)
    } catch (e) {
      console.error('[delete-account] images failed:', String(e))
      return json({ error: 'delete_failed' }, 500)
    }
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
