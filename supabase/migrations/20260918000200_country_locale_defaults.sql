create or replace function public.apply_country_default_locale()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  def text;
begin
  if TG_OP = 'INSERT' and new.preferred_locale is null then
    new.preferred_locale_explicit := false;
  elsif TG_OP = 'UPDATE' then
    if new.preferred_locale is distinct from old.preferred_locale
       and new.preferred_locale_explicit is not distinct from old.preferred_locale_explicit then
      new.preferred_locale_explicit := true;
    end if;
  end if;

  if new.preferred_locale_explicit is false then
    if TG_OP = 'INSERT' then
      select c.default_locale into def from public.countries c
      where c.iso_code = upper(btrim(new.country_code));
      new.preferred_locale := coalesce(def, new.preferred_locale, 'en');
    elsif new.country_code is distinct from old.country_code
       or new.preferred_locale_explicit is distinct from old.preferred_locale_explicit then
      select c.default_locale into def from public.countries c
      where c.iso_code = upper(btrim(new.country_code));
      new.preferred_locale := coalesce(def, new.preferred_locale, 'en');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_country_default_locale() from public, anon, authenticated;
alter function public.stt_try_consume(uuid, integer, integer) set search_path = '';
