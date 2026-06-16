-- FCF Events production-minded MVP schema for Supabase PostgreSQL.
-- Apply from Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type app_role as enum ('owner', 'admin', 'manager', 'check_in_staff', 'viewer');
create type event_status as enum ('draft', 'published', 'cancelled', 'past');
create type event_visibility as enum ('private', 'public', 'unlisted');
create type ticket_visibility as enum ('public', 'private', 'hidden');
create type session_type as enum ('seminar', 'panel', 'keynote', 'workshop', 'networking', 'vip', 'press', 'sponsor');
create type discount_type as enum ('percentage', 'fixed_amount', 'comp', 'access_only');
create type payment_method as enum ('free', 'comped', 'manual', 'invoice', 'future_provider');
create type payment_status as enum ('not_required', 'pending', 'paid', 'partially_paid', 'failed', 'refunded', 'comped');
create type refund_status as enum ('none', 'requested', 'processed', 'failed');
create type registration_status as enum ('pending', 'confirmed', 'cancelled', 'waitlisted');
create type ticket_status as enum ('active', 'revoked', 'cancelled', 'used');
create type attendance_scope as enum ('event', 'session');
create type message_channel as enum ('sms', 'email');
create type message_status as enum ('draft', 'queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled', 'skipped', 'opted_out');
create type sync_status as enum ('pending', 'success', 'failed', 'skipped');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_email(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(value)), '');
$$;

create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g'), '');
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_email text,
  timezone text not null default 'America/Toronto',
  default_minimum_age integer not null default 19,
  default_consent_text text not null default 'I agree to receive event-related communications. I can unsubscribe at any time.',
  branding jsonb not null default '{"dark":"#0b0b0b","red":"#b20711","light":"#ffffff"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.current_user_role(target_org uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_org
    and om.user_id = auth.uid()
    and om.is_active = true
  limit 1;
$$;

create or replace function public.has_org_role(target_org uuid, allowed app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role = any(allowed)
  );
$$;

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  room text,
  city text,
  province text,
  country text not null default 'Canada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  title text not null,
  slug text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Toronto',
  venue_name text,
  address text,
  room text,
  description text not null default '',
  banner_image_path text,
  capacity integer check (capacity is null or capacity > 0),
  status event_status not null default 'draft',
  visibility event_visibility not null default 'private',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  event_category text,
  compliance_notes text,
  minimum_age integer not null default 19,
  organizer_contact text,
  zeffy_campaign_id text,
  zeffy_form_url text,
  prevent_overlapping_session_registrations boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_dates_valid check (ends_at > starts_at),
  unique (organization_id, slug)
);

create table public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'check_in_staff',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.event_days (
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

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  event_day_id uuid references public.event_days(id) on delete set null,
  title text not null,
  slug text not null,
  description text not null default '',
  speakers text[] not null default '{}',
  room text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  status event_status not null default 'draft',
  type session_type not null default 'seminar',
  requires_separate_check_in boolean not null default true,
  requires_registration boolean not null default false,
  allowed_ticket_type_ids uuid[] not null default '{}',
  waitlist_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_dates_valid check (ends_at > starts_at),
  unique (event_id, slug)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  currency text not null default 'CAD',
  capacity_limit integer check (capacity_limit is null or capacity_limit > 0),
  per_attendee_limit integer not null default 1,
  sales_starts_at timestamptz,
  sales_ends_at timestamptz,
  automatic_price_change_at timestamptz,
  tax_label text,
  visibility ticket_visibility not null default 'public',
  approval_required boolean not null default false,
  waitlist_enabled boolean not null default false,
  benefits text,
  session_access_rules jsonb not null default '{}'::jsonb,
  payment_method payment_method not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_type_day_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  event_day_id uuid not null references public.event_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_type_id, event_day_id)
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  description text,
  type discount_type not null,
  amount numeric(12,2) not null default 0,
  applies_to_event_ids uuid[] not null default '{}',
  applies_to_ticket_type_ids uuid[] not null default '{}',
  max_total_uses integer,
  one_use_per_attendee boolean not null default true,
  expires_at timestamptz,
  active boolean not null default true,
  minimum_ticket_quantity integer not null default 1,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.registration_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Default registration form',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registration_form_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  form_id uuid not null references public.registration_forms(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type text not null check (field_type in ('text','textarea','select','multi-select','checkbox','radio','date','number','consent')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, field_key)
);

