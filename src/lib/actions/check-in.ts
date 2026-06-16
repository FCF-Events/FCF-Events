"use server";

import { headers } from "next/headers";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoEvents } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkInSchema } from "@/lib/validation";
import type { CheckInResult, Role } from "@/lib/types";

const demoCheckedInCodes = new Set<string>();

function demoCheckIn(values: { ticketCode: string; eventId: string; sessionId?: string | null }): CheckInResult {
  if (!values.ticketCode.startsWith("FCF-")) return { result: "invalid" };
  const key = `${values.ticketCode}:${values.eventId}:${values.sessionId ?? "event"}`;
  if (demoCheckedInCodes.has(key)) {
    return {
      result: "duplicate",
      attendeeName: "Demo Guest",
      ticketTypeName: "General Admission",
      priorCheckedInAt: new Date().toISOString(),
    };
  }
  demoCheckedInCodes.add(key);
  return {
    result: "success",
    attendeeName: "Demo Guest",
    ticketTypeName: "General Admission",
    checkedInAt: new Date().toISOString(),
  };
}

export async function runCheckIn(input: unknown): Promise<CheckInResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { result: "invalid" };

  const values = parsed.data;

  if (!isServiceRoleConfigured()) {
    return demoCheckIn(values);
  }

  const headerStore = await headers();
  const supabase = createSupabaseAdminClient();
  const sessionClient = await createSupabaseServerClient();
  const { data: sessionData } = sessionClient ? await sessionClient.auth.getUser() : { data: { user: null } };
  const userId = sessionData.user?.id ?? null;

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

  if (userId) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", ticket.organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    const role = membership?.is_active ? (membership.role as Role) : null;
    const canAccessAllEvents = role === "owner" || role === "admin" || role === "manager";

    if (!canAccessAllEvents) {
      const { data: assignment } = await supabase
        .from("event_staff_assignments")
        .select("role")
        .eq("organization_id", ticket.organization_id)
        .eq("event_id", values.eventId)
        .eq("user_id", userId)
        .maybeSingle();

      const assignedRole = assignment?.role as Role | undefined;
      const canUseAssignedEvent =
        assignedRole === "owner" ||
        assignedRole === "admin" ||
        assignedRole === "manager" ||
        assignedRole === "check_in_staff";

      if (!canUseAssignedEvent) {
        await logAttempt("not_authorized", ticket.id, ticket.organization_id);
        return { result: "not_authorized" };
      }
    }
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
