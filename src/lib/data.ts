import {
  demoAttendees,
  demoDiscountCodes,
  demoEvents,
  demoMetrics,
  demoOrganizationId,
  demoRegistrationTrend,
  demoSessions,
  demoTicketBreakdown,
  demoTicketTypes,
} from "@/lib/demo-data";
import { ensureDefaultEmailTemplates } from "@/lib/email/templates";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AccountTicketSummary,
  AttendeeDetail,
  AttendeeEventTicket,
  AttendeeSummary,
  DashboardMetrics,
  DiscountCodeSummary,
  EmailTemplateSummary,
  EventAttendeeSummary,
  EventSummary,
  ManagedUserSummary,
  Role,
  SessionSummary,
  TicketDetails,
  TicketDetailSession,
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

export async function getDiscountCodes(): Promise<DiscountCodeSummary[]> {
  if (!isServiceRoleConfigured()) return demoDiscountCodes;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("organization_id", demoOrganizationId)
    .order("created_at", { ascending: false });

  if (error || !data) return demoDiscountCodes;
  if (data.length === 0) return [];

  const discountIds = data.map((discount) => discount.id);
  const { data: redemptions } = await supabase
    .from("discount_redemptions")
    .select("discount_code_id")
    .eq("organization_id", demoOrganizationId)
    .eq("success", true)
    .in("discount_code_id", discountIds);

  const redemptionCountByCode = new Map<string, number>();
  for (const redemption of redemptions ?? []) {
    redemptionCountByCode.set(
      redemption.discount_code_id,
      (redemptionCountByCode.get(redemption.discount_code_id) ?? 0) + 1,
    );
  }

  return data.map((discount) => ({
    ...discount,
    amount: Number(discount.amount ?? 0),
    applies_to_event_ids: discount.applies_to_event_ids ?? [],
    applies_to_ticket_type_ids: discount.applies_to_ticket_type_ids ?? [],
    successful_redemptions: redemptionCountByCode.get(discount.id) ?? 0,
  })) as DiscountCodeSummary[];
}

export async function getAttendees(): Promise<AttendeeSummary[]> {
  if (!isServiceRoleConfigured()) return demoAttendees;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("attendees").select("*").order("last_registered_at", { ascending: false });
  if (error || !data) return demoAttendees;
  return data as AttendeeSummary[];
}

export async function getAttendeeById(id: string): Promise<AttendeeDetail | null> {
  if (!isServiceRoleConfigured()) return demoAttendeeDetail(id);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("attendees").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as AttendeeDetail;
}