create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  search_name text generated always as (lower(trim(first_name || ' ' || last_name))) stored,
  email text,
  normalized_email text generated always as (public.normalize_email(email)) stored,
  phone text,
  normalized_phone text generated always as (public.normalize_phone(phone)) stored,
  company text,
  role_title text,
  date_of_birth date,
  tags text[] not null default '{}',
  notes text,
  sms_consent_status boolean not null default false,
  email_consent_status boolean not null default false,
  events_registered_count integer not null default 0,
  events_attended_count integer not null default 0,
  sessions_attended_count integer not null default 0,
  last_registered_at timestamptz,
  last_attended_at timestamptz,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index attendees_org_email_unique on public.attendees (organization_id, normalized_email) where normalized_email is not null;
create index attendees_org_phone_idx on public.attendees (organization_id, normalized_phone) where normalized_phone is not null;

create table public.attendee_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  identity_type text not null check (identity_type in ('email','phone')),
  identity_value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, identity_type, normalized_value)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete restrict,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  status registration_status not null default 'confirmed',
  payment_status payment_status not null default 'pending',
  payment_method payment_method not null default 'manual',
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_reference text,
  external_payment_provider text,
  external_payment_id text,
  external_payment_payload jsonb not null default '{}'::jsonb,
  external_payment_completed_at timestamptz,
  refund_status refund_status not null default 'none',
  custom_responses jsonb not null default '{}'::jsonb,
  sms_consent boolean not null default false,
  email_consent boolean not null default false,
  privacy_terms_accepted_at timestamptz,
  consent_source text,
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registration_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  status registration_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  unique (registration_id, session_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete restrict,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  ticket_code text not null unique,
  qr_token_hash text not null unique,
  status ticket_status not null default 'active',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_day_id uuid references public.event_days(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  scope attendance_scope not null default 'event',
  checked_in_by uuid references auth.users(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  device_user_agent text,
  created_at timestamptz not null default now()
);

create unique index attendance_once_per_day_scope_idx
on public.attendance_logs (
  ticket_id,
  event_id,
  coalesce(event_day_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope
);

create table public.check_in_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  event_day_id uuid references public.event_days(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  attempted_by uuid references auth.users(id) on delete set null,
  attempted_code text,
  result text not null check (result in ('success','duplicate','invalid','wrong_event','revoked','cancelled','not_authorized','unpaid','not_confirmed','not_entitled_for_day','not_entitled_for_session','daily_check_in_required')),
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  attempted_code text not null,
  success boolean not null,
  failure_reason text,
  amount_discounted numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index discount_one_success_per_attendee_idx
on public.discount_redemptions (discount_code_id, attendee_id)
where success = true;

create table public.twilio_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  account_sid text not null,
  auth_token_ciphertext text,
  twilio_phone_number text,
  messaging_service_sid text,
  default_sender_name text not null default 'FCF Events',
  default_footer text not null default 'Reply STOP to unsubscribe.',
  compliance_contact text,
  quiet_hours_start time,
  quiet_hours_end time,
  default_timezone text not null default 'America/Toronto',
  last_tested_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sms_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  phone text not null,
  normalized_phone text generated always as (public.normalize_phone(phone)) stored,
  consented boolean not null,
  purpose text not null,
  source text not null,
  consent_text text,
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index sms_consents_attendee_idx on public.sms_consents (organization_id, attendee_id, created_at desc);
create index sms_consents_phone_idx on public.sms_consents (organization_id, normalized_phone, created_at desc);

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  purpose text not null default 'event_reminder',
  body text not null,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  template_id uuid references public.sms_templates(id) on delete set null,
  name text not null,
  relative_minutes_before integer,
  scheduled_at timestamptz,
  recipient_filter jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_has_time check (relative_minutes_before is not null or scheduled_at is not null)
);

create table public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  channel message_channel not null default 'sms',
  name text not null,
  body_snapshot text not null,
  recipient_count integer not null default 0,
  status message_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.message_campaigns(id) on delete set null,
  reminder_schedule_id uuid references public.reminder_schedules(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  attendee_id uuid references public.attendees(id) on delete set null,
  channel message_channel not null default 'sms',
  to_address text not null,
  body_snapshot text not null,
  idempotency_key text not null,
  provider_message_sid text,
  provider_status text,
  provider_error text,
  status message_status not null default 'queued',
  segment_count integer,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.inbound_sms_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  from_phone text not null,
  normalized_from_phone text generated always as (public.normalize_phone(from_phone)) stored,
  to_phone text,
  body text,
  opt_out_type text,
  provider_message_sid text,
  raw_payload jsonb not null default '{}'::jsonb,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  attendee_id uuid references public.attendees(id) on delete set null,
  to_email text not null,
  subject_snapshot text not null,
  body_snapshot text not null,
  provider_status text,
  status message_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.airtable_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  api_token_ciphertext text,
  base_id text,
  events_table_name text not null default 'Events',
  sessions_table_name text not null default 'Sessions',
  attendees_table_name text not null default 'Attendees',
  registrations_table_name text not null default 'Registrations',
  tickets_table_name text not null default 'Tickets',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.airtable_field_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  config_id uuid not null references public.airtable_configs(id) on delete cascade,
  entity_type text not null,
  local_field text not null,
  airtable_field text not null,
  created_at timestamptz not null default now(),
  unique (config_id, entity_type, local_field)
);

create table public.airtable_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  config_id uuid references public.airtable_configs(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  airtable_record_id text,
  status sync_status not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function public.atomic_check_in(
  p_ticket_code text,
  p_event_id uuid,
  p_session_id uuid default null,
  p_user_agent text default null
)
returns table (
  result text,
  attendee_name text,
  ticket_type_name text,
  checked_in_at timestamptz,
  prior_checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket tickets%rowtype;
  v_registration registrations%rowtype;
  v_attendee attendees%rowtype;
  v_ticket_type_name text;
  v_scope attendance_scope := case when p_session_id is null then 'event'::attendance_scope else 'session'::attendance_scope end;
  v_existing timestamptz;
begin
  select * into v_ticket from public.tickets where ticket_code = p_ticket_code limit 1;
  if not found then
    insert into public.check_in_attempts(attempted_by, attempted_code, event_id, session_id, result, user_agent)
    values (auth.uid(), p_ticket_code, p_event_id, p_session_id, 'invalid', p_user_agent);
    return query select 'invalid', null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if not (public.has_org_role(v_ticket.organization_id, array['owner','admin','manager','check_in_staff']::app_role[]) or auth.role() = 'service_role') then
    insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
    values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'not_authorized', p_user_agent);
    return query select 'not_authorized', null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_ticket.event_id <> p_event_id then
    insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
    values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'wrong_event', p_user_agent);
    return query select 'wrong_event', null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'revoked' then
    insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
    values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'revoked', p_user_agent);
    return query select 'revoked', null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'cancelled' then
    insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
    values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'cancelled', p_user_agent);
    return query select 'cancelled', null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select checked_in_at into v_existing
  from public.attendance_logs
  where ticket_id = v_ticket.id
    and event_id = p_event_id
    and coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and scope = v_scope
  limit 1;

  select * into v_registration from public.registrations where id = v_ticket.registration_id;
  select * into v_attendee from public.attendees where id = v_ticket.attendee_id;
  select name into v_ticket_type_name from public.ticket_types where id = v_ticket.ticket_type_id;

  if v_existing is not null then
    insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, metadata, user_agent)
    values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'duplicate', jsonb_build_object('prior_checked_in_at', v_existing), p_user_agent);
    return query select 'duplicate', v_attendee.full_name, v_ticket_type_name, null::timestamptz, v_existing;
    return;
  end if;

  insert into public.attendance_logs(
    organization_id, ticket_id, registration_id, attendee_id, event_id, session_id, scope, checked_in_by, device_user_agent
  )
  values (
    v_ticket.organization_id, v_ticket.id, v_registration.id, v_attendee.id, p_event_id, p_session_id, v_scope, auth.uid(), p_user_agent
  )
  returning attendance_logs.checked_in_at into v_existing;

  update public.attendees
  set last_attended_at = v_existing,
      events_attended_count = events_attended_count + case when p_session_id is null then 1 else 0 end,
      sessions_attended_count = sessions_attended_count + case when p_session_id is null then 0 else 1 end
  where id = v_attendee.id;

  insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
  values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'success', p_user_agent);

  return query select 'success', v_attendee.full_name, v_ticket_type_name, v_existing, null::timestamptz;
