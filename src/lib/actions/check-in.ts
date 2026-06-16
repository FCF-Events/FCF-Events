"use server";

import { headers } from "next/headers";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoAttendees, demoEvents, demoTicketTypes } from "@/lib/demo-data";
import { createTicketCode, hashTicketToken } from "@/lib/security/qr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkInLookupSchema, checkInSchema, walkUpCheckInSchema } from "@/lib/validation";
import type { AttendeeSummary, CheckInLookupResponse, CheckInResult, EventAttendeeSummary, Role, WalkUpCheckInResult } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";

type CheckInAttendeeListResponse = {
  ok: boolean;
  message?: string;
  attendees: EventAttendeeSummary[];
};

const checkInAttendeeListSchema = checkInSchema.pick({
  eventId: true,
  sessionId: true,
});

const demoCheckedInCodes = new Map<string, string>();
const demoTicketProfiles = new Map<string, { attendeeName: string; ticketTypeName: string }>([
  ["FCF-DEMO-2026", { attendeeName: "Maya Reed", ticketTypeName: "General Admission" }],
  ["FCF-ANDRE-2026", { attendeeName: "Andre Singh", ticketTypeName: "VIP" }],
]);

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function checkInKey(ticketCode: string, eventId: string, sessionId?: string | null) {
  return `${ticketCode}:${eventId}:${sessionId ?? "event"}`;
}

function demoCheckIn(values: { ticketCode: string; eventId: string; sessionId?: string | null }): CheckInResult {
  const ticketCode = values.ticketCode.trim().toUpperCase();
  if (!ticketCode.startsWith("FCF-")) return { result: "invalid" };

  const key = checkInKey(ticketCode, values.eventId, values.sessionId);
  const profile = demoTicketProfiles.get(ticketCode) ?? {
    attendeeName: "Demo Guest",
    ticketTypeName: "General Admission",
  };

  const priorCheckedInAt = demoCheckedInCodes.get(key);
  if (priorCheckedInAt) {
    return {
      result: "duplicate",
      attendeeName: profile.attendeeName,
      ticketTypeName: profile.ticketTypeName,
      priorCheckedInAt,
    };
  }

  const checkedInAt = new Date().toISOString();
  demoCheckedInCodes.set(key, checkedInAt);
  return {
    result: "success",
    attendeeName: profile.attendeeName,
    ticketTypeName: profile.ticketTypeName,
    checkedInAt,
  };
}

function demoLookup(input: { eventId: string; sessionId?: string | null; query: string }): CheckInLookupResponse {
  const query = input.query.trim().toLowerCase();
  const matches = demoAttendees.filter((attendee) =>
    [attendee.full_name, attendee.email, attendee.phone]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query)),
  );

  return {
    ok: true,
    results: matches.map((attendee, index) => {
      const ticketCode = index === 0 ? "FCF-DEMO-2026" : "FCF-ANDRE-2026";
      const profile = demoTicketProfiles.get(ticketCode) ?? {
        attendeeName: attendee.full_name,
        ticketTypeName: "General Admission",
      };
      demoTicketProfiles.set(ticketCode, profile);

      return {
        ticketId: attendee.id,
        ticketCode,
        ticketStatus: "active",
        attendeeName: attendee.full_name,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        ticketTypeName: profile.ticketTypeName,
        checkedInAt: demoCheckedInCodes.get(checkInKey(ticketCode, input.eventId, input.sessionId)) ?? null,
      };
    }),
  };
}

