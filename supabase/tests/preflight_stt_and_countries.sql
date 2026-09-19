begin read only;
set local statement_timeout = '15s';

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.public_profiles') is null
     or to_regclass('public.neighbor_profiles') is null then
    raise exception 'Required profile objects are missing';
  end if;

  if to_regclass('public.countries') is not null
     or to_regclass('public.stt_rate_windows') is not null
     or exists (
       select 1 from pg_attribute
       where attrelid = 'public.profiles'::regclass
         and attname = 'preferred_locale_explicit' and not attisdropped
     )
     or exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('stt_try_consume', 'apply_country_default_locale')
     )
     or exists (
       select 1 from pg_trigger
       where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_apply_country_locale'
     ) then
    raise exception 'New objects already exist; review partial application before proceeding';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.profiles'::regclass and attname = 'preferred_locale'
      and atttypid = 'text'::regtype and attnotnull and not attisdropped
  ) then
    raise exception 'Unexpected preferred_locale schema';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass)
     or has_table_privilege('anon', 'public.profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Unexpected profile RLS or privileges';
  end if;

  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'Untrusted roles can create objects in public';
  end if;

  if not exists (
    select 1 from pg_class where oid = 'public.public_profiles'::regclass
      and reloptions @> array['security_barrier=true']
  ) or not exists (
    select 1 from pg_class where oid = 'public.neighbor_profiles'::regclass
      and reloptions @> array['security_barrier=true']
  ) or has_table_privilege('anon', 'public.neighbor_profiles', 'SELECT') then
    raise exception 'Unexpected profile view protection';
  end if;
end;
$$;

select 'ready_for_schema_review' as status,
  (select count(*) from public.profiles) as existing_profiles,
  (select count(*) from pg_stat_activity
   where datname = current_database() and pid <> pg_backend_pid()
     and xact_start < now() - interval '1 minute') as long_running_transactions;

rollback;
