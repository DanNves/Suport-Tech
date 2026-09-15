-- Complete ticket operations: business-time pause/resume and attendance metrics.
-- Keeps the existing status model and uses AGUARDANDO_USUARIO as the SLA pause state.

create or replace function public.business_minutes_between(
  p_calendar_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  tz text;
  d date;
  total integer := 0;
  day_start timestamptz;
  day_end timestamptz;
  overlap_start timestamptz;
  overlap_end timestamptz;
  weekday_num integer;
  holiday_exists boolean;
  h record;
begin
  if p_start is null or p_end is null or p_end <= p_start then return 0; end if;
  select timezone into tz from public.support_calendars where id = p_calendar_id and is_active;
  if tz is null then return 0; end if;
  d := (p_start at time zone tz)::date;
  while d <= (p_end at time zone tz)::date loop
    weekday_num := extract(dow from d)::integer;
    select exists(select 1 from public.support_holidays sh where sh.calendar_id = p_calendar_id and sh.holiday_date = d and sh.is_active) into holiday_exists;
    if weekday_num between 1 and 5 and not holiday_exists then
      for h in select start_time, end_time from public.support_calendar_hours where calendar_id = p_calendar_id and weekday = weekday_num and is_active order by start_time loop
        day_start := (d + h.start_time) at time zone tz;
        day_end := (d + h.end_time) at time zone tz;
        overlap_start := greatest(p_start, day_start);
        overlap_end := least(p_end, day_end);
        if overlap_end > overlap_start then
          total := total + floor(extract(epoch from (overlap_end - overlap_start)) / 60)::integer;
        end if;
      end loop;
    end if;
    d := d + 1;
  end loop;
  return total;
end;
$$;

revoke all on function public.business_minutes_between(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.business_minutes_between(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.transition_ticket(p_ticket_id uuid, p_to_status ticket_status)
returns tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_old public.ticket_status;
  v_calendar_id uuid;
  v_pause_start timestamptz;
  v_pause_minutes integer := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_manage_tickets() then raise exception 'permission_denied'; end if;
  select status, sla_paused_at into v_old, v_pause_start from public.tickets where id = p_ticket_id for update;
  if v_old is null then raise exception 'ticket_not_found'; end if;
  if v_old = p_to_status then select * into v_ticket from public.tickets where id=p_ticket_id; return v_ticket; end if;
  if not ((v_old='novo' and p_to_status in ('atribuido','em_atendimento')) or (v_old='atribuido' and p_to_status in ('em_atendimento','aguardando_usuario')) or (v_old='em_atendimento' and p_to_status in ('aguardando_usuario','resolvido')) or (v_old='aguardando_usuario' and p_to_status in ('em_atendimento','resolvido')) or (v_old='resolvido' and p_to_status='fechado') or (v_old in ('resolvido','fechado') and p_to_status='em_atendimento')) then raise exception 'invalid_status_transition'; end if;
  if p_to_status='aguardando_usuario' and v_old<>'aguardando_usuario' then
    update public.tickets set sla_paused_at=now(), updated_at=now() where id=p_ticket_id;
  elsif v_old='aguardando_usuario' and p_to_status<>'aguardando_usuario' and v_pause_start is not null then
    select calendar_id into v_calendar_id from public.ticket_sla where ticket_id=p_ticket_id;
    v_pause_minutes := public.business_minutes_between(v_calendar_id,v_pause_start,now());
    update public.tickets set sla_paused_at=null,sla_total_paused_minutes=coalesce(sla_total_paused_minutes,0)+v_pause_minutes,updated_at=now() where id=p_ticket_id;
    update public.ticket_sla set paused_at=null,total_paused_minutes=coalesce(total_paused_minutes,0)+v_pause_minutes,updated_at=now() where ticket_id=p_ticket_id;
  end if;
  update public.tickets set status=p_to_status,first_response_at=case when p_to_status='em_atendimento' and first_response_at is null then now() else first_response_at end,resolved_at=case when p_to_status='resolvido' then coalesce(resolved_at,now()) else resolved_at end,closed_at=case when p_to_status='fechado' then coalesce(closed_at,now()) else closed_at end,updated_at=now() where id=p_ticket_id returning * into v_ticket;
  if p_to_status='aguardando_usuario' then update public.ticket_sla set paused_at=coalesce(paused_at,now()),updated_at=now() where ticket_id=p_ticket_id; end if;
  insert into public.ticket_history(ticket_id,actor_id,event_type,from_status,to_status,metadata) values(p_ticket_id,auth.uid(),'status_changed',v_old,p_to_status,jsonb_build_object('sla_paused_minutes_added',v_pause_minutes));
  return v_ticket;
end;
$$;

revoke all on function public.transition_ticket(uuid,ticket_status) from public, anon;
grant execute on function public.transition_ticket(uuid,ticket_status) to authenticated;

create or replace function public.get_ticket_details(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_requester jsonb;
  v_assignee jsonb;
  v_is_staff boolean;
  v_comments jsonb;
  v_history jsonb;
  v_calendar_id uuid;
  v_worked_minutes integer := 0;
  v_end timestamptz;
  v_paused integer := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_ticket from public.tickets where id=p_ticket_id;
  if not found then raise exception 'ticket_not_found'; end if;
  v_is_staff:=public.is_support_staff();
  if not v_is_staff and v_ticket.requester_id<>auth.uid() then raise exception 'permission_denied'; end if;
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'email',case when v_is_staff then p.email else null end,'department',d.name) into v_requester from public.profiles p left join public.departments d on d.id=p.department_id where p.id=v_ticket.requester_id;
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'role_key',r.key::text) into v_assignee from public.ticket_assignments a join public.profiles p on p.id=a.assignee_id join public.roles r on r.id=p.role_id where a.ticket_id=p_ticket_id and a.unassigned_at is null order by a.assigned_at desc limit 1;
  if v_is_staff then
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'author_id',c.author_id,'author_name',p.full_name,'body',c.body,'is_internal',c.is_internal,'created_at',c.created_at) order by c.created_at),'[]'::jsonb) into v_comments from public.ticket_comments c left join public.profiles p on p.id=c.author_id where c.ticket_id=p_ticket_id;
    select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'actor_id',h.actor_id,'actor_name',p.full_name,'event_type',h.event_type,'from_status',h.from_status,'to_status',h.to_status,'from_priority',h.from_priority,'to_priority',h.to_priority,'metadata',h.metadata,'created_at',h.created_at) order by h.created_at),'[]'::jsonb) into v_history from public.ticket_history h left join public.profiles p on p.id=h.actor_id where h.ticket_id=p_ticket_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'author_id',c.author_id,'author_name',p.full_name,'body',c.body,'is_internal',false,'created_at',c.created_at) order by c.created_at),'[]'::jsonb) into v_comments from public.ticket_comments c left join public.profiles p on p.id=c.author_id where c.ticket_id=p_ticket_id and c.is_internal=false;
    select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'actor_id',h.actor_id,'actor_name',p.full_name,'event_type',h.event_type,'from_status',h.from_status,'to_status',h.to_status,'created_at',h.created_at) order by h.created_at),'[]'::jsonb) into v_history from public.ticket_history h left join public.profiles p on p.id=h.actor_id where h.ticket_id=p_ticket_id and h.event_type in ('created','assigned','status_changed','comment_added');
  end if;
  select calendar_id into v_calendar_id from public.ticket_sla where ticket_id=p_ticket_id;
  v_end := coalesce(v_ticket.resolved_at,v_ticket.closed_at,now());
  if v_ticket.first_response_at is not null then v_worked_minutes := public.business_minutes_between(v_calendar_id,v_ticket.first_response_at,v_end); end if;
  v_paused := coalesce(v_ticket.sla_total_paused_minutes,0);
  if v_ticket.sla_paused_at is not null then v_paused := v_paused + public.business_minutes_between(v_calendar_id,v_ticket.sla_paused_at,now()); end if;
  return jsonb_build_object('ticket',to_jsonb(v_ticket) || jsonb_build_object('attendance_minutes',greatest(v_worked_minutes-v_paused,0),'attendance_elapsed_minutes',v_worked_minutes,'sla_current_pause_minutes',case when v_ticket.sla_paused_at is null then 0 else public.business_minutes_between(v_calendar_id,v_ticket.sla_paused_at,now()) end),'requester',v_requester,'assignee',coalesce(v_assignee,'null'::jsonb),'comments',v_comments,'history',v_history,'is_staff',v_is_staff);
end;
$$;

revoke all on function public.get_ticket_details(uuid) from public, anon;
grant execute on function public.get_ticket_details(uuid) to authenticated;