export async function getAttendeeEventTickets(attendeeId: string): Promise<AttendeeEventTicket[]> {
  if (!isServiceRoleConfigured()) return demoAttendeeEventTickets(attendeeId);

  const supabase = createSupabaseAdminClient();
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("id, event_id, ticket_type_id, status, payment_status, amount_due, amount_paid, registered_at")
    .eq("attendee_id", attendeeId)
    .order("registered_at", { ascending: false });

  if (error || !registrations?.length) return [];

  const registrationIds = registrations.map((registration) => registration.id);
  const eventIds = [...new Set(registrations.map((registration) => registration.event_id))];
  const registrationTicketTypeIds = registrations
    .map((registration) => registration.ticket_type_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: events }, { data: tickets }, { data: sessionRows }, { data: attendanceLogs }] = await Promise.all([
    supabase.from("events").select("id, title, slug, starts_at, ends_at, timezone, venue_name, status").in("id", eventIds),
    supabase
      .from("tickets")
      .select("id, registration_id, ticket_code, status, issued_at, ticket_type_id")
      .in("registration_id", registrationIds)
      .order("issued_at", { ascending: false }),
    supabase.from("registration_sessions").select("registration_id, session_id").in("registration_id", registrationIds),
    supabase
      .from("attendance_logs")
      .select("registration_id, scope, checked_in_at")
      .in("registration_id", registrationIds)
      .order("checked_in_at", { ascending: false }),
  ]);

  const ticketTypeIds = [
    ...new Set([
      ...registrationTicketTypeIds,
      ...((tickets ?? []).map((ticket) => ticket.ticket_type_id).filter((id): id is string => Boolean(id))),
    ]),
  ];
  const sessionIds = [...new Set((sessionRows ?? []).map((row) => row.session_id))];

  const [{ data: ticketTypes }, { data: sessions }] = await Promise.all([
    ticketTypeIds.length
      ? supabase.from("ticket_types").select("id, name").in("id", ticketTypeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    sessionIds.length
      ? supabase.from("sessions").select("id, title, starts_at, ends_at, room, type").in("id", sessionIds).order("starts_at")
      : Promise.resolve({ data: [] as TicketDetailSession[] }),
  ]);

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const ticketTypeById = new Map((ticketTypes ?? []).map((ticketType) => [ticketType.id, ticketType.name]));
  const ticketByRegistrationId = new Map(
    (tickets ?? []).map((ticket) => [
      ticket.registration_id,
      {
        id: ticket.id as string,
        code: ticket.ticket_code as string,
        status: ticket.status as AttendeeEventTicket["ticket_status"],
        issuedAt: ticket.issued_at as string,
        ticketTypeId: ticket.ticket_type_id as string | null,
      },
    ]),
  );
  const sessionById = new Map(((sessions ?? []) as TicketDetailSession[]).map((session) => [session.id, session]));
  const sessionsByRegistrationId = new Map<string, TicketDetailSession[]>();
  const eventCheckInByRegistrationId = new Map<string, string>();
  const sessionCheckInCountByRegistrationId = new Map<string, number>();

  for (const row of sessionRows ?? []) {
    const session = sessionById.get(row.session_id);
    if (!session) continue;

    const current = sessionsByRegistrationId.get(row.registration_id) ?? [];
    current.push(session);
    sessionsByRegistrationId.set(row.registration_id, current);
  }

  for (const log of attendanceLogs ?? []) {
    if (log.scope === "event" && !eventCheckInByRegistrationId.has(log.registration_id)) {
      eventCheckInByRegistrationId.set(log.registration_id, log.checked_in_at);
    }

    if (log.scope === "session") {
      sessionCheckInCountByRegistrationId.set(
        log.registration_id,
        (sessionCheckInCountByRegistrationId.get(log.registration_id) ?? 0) + 1,
      );
    }
  }

  return registrations.flatMap((registration) => {
    const event = eventById.get(registration.event_id);
    if (!event) return [];

    const ticket = ticketByRegistrationId.get(registration.id);
    const ticketTypeId = registration.ticket_type_id ?? ticket?.ticketTypeId ?? null;

    return {
      registration_id: registration.id,
      registration_status: String(registration.status),
      payment_status: String(registration.payment_status),
      amount_due: Number(registration.amount_due ?? 0),
      amount_paid: Number(registration.amount_paid ?? 0),
      registered_at: String(registration.registered_at),
      event_id: String(event.id),
      event_title: String(event.title),
      event_slug: String(event.slug),
      event_starts_at: String(event.starts_at),
      event_ends_at: String(event.ends_at),
      event_timezone: String(event.timezone ?? "America/Toronto"),
      event_status: event.status as AttendeeEventTicket["event_status"],
      venue_name: event.venue_name ?? null,
      ticket_type_id: ticketTypeId,
      ticket_type_name: ticketTypeId ? ticketTypeById.get(ticketTypeId) ?? null : null,
      ticket_id: ticket?.id ?? null,
      ticket_code: ticket?.code ?? null,
      ticket_status: ticket?.status ?? null,
      issued_at: ticket?.issuedAt ?? null,
      checked_in_at: eventCheckInByRegistrationId.get(registration.id) ?? null,
      session_check_in_count: sessionCheckInCountByRegistrationId.get(registration.id) ?? 0,
      sessions: sessionsByRegistrationId.get(registration.id) ?? [],
    };
  });
}

export async function getEmailTemplates(organizationId: string): Promise<EmailTemplateSummary[]> {
  return ensureDefaultEmailTemplates(organizationId);
}