function demoCheckInAttendeeList(input: { eventId: string; sessionId?: string | null }): CheckInAttendeeListResponse {
  if (!demoEvents.some((event) => event.id === input.eventId)) {
    return { ok: true, attendees: [] };
  }

  return {
    ok: true,
    attendees: demoAttendees.map((attendee, index) => {
      const ticketCode = index === 0 ? "FCF-DEMO-2026" : "FCF-ANDRE-2026";
      const ticketType = demoTicketTypes[index] ?? demoTicketTypes[0];

      return {
        ...attendee,
        registration_id: `99999999-9999-4999-8999-99999999999${index + 1}`,
        registration_status: "confirmed",
        payment_status: index === 0 ? "paid" : "pending",
        registered_at: attendee.last_registered_at ?? new Date().toISOString(),
        ticket_code: ticketCode,
        ticket_status: "active",
        ticket_type_name: ticketType?.name ?? null,
        checked_in_at: demoCheckedInCodes.get(checkInKey(ticketCode, input.eventId, input.sessionId)) ?? null,
      };
    }),
  };
}

function demoWalkUp(input: {
  eventId: string;
  sessionId?: string | null;
  firstName: string;
  lastName: string;
  ticketTypeId: string;
}): WalkUpCheckInResult {
  const ticketCode = createTicketCode();
  const ticketType = demoTicketTypes.find((type) => type.id === input.ticketTypeId);
  demoTicketProfiles.set(ticketCode, {
    attendeeName: `${input.firstName} ${input.lastName}`,
    ticketTypeName: ticketType?.name ?? "Walk-up",
  });

  const result = demoCheckIn({
    eventId: input.eventId,
    sessionId: input.sessionId,
    ticketCode,
  });

  return {
    ...result,
    ok: result.result === "success" || result.result === "duplicate",
    ticketCode,
    message: result.result === "success" ? "Walk-up guest added and checked in." : "Walk-up guest was already checked in.",
  };
}

async function getCurrentUserId() {
  const sessionClient = await createSupabaseServerClient();
  const { data: sessionData } = sessionClient ? await sessionClient.auth.getUser() : { data: { user: null } };
  return sessionData.user?.id ?? null;
}

async function canUseCheckIn(
  supabase: SupabaseAdminClient,
  organizationId: string,
  eventId: string,
  userId: string | null,
) {
  if (!userId) return process.env.NODE_ENV !== "production";

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, is_active")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = membership?.is_active ? (membership.role as Role) : null;
  if (role === "owner" || role === "admin" || role === "manager") return true;

  const { data: assignment } = await supabase
    .from("event_staff_assignments")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  const assignedRole = assignment?.role as Role | undefined;
  return (
    assignedRole === "owner" ||
    assignedRole === "admin" ||
    assignedRole === "manager" ||
    assignedRole === "check_in_staff"
  );
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "");
}

function isAcceptedCheckInResult(result: CheckInResult["result"]) {
  return result === "success" || result === "duplicate";
}

