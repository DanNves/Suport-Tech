-- SuportTech: auditoria administrativa (audit_log) + suporte a reenvio de convite
-- COMO APLICAR: Supabase Dashboard > SQL Editor (projeto afylrvytkpmetzmeosvb) > cole e execute.
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.

-- 1) Tabela de auditoria (reaproveita public.audit_log se já existir)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log add column if not exists actor_id uuid;
alter table public.audit_log add column if not exists action text;
alter table public.audit_log add column if not exists entity_type text;
alter table public.audit_log add column if not exists entity_id uuid;
alter table public.audit_log add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.audit_log add column if not exists created_at timestamptz not null default now();

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists audit_log_entity_type_idx on public.audit_log (entity_type);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_entity_lookup_idx on public.audit_log (entity_type, entity_id, created_at desc);

-- 2) Helper de autorização: administrador ativo
create or replace function public.is_active_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = _user_id
      and p.is_active
      and r.is_active
      and lower(r.key) = 'admin'
  );
$$;

revoke all on function public.is_active_admin(uuid) from public;
grant execute on function public.is_active_admin(uuid) to authenticated, service_role;

-- 3) Data API: leitura só para authenticated (RLS restringe a admin); escrita só service_role
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

drop policy if exists "authenticated can read audit log" on public.audit_log;
drop policy if exists "authenticated can insert audit log" on public.audit_log;
drop policy if exists "admins can read audit log" on public.audit_log;

create policy "admins can read audit log"
  on public.audit_log
  for select
  to authenticated
  using (public.is_active_admin(auth.uid()));

-- Sem policies de INSERT/UPDATE/DELETE: gravação apenas por mecanismo privilegiado
-- (service_role nas Edge Functions e trigger SECURITY DEFINER abaixo).

-- 4) Gravação privilegiada interna
create or replace function public.write_audit_log(
  _actor_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid,
  _metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (_actor_id, _action, _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb))
  returning id into _id;
  return _id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to service_role;

-- 5) Auditoria automática da gestão de setores (executada direto pelo app)
create or replace function public.audit_departments_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      auth.uid(), 'department.created', 'department', new.id,
      jsonb_build_object('name', new.name, 'code', new.code, 'is_active', new.is_active)
    );
  elsif tg_op = 'UPDATE' then
    perform public.write_audit_log(
      auth.uid(), 'department.updated', 'department', new.id,
      jsonb_build_object(
        'name', new.name,
        'code', new.code,
        'is_active', new.is_active,
        'previous', jsonb_build_object('name', old.name, 'code', old.code, 'is_active', old.is_active)
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_departments_changes() from public, anon, authenticated;

drop trigger if exists audit_departments_changes_trg on public.departments;
create trigger audit_departments_changes_trg
  after insert or update on public.departments
  for each row execute function public.audit_departments_changes();
