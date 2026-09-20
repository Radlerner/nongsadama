begin;

insert into public.map_config (kakao_javascript_key)
values ('0123456789abcdef0123456789abcdef');

set local role anon;
do $$ begin
  assert (select kakao_javascript_key = '0123456789abcdef0123456789abcdef'
          from public.map_config where id), 'Anonymous map config read';
end $$;
do $$ begin
  update public.map_config set kakao_javascript_key = 'abcdef0123456789abcdef0123456789' where id;
  raise exception 'Anonymous map config update must fail';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role authenticated;
do $$ begin
  delete from public.map_config where id;
  raise exception 'Authenticated map config delete must fail';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$ begin
  assert not has_table_privilege('anon', 'public.map_config', 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'Anonymous map config mutations must be denied';
  assert not has_table_privilege('authenticated', 'public.map_config', 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'Authenticated map config mutations must be denied';
end $$;

rollback;
