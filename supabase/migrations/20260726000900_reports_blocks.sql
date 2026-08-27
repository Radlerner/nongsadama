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
