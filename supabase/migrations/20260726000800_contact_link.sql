-- PRD v1.6 §2: 안전한 연락 연결 — 전화 비노출 메신저 링크, 별도 opt-in, 상호성 열람.
-- WhatsApp(전화 기반) 제외. 허용 도메인을 DB CHECK로 강제(클라이언트 검증과 이중).

alter table public.profiles
  add column if not exists messenger_link text
    check (
      messenger_link is null
      or (char_length(messenger_link) <= 200
          and messenger_link ~ '^https://(open\.kakao\.com|t\.me)/')
    ),
  add column if not exists is_contact_visible boolean not null default false;

comment on column public.profiles.messenger_link is '전화 비노출 메신저 링크(오픈카카오/텔레그램)만. opt-in+상호성 열람(v1.6 §2).';
comment on column public.profiles.is_contact_visible is '연락 링크 공개 동의(기본 false). is_matching_visible과 별도(D-012 과겸용 방지).';

-- 상호성: 열람자 본인도 링크를 등록하고 공개에 동의했는가.
-- (뷰 참조 함수는 호출자 권한 실행 — authenticated EXECUTE 필요, D-012 학습 반영)
create or replace function public.is_contact_opted_in()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_contact_visible = true and messenger_link is not null
  );
$$;
revoke execute on function public.is_contact_opted_in() from public, anon;
grant execute on function public.is_contact_opted_in() to authenticated;

-- 열람 뷰: 동의+링크 보유자 행만, 열람자도 동의자일 때만. anon 접근 불가.
-- D-012 필수 절차: revoke-then-grant(SELECT만) + security_barrier.
create or replace view public.contact_links as
  select id, messenger_link
  from public.profiles
  where is_contact_visible = true
    and messenger_link is not null
    and public.is_contact_opted_in();

revoke all on public.contact_links from public, anon, authenticated;
grant select on public.contact_links to authenticated;
alter view public.contact_links set (security_barrier = true);
