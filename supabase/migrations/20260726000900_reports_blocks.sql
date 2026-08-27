-- Play UGC 정책 대응(심사 준비 3순위, D-022): in-app 신고 + 사용자 차단.
-- 신고는 운영자(admin)만 열람, 차단은 본인 것만 CRUD. 차단 필터링은 클라이언트에서 적용.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id) -- 같은 글 중복 신고 방지
);
alter table public.reports enable row level security;

create policy reports_insert_self on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_select_admin on public.reports
  for select to authenticated
  using (public.is_admin());

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create policy blocks_all_self on public.blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

comment on table public.reports is '게시글 신고(운영자 검토용). 열람은 admin만(D-022).';
comment on table public.blocks is '사용자 차단(본인 것만). 게시글·이웃 노출에서 클라이언트 필터.';

-- 재검수 반영(P1-1b·P2-1): similar_posts author_id 추가는 20260726000700 함수를 대체하며
-- 라이브에는 moderation_hardening 마이그레이션으로 적용됨. reason은 코드값 4택 강제.
drop function if exists public.similar_posts(uuid, int);
create function public.similar_posts(source_id uuid, match_count int default 3)
returns table (
  id uuid, title text, category text, region_id uuid, author_id uuid,
  created_at timestamptz, similarity float
)
language sql
stable
as $$
  select p.id, p.title, p.category, p.region_id, p.author_id, p.created_at,
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
alter function public.similar_posts(uuid, int) set search_path = public, pg_catalog;

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam','abuse','scam','other'));
