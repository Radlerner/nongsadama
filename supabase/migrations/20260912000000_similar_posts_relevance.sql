-- v1.2 (D-034): 연관 글(similar_posts) 관련성 게이트 + 임베딩 모델 표시
--
-- 진단(2026-09-12, 라이브 측정): 임베딩은 OpenAI가 아니라 Supabase 내장 gte-small(384)이며 한국어 글끼리
-- 코사인이 0.85~0.95에 몰려 변별력이 없다("몸이 아파요 병원 추천"의 1위가 "일요일 풋살 멤버 구해요" 0.949,
-- 실제 관련 글 "읍내 내과"는 0.928). 기존 RPC는 임계값 없이 상위 3건을 무조건 반환해 무관한 글이 항상 노출됐다.
--
-- 대책:
-- 1) posts.embedding_model — 어떤 모델로 만든 벡터인지 기록(null=v1.1 이전 gte-small). 서로 다른 모델의 벡터는
--    비교하지 않는다(OpenAI 키를 넣어 모델을 바꿔도 섞이지 않음).
-- 2) 어휘 근거 — 문자 바이그램 자카드(한글·영숫자, 조사·상투어 제외)를 확장 없이 SQL로 계산(pg_trgm 미설치).
-- 3) 게이트 — gte-small: 코사인 ≥ 0.92 AND 어휘 ≥ 0.02(라이브 10건 코퍼스에서 "몸이 아파요→읍내 내과",
--    "풋살→축구"만 남기고 무관 쌍은 전부 제외됨을 확인). OpenAI(text-embedding-3-small, 384차원): 코사인 ≥ 0.45.
--    후보가 없으면 빈 결과(클라이언트는 "비슷한 글이 없어요" 빈 상태). 억지 추천 없음.
--
-- 롤백: 20260726000900_reports_blocks.sql의 similar_posts 정의로 되돌리고 두 헬퍼를 drop. embedding_model 컬럼은
--       남겨도 무해(null 허용).

alter table public.posts add column if not exists embedding_model text;
comment on column public.posts.embedding_model is
  '임베딩 생성 모델: gte-small | openai:text-embedding-3-small. null은 v1.1 이전(gte-small)으로 취급.';

-- 문자 바이그램(한글·영숫자 단어별, 2자 이상, 상투어 제외)
create or replace function public.text_bigrams(t text)
returns text[]
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  with words as (
    select w
    from regexp_split_to_table(regexp_replace(lower(coalesce(t, '')), '[^0-9a-z가-힣\s]', ' ', 'g'), '\s+') as w
    where length(w) >= 2
      and w <> all (array[
        '하실','구해요','아시는','어디','어떻게','해야','하나요','인데','에서','합니다','습니다','해요','세요',
        '주세요','드려요','있어요','싶어요','있는','같이','오늘','이번','저는','정보','추천','부탁드려요',
        '알려주세요','아시나요','궁금해요','있나요','좋아요','있을까요','알려','주실','분','분?'
      ])
  )
  select coalesce(array_agg(distinct substr(w, i, 2)), '{}'::text[])
  from words, generate_series(1, length(w) - 1) as i;
$$;

create or replace function public.bigram_jaccard(a text, b text)
returns double precision
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  with x as (select public.text_bigrams(a) as g),
       y as (select public.text_bigrams(b) as g),
       i as (select count(*)::double precision as n from x, unnest(x.g) u, y where u = any(y.g))
  select case
    when cardinality(x.g) = 0 or cardinality(y.g) = 0 then 0::double precision
    else i.n / (cardinality(x.g) + cardinality(y.g) - i.n)
  end
  from x, y, i;
$$;

revoke all on function public.text_bigrams(text) from public;
revoke all on function public.bigram_jaccard(text, text) from public;
grant execute on function public.text_bigrams(text) to anon, authenticated;
grant execute on function public.bigram_jaccard(text, text) to anon, authenticated;

drop function if exists public.similar_posts(uuid, int);
create or replace function public.similar_posts(source_id uuid, match_count int default 3)
returns table (
  id uuid,
  title text,
  category text,
  region_id uuid,
  author_id uuid,
  created_at timestamptz,
  similarity double precision,
  lexical double precision
)
language sql
stable
set search_path = public, pg_catalog
as $$
  with s as (
    select embedding, title, body, coalesce(embedding_model, 'gte-small') as model
    from public.posts
    where id = source_id
  ),
  cand as (
    select p.id, p.title, p.category, p.region_id, p.author_id, p.created_at, p.body,
           1 - (p.embedding <=> s.embedding) as similarity,
           s.model, s.title as s_title, s.body as s_body
    from public.posts p
    cross join s
    where s.embedding is not null
      and p.status = 'published'
      and p.embedding is not null
      and p.id <> source_id
      and coalesce(p.embedding_model, 'gte-small') = s.model
      and (select count(*) from public.posts where status = 'published') >= 5
    order by p.embedding <=> s.embedding
    limit 20
  ),
  scored as (
    select c.*,
           public.bigram_jaccard(c.s_title || ' ' || c.s_body, c.title || ' ' || c.body) as lexical
    from cand c
  )
  select id, title, category, region_id, author_id, created_at, similarity, lexical
  from scored
  where case
    when model = 'gte-small' then similarity >= 0.92 and lexical >= 0.02
    else similarity >= 0.45
  end
  order by similarity desc
  limit match_count;
$$;
revoke all on function public.similar_posts(uuid, int) from public;
grant execute on function public.similar_posts(uuid, int) to anon, authenticated;
comment on function public.similar_posts(uuid, int) is
  '연관 글: 같은 임베딩 모델끼리 코사인 상위 20 → 관련성 게이트(gte-small: 코사인≥0.92 AND 바이그램≥0.02 / openai: 코사인≥0.45) → 상위 match_count. 후보 없으면 빈 결과(D-034).';