exception when unique_violation then
  insert into public.check_in_attempts(organization_id, ticket_id, attempted_by, attempted_code, event_id, session_id, result, user_agent)
  values (v_ticket.organization_id, v_ticket.id, auth.uid(), p_ticket_code, p_event_id, p_session_id, 'duplicate', p_user_agent);
  return query select 'duplicate', v_attendee.full_name, v_ticket_type_name, null::timestamptz, now();
end;
$$;

create or replace function public.increment_registration_counters()
returns trigger
language plpgsql
as $$
begin
  update public.attendees
  set events_registered_count = events_registered_count + 1,
      last_registered_at = new.registered_at
  where id = new.attendee_id;
  return new;
end;
$$;

create trigger registrations_increment_attendee
after insert on public.registrations
for each row execute function public.increment_registration_counters();

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','user_profiles','organization_members','venues','events','event_staff_assignments',
    'event_days','sessions','ticket_types','ticket_type_day_access','discount_codes','discount_redemptions','registration_forms',
    'registration_form_fields','attendees','attendee_identities','registrations','registration_sessions',
    'tickets','twilio_configs','sms_templates','reminder_schedules','message_campaigns','message_sends',
    'email_templates','email_sends','airtable_configs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','user_profiles','organization_members','venues','events','event_days','sessions','ticket_types','ticket_type_day_access',
    'discount_codes','registration_forms','registration_form_fields','attendees','attendee_identities',
    'registrations','registration_sessions','tickets','attendance_logs','check_in_attempts','twilio_configs',
    'sms_consents','sms_templates','reminder_schedules','message_campaigns','message_sends',
    'inbound_sms_events','email_templates','email_sends','airtable_configs','airtable_field_mappings',
    'airtable_sync_logs','audit_logs'
  ] loop
    begin
      execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

