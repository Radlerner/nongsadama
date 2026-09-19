-- 국가 기준 기본 언어. UI 번역 파일을 만들지 않는다. 언어 코드만 저장한다.
-- preferred_locale 은 NOT NULL 이라 "미선택"을 NULL 로 표현할 수 없다.
-- preferred_locale_explicit 기본 true: 기존 행은 이미 값이 있으므로 국적 변경으로 덮지 않는다.
-- 후속 클라이언트가 explicit=false 로 넣거나 바꾸면 그 국가의 default_locale 을 적용한다.
-- public_profiles / neighbor_profiles 는 재생성하지 않는다(노출 컬럼 유지).

alter table public.profiles
  add column if not exists preferred_locale_explicit boolean not null default true;

comment on column public.profiles.preferred_locale_explicit is
  'true=사용자가 고른 언어(또는 기존 행). false=국적 기본 언어를 채워도 됨. 국적만 바꾼다고 true 행의 preferred_locale 을 덮지 않는다.';

create table if not exists public.countries (
  iso_code text primary key check (iso_code ~ '^[A-Z]{2}$'),
  name_ko text not null check (char_length(name_ko) between 1 and 80),
  name_native text not null check (char_length(name_native) between 1 and 80),
  default_locale text not null check (char_length(default_locale) between 2 and 35),
  supported_locales text[] not null check (cardinality(supported_locales) >= 1),
  check (default_locale = any (supported_locales))
);

insert into public.countries (iso_code, name_ko, name_native, default_locale, supported_locales) values
  ('KR', '대한민국', '대한민국', 'ko', array['ko', 'en']),
  ('VN', '베트남', 'Việt Nam', 'vi', array['vi', 'en']),
  ('KH', '캄보디아', 'កម្ពុជា', 'km', array['km', 'en']),
  ('TH', '태국', 'ไทย', 'th', array['th', 'en']),
  ('NP', '네팔', 'नेपाल', 'ne', array['ne', 'en']),
  ('MN', '몽골', 'Монгол Улс', 'mn', array['mn', 'en']),
  ('UZ', '우즈베키스탄', E'O\u02BBzbekiston', 'uz', array['uz', 'ru', 'en'])
on conflict (iso_code) do nothing;

alter table public.countries enable row level security;
revoke all on public.countries from public, anon, authenticated;
grant select on public.countries to anon, authenticated;

drop policy if exists countries_select_all on public.countries;
create policy countries_select_all on public.countries
  for select to anon, authenticated
  using (true);

create or replace function public.apply_country_default_locale()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  def text;
begin
  if TG_OP = 'UPDATE'
     and new.preferred_locale is distinct from old.preferred_locale
     and new.preferred_locale_explicit is not distinct from old.preferred_locale_explicit then
    new.preferred_locale_explicit := true;
  end if;

  if new.preferred_locale_explicit is false and new.country_code is not null then
    if TG_OP = 'INSERT'
       or new.country_code is distinct from old.country_code
       or new.preferred_locale_explicit is distinct from old.preferred_locale_explicit then
      select c.default_locale into def
      from public.countries c
      where c.iso_code = upper(btrim(new.country_code));
      if def is not null then
        new.preferred_locale := def;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_apply_country_locale on public.profiles;
create trigger profiles_apply_country_locale
before insert or update on public.profiles
for each row execute function public.apply_country_default_locale();

revoke all on function public.apply_country_default_locale() from public, anon, authenticated;

comment on table public.countries is
  '국가 기준 기본 언어. 공개 읽기, 쓰기는 서비스 역할/대시보드만. 국적 인증이 아니다.';
