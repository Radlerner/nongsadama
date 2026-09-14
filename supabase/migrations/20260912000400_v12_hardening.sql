-- v1.2 하드닝 — 독립 재검수 확정 5건 반영(2026-09-12/13, D-034·D-035·D-037 보강)
--
-- 1) [P0→하드닝] text_bigrams 자원 고갈: 공백 없는 긴 입력에서 words × generate_series 정렬 튜플에 원문 w가 실려
--    임시파일이 O(N²)로 커졌고(라이브 EXPLAIN: 5000자 무공백 → temp 144MB), public 스키마라 PostgREST로 anon이
--    /rest/v1/rpc/text_bigrams 를 직접 호출할 수 있었다. 대책: 입력 1500자·단어 2~40자 상한, 바이그램만 프로젝션한
--    DISTINCT, 헬퍼를 PostgREST 미노출 스키마 private 로 이동(similar_posts 만 호출), 원문 바이그램은 1회 계산.
-- 2) [P1] neighbor_profiles 뷰 범위: 키가 coalesce(parent_id,id)라 v1.2 데이터(시·군·구.parent_id=시·도)에서
--    "같은 시/군" 고지보다 넓은 "같은 시/도"로 매칭됐다. 키를 단계 기반(읍·면→부모 시·군·구, 시·군·구→자기)으로.
-- 3) [P1] life_info 전화에 다이얼 불가 문자('~' 범위, '(대표)', 지역번호+전국대표번호) 4건 정정, 시·군 없는 주소 11건 보정,
--    보령중앙시장 장날 오독 제거, 민간 병원 4건 '민간' 명시.
--
-- 롤백: 1) 20260912000000 파일의 public 헬퍼·similar_posts 재생성 후 private 함수 drop; 2) 20260726000400 뷰 정의로 재생성;
--       3) 데이터 정정은 되돌릴 필요 없음(정확성 개선).

-- ── 1) 헬퍼를 private 스키마로, 입력 상한 ──────────────────────────────────────────
create schema if not exists private;
revoke create on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.text_bigrams(t text)
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  with words as (
    select w
    from regexp_split_to_table(
           regexp_replace(lower(left(coalesce(t, ''), 1500)), '[^0-9a-z가-힣\s]', ' ', 'g'),
           '\s+') as w
    where length(w) between 2 and 40
      and w <> all (array[
        '하실','구해요','아시는','어디','어떻게','해야','하나요','인데','에서','합니다','습니다','해요','세요',
        '주세요','드려요','있어요','싶어요','있는','같이','오늘','이번','저는','정보','추천','부탁드려요',
        '알려주세요','아시나요','궁금해요','있나요','좋아요','있을까요','알려','주실'
      ])
  ),
  grams as (
    select distinct substr(words.w, i, 2) as g
    from words cross join lateral generate_series(1, length(words.w) - 1) as i
  )
  select coalesce(array_agg(g), '{}'::text[]) from grams;
$$;

create or replace function private.bigram_jaccard(a text[], b text[])
returns double precision
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when a is null or b is null or cardinality(a) = 0 or cardinality(b) = 0 then 0::double precision
    else (select count(*) from unnest(a) u where u = any(b))::double precision
         / (cardinality(a) + cardinality(b) - (select count(*) from unnest(a) u where u = any(b)))
  end;
$$;

revoke all on function private.text_bigrams(text) from public;
revoke all on function private.bigram_jaccard(text[], text[]) from public;
grant execute on function private.text_bigrams(text) to anon, authenticated;
grant execute on function private.bigram_jaccard(text[], text[]) to anon, authenticated;

drop function if exists public.bigram_jaccard(text, text);
drop function if exists public.text_bigrams(text);

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
  with s as materialized (
    select embedding,
           coalesce(embedding_model, 'gte-small') as model,
           private.text_bigrams(title || ' ' || body) as grams
    from public.posts
    where id = source_id
  ),
  cand as (
    select p.id, p.title, p.category, p.region_id, p.author_id, p.created_at, p.body,
           1 - (p.embedding <=> s.embedding) as similarity,
           s.model, s.grams as s_grams
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
           private.bigram_jaccard(c.s_grams, private.text_bigrams(c.title || ' ' || c.body)) as lexical
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
  '연관 글: 같은 임베딩 모델끼리 코사인 상위 20 → 관련성 게이트(gte-small: 코사인≥0.92 AND 바이그램≥0.02 / openai: 코사인≥0.45) → 상위 match_count. 후보 없으면 빈 결과(D-034). 어휘 헬퍼는 private 스키마(입력 1500자 상한).';

-- ── 2) 이웃 뷰 범위 키를 단계 기반으로(D-012 절차: drop → create → barrier → revoke/grant) ──
drop view if exists public.neighbor_profiles;
create view public.neighbor_profiles as
  select
    p.id,
    p.nickname,
    p.region_id,
    p.country_code,
    p.crop_type,
    p.preferred_locale
  from public.profiles p
  where p.is_matching_visible = true
    and public.is_matching_opted_in()
    and exists (
      select 1
      from public.profiles me
      join public.regions vr on vr.id = me.region_id
      join public.regions tr on tr.id = p.region_id
      where me.id = auth.uid()
        and (case when vr.level = 'town' then vr.parent_id else vr.id end)
          = (case when tr.level = 'town' then tr.parent_id else tr.id end)
    );
