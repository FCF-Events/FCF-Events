import {
  demoAttendees,
  demoEvents,
  demoMetrics,
  demoOrganizationId,
  demoRegistrationTrend,
  demoSessions,
  demoTicketBreakdown,
  demoTicketTypes,
} from "@/lib/demo-data";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AccountTicketSummary,
  AttendeeSummary,
  DashboardMetrics,
  EventSummary,
  ManagedUserSummary,
  Role,
  SessionSummary,
  TicketTypeSummary,
} from "@/lib/types";

export async function getEvents(): Promise<EventSummary[]> {
  if (!isServiceRoleConfigured()) return demoEvents;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").select("*").order("starts_at");
  if (error || !data || data.length === 0) return demoEvents;
  return data as EventSummary[];
}

export async function getEventBySlug(slug: string): Promise<EventSummary | null> {
  if (!isServiceRoleConfigured()) return demoEvents.find((event) => event.slug === slug) ?? null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return demoEvents.find((event) => event.slug === slug) ?? null;
  return data as EventSummary;
}

export async function getEventById(id: string): Promise<EventSummary | null> {
  if (!isServiceRoleConfigured()) return demoEvents.find((event) => event.id === id) ?? null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error || !data) return demoEvents.find((event) => event.id === id) ?? null;
  return data as EventSummary;
}

export async function getSessions(eventId?: string): Promise<SessionSummary[]> {
  if (!isServiceRoleConfigured()) {
    return eventId ? demoSessions.filter((session) => session.event_id === eventId) : demoSessions;
  }
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("sessions").select("*").order("starts_at");
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error || !data) return eventId ? demoSessions.filter((session) => session.event_id === eventId) : demoSessions;
  return data as SessionSummary[];
}

export async function getTicketTypes(eventId?: string): Promise<TicketTypeSummary[]> {
  if (!isServiceRoleConfigured()) {
    return eventId ? demoTicketTypes.filter((ticket) => ticket.event_id === eventId) : demoTicketTypes;
  }
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("ticket_types").select("*").order("price");
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error || !data) return eventId ? demoTicketTypes.filter((ticket) => ticket.event_id === eventId) : demoTicketTypes;
  return data.map((ticket) => ({
    ...ticket,
    price: Number(ticket.price),
  })) as TicketTypeSummary[];
}