export async function getEventAttendees(eventId: string): Promise<EventAttendeeSummary[]> {
  if (!isServiceRoleConfigured()) return demoEventAttendees(eventId);

  const supabase = createSupabaseAdminClient();
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("id, attendee_id, ticket_type_id, status, payment_status, registered_at")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (error || !registrations?.length) return [];

  const attendeeIds = [...new Set(registrations.map((registration) => registration.attendee_id))];
  const ticketTypeIds = [
    ...new Set(registrations.map((registration) => registration.ticket_type_id).filter((id): id is string => Boolean(id))),
  ];
  const registrationIds = registrations.map((registration) => registration.id);

  const ticketTypesPromise = ticketTypeIds.length
    ? supabase.from("ticket_types").select("id, name").in("id", ticketTypeIds)
    : Promise.resolve({ data: [] as { id: string; name: string }[] });

  const [{ data: attendees }, { data: ticketTypes }, { data: tickets }, { data: attendanceLogs }] =
    await Promise.all([
      supabase.from("attendees").select("*").in("id", attendeeIds),
      ticketTypesPromise,
      supabase
        .from("tickets")
        .select("id, registration_id, ticket_code, status, ticket_type_id")
        .eq("event_id", eventId)
        .in("registration_id", registrationIds),
      supabase
        .from("attendance_logs")
        .select("registration_id, checked_in_at")
        .eq("event_id", eventId)
        .eq("scope", "event")
        .in("registration_id", registrationIds)
        .order("checked_in_at", { ascending: false }),
    ]);

  const attendeeById = new Map(((attendees ?? []) as AttendeeSummary[]).map((attendee) => [attendee.id, attendee]));
  const ticketTypeById = new Map((ticketTypes ?? []).map((ticketType) => [ticketType.id, ticketType.name]));
  const ticketByRegistrationId = new Map(
    (tickets ?? []).map((ticket) => [
      ticket.registration_id,
      {
        code: ticket.ticket_code as string,
        status: ticket.status as EventAttendeeSummary["ticket_status"],
        ticketTypeId: ticket.ticket_type_id as string | null,
      },
    ]),
  );
  const checkInByRegistrationId = new Map<string, string>();
  for (const log of attendanceLogs ?? []) {
    if (!checkInByRegistrationId.has(log.registration_id)) {
      checkInByRegistrationId.set(log.registration_id, log.checked_in_at);
    }
  }

  return registrations.flatMap((registration) => {
    const attendee = attendeeById.get(registration.attendee_id);
    if (!attendee) return [];

    const ticket = ticketByRegistrationId.get(registration.id);
    const ticketTypeId = registration.ticket_type_id ?? ticket?.ticketTypeId ?? null;

    return {
      ...attendee,
      registration_id: registration.id,
      registration_status: String(registration.status),
      payment_status: String(registration.payment_status),
      registered_at: String(registration.registered_at),
      ticket_code: ticket?.code ?? null,
      ticket_status: ticket?.status ?? null,
      ticket_type_name: ticketTypeId ? ticketTypeById.get(ticketTypeId) ?? null : null,
      checked_in_at: checkInByRegistrationId.get(registration.id) ?? null,
    };
  });
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
      registration_id: ticket.registration_id,
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

export async function getTicketDetails(ticketCode: string): Promise<TicketDetails | null> {
  if (!isServiceRoleConfigured()) return demoTicketDetails(ticketCode);

  const supabase = createSupabaseAdminClient();
  const { data: ticketData, error: ticketError } = await supabase
    .from("tickets")
    .select("id, organization_id, ticket_code, status, issued_at, registration_id, event_id, attendee_id, ticket_type_id")
    .eq("ticket_code", ticketCode)
    .maybeSingle();

  if (ticketError || !ticketData) return null;

  const ticket = ticketData as {
    id: string;
    organization_id: string;
    ticket_code: string;
    status: TicketDetails["ticket_status"];
    issued_at: string;
    registration_id: string;
    event_id: string;
    attendee_id: string;
    ticket_type_id: string | null;
  };

  const [{ data: event }, { data: attendee }, { data: registration }, { data: ticketType }, { data: sessionRows }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, slug, description, starts_at, ends_at, timezone, venue_name, address, room, minimum_age, compliance_notes")
        .eq("id", ticket.event_id)
        .maybeSingle(),
      supabase
        .from("attendees")
        .select("full_name, email, phone, company, role_title")
        .eq("id", ticket.attendee_id)
        .maybeSingle(),
      supabase
        .from("registrations")
        .select("status, payment_status, amount_due, amount_paid")
        .eq("id", ticket.registration_id)
        .maybeSingle(),
      ticket.ticket_type_id
        ? supabase
            .from("ticket_types")
            .select("name, description, price, currency")
            .eq("id", ticket.ticket_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("registration_sessions").select("session_id").eq("registration_id", ticket.registration_id),
    ]);

  if (!event || !attendee || !registration) return null;

  const sessionIds = ((sessionRows ?? []) as { session_id: string }[]).map((row) => row.session_id);
  const { data: sessions } = sessionIds.length
    ? await supabase
        .from("sessions")
        .select("id, title, starts_at, ends_at, room, type")
        .in("id", sessionIds)
        .order("starts_at")
    : { data: [] };

  return {
    ticket_id: ticket.id,
    registration_id: ticket.registration_id,
    ticket_code: ticket.ticket_code,
    ticket_status: ticket.status,
    issued_at: ticket.issued_at,
    registration_status: String(registration.status),
    payment_status: String(registration.payment_status),
    amount_due: Number(registration.amount_due ?? 0),
    amount_paid: Number(registration.amount_paid ?? 0),
    organization_id: ticket.organization_id,
    event_id: String(event.id),
    event_title: String(event.title),
    event_slug: String(event.slug),
    event_description: String(event.description ?? ""),
    event_starts_at: String(event.starts_at),
    event_ends_at: String(event.ends_at),
    event_timezone: String(event.timezone ?? "America/Toronto"),
    venue_name: event.venue_name ?? null,
    address: event.address ?? null,
    room: event.room ?? null,
    minimum_age: Number(event.minimum_age ?? 19),
    compliance_notes: event.compliance_notes ?? null,
    ticket_type_name: ticketType?.name ?? null,
    ticket_type_description: ticketType?.description ?? null,
    ticket_type_price: ticketType ? Number(ticketType.price ?? 0) : null,
    ticket_type_currency: ticketType?.currency ?? null,
    attendee_id: ticket.attendee_id,
    attendee_name: String(attendee.full_name ?? "FCF attendee"),
    attendee_email: attendee.email ?? null,
    attendee_phone: attendee.phone ?? null,
    attendee_company: attendee.company ?? null,
    attendee_role_title: attendee.role_title ?? null,
    sessions: ((sessions ?? []) as TicketDetailSession[]).map((session) => ({
      id: session.id,
      title: session.title,
      starts_at: session.starts_at,
      ends_at: session.ends_at,
      room: session.room,
      type: session.type,
    })),
  };
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

function demoTicketDetails(ticketCode: string): TicketDetails {
  const event = demoEvents[0];
  const attendee = demoAttendees[0];
  const ticketType = demoTicketTypes[0];
  const sessions = demoSessions.filter((session) => session.event_id === event.id);

  return {
    ticket_id: "88888888-8888-4888-8888-888888888800",
    registration_id: "99999999-9999-4999-8999-999999999900",
    ticket_code: ticketCode,
    ticket_status: "active",
    issued_at: new Date().toISOString(),
    registration_status: "confirmed",
    payment_status: ticketType.price > 0 ? "pending" : "not_required",
    amount_due: ticketType.price,
    amount_paid: 0,
    organization_id: demoOrganizationId,
    event_id: event.id,
    event_title: event.title,
    event_slug: event.slug,
    event_description: event.description,
    event_starts_at: event.starts_at,
    event_ends_at: event.ends_at,
    event_timezone: event.timezone,
    venue_name: event.venue_name,
    address: event.address,
    room: event.room,
    minimum_age: event.minimum_age,
    compliance_notes: event.compliance_notes,
    ticket_type_name: ticketType.name,
    ticket_type_description: ticketType.description,
    ticket_type_price: ticketType.price,
    ticket_type_currency: ticketType.currency,
    attendee_id: attendee.id,
    attendee_name: attendee.full_name,
    attendee_email: attendee.email,
    attendee_phone: attendee.phone,
    attendee_company: attendee.company,
    attendee_role_title: attendee.role_title,
    sessions,
  };
}

function demoAttendeeDetail(id: string): AttendeeDetail | null {
  const attendee = demoAttendees.find((item) => item.id === id);
  if (!attendee) return null;

  return {
    ...attendee,
    organization_id: demoOrganizationId,
    date_of_birth: "1990-01-01",
    tags: [],
    notes: attendee.id === demoAttendees[0].id ? "Prefers email confirmations and VIP seating when available." : null,
    first_seen_at: attendee.last_registered_at ?? new Date().toISOString(),
    created_at: attendee.last_registered_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function demoAttendeeEventTickets(attendeeId: string): AttendeeEventTicket[] {
  const attendee = demoAttendees.find((item) => item.id === attendeeId);
  if (!attendee) return [];

  if (attendee.id === demoAttendees[1]?.id) {
    const event = demoEvents[0];
    const ticketType = demoTicketTypes[1] ?? demoTicketTypes[0];

    return [
      {
        registration_id: "99999999-9999-4999-8999-999999999992",
        registration_status: "pending",
        payment_status: "pending",
        amount_due: ticketType.price,
        amount_paid: 0,
        registered_at: attendee.last_registered_at ?? new Date().toISOString(),
        event_id: event.id,
        event_title: event.title,
        event_slug: event.slug,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
        event_timezone: event.timezone,
        event_status: event.status,
        venue_name: event.venue_name,
        ticket_type_id: ticketType.id,
        ticket_type_name: ticketType.name,
        ticket_id: null,
        ticket_code: null,
        ticket_status: null,
        issued_at: null,
        checked_in_at: null,
        session_check_in_count: 0,
        sessions: demoSessions.filter((session) => session.event_id === event.id),
      },
    ];
  }

  return demoAccountTickets().map((ticket) => ({
    registration_id:
      ticket.ticket_code === "FCF-DEMO-2026"
        ? "99999999-9999-4999-8999-999999999991"
        : "99999999-9999-4999-8999-999999999993",
    registration_status: ticket.registration_status,
    payment_status: ticket.payment_status,
    amount_due: ticket.amount_due,
    amount_paid: ticket.amount_paid,
    registered_at: ticket.issued_at,
    event_id: ticket.event_id,
    event_title: ticket.event_title,
    event_slug: ticket.event_slug,
    event_starts_at: ticket.event_starts_at,
    event_ends_at: ticket.event_ends_at,
    event_timezone: "America/Toronto",
    event_status: ticket.event_id === demoEvents[0].id ? demoEvents[0].status : "past",
    venue_name: ticket.venue_name,
    ticket_type_id: ticket.event_id === demoEvents[0].id ? demoTicketTypes[0]?.id ?? null : null,
    ticket_type_name: ticket.ticket_type_name,
    ticket_id: ticket.ticket_id,
    ticket_code: ticket.ticket_code,
    ticket_status: ticket.ticket_status,
    issued_at: ticket.issued_at,
    checked_in_at: ticket.ticket_status === "used" ? ticket.issued_at : null,
    session_check_in_count: ticket.event_id === demoEvents[0].id ? 1 : 0,
    sessions: ticket.event_id === demoEvents[0].id ? demoSessions.filter((session) => session.event_id === ticket.event_id) : [],
  }));
}

function demoEventAttendees(eventId: string): EventAttendeeSummary[] {
  if (eventId !== demoEvents[0].id) return [];

  return demoAttendees.map((attendee, index) => ({
    ...attendee,
    registration_id: `99999999-9999-4999-8999-99999999999${index + 1}`,
    registration_status: index === 0 ? "confirmed" : "pending",
    payment_status: index === 0 ? "paid" : "pending",
    registered_at: attendee.last_registered_at ?? new Date().toISOString(),
    ticket_code: index === 0 ? "FCF-DEMO-2026" : null,
    ticket_status: index === 0 ? "active" : null,
    ticket_type_name: demoTicketTypes[index]?.name ?? demoTicketTypes[0]?.name ?? null,
    checked_in_at: index === 0 ? attendee.last_attended_at : null,
  }));
}

function demoAccountTickets(): AccountTicketSummary[] {
  const upcomingEvent = demoEvents[0];
  const pastStartsAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
  const pastEndsAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90 + 1000 * 60 * 60 * 4).toISOString();

  return [
    {
      ticket_id: "88888888-8888-4888-8888-888888888881",
      registration_id: "99999999-9999-4999-8999-999999999991",
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
      registration_id: "99999999-9999-4999-8999-999999999992",
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
