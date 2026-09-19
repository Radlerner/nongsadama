
begin;

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'stt-a@test.local'),
  ('a2222222-2222-2222-2222-222222222222', 'stt-b@test.local');

insert into public.profiles (id, nickname, preferred_locale, country_code, role) values
  ('a1111111-1111-1111-1111-111111111111', 'A', 'ko', 'VN', 'user');

do $$
declare
  loc text;
  expl boolean;
begin
  select preferred_locale, preferred_locale_explicit into loc, expl
  from public.profiles where id = 'a1111111-1111-1111-1111-111111111111';
  if loc = 'ko' and expl = true then
    raise notice 'C1 OK: existing preferred_locale kept, explicit default true';
  else
    raise exception 'C1 FAIL: locale=% explicit=%', loc, expl;
  end if;
end $$;

update public.profiles
  set country_code = 'KR'
  where id = 'a1111111-1111-1111-1111-111111111111';

do $$
declare
  loc text;
begin
  select preferred_locale into loc
  from public.profiles where id = 'a1111111-1111-1111-1111-111111111111';
  if loc = 'ko' then
    raise notice 'C2 OK: country change did not overwrite explicit locale';
  else
    raise exception 'C2 FAIL: locale=% (expected ko)', loc;
  end if;
end $$;

insert into public.profiles (id, nickname, preferred_locale, country_code, role, preferred_locale_explicit)
values ('a2222222-2222-2222-2222-222222222222', 'B', 'ko', 'VN', 'user', false);

do $$
declare
  loc text;
  expl boolean;
begin
  select preferred_locale, preferred_locale_explicit into loc, expl
  from public.profiles where id = 'a2222222-2222-2222-2222-222222222222';
  if loc = 'vi' and expl = false then
    raise notice 'C3 OK: non-explicit insert applied VN default vi';
  else
    raise exception 'C3 FAIL: locale=% explicit=%', loc, expl;
  end if;
end $$;

update public.profiles
  set preferred_locale = 'en'
  where id = 'a2222222-2222-2222-2222-222222222222';

update public.profiles
  set country_code = 'TH'
  where id = 'a2222222-2222-2222-2222-222222222222';

do $$
declare
  loc text;
  expl boolean;
begin
  select preferred_locale, preferred_locale_explicit into loc, expl
  from public.profiles where id = 'a2222222-2222-2222-2222-222222222222';
  if loc = 'en' and expl = true then
    raise notice 'C4 OK: user-chosen locale survived later country change';
  else
    raise exception 'C4 FAIL: locale=% explicit=%', loc, expl;
  end if;
end $$;

do $$
declare
  n integer;
  def text;
  supported text[];
begin
  select count(*) into n from public.countries;
  if n = 7 then
    raise notice 'C5 OK: countries seed count 7';
  else
    raise exception 'C5 FAIL: count=%', n;
  end if;

  select default_locale, supported_locales into def, supported
  from public.countries where iso_code = 'KR';
  if def = 'ko' and supported @> array['ko', 'en'] then
    raise notice 'C6 OK: KR default ko';
  else
    raise exception 'C6 FAIL: KR default=%', def;
  end if;

  select default_locale, supported_locales into def, supported
  from public.countries where iso_code = 'UZ';
  if def = 'uz' and supported @> array['uz', 'ru', 'en'] then
    raise notice 'C7 OK: UZ default uz plus ru,en';
  else
    raise exception 'C7 FAIL: UZ default=% supported=%', def, supported;
  end if;
end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$ begin
  assert (select count(*) = 7 from public.countries), 'Anonymous country read';
end $$;

do $$ begin
  insert into public.countries (iso_code, name_ko, name_native, default_locale, supported_locales)
    values ('XX', 'x', 'x', 'en', array['en']);
  raise exception 'C9 FAIL: anon insert countries succeeded';
exception when insufficient_privilege then
  raise notice 'C9 OK: anon countries write denied (%)', sqlerrm;
end $$;

do $$ begin
  perform 1 from public.stt_rate_windows;
  raise exception 'S1 FAIL: anon read stt_rate_windows succeeded';
exception when insufficient_privilege then
  raise notice 'S1 OK: anon stt_rate_windows denied (%)', sqlerrm;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$ begin
  perform public.stt_try_consume('a1111111-1111-1111-1111-111111111111', 2, 60);
  raise exception 'S2 FAIL: authenticated execute stt_try_consume succeeded';
exception when insufficient_privilege then
  raise notice 'S2 OK: authenticated stt_try_consume denied (%)', sqlerrm;
end $$;
reset role;

do $$
declare
  r1 jsonb;
  r2 jsonb;
  r3 jsonb;
begin
  r1 := public.stt_try_consume('a1111111-1111-1111-1111-111111111111', 2, 3600);
  r2 := public.stt_try_consume('a1111111-1111-1111-1111-111111111111', 2, 3600);
  r3 := public.stt_try_consume('a1111111-1111-1111-1111-111111111111', 2, 3600);
  if (r1->>'allowed')::boolean = true
     and (r2->>'allowed')::boolean = true
     and (r3->>'allowed')::boolean = false then
    raise notice 'S3 OK: rate limit allows 2 then denies';
  else
    raise exception 'S3 FAIL: r1=% r2=% r3=%', r1, r2, r3;
  end if;