create policy "members read organizations" on public.organizations
for select using (public.has_org_role(id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));

create policy "owners admins update organizations" on public.organizations
for update using (public.has_org_role(id, array['owner','admin']::app_role[]));

create policy "users read own profile" on public.user_profiles
for select using (id = auth.uid());

create policy "users update own profile" on public.user_profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read org memberships" on public.organization_members
for select using (public.has_org_role(organization_id, array['owner','admin','manager','viewer']::app_role[]));

create policy "owners manage org memberships" on public.organization_members
for all using (public.has_org_role(organization_id, array['owner']::app_role[]))
with check (public.has_org_role(organization_id, array['owner']::app_role[]));

create policy "public read published events" on public.events
for select using (status = 'published' and visibility in ('public','unlisted'));

create policy "public read published event days" on public.event_days
for select using (
  exists (
    select 1 from public.events e
    where e.id = event_days.event_id and e.status = 'published' and e.visibility in ('public','unlisted')
  )
);

create policy "public read published sessions" on public.sessions
for select using (
  exists (
    select 1 from public.events e
    where e.id = sessions.event_id and e.status = 'published' and e.visibility in ('public','unlisted')
  )
);

create policy "public read available ticket types" on public.ticket_types
for select using (
  visibility = 'public'
  and exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id and e.status = 'published' and e.visibility in ('public','unlisted')
  )
);

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

create policy "members read org rows venues" on public.venues
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage org rows venues" on public.venues
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read events" on public.events
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage events" on public.events
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read event days" on public.event_days
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage event days" on public.event_days
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read sessions" on public.sessions
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage sessions" on public.sessions
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read event staff" on public.event_staff_assignments
for select using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]) or user_id = auth.uid());
create policy "admins manage event staff" on public.event_staff_assignments
for all using (public.has_org_role(organization_id, array['owner','admin']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::app_role[]));