export async function runCheckIn(input: unknown): Promise<CheckInResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { result: "invalid" };

  const values = {
    ...parsed.data,
    ticketCode: parsed.data.ticketCode.trim(),
  };

  if (!isServiceRoleConfigured()) {
    return demoCheckIn(values);
  }

  const headerStore = await headers();
  const supabase = createSupabaseAdminClient();
  const userId = await getCurrentUserId();

  if (process.env.NODE_ENV === "production" && !userId) {
    return { result: "not_authorized" };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("*")
    .eq("ticket_code", values.ticketCode)
    .maybeSingle();

  if ((ticketError || !ticket) && process.env.NODE_ENV !== "production" && demoEvents.some((event) => event.id === values.eventId)) {
    return demoCheckIn(values);
  }

  if (ticketError || !ticket) return { result: "invalid" };

  const hasAccess = await canUseCheckIn(supabase, ticket.organization_id, values.eventId, userId);
  if (!hasAccess) {
    await logAttempt("not_authorized", ticket.id, ticket.organization_id);
    return { result: "not_authorized" };
  }

  if (ticket.event_id !== values.eventId) {
    await logAttempt("wrong_event", ticket.id, ticket.organization_id);
    return { result: "wrong_event" };
  }

  if (ticket.status === "revoked" || ticket.status === "cancelled") {
    await logAttempt(ticket.status, ticket.id, ticket.organization_id);
    return { result: ticket.status };
  }

  const { data: attendee } = await supabase.from("attendees").select("full_name").eq("id", ticket.attendee_id).maybeSingle();
  const { data: ticketType } = ticket.ticket_type_id
    ? await supabase.from("ticket_types").select("name").eq("id", ticket.ticket_type_id).maybeSingle()
    : { data: null };

  let existingQuery = supabase
    .from("attendance_logs")
    .select("checked_in_at")
    .eq("ticket_id", ticket.id)
    .eq("event_id", values.eventId)
    .eq("scope", values.sessionId ? "session" : "event")
    .limit(1);

  existingQuery = values.sessionId ? existingQuery.eq("session_id", values.sessionId) : existingQuery.is("session_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.checked_in_at) {
    await logAttempt("duplicate", ticket.id, ticket.organization_id, { prior_checked_in_at: existing.checked_in_at });
    return {
      result: "duplicate",
      attendeeName: attendee?.full_name,
      ticketTypeName: ticketType?.name,
      priorCheckedInAt: existing.checked_in_at,
    };
  }

  const checkedInAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("attendance_logs").insert({
    organization_id: ticket.organization_id,
    ticket_id: ticket.id,
    registration_id: ticket.registration_id,
    attendee_id: ticket.attendee_id,
    event_id: values.eventId,
    session_id: values.sessionId,
    scope: values.sessionId ? "session" : "event",
    checked_in_by: userId,
    checked_in_at: checkedInAt,
    device_user_agent: headerStore.get("user-agent"),
  });

  if (insertError) {
    await logAttempt("duplicate", ticket.id, ticket.organization_id, { insert_error: insertError.message });
    return {
      result: "duplicate",
      attendeeName: attendee?.full_name,
      ticketTypeName: ticketType?.name,
      priorCheckedInAt: new Date().toISOString(),
    };
  }

  await supabase
    .from("attendees")
    .update({
      last_attended_at: checkedInAt,
    })
    .eq("id", ticket.attendee_id);

  await logAttempt("success", ticket.id, ticket.organization_id);

  return {
    result: "success",
    attendeeName: attendee?.full_name,
    ticketTypeName: ticketType?.name,
    checkedInAt,
  };

  async function logAttempt(result: CheckInResult["result"], ticketId?: string, organizationId?: string, metadata?: Record<string, unknown>) {
    await supabase.from("check_in_attempts").insert({
      organization_id: organizationId,
      ticket_id: ticketId,
      attempted_by: userId,
      attempted_code: values.ticketCode,
      event_id: values.eventId,
      session_id: values.sessionId,
      result,
      metadata: metadata ?? {},
      user_agent: headerStore.get("user-agent"),
    });
  }
}

