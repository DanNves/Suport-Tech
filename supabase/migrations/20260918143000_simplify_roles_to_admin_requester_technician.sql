-- Keep the initial product permission model intentionally small.
update public.roles
set is_active = case when key in ('admin','requester','technician') then true else false end;

create or replace function public.can_manage_tickets()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() in ('admin','technician'), false) $$;

create or replace function public.is_support_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() in ('admin','technician'), false) $$;

create or replace function public.get_support_staff()
returns table(id uuid, full_name text, email text, role_key text, role_name text, department_name text)
language plpgsql stable security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_support_staff() then raise exception 'permission_denied'; end if;
  return query
    select p.id,p.full_name,p.email,r.key::text,r.name,d.name
    from public.profiles p
    join public.roles r on r.id=p.role_id
    left join public.departments d on d.id=p.department_id
    where p.is_active=true and r.key::text in ('admin','technician')
    order by p.full_name;
end;
$$;