create policy "members read ticket types" on public.ticket_types
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage ticket types" on public.ticket_types
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read ticket day access" on public.ticket_type_day_access
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage ticket day access" on public.ticket_type_day_access
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "staff manage discounts" on public.discount_codes
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read operational rows attendees" on public.attendees
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage attendees" on public.attendees
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read registrations" on public.registrations
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "server or staff manage registrations" on public.registrations
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read tickets" on public.tickets
for select using (public.has_org_role(organization_id, array['owner','admin','manager','check_in_staff','viewer']::app_role[]));
create policy "staff manage tickets" on public.tickets
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "members read message rows" on public.message_sends
for select using (public.has_org_role(organization_id, array['owner','admin','manager','viewer']::app_role[]));
create policy "staff manage message rows" on public.message_sends
for all using (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

create policy "owners admins manage secrets" on public.twilio_configs
for all using (public.has_org_role(organization_id, array['owner','admin']::app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::app_role[]));

create policy "members read audit logs" on public.audit_logs
for select using (public.has_org_role(organization_id, array['owner','admin','manager','viewer']::app_role[]));
create policy "service insert audit logs" on public.audit_logs
for insert with check (auth.uid() is not null);

-- Generic member policies for remaining organization-scoped tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'discount_redemptions','registration_forms','registration_form_fields','attendee_identities',
    'registration_sessions','attendance_logs','check_in_attempts','sms_consents','sms_templates',
    'reminder_schedules','message_campaigns','inbound_sms_events','email_templates','email_sends',
    'airtable_configs','airtable_field_mappings','airtable_sync_logs'
  ] loop
    begin
      execute format('create policy "members read %1$I" on public.%1$I for select using (public.has_org_role(organization_id, array[''owner'',''admin'',''manager'',''check_in_staff'',''viewer'']::app_role[]))', t);
      execute format('create policy "staff manage %1$I" on public.%1$I for all using (public.has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[])) with check (public.has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[]))', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

create index events_org_status_start_idx on public.events (organization_id, status, starts_at);
create index events_zeffy_campaign_idx on public.events (zeffy_campaign_id) where zeffy_campaign_id is not null;
create index event_days_event_sort_idx on public.event_days (event_id, sort_order);
create index sessions_event_start_idx on public.sessions (event_id, starts_at);
create index sessions_event_day_idx on public.sessions (event_day_id, starts_at);
create index ticket_type_day_access_day_idx on public.ticket_type_day_access (event_day_id);
create index registrations_event_status_idx on public.registrations (event_id, status);
create index registrations_external_payment_idx on public.registrations (external_payment_provider, external_payment_id) where external_payment_id is not null;
create index tickets_event_code_idx on public.tickets (event_id, ticket_code);
create index message_sends_status_idx on public.message_sends (organization_id, status, created_at desc);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

insert into public.organizations (id, name, slug, contact_email)
values ('11111111-1111-4111-8111-111111111111', 'FCF Events', 'fcf', 'ops@example.com')
on conflict (slug) do nothing;

insert into public.venues (id, organization_id, name, address, room, city, province)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Metro Toronto Convention Centre', '255 Front St W', 'North Building', 'Toronto', 'ON')
on conflict do nothing;

insert into public.events (
  id, organization_id, venue_id, title, slug, starts_at, ends_at, venue_name, address, room,
  description, capacity, status, visibility, registration_opens_at, registration_closes_at,
  event_category, compliance_notes, minimum_age, organizer_contact
) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'FCF Cannabis Business Conference',
  'fcf-business-conference',
  now() + interval '30 days',
  now() + interval '30 days 8 hours',
  'Metro Toronto Convention Centre',
  '255 Front St W, Toronto, ON',
  'North Building',
  'A private industry conference for verified adult cannabis professionals.',
  500,
  'published',
  'public',
  now() - interval '1 day',
  now() + interval '29 days',
  'conference',
  'Organizer must confirm applicable federal, provincial, territorial, and venue rules.',
  19,
  'ops@example.com'
) on conflict (organization_id, slug) do nothing;

insert into public.event_days (id, organization_id, event_id, label, starts_at, ends_at, sort_order)
values (
  '33333333-3333-4333-8333-333333333331',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'Day 1',
  now() + interval '30 days',
  now() + interval '30 days 8 hours',
  0
) on conflict (event_id, sort_order) do nothing;

insert into public.sessions (id, organization_id, event_id, title, slug, description, speakers, room, starts_at, ends_at, capacity, status, type, requires_registration)
values
('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Compliance Operations Panel','compliance-operations-panel','Practical operations guardrails for Canadian cannabis events.',array['A. Morgan','S. Patel'],'Stage A',now() + interval '30 days 2 hours',now() + interval '30 days 3 hours',150,'published','panel',true),
('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Retail Networking Seminar','retail-networking-seminar','Structured networking for retailers and operators.',array['J. Chen'],'Room 201',now() + interval '30 days 4 hours',now() + interval '30 days 5 hours',120,'published','networking',true)
on conflict (event_id, slug) do nothing;

update public.sessions
set event_day_id = '33333333-3333-4333-8333-333333333331'
where event_id = '33333333-3333-4333-8333-333333333333'
  and event_day_id is null;

insert into public.ticket_types (id, organization_id, event_id, name, description, price, currency, capacity_limit, visibility, payment_method)
values
('55555555-5555-4555-8555-555555555551','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','General Admission','Standard conference access.',99,'CAD',350,'public','manual'),
('55555555-5555-4555-8555-555555555552','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','VIP','Includes VIP networking access.',249,'CAD',75,'public','manual'),
('55555555-5555-4555-8555-555555555553','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Speaker','Speaker and moderator access.',0,'CAD',50,'hidden','comped')
on conflict do nothing;

insert into public.ticket_type_day_access (organization_id, ticket_type_id, event_day_id)
values
('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331'),
('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555552','33333333-3333-4333-8333-333333333331'),
('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555553','33333333-3333-4333-8333-333333333331')
on conflict (ticket_type_id, event_day_id) do nothing;

insert into public.sms_templates (organization_id, name, purpose, body, is_default)
values (
  '11111111-1111-4111-8111-111111111111',
  'Default 24 hour reminder',
  'event_reminder',
  'Hey {{first_name}}. Your FCF event spot at {{event}} is confirmed for {{event_start_time}} at {{venue}}. Reply STOP to unsubscribe.',
  true
);
