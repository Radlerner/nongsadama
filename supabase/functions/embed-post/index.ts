// embed-post — 글 제목+본문을 임베딩해 posts.embedding / posts.embedding_model 에 저장.
// 호출: 로그인 사용자(verify_jwt). 입력 post_id의 글 내용으로만 재계산하므로 임의 호출돼도 무해(멱등).
//
// 모델 선택(v1.2, D-034):
// - Supabase secret OPENAI_API_KEY 가 있으면 OpenAI text-embedding-3-small(dimensions=384, 다국어 의미 임베딩)
// - 없으면 Supabase 내장 gte-small(384, 무료·외부 미전송 — v1.1까지의 기본).
// 어느 모델로 만들었는지 embedding_model 에 기록하고, similar_posts RPC는 같은 모델끼리만 비교한다.
// OpenAI 호출이 실패하면 gte-small로 조용히 대체하지 않고 502를 돌려준다(벡터 미저장 → 다음 수정 때 재시도).
// 모델을 바꾼 뒤에는 기존 글을 다시 임베딩해야 한다(docs/prd/PRD_v1.2.md §재임베딩).
// 키는 코드·저장소에 두지 않는다 — Supabase 대시보드 Edge Function secrets 에만.
import { createClient } from 'jsr:@supabase/supabase-js@2'

declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts?: Record<string, unknown>): Promise<number[]> } }
}

const OPENAI_MODEL = 'text-embedding-3-small'
const DIMS = 384
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

let gteSession: { run(input: string, opts?: Record<string, unknown>): Promise<number[]> } | null = null

async function embed(text: string): Promise<{ vector: number[]; model: string }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (openaiKey) {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_MODEL, input: text, dimensions: DIMS }),
    })
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 200)
      throw new Error(`openai ${r.status}: ${detail}`)
    }
    const d = await r.json()
    const vector = d?.data?.[0]?.embedding
    if (!Array.isArray(vector) || vector.length !== DIMS) throw new Error('openai: unexpected embedding shape')
    return { vector, model: `openai:${OPENAI_MODEL}` }
  }
  gteSession ??= new Supabase.ai.Session('gte-small')
  const vector = await gteSession.run(text, { mean_pool: true, normalize: true })
  return { vector, model: 'gte-small' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { post_id } = await req.json()
    if (typeof post_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(post_id)) {
      return json({ error: 'invalid post_id' }, 400)
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: post, error } = await supabase
      .from('posts').select('id,title,body').eq('id', post_id).maybeSingle()
    if (error || !post) return json({ error: 'post not found' }, 404)

    const text = `${post.title}\n${post.body}`.slice(0, 4000)
    let embedded: { vector: number[]; model: string }
    try {
      embedded = await embed(text)
    } catch (e) {
      // 외부 모델 실패 시 대체 모델로 섞어 저장하지 않는다(모델 간 벡터 비교 금지, D-034).
      console.error('[embed-post] embedding failed:', String(e))
      return json({ error: 'embedding_failed' }, 502)
    }
    const { error: upErr } = await supabase
      .from('posts')
      .update({ embedding: JSON.stringify(embedded.vector), embedding_model: embedded.model })
      .eq('id', post_id)
    if (upErr) return json({ error: upErr.message }, 500)
    return json({ ok: true, dims: embedded.vector.length, model: embedded.model })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
