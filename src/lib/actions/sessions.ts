"use server";

import { revalidatePath } from "next/cache";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sessionUpdateSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export async function updateSessionAction(input: FormData) {
  const parsed = sessionUpdateSchema.safeParse({
    sessionId: input.get("sessionId"),
    eventId: input.get("eventId"),
    eventDayId: input.get("eventDayId"),
    title: input.get("title"),
    slug: input.get("slug"),
    startsAt: input.get("startsAt"),
    endsAt: input.get("endsAt"),
    room: input.get("room"),
    description: input.get("description"),
    capacity: input.get("capacity") || undefined,
    status: input.get("status"),
    type: input.get("type"),
    requiresRegistration: checkboxValue(input.get("requiresRegistration")),
    requiresSeparateCheckIn: checkboxValue(input.get("requiresSeparateCheckIn")),
    allowedTicketTypeIds: input.getAll("allowedTicketTypeIds").map((value) => String(value)),
    waitlistEnabled: checkboxValue(input.get("waitlistEnabled")),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid session." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Session validated. Connect Supabase to persist it.", persisted: false };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: existingSession, error: sessionError } = await supabase
    .from("sessions")
    .select("id, organization_id, event_id")
    .eq("id", values.sessionId)
    .maybeSingle();

  if (sessionError || !existingSession) return { ok: false, message: "Session not found." };

  const eventIds = [...new Set([existingSession.event_id, values.eventId])];
  const { data: relatedEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, organization_id, slug")
    .in("id", eventIds);

  if (eventsError) return { ok: false, message: eventsError.message };

  const eventById = new Map((relatedEvents ?? []).map((event) => [event.id, event]));
  const selectedEvent = eventById.get(values.eventId);
  if (!selectedEvent || selectedEvent.organization_id !== existingSession.organization_id) {
    return { ok: false, message: "Selected event not found." };
  }

  const selectedEventDayId = values.eventDayId || null;
  if (selectedEventDayId) {
    const { data: selectedDay } = await supabase
      .from("event_days")
      .select("id")
      .eq("id", selectedEventDayId)
      .eq("event_id", values.eventId)
      .eq("organization_id", existingSession.organization_id)
      .maybeSingle();

    if (!selectedDay) return { ok: false, message: "Selected event day not found." };
  }

  if (values.allowedTicketTypeIds.length) {
    const { data: allowedTicketTypes } = await supabase
      .from("ticket_types")
      .select("id")
      .eq("event_id", values.eventId)
      .eq("organization_id", existingSession.organization_id)
      .in("id", values.allowedTicketTypeIds);

    if ((allowedTicketTypes ?? []).length !== values.allowedTicketTypeIds.length) {
      return { ok: false, message: "One or more allowed ticket types are not valid for this event." };
    }
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      event_id: values.eventId,
      event_day_id: selectedEventDayId,
      title: values.title,
      slug: values.slug,
      description: values.description || "",
      room: values.room || null,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      capacity: values.capacity ?? null,
      status: values.status,
      type: values.type,
      requires_registration: values.requiresRegistration,
      requires_separate_check_in: values.requiresSeparateCheckIn,
      allowed_ticket_type_ids: values.allowedTicketTypeIds,
      waitlist_enabled: values.waitlistEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.sessionId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: existingSession.organization_id,
    action: "session.updated",
    entityType: "session",
    entityId: existingSession.id,
  });

  const affectedEventSlugs = new Set(
    [eventById.get(existingSession.event_id)?.slug, selectedEvent.slug].filter((slug): slug is string => Boolean(slug)),
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sessions");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/check-in");
  for (const slug of affectedEventSlugs) {
    revalidatePath(`/dashboard/events/${slug}`);
    revalidatePath(`/e/${slug}`);
  }

  return { ok: true, message: "Session updated.", persisted: true };
}
