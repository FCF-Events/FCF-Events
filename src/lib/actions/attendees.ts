"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { attendeeRegistrationUpdateSchema, attendeeUpdateSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

type AttendeeActionResult = {
  ok: boolean;
  message: string;
};

export async function updateAttendeeAction(input: FormData): Promise<AttendeeActionResult> {
  const access = await requireDashboardAccess(["owner", "admin", "manager"]);
  const parsed = attendeeUpdateSchema.safeParse({
    attendeeId: input.get("attendeeId"),
    firstName: input.get("firstName"),
    lastName: input.get("lastName"),
    email: input.get("email"),
    phone: input.get("phone"),
    company: input.get("company"),
    roleTitle: input.get("roleTitle"),
    dateOfBirth: input.get("dateOfBirth"),
    notes: input.get("notes"),
    smsConsent: input.get("smsConsent") === "on",
    emailConsent: input.get("emailConsent") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid attendee update." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Attendee update validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: attendee, error } = await supabase
    .from("attendees")
    .update({
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      role_title: values.roleTitle || null,
      date_of_birth: values.dateOfBirth || null,
      notes: values.notes || null,
      sms_consent_status: values.smsConsent,
      email_consent_status: values.emailConsent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.attendeeId)
    .select("id, organization_id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Another attendee already uses that email address." };
    }

    return { ok: false, message: error.message };
  }

  if (!attendee) {
    return { ok: false, message: "Attendee not found." };
  }

  await writeAuditLog({
    organizationId: attendee.organization_id,
    actorUserId: access.userId ?? undefined,
    action: "attendee.updated",
    entityType: "attendee",
    entityId: attendee.id,
  });

  revalidatePath("/dashboard/attendees");
  revalidatePath(`/dashboard/attendees/${attendee.id}`);

  return { ok: true, message: "Attendee updated." };
}

export async function updateAttendeeRegistrationEventAction(input: FormData): Promise<AttendeeActionResult> {
  const access = await requireDashboardAccess(["owner", "admin", "manager"]);
  const parsed = attendeeRegistrationUpdateSchema.safeParse({
    attendeeId: input.get("attendeeId"),
    registrationId: input.get("registrationId"),
    eventId: input.get("eventId"),
    ticketTypeId: input.get("ticketTypeId") || "",
    sessionIds: input.getAll("sessionIds").map(String),
    registrationStatus: input.get("registrationStatus"),
    paymentStatus: input.get("paymentStatus"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid event assignment." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Event assignment validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  const sessionIds = [...new Set(values.sessionIds)];
  const ticketTypeId = values.ticketTypeId || null;
  const supabase = createSupabaseAdminClient();

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .select("id, organization_id, attendee_id, event_id, ticket_type_id")
    .eq("id", values.registrationId)
    .eq("attendee_id", values.attendeeId)
    .maybeSingle();

  if (registrationError) return { ok: false, message: registrationError.message };
  if (!registration) return { ok: false, message: "Registration not found for this attendee." };

  const { data: targetEvent, error: eventError } = await supabase
    .from("events")
    .select("id, organization_id, slug, title")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError) return { ok: false, message: eventError.message };
  if (!targetEvent || targetEvent.organization_id !== registration.organization_id) {
    return { ok: false, message: "Target event is not available for this attendee." };
  }

  const eventChanged = registration.event_id !== values.eventId;
  if (eventChanged) {
    const { count: attendanceCount } = await supabase
      .from("attendance_logs")
      .select("*", { count: "exact", head: true })
      .eq("registration_id", values.registrationId);

    if ((attendanceCount ?? 0) > 0) {
      return { ok: false, message: "This registration already has check-in history, so it cannot be moved to another event." };
    }
  }

  let amountDue: number | null = null;
  let ticketAllowedEventDayIds: string[] = [];
  if (ticketTypeId) {
    const [{ data: ticketType, error: ticketTypeError }, { data: eventDays }, { data: accessRows }] = await Promise.all([
      supabase
        .from("ticket_types")
        .select("id, event_id, price")
        .eq("id", ticketTypeId)
        .eq("event_id", values.eventId)
        .maybeSingle(),
      supabase.from("event_days").select("id").eq("event_id", values.eventId).order("sort_order"),
      supabase.from("ticket_type_day_access").select("event_day_id").eq("ticket_type_id", ticketTypeId),
    ]);

    if (ticketTypeError) return { ok: false, message: ticketTypeError.message };
    if (!ticketType) return { ok: false, message: "Choose a ticket type that belongs to the selected event." };
    amountDue = Number(ticketType.price ?? 0);
    ticketAllowedEventDayIds = (accessRows ?? []).length
      ? (accessRows ?? []).map((row) => row.event_day_id as string)
      : (eventDays ?? []).map((day) => day.id as string);
  } else {
    const { data: eventDays } = await supabase.from("event_days").select("id").eq("event_id", values.eventId).order("sort_order");
    ticketAllowedEventDayIds = (eventDays ?? []).map((day) => day.id as string);
  }

  if (sessionIds.length) {
    const { data: matchingSessions, error: sessionError } = await supabase
      .from("sessions")
      .select("id, event_day_id, allowed_ticket_type_ids")
      .eq("event_id", values.eventId)
      .in("id", sessionIds);

    if (sessionError) return { ok: false, message: sessionError.message };
    if ((matchingSessions ?? []).length !== sessionIds.length) {
      return { ok: false, message: "Selected sessions must belong to the selected event." };
    }

    for (const session of matchingSessions ?? []) {
      const sessionDayId = session.event_day_id as string | null;
      const allowedTicketTypeIds = (session.allowed_ticket_type_ids ?? []) as string[];
      if (sessionDayId && !ticketAllowedEventDayIds.includes(sessionDayId)) {
        return { ok: false, message: "The selected ticket type does not include one or more selected sessions." };
      }
      if (allowedTicketTypeIds.length && (!ticketTypeId || !allowedTicketTypeIds.includes(ticketTypeId))) {
        return { ok: false, message: "The selected ticket type is not eligible for one or more selected sessions." };
      }
    }
  }

  const registrationUpdate: Record<string, unknown> = {
    event_id: values.eventId,
    ticket_type_id: ticketTypeId,
    status: values.registrationStatus,
    payment_status: values.paymentStatus,
    cancelled_at: values.registrationStatus === "cancelled" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (amountDue !== null) {
    registrationUpdate.amount_due = amountDue;
  }

  const { error: updateError } = await supabase
    .from("registrations")
    .update(registrationUpdate)
    .eq("id", values.registrationId);

  if (updateError) return { ok: false, message: updateError.message };

  const ticketUpdate: Record<string, unknown> = {
    event_id: values.eventId,
    ticket_type_id: ticketTypeId,
    updated_at: new Date().toISOString(),
  };

  if (values.registrationStatus === "cancelled") {
    ticketUpdate.status = "cancelled";
  }

  const { error: ticketError } = await supabase
    .from("tickets")
    .update(ticketUpdate)
    .eq("registration_id", values.registrationId);

  if (ticketError) return { ok: false, message: ticketError.message };

  const { error: deleteSessionsError } = await supabase
    .from("registration_sessions")
    .delete()
    .eq("registration_id", values.registrationId);

  if (deleteSessionsError) return { ok: false, message: deleteSessionsError.message };

  if (sessionIds.length) {
    const { error: insertSessionsError } = await supabase.from("registration_sessions").insert(
      sessionIds.map((sessionId) => ({
        organization_id: registration.organization_id,
        registration_id: values.registrationId,
        session_id: sessionId,
        status: values.registrationStatus,
      })),
    );

    if (insertSessionsError) return { ok: false, message: insertSessionsError.message };
  }

  await writeAuditLog({
    organizationId: registration.organization_id,
    actorUserId: access.userId ?? undefined,
    action: "attendee.registration.updated",
    entityType: "registration",
    entityId: values.registrationId,
    metadata: {
      attendeeId: values.attendeeId,
      oldEventId: registration.event_id,
      newEventId: values.eventId,
      ticketTypeId,
      sessionIds,
      registrationStatus: values.registrationStatus,
      paymentStatus: values.paymentStatus,
    },
  });

  if (eventChanged) {
    const { data: oldEvent } = await supabase
      .from("events")
      .select("slug")
      .eq("id", registration.event_id)
      .maybeSingle();

    if (oldEvent?.slug) {
      revalidatePath(`/dashboard/events/${oldEvent.slug}`);
    }
  }

  revalidatePath("/dashboard/attendees");
  revalidatePath(`/dashboard/attendees/${values.attendeeId}`);
  revalidatePath(`/dashboard/events/${targetEvent.slug}`);

  return { ok: true, message: "Event assignment updated." };
}
