create table if not exists public.event_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_day_dates_valid check (ends_at > starts_at),
  unique (event_id, sort_order)
);

alter table public.sessions
  add column if not exists event_day_id uuid references public.event_days(id) on delete set null;

create table if not exists public.ticket_type_day_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  event_day_id uuid not null references public.event_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_type_id, event_day_id)
);

alter table public.attendance_logs
  add column if not exists event_day_id uuid references public.event_days(id) on delete cascade;

alter table public.check_in_attempts
  add column if not exists event_day_id uuid references public.event_days(id) on delete set null;

alter table public.check_in_attempts
  drop constraint if exists check_in_attempts_result_check;

alter table public.check_in_attempts
  add constraint check_in_attempts_result_check
  check (result in (
    'success',
    'duplicate',
    'invalid',
    'wrong_event',
    'revoked',
    'cancelled',
    'not_authorized',
    'unpaid',
    'not_confirmed',
    'not_entitled_for_day',
    'not_entitled_for_session',
    'daily_check_in_required'
  ));

with generated_days as (
  select
    e.id as event_id,
    e.organization_id,
    generated.day_start,
    row_number() over (partition by e.id order by generated.day_start) - 1 as sort_order,
    greatest(generated.day_start, e.starts_at) as starts_at,
    least(generated.day_start + interval '1 day', e.ends_at) as ends_at
  from public.events e
  cross join lateral generate_series(
    date_trunc('day', e.starts_at),
    date_trunc('day', e.ends_at),
    interval '1 day'
  ) as generated(day_start)
)
insert into public.event_days (organization_id, event_id, label, starts_at, ends_at, sort_order)
select
  organization_id,
  event_id,
  'Day ' || (sort_order + 1)::text,
  starts_at,
  ends_at,
  sort_order
from generated_days
where ends_at > starts_at
on conflict (event_id, sort_order) do update
set starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    updated_at = now();

update public.sessions s
set event_day_id = ed.id
from public.event_days ed
where s.event_id = ed.event_id
  and s.event_day_id is null
  and s.starts_at >= ed.starts_at
  and s.starts_at < ed.ends_at;

update public.sessions s
set event_day_id = (
  select ed.id
  from public.event_days ed
  where ed.event_id = s.event_id
  order by ed.sort_order
  limit 1
)
where s.event_day_id is null;

insert into public.ticket_type_day_access (organization_id, ticket_type_id, event_day_id)
select tt.organization_id, tt.id, ed.id
from public.ticket_types tt
join public.event_days ed on ed.event_id = tt.event_id
on conflict (ticket_type_id, event_day_id) do nothing;

update public.attendance_logs al
set event_day_id = s.event_day_id
from public.sessions s
where al.session_id = s.id
  and al.event_day_id is null
  and s.event_day_id is not null;

update public.attendance_logs al
set event_day_id = ed.id
from public.event_days ed
where al.event_id = ed.event_id
  and al.event_day_id is null
  and al.checked_in_at >= ed.starts_at
  and al.checked_in_at < ed.ends_at;

update public.attendance_logs al
set event_day_id = (
  select ed.id
  from public.event_days ed
  where ed.event_id = al.event_id
  order by ed.sort_order
  limit 1
)
where al.event_day_id is null;

drop index if exists public.attendance_once_per_scope_idx;

create unique index if not exists attendance_once_per_day_scope_idx
on public.attendance_logs (
  ticket_id,
  event_id,
  coalesce(event_day_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope
);

create index if not exists event_days_event_sort_idx on public.event_days (event_id, sort_order);
create index if not exists sessions_event_day_idx on public.sessions (event_day_id, starts_at);
create index if not exists ticket_type_day_access_day_idx on public.ticket_type_day_access (event_day_id);

alter table public.event_days enable row level security;
alter table public.ticket_type_day_access enable row level security;

do $$
begin
  create trigger event_days_set_updated_at
  before update on public.event_days
  for each row execute function public.set_updated_at();
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create trigger ticket_type_day_access_set_updated_at
  before update on public.ticket_type_day_access
  for each row execute function public.set_updated_at();
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "public read published event days" on public.event_days
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_days.event_id and e.status = 'published' and e.visibility in ('public','unlisted')
    )
  );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "public read available ticket day access" on public.ticket_type_day_access
  for select using (
    exists (
      select 1
      from public.ticket_types tt
      join public.events e on e.id = tt.event_id
      where tt.id = ticket_type_day_access.ticket_type_id
        and tt.visibility = 'public'
        and e.status = 'published'
        and e.visibility in ('public','unlisted')
    )
  );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "members read event days" on public.event_days
  for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "staff manage event days" on public.event_days
  for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "members read ticket day access" on public.ticket_type_day_access
  for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "staff manage ticket day access" on public.ticket_type_day_access
  for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));
exception when duplicate_object then
  null;
end $$;