alter view public.neighbor_profiles set (security_barrier = true);
revoke all on public.neighbor_profiles from public, anon, authenticated;
grant select on public.neighbor_profiles to authenticated;
comment on view public.neighbor_profiles is
  '이웃 목록(상호 동의자, 같은 시·군·구). v1.2: 키를 단계 기반으로 — 읍·면은 부모 시·군·구, 시·군·구는 자기 자신(시·도가 부모가 되어도 범위가 넓어지지 않음).';

-- ── 3) life_info 데이터 정정(2026-09-12 수록분) ───────────────────────────────────────
update public.life_info set phone = '1544-7788'   where verified_at = '2026-09-12' and phone = '1544-7788(대표)';
update public.life_info set phone = '1577-8653'   where verified_at = '2026-09-12' and phone = '041-1577-8653';
update public.life_info set phone = '041-746-8011' where verified_at = '2026-09-12' and phone = '041-746-8011~5';
update public.life_info set phone = '041-751-6625' where verified_at = '2026-09-12' and phone = '041-751-6625~6';

update public.life_info set address = '충남 보령시 옥마로 42' where verified_at = '2026-09-12' and address like '(우:33482)%';
update public.life_info set address = '충남 ' || address where verified_at = '2026-09-12' and address ~ '^(금산군|아산시|서산시|논산시)';
update public.life_info set address = '충남 청양군 ' || address where verified_at = '2026-09-12' and address ~ '^(청양읍|정산면)';
update public.life_info set address = '충남 태안군 ' || address where verified_at = '2026-09-12' and address ~ '^태안읍';

update public.life_info
set localized_content = jsonb_set(jsonb_set(localized_content,
      '{ko,description}', to_jsonb('해산물·건어물·채소·의류·제수용품 등을 파는 보령의 대표 전통시장입니다.'::text)),
      '{en,description}', to_jsonb('Boryeong''s main traditional market selling seafood, dried fish, vegetables, clothing and ritual goods.'::text))
where verified_at = '2026-09-12' and localized_content->'ko'->>'name' = '보령중앙시장';

update public.life_info
set localized_content = jsonb_set(jsonb_set(localized_content,
      '{ko,description}', to_jsonb('민간 병원으로, 아산시보건소 응급의료기관 안내에 ''지역응급의료센터''로 기재되어 있으며 응급실을 운영합니다.'::text)),
      '{en,description}', to_jsonb('Private hospital listed by the Asan Public Health Center as a designated Regional Emergency Medical Center with an emergency room.'::text))
where verified_at = '2026-09-12' and localized_content->'ko'->>'name' = '아산충무병원';

update public.life_info
set localized_content = jsonb_set(jsonb_set(localized_content,
      '{ko,description}', to_jsonb('민간 병원(아산사회복지재단)으로 지역응급의료센터로 지정되어 응급실을 연중무휴 24시간 운영하며 내과·외과·소아청소년과·산부인과·정형외과 등 당직전문의를 둡니다.'::text)),
      '{en,description}', to_jsonb('Private hospital (Asan Foundation) designated as a regional emergency medical center, with an emergency room open 24 hours year-round and on-call specialists in internal medicine, surgery, pediatrics, OB/GYN, orthopedics and more.'::text))
where verified_at = '2026-09-12' and localized_content->'ko'->>'name' = '보령아산병원';

update public.life_info
set localized_content = jsonb_set(jsonb_set(localized_content,
      '{ko,description}', to_jsonb('민간 대학병원으로, 부여보건소 병원현황 기준 부여군 관내 유일한 종합병원이며 응급실을 운영합니다.'::text)),
      '{en,description}', to_jsonb('Private university hospital; the only general hospital in Buyeo-gun per the county health center listing, with an emergency room.'::text))
where verified_at = '2026-09-12' and localized_content->'ko'->>'name' = '건양대학교 부여병원';

update public.life_info
set localized_content = jsonb_set(jsonb_set(localized_content,
      '{ko,description}', to_jsonb('민간 의료법인 종합병원(내과·외과·정형외과·산부인과·소아청소년과·응급의학과 등)으로, 홈페이지에 24시간 응급센터 운영을 안내합니다.'::text)),
      '{en,description}', to_jsonb('Private general hospital (medical foundation) with internal medicine, surgery, orthopedics, OB/GYN, pediatrics and emergency medicine; its website states the emergency center operates 24 hours.'::text))
where verified_at = '2026-09-12' and localized_content->'ko'->>'name' = '백제종합병원 (의료법인 백제병원)';
