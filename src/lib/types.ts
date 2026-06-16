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
  zeffy_campaign_id: string | null;
  zeffy_form_url: string | null;
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
  capacity: number | null;
  status: EventSummary["status"];
  type: string;
  requires_separate_check_in: boolean;
  requires_registration: boolean;
  allowed_ticket_type_ids: string[];
  waitlist_enabled: boolean;
};

export type TicketTypeSummary = {
  id: string;
  organization_id?: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  capacity_limit: number | null;
  visibility: "public" | "private" | "hidden";
  event_day_ids: string[];
};

export type DiscountType = "percentage" | "fixed_amount" | "comp" | "access_only";

export type DiscountCodeSummary = {
  id: string;
  organization_id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  amount: number;
  applies_to_event_ids: string[];
  applies_to_ticket_type_ids: string[];
  max_total_uses: number | null;
  one_use_per_attendee: boolean;
  expires_at: string | null;
  active: boolean;
  minimum_ticket_quantity: number;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  successful_redemptions: number;
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

export type EventAttendeeSummary = AttendeeSummary & {
  registration_id: string;
  registration_status: string;
  payment_status: string;
  registered_at: string;
  ticket_code: string | null;
  ticket_status: TicketSummary["status"] | null;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  eligible_event_day_ids: string[];
  planned_session_ids: string[];
  checked_in_at: string | null;
};

export type AttendeeDetail = AttendeeSummary & {
  organization_id: string;
  date_of_birth: string | null;
  tags: string[];
  notes: string | null;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type AttendeeEventTicket = {
  registration_id: string;
  registration_status: string;
  payment_status: string;
  amount_due: number;
  amount_paid: number;
  registered_at: string;
  event_id: string;
  event_title: string;
  event_slug: string;
  event_starts_at: string;
  event_ends_at: string;
  event_timezone: string;
  event_status: EventSummary["status"];
  venue_name: string | null;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  ticket_id: string | null;
  ticket_code: string | null;
  ticket_status: TicketSummary["status"] | null;
  issued_at: string | null;
  checked_in_at: string | null;
  session_check_in_count: number;
  sessions: TicketDetailSession[];
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
  registration_id: string;
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

export type EmailTemplateSummary = {
  id: string;
  organization_id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type TicketDetailSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  type: string;
};

export type TicketDetails = {
  ticket_id: string;
  registration_id: string;
  ticket_code: string;
  ticket_status: TicketSummary["status"];
  issued_at: string;
  registration_status: string;
  payment_status: string;
  amount_due: number;
  amount_paid: number;
  organization_id: string;
  event_id: string;
  event_title: string;
  event_slug: string;
  event_description: string;
  event_starts_at: string;
  event_ends_at: string;
  event_timezone: string;
  venue_name: string | null;
  address: string | null;
  room: string | null;
  minimum_age: number;
  compliance_notes: string | null;
  ticket_type_name: string | null;
  ticket_type_description: string | null;
  ticket_type_price: number | null;
  ticket_type_currency: string | null;
  attendee_id: string;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  attendee_company: string | null;
  attendee_role_title: string | null;
  sessions: TicketDetailSession[];
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
  paymentUrl?: string;
  registrationId?: string;
  requiresPayment?: boolean;
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
  ticketStatus: TicketSummary["status"];
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
