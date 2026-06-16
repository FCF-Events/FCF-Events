export type Role = "owner" | "admin" | "manager" | "check_in_staff" | "viewer";

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
  event_category?: string | null;
  capacity: number | null;
  status: "draft" | "published" | "cancelled" | "past";
  visibility: "private" | "public" | "unlisted";
  minimum_age: number;
  compliance_notes: string | null;
};

export type SessionSummary = {
  id: string;
  event_id: string;
  title: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  capacity: number | null;
  type: string;
  requires_registration: boolean;
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
};

export type AttendeeSummary = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role_title: string | null;
  sms_consent_status: boolean;
  email_consent_status: boolean;
  events_registered_count: number;
  events_attended_count: number;
  sessions_attended_count: number;
  last_registered_at: string | null;
  last_attended_at: string | null;
};

export type EventAccessAssignment = {
  event_id: string;
  event_title: string;
  role: Role;
};

export type ManagedUserSummary = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  event_access: EventAccessAssignment[];
};

export type AccountTicketSummary = {
  ticket_id: string;
  ticket_code: string;
  ticket_status: TicketSummary["status"];
  issued_at: string;
  event_id: string;
  event_title: string;
  event_slug: string;
  event_starts_at: string;
  event_ends_at: string;
  venue_name: string | null;
  address: string | null;
  ticket_type_name: string | null;
  amount_due: number;
  amount_paid: number;
  payment_status: string;
  registration_status: string;
};

export type TicketSummary = {
  id: string;
  ticket_code: string;
  status: "active" | "revoked" | "cancelled" | "used";
  event_id: string;
  attendee_id: string;
  ticket_type_id: string | null;
};

export type RegistrationResult = {
  ok: boolean;
  ticketCode?: string;
  message: string;
};

export type CheckInResult = {
  result:
    | "success"
    | "duplicate"
    | "invalid"
    | "wrong_event"
    | "revoked"
    | "cancelled"
    | "not_authorized";
  attendeeName?: string;
  ticketTypeName?: string;
  checkedInAt?: string;
  priorCheckedInAt?: string;
};

export type DashboardMetrics = {
  upcomingEvents: number;
  activePublishedEvents: number;
  totalRegistered: number;
  totalCheckedIn: number;
  checkInPercentage: number;
  repeatAttendeeRate: number;
  smsConsentRate: number;
  smsDelivered: number;
  smsFailed: number;
};

export type NavItem = {
  href: string;
  label: string;
};
