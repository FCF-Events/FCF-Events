export type EventSummary = {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string | null;
  address: string | null;
  room: string | null;
  description: string;
  status: "draft" | "published" | "cancelled" | "past";
};

export type EventDaySummary = {
  id: string;
  organization_id: string;
  event_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
};

export type SessionSummary = {
  id: string;
  organization_id: string;
  event_id: string;
  event_day_id: string | null;
  title: string;
  slug: string;
  description: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  status: EventSummary["status"];
  requires_separate_check_in: boolean;
  requires_registration: boolean;
  allowed_ticket_type_ids: string[];
};

export type TicketTypeSummary = {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  capacity_limit: number | null;
  visibility: "public" | "private" | "hidden";
  event_day_ids: string[];
};

export type EventAttendeeSummary = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role_title: string | null;
  registration_id: string;
  registration_status: string;
  payment_status: string;
  registered_at: string;
  ticket_code: string | null;
  ticket_status: "active" | "revoked" | "cancelled" | "used" | null;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  eligible_event_day_ids: string[];
  planned_session_ids: string[];
  checked_in_at: string | null;
};

export type CheckInResult = {
  result:
    | "success"
    | "duplicate"
    | "invalid"
    | "wrong_event"
    | "revoked"
    | "cancelled"
    | "not_authorized"
    | "unpaid"
    | "not_confirmed"
    | "not_entitled_for_day"
    | "not_entitled_for_session"
    | "daily_check_in_required";
  attendeeName?: string;
  ticketTypeName?: string;
  checkedInAt?: string;
  priorCheckedInAt?: string;
};

export type CheckInLookupResult = {
  ticketId: string;
  ticketCode: string;
  ticketStatus: NonNullable<EventAttendeeSummary["ticket_status"]>;
  attendeeName: string;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  ticketTypeName: string | null;
  eligibleEventDayIds: string[];
  plannedSessionIds: string[];
  checkedInAt: string | null;
};

export type CheckInLookupResponse = {
  ok: boolean;
  message?: string;
  results: CheckInLookupResult[];
};

export type WalkUpCheckInResult = CheckInResult & {
  ok: boolean;
  message?: string;
  ticketCode?: string;
  registrationId?: string;
};

export type CheckInContextResponse = {
  ok: boolean;
  message?: string;
  events: EventSummary[];
  eventDays: EventDaySummary[];
  sessions: SessionSummary[];
  ticketTypes: TicketTypeSummary[];
  initialAttendees: EventAttendeeSummary[];
};

export type CheckInAttendeeListResponse = {
  ok: boolean;
  message?: string;
  attendees: EventAttendeeSummary[];
};

export type WalkUpFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  roleTitle: string;
  ticketTypeId: string;
  paymentMode: "cash" | "comp";
};