end $$;

insert into auth.users (id) values
  ('a3333333-3333-3333-3333-333333333333'),
  ('a4444444-4444-4444-4444-444444444444');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.profiles (id, nickname, country_code)
values ('a3333333-3333-3333-3333-333333333333', 'C', 'VN');
do $$ begin
  assert (select preferred_locale = 'vi' and not preferred_locale_explicit
          from public.profiles where id = auth.uid()), 'Country default on locale omission';
  assert (select count(*) = 1 from public.profiles), 'Profiles must remain self-only';
  assert (select count(*) = 0 from public.neighbor_profiles), 'No consent must hide neighbors';
  assert (select country_code is null from public.public_profiles where id = auth.uid()), 'No consent must hide country';
  assert (select count(*) = 7 from public.countries), 'Authenticated country read';
end $$;
update public.profiles set country_code = 'TH' where id = auth.uid();
do $$ begin
  assert (select preferred_locale = 'th' and not preferred_locale_explicit
          from public.profiles where id = auth.uid()), 'Automatic locale follows country without becoming explicit';
end $$;
update public.profiles set preferred_locale_explicit = true where id = auth.uid();
update public.profiles set country_code = 'UZ' where id = auth.uid();
do $$ begin
  assert (select preferred_locale = 'th' from public.profiles where id = auth.uid()), 'Explicit same-value choice survives country change';
end $$;
do $$ begin
  update public.countries set default_locale = 'en' where iso_code = 'KR';
  raise exception 'Authenticated country write must fail';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.stt_rate_windows values (auth.uid(), now(), 0);
  raise exception 'Authenticated quota write must fail';
exception when insufficient_privilege then null;
end $$;
reset role;
set local request.jwt.claims = '{}';
insert into public.profiles (id, nickname)
values ('a4444444-4444-4444-4444-444444444444', 'D');
do $$ begin
  assert (select preferred_locale = 'en' and not preferred_locale_explicit
          from public.profiles where id = 'a4444444-4444-4444-4444-444444444444'), 'No country defaults to English';
  assert not exists (
    select 1 from (values
      ('KR', 'ko', array['ko','en']), ('VN', 'vi', array['vi','en']),
      ('KH', 'km', array['km','en']), ('TH', 'th', array['th','en']),
      ('NP', 'ne', array['ne','en']), ('MN', 'mn', array['mn','en']),
      ('UZ', 'uz', array['uz','ru','en'])
    ) as expected(code, locale, supported)
    left join public.countries c on c.iso_code = expected.code
    where c.iso_code is null or c.default_locale <> expected.locale or c.supported_locales <> expected.supported
  ), 'All required country values must match';
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('public_profiles', 'neighbor_profiles')
      and column_name in ('preferred_locale_explicit', 'auth_provider', 'role')
  ), 'Views must not expose private fields';
end $$;
set local role service_role;
do $$ begin
  assert (public.stt_try_consume('a3333333-3333-3333-3333-333333333333', 2, 3600)->>'allowed')::boolean,
    'Service role can consume a separate user quota';
end $$;
reset role;

insert into public.regions (id, names, level) values
  ('b1111111-1111-1111-1111-111111111111', '{"en":"Region A"}', 'city'),
  ('b2222222-2222-2222-2222-222222222222', '{"en":"Region B"}', 'city');
update public.profiles set is_matching_visible = true,
  region_id = 'b1111111-1111-1111-1111-111111111111'
where id in ('a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222');
update public.profiles set is_matching_visible = true,
  region_id = 'b2222222-2222-2222-2222-222222222222'
where id = 'a3333333-3333-3333-3333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin
  assert (select count(*) = 2 from public.neighbor_profiles), 'Only same-region consenting neighbors';
  assert not exists (select 1 from public.neighbor_profiles
    where id in ('a3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444')),
    'Other-region and nonconsenting profiles stay hidden';
end $$;
reset role;
set local role anon;
do $$ begin
  perform 1 from public.neighbor_profiles;
  raise exception 'Anonymous neighbor read must fail';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$ begin
  assert not has_table_privilege('anon', 'public.countries', 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'Anonymous country mutations must be denied';
  assert not has_table_privilege('authenticated', 'public.countries', 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'Authenticated country mutations must be denied';
  assert not has_table_privilege('anon', 'public.stt_rate_windows', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
    'Anonymous quota access must be denied';
  assert not has_table_privilege('authenticated', 'public.stt_rate_windows', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
    'Authenticated quota access must be denied';
  assert not has_function_privilege('anon', 'public.stt_try_consume(uuid,integer,integer)', 'EXECUTE'),
    'Anonymous quota RPC access must be denied';
  assert not has_function_privilege('authenticated', 'public.stt_try_consume(uuid,integer,integer)', 'EXECUTE'),
    'Authenticated quota RPC access must be denied';
end $$;
rollback;