export async function getAttendees(): Promise<AttendeeSummary[]> {
  if (!isServiceRoleConfigured()) return demoAttendees;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("attendees").select("*").order("last_registered_at", { ascending: false });
  if (error || !data) return demoAttendees;
  return data as AttendeeSummary[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (!isServiceRoleConfigured()) return demoMetrics;

  const supabase = createSupabaseAdminClient();
  const [{ count: eventCount }, { count: registrationCount }, { count: attendanceCount }, { count: consentCount }] =
    await Promise.all([
      supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("registrations").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
      supabase.from("attendance_logs").select("*", { count: "exact", head: true }),
      supabase.from("attendees").select("*", { count: "exact", head: true }).eq("sms_consent_status", true),
    ]);

  const totalRegistered = registrationCount ?? 0;
  const totalCheckedIn = attendanceCount ?? 0;
  const smsConsentRate = totalRegistered > 0 ? Math.round(((consentCount ?? 0) / totalRegistered) * 100) : 0;

  return {
    upcomingEvents: eventCount ?? 0,
    activePublishedEvents: eventCount ?? 0,
    totalRegistered,
    totalCheckedIn,
    checkInPercentage: totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
    repeatAttendeeRate: 0,
    smsConsentRate,
    smsDelivered: 0,
    smsFailed: 0,
  };
}

export async function getAnalyticsData() {
  return {
    registrationTrend: demoRegistrationTrend,
    ticketBreakdown: demoTicketBreakdown,
  };
}

export async function getAccountTickets(email: string | null): Promise<AccountTicketSummary[]> {
  if (!isServiceRoleConfigured()) return demoAccountTickets();
  if (!email) return [];

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createSupabaseAdminClient();
  const { data: attendees, error: attendeeError } = await supabase
    .from("attendees")
    .select("id")
    .eq("normalized_email", normalizedEmail);

  if (attendeeError || !attendees?.length) return [];

  const attendeeIds = attendees.map((attendee) => attendee.id);
  const { data: tickets, error: ticketError } = await supabase
    .from("tickets")
    .select("id, ticket_code, status, issued_at, event_id, ticket_type_id, registration_id")
    .in("attendee_id", attendeeIds)
    .order("issued_at", { ascending: false });

  if (ticketError || !tickets?.length) return [];

  const eventIds = [...new Set(tickets.map((ticket) => ticket.event_id))];
  const ticketTypeIds = [
    ...new Set(tickets.map((ticket) => ticket.ticket_type_id).filter((id): id is string => Boolean(id))),
  ];
  const registrationIds = [...new Set(tickets.map((ticket) => ticket.registration_id))];

  const [{ data: events }, { data: ticketTypes }, { data: registrations }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, starts_at, ends_at, venue_name, address")
      .in("id", eventIds),
    ticketTypeIds.length
      ? supabase.from("ticket_types").select("id, name").in("id", ticketTypeIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("registrations")
      .select("id, status, payment_status, amount_due, amount_paid")
      .in("id", registrationIds),
  ]);

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const ticketTypeById = new Map((ticketTypes ?? []).map((ticketType) => [ticketType.id, ticketType]));
  const registrationById = new Map((registrations ?? []).map((registration) => [registration.id, registration]));

  return tickets.flatMap((ticket) => {
    const event = eventById.get(ticket.event_id);
    const registration = registrationById.get(ticket.registration_id);
    if (!event || !registration) return [];
    const ticketType = ticket.ticket_type_id ? ticketTypeById.get(ticket.ticket_type_id) : null;

    return {
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      ticket_status: ticket.status as AccountTicketSummary["ticket_status"],
      issued_at: ticket.issued_at,
      event_id: ticket.event_id,
      event_title: event.title,
      event_slug: event.slug,
      event_starts_at: event.starts_at,
      event_ends_at: event.ends_at,
      venue_name: event.venue_name,
      address: event.address,
      ticket_type_name: ticketType?.name ?? null,
      amount_due: Number(registration.amount_due ?? 0),
      amount_paid: Number(registration.amount_paid ?? 0),
      payment_status: registration.payment_status,
      registration_status: registration.status,
    };
  });
}

export async function getManagedUsers(): Promise<ManagedUserSummary[]> {
  if (!isServiceRoleConfigured()) {
    return [
      {
        user_id: "77777777-7777-4777-8777-777777777771",
        email: "events@federationofcannabisfarmers.ca",
        full_name: "FCF Events Admin",
        role: "admin",
        is_active: true,
        created_at: new Date().toISOString(),
        last_sign_in_at: null,
        event_access: demoEvents.map((event) => ({
          event_id: event.id,
          event_title: event.title,
          role: "manager" as Role,
        })),
      },
      {
        user_id: "77777777-7777-4777-8777-777777777772",
        email: "checkin@example.com",
        full_name: "Check-in Staff",
        role: "check_in_staff",
        is_active: true,
        created_at: new Date().toISOString(),
        last_sign_in_at: null,
        event_access: [
          {
            event_id: demoEvents[0].id,
            event_title: demoEvents[0].title,
            role: "check_in_staff",
          },
        ],
      },
    ];
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: members }, { data: profiles }, { data: assignments }, { data: events }, authUsers] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, is_active, created_at")
      .eq("organization_id", demoOrganizationId)
      .order("created_at", { ascending: true }),
    supabase.from("user_profiles").select("id, full_name, email"),
    supabase
      .from("event_staff_assignments")
      .select("user_id, event_id, role")
      .eq("organization_id", demoOrganizationId),
    supabase.from("events").select("id, title").eq("organization_id", demoOrganizationId),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const authUserById = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user]));
  const assignmentsByUser = new Map<string, ManagedUserSummary["event_access"]>();

  for (const assignment of assignments ?? []) {
    const event = eventById.get(assignment.event_id);
    const current = assignmentsByUser.get(assignment.user_id) ?? [];
    current.push({
      event_id: assignment.event_id,
      event_title: event?.title ?? "Unknown event",
      role: assignment.role as Role,
    });
    assignmentsByUser.set(assignment.user_id, current);
  }

  return (members ?? []).map((member) => {
    const profile = profileById.get(member.user_id);
    const authUser = authUserById.get(member.user_id);

    return {
      user_id: member.user_id,
      email: profile?.email ?? authUser?.email ?? null,
      full_name: profile?.full_name ?? (authUser?.user_metadata?.full_name as string | undefined) ?? null,
      role: member.role as Role,
      is_active: member.is_active,
      created_at: member.created_at,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      event_access: assignmentsByUser.get(member.user_id) ?? [],
    };
  });
}

function demoAccountTickets(): AccountTicketSummary[] {
  const upcomingEvent = demoEvents[0];
  const pastStartsAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
  const pastEndsAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90 + 1000 * 60 * 60 * 4).toISOString();

  return [
    {
      ticket_id: "88888888-8888-4888-8888-888888888881",
      ticket_code: "FCF-DEMO-2026",
      ticket_status: "active",
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      event_id: upcomingEvent.id,
      event_title: upcomingEvent.title,
      event_slug: upcomingEvent.slug,
      event_starts_at: upcomingEvent.starts_at,
      event_ends_at: upcomingEvent.ends_at,
      venue_name: upcomingEvent.venue_name,
      address: upcomingEvent.address,
      ticket_type_name: demoTicketTypes[0].name,
      amount_due: demoTicketTypes[0].price,
      amount_paid: 0,
      payment_status: "pending",
      registration_status: "confirmed",
    },
    {
      ticket_id: "88888888-8888-4888-8888-888888888882",
      ticket_code: "FCF-PAST-2026",
      ticket_status: "used",
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
      event_id: "33333333-3333-4333-8333-333333333399",
      event_title: "FCF Growers Roundtable",
      event_slug: "fcf-growers-roundtable",
      event_starts_at: pastStartsAt,
      event_ends_at: pastEndsAt,
      venue_name: "Private Venue",
      address: "Toronto, ON",
      ticket_type_name: "Member Admission",
      amount_due: 0,
      amount_paid: 0,
      payment_status: "not_required",
      registration_status: "confirmed",
    },
  ];
}
