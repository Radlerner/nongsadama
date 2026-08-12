// embed-post — 글 본문을 Supabase 내장 gte-small(384)로 임베딩해 posts.embedding에 저장.
// 외부 API 미사용(무료·UGC 외부 미전송, PRD v1.6 §1.2-A). 호출: 로그인 사용자(verify_jwt).
// 입력 post_id의 글 내용으로만 재계산하므로 임의 호출돼도 무해(멱등).
import { createClient } from 'jsr:@supabase/supabase-js@2'

declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts?: Record<string, unknown>): Promise<number[]> } }
}

const session = new Supabase.ai.Session('gte-small')
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { post_id } = await req.json()
    if (typeof post_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(post_id)) {
      return new Response(JSON.stringify({ error: 'invalid post_id' }), { status: 400, headers: cors })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: post, error } = await supabase
      .from('posts').select('id,title,body').eq('id', post_id).maybeSingle()
    if (error || !post) {
      return new Response(JSON.stringify({ error: 'post not found' }), { status: 404, headers: cors })
    }
    const text = `${post.title}\n${post.body}`.slice(0, 4000)
    const embedding = await session.run(text, { mean_pool: true, normalize: true })
    const { error: upErr } = await supabase
      .from('posts').update({ embedding: JSON.stringify(embedding) }).eq('id', post_id)
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: cors })
    }
    return new Response(JSON.stringify({ ok: true, dims: embedding.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