export async function searchCheckInGuests(input: unknown): Promise<CheckInLookupResponse> {
  const parsed = checkInLookupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid search.", results: [] };
  }

  const values = parsed.data;

  if (!isServiceRoleConfigured()) {
    return demoLookup(values);
  }

  const supabase = createSupabaseAdminClient();
  const userId = await getCurrentUserId();

  if (process.env.NODE_ENV === "production" && !userId) {
    return { ok: false, message: "You are not authorized to check in guests.", results: [] };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", values.eventId)
    .maybeSingle();

  if (!event) return { ok: false, message: "Event is not available.", results: [] };

  const hasAccess = await canUseCheckIn(supabase, event.organization_id, event.id, userId);
  if (!hasAccess) return { ok: false, message: "You are not authorized to check in this event.", results: [] };

  const query = values.query.trim();
  const normalizedQuery = query.toLowerCase();
  const normalizedPhone = normalizePhone(query);

  const attendeeSearches = [
    supabase
      .from("attendees")
      .select("id")
      .eq("organization_id", event.organization_id)
      .ilike("search_name", `%${normalizedQuery}%`)
      .limit(25),
    supabase
      .from("attendees")
      .select("id")
      .eq("organization_id", event.organization_id)
      .ilike("normalized_email", `%${normalizedQuery}%`)
      .limit(25),
  ];

  if (normalizedPhone.length >= 2) {
    attendeeSearches.push(
      supabase
        .from("attendees")
        .select("id")
        .eq("organization_id", event.organization_id)
        .ilike("normalized_phone", `%${normalizedPhone}%`)
        .limit(25),
    );
  }

  const [{ data: ticketCodeMatches }, ...attendeeResults] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, ticket_code, status, attendee_id, ticket_type_id")
      .eq("event_id", values.eventId)
      .ilike("ticket_code", `%${query}%`)
      .limit(10),
    ...attendeeSearches,
  ]);

  const attendeeIds = [
    ...new Set(
      attendeeResults.flatMap((result) => (result.data ?? []).map((attendee) => attendee.id as string)),
    ),
  ];

  const { data: attendeeTickets } = attendeeIds.length
    ? await supabase
        .from("tickets")
        .select("id, ticket_code, status, attendee_id, ticket_type_id")
        .eq("event_id", values.eventId)
        .in("attendee_id", attendeeIds)
        .limit(30)
    : { data: [] };

  const ticketById = new Map<string, NonNullable<typeof ticketCodeMatches>[number]>();
  for (const ticket of [...(ticketCodeMatches ?? []), ...(attendeeTickets ?? [])]) {
    ticketById.set(ticket.id, ticket);
  }

  const tickets = [...ticketById.values()].slice(0, 30);
  if (!tickets.length) return { ok: true, results: [] };

  const matchedAttendeeIds = [...new Set(tickets.map((ticket) => ticket.attendee_id as string))];
  const ticketTypeIds = [
    ...new Set(tickets.map((ticket) => ticket.ticket_type_id).filter((id): id is string => Boolean(id))),
  ];
  const ticketIds = tickets.map((ticket) => ticket.id as string);

  const [{ data: attendees }, { data: ticketTypes }, attendanceLogs] = await Promise.all([
    supabase
      .from("attendees")
      .select("id, full_name, email, phone")
      .in("id", matchedAttendeeIds),
    ticketTypeIds.length
      ? supabase.from("ticket_types").select("id, name").in("id", ticketTypeIds)
      : Promise.resolve({ data: [] }),
    fetchAttendanceLogs(supabase, ticketIds, values.eventId, values.sessionId),
  ]);

  const attendeeById = new Map((attendees ?? []).map((attendee) => [attendee.id, attendee]));
  const ticketTypeById = new Map((ticketTypes ?? []).map((ticketType) => [ticketType.id, ticketType]));
  const attendanceByTicketId = new Map((attendanceLogs ?? []).map((log) => [log.ticket_id, log.checked_in_at]));

  return {
    ok: true,
    results: tickets.map((ticket) => {
      const attendee = attendeeById.get(ticket.attendee_id);
      const ticketType = ticket.ticket_type_id ? ticketTypeById.get(ticket.ticket_type_id) : null;

      return {
        ticketId: ticket.id,
        ticketCode: ticket.ticket_code,
        ticketStatus: ticket.status,
        attendeeName: attendee?.full_name ?? "Unknown attendee",
        attendeeEmail: attendee?.email ?? null,
        attendeePhone: attendee?.phone ?? null,
        ticketTypeName: ticketType?.name ?? null,
        checkedInAt: attendanceByTicketId.get(ticket.id) ?? null,
      };
    }),
  };
}

