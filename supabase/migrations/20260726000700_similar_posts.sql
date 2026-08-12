-- PRD v1.6 §1: 비슷한 게시물 (pgvector + 내장 gte-small 384차원)
-- 임베딩 생성은 Edge Function embed-post(무료 내장 모델 — UGC 외부 미전송, D-017 정합).

create extension if not exists vector;

alter table public.posts add column if not exists embedding vector(384);
comment on column public.posts.embedding is 'gte-small(384) 본문 임베딩. Edge Function embed-post가 생성. 외부 API 미사용.';

-- 유사 글 조회: source 글의 임베딩으로 published 글 검색.
-- SECURITY INVOKER(기본) — posts RLS(published or own)가 source·결과 모두에 적용된다.
-- 공개 글 5건 미만이면 빈 결과(PRD §1.5 품질 게이트: 데이터 부족 시 섹션 숨김).
create or replace function public.similar_posts(source_id uuid, match_count int default 3)
returns table (
  id uuid, title text, category text, region_id uuid, created_at timestamptz, similarity float
)
language sql
stable
as $$
  select p.id, p.title, p.category, p.region_id, p.created_at,
         1 - (p.embedding <=> s.embedding) as similarity
  from public.posts p
  cross join (select embedding from public.posts where id = source_id) s
  where s.embedding is not null
    and p.status = 'published'
    and p.embedding is not null
    and p.id <> source_id
    and (select count(*) from public.posts where status = 'published') >= 5
  order by p.embedding <=> s.embedding
  limit match_count;
$$;

revoke all on function public.similar_posts(uuid, int) from public;
grant execute on function public.similar_posts(uuid, int) to anon, authenticated;

-- 재검수 P2-a: search_path 고정(D-010 표준). ''가 아닌 이유: pgvector <=> 연산자가 public 소재.
alter function public.similar_posts(uuid, int) set search_path = public, pg_catalog;
