-- 재검수 P1-2: 이웃 목록을 "같은 시/군"으로 한정 (PRD v1.4 §2.1)
-- 기존 뷰는 지역 조건이 없어 다지역 확장 시 동의 고지("같은 지역")보다 넓게 노출될 위험.
-- 열람자 프로필 지역의 시/군과 대상의 시/군이 같을 때만 행을 반환한다.
-- (지역 미설정 열람자/대상은 매칭에서 제외 — 프라이버시 보수적 기본값)
--
-- D-012 규칙: 뷰 재생성 시 revoke-then-grant(SELECT만) + security_barrier 를 반드시 반복한다.

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
        and coalesce(vr.parent_id, vr.id) = coalesce(tr.parent_id, tr.id)
    );

alter view public.neighbor_profiles set (security_barrier = true);
revoke all on public.neighbor_profiles from public, anon, authenticated;
grant select on public.neighbor_profiles to authenticated;