export async function listCheckInAttendees(input: unknown): Promise<CheckInAttendeeListResponse> {
  const parsed = checkInAttendeeListSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid attendee list request.",
      attendees: [],
    };
  }

  const values = parsed.data;

  if (!isServiceRoleConfigured()) {
    return demoCheckInAttendeeList(values);
  }

  const supabase = createSupabaseAdminClient();
  const userId = await getCurrentUserId();

  if (process.env.NODE_ENV === "production" && !userId) {
    return { ok: false, message: "You are not authorized to view check-in attendees.", attendees: [] };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", values.eventId)
    .maybeSingle();

  if (!event) return { ok: false, message: "Event is not available.", attendees: [] };

  const hasAccess = await canUseCheckIn(supabase, event.organization_id, event.id, userId);
  if (!hasAccess) {
    return { ok: false, message: "You are not authorized to view this event check-in list.", attendees: [] };
  }

  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("id, attendee_id, ticket_type_id, status, payment_status, registered_at")
    .eq("event_id", values.eventId)
    .order("registered_at", { ascending: false });

  if (error) return { ok: false, message: "Could not load attendees.", attendees: [] };
  if (!registrations?.length) return { ok: true, attendees: [] };

  const registrationIds = registrations.map((registration) => registration.id as string);
  const attendeeIds = [...new Set(registrations.map((registration) => registration.attendee_id as string))];
  const registrationTicketTypeIds = registrations
    .map((registration) => registration.ticket_type_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: attendees }, { data: ticketTypes }, { data: tickets }, attendanceLogs] = await Promise.all([
    supabase.from("attendees").select("*").in("id", attendeeIds),
    registrationTicketTypeIds.length
      ? supabase.from("ticket_types").select("id, name").in("id", registrationTicketTypeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("tickets")
      .select("id, registration_id, ticket_code, status, ticket_type_id")
      .eq("event_id", values.eventId)
      .in("registration_id", registrationIds),
    fetchAttendanceLogsByRegistration(supabase, registrationIds, values.eventId, values.sessionId),
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

  for (const log of attendanceLogs) {
    if (!checkInByRegistrationId.has(log.registration_id)) {
      checkInByRegistrationId.set(log.registration_id, log.checked_in_at);
    }
  }

  return {
    ok: true,
    attendees: registrations.flatMap((registration) => {
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
    }),
  };
}

export async function createWalkUpCheckIn(input: unknown): Promise<WalkUpCheckInResult> {
  const parsed = walkUpCheckInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      result: "invalid",
      message: parsed.error.issues[0]?.message ?? "Invalid walk-up guest.",
    };
  }

  const values = parsed.data;

  if (!isServiceRoleConfigured()) {
    return demoWalkUp(values);
  }

  const supabase = createSupabaseAdminClient();
  const userId = await getCurrentUserId();

  if (process.env.NODE_ENV === "production" && !userId) {
    return { ok: false, result: "not_authorized", message: "You are not authorized to check in guests." };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", values.eventId)
    .maybeSingle();

  if (!event) return { ok: false, result: "invalid", message: "Event is not available." };

  const hasAccess = await canUseCheckIn(supabase, event.organization_id, event.id, userId);
  if (!hasAccess) {
    return { ok: false, result: "not_authorized", message: "You are not authorized to check in this event." };
  }

  const { data: ticketType } = await supabase
    .from("ticket_types")
    .select("id, name, price, currency")
    .eq("id", values.ticketTypeId)
    .eq("event_id", values.eventId)
    .maybeSingle();

  if (!ticketType) return { ok: false, result: "invalid", message: "Ticket type is not available." };

  const email = values.email?.trim() || null;
  const phone = values.phone?.trim() || null;
  const existingAttendee = await findExistingWalkUpAttendee(supabase, event.organization_id, email, phone);

  const attendeePayload = {
    organization_id: event.organization_id,
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    email: email ?? existingAttendee?.email ?? null,
    phone: phone ?? existingAttendee?.phone ?? null,
    company: values.company?.trim() || existingAttendee?.company || null,
    role_title: values.roleTitle?.trim() || existingAttendee?.role_title || null,
  };

  const { data: attendee, error: attendeeError } = existingAttendee?.id
    ? await supabase.from("attendees").update(attendeePayload).eq("id", existingAttendee.id).select("*").single()
    : await supabase.from("attendees").insert(attendeePayload).select("*").single();

  if (attendeeError || !attendee) {
    return { ok: false, result: "invalid", message: "Could not save the walk-up guest." };
  }

  const ticketPrice = Number(ticketType.price ?? 0);
  const isCash = values.paymentMode === "cash";
  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .insert({
      organization_id: event.organization_id,
      event_id: values.eventId,
      attendee_id: attendee.id,
      ticket_type_id: values.ticketTypeId,
      status: "confirmed",
      payment_status: isCash ? "paid" : "comped",
      payment_method: isCash ? "manual" : "comped",
      amount_due: isCash ? ticketPrice : 0,
      amount_paid: isCash ? ticketPrice : 0,
      payment_reference: isCash ? "cash_at_door" : "staff_comp",
      custom_responses: {
        source: "walk_up_check_in",
        createdBy: userId,
      },
    })
    .select("*")
    .single();

  if (registrationError || !registration) {
    return { ok: false, result: "invalid", message: "Could not create a walk-up registration." };
  }

  if (values.sessionId) {
    await supabase.from("registration_sessions").insert({
      organization_id: event.organization_id,
      registration_id: registration.id,
      session_id: values.sessionId,
      status: "confirmed",
    });
  }

  const ticketCode = createTicketCode();
  const { error: ticketError } = await supabase.from("tickets").insert({
    organization_id: event.organization_id,
    registration_id: registration.id,
    event_id: values.eventId,
    attendee_id: attendee.id,
    ticket_type_id: values.ticketTypeId,
    ticket_code: ticketCode,
    qr_token_hash: hashTicketToken(ticketCode),
    status: "active",
  });

  if (ticketError) {
    return { ok: false, result: "invalid", message: "Could not issue a walk-up ticket." };
  }

  const checkInResult = await runCheckIn({
    eventId: values.eventId,
    sessionId: values.sessionId,
    ticketCode,
  });

  await writeAuditLog({
    organizationId: event.organization_id,
    actorUserId: userId ?? undefined,
    action: "check_in.walk_up_created",
    entityType: "registration",
    entityId: registration.id,
    metadata: {
      eventId: values.eventId,
      attendeeId: attendee.id,
      ticketCode,
      paymentMode: values.paymentMode,
      checkedIn: checkInResult.result,
    },
  });

  return {
    ...checkInResult,
    ok: isAcceptedCheckInResult(checkInResult.result),
    ticketCode,
    registrationId: registration.id,
    message:
      checkInResult.result === "success"
        ? "Walk-up guest added and checked in."
        : "Walk-up guest was added, but check-in needs review.",
  };
}

async function fetchAttendanceLogs(
  supabase: SupabaseAdminClient,
  ticketIds: string[],
  eventId: string,
  sessionId?: string | null,
) {
  let query = supabase
    .from("attendance_logs")
    .select("ticket_id, checked_in_at")
    .eq("event_id", eventId)
    .eq("scope", sessionId ? "session" : "event")
    .in("ticket_id", ticketIds);

  query = sessionId ? query.eq("session_id", sessionId) : query.is("session_id", null);
  const { data } = await query;
  return data ?? [];
}

async function fetchAttendanceLogsByRegistration(
  supabase: SupabaseAdminClient,
  registrationIds: string[],
  eventId: string,
  sessionId?: string | null,
) {
  let query = supabase
    .from("attendance_logs")
    .select("registration_id, checked_in_at")
    .eq("event_id", eventId)
    .eq("scope", sessionId ? "session" : "event")
    .in("registration_id", registrationIds)
    .order("checked_in_at", { ascending: false });

  query = sessionId ? query.eq("session_id", sessionId) : query.is("session_id", null);
  const { data } = await query;
  return (data ?? []) as { registration_id: string; checked_in_at: string }[];
}

async function findExistingWalkUpAttendee(
  supabase: SupabaseAdminClient,
  organizationId: string,
  email: string | null,
  phone: string | null,
) {
  if (email) {
    const { data } = await supabase
      .from("attendees")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("normalized_email", email.toLowerCase())
      .maybeSingle();

    if (data) return data;
  }

  const normalizedPhone = phone ? normalizePhone(phone) : "";
  if (normalizedPhone) {
    const { data } = await supabase
      .from("attendees")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("normalized_phone", normalizedPhone)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}
