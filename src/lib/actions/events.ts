"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoOrganizationId } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { eventSchema, eventUpdateSchema, ticketTypeSchema, zeffyEventSettingsSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import type { Role } from "@/lib/types";

const EVENT_MANAGEMENT_ROLES: Role[] = ["owner", "admin", "manager"];

type ActionResult = {
  ok: boolean;
  message: string;
};

export async function createEventAction(input: FormData) {
  const zeffyFields = readZeffyFields(input);
  const parsed = eventSchema.safeParse({
    title: input.get("title"),
    slug: input.get("slug"),
    startsAt: input.get("startsAt"),
    endsAt: input.get("endsAt"),
    venueName: input.get("venueName"),
    address: input.get("address"),
    room: input.get("room"),
    description: input.get("description"),
    complianceNotes: input.get("complianceNotes"),
    capacity: input.get("capacity") || undefined,
    status: input.get("status"),
    visibility: input.get("visibility"),
    minimumAge: input.get("minimumAge"),
    ...zeffyFields,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid event." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Event validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      organization_id: demoOrganizationId,
      title: values.title,
      slug: values.slug,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      venue_name: values.venueName,
      address: values.address,
      room: values.room,
      description: values.description,
      compliance_notes: values.complianceNotes || null,
      capacity: values.capacity,
      status: values.status,
      visibility: values.visibility,
      minimum_age: values.minimumAge,
      zeffy_campaign_id: values.zeffyCampaignId || null,
      zeffy_form_url: values.zeffyFormUrl || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: demoOrganizationId,
    action: "event.created",
    entityType: "event",
    entityId: data.id,
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/check-in");
  revalidatePath(`/e/${values.slug}`);
  return { ok: true, message: "Event created." };
}

export async function updateEventAction(input: FormData) {
  const zeffyFields = readZeffyFields(input);
  const parsed = eventUpdateSchema.safeParse({
    eventId: input.get("eventId"),
    title: input.get("title"),
    slug: input.get("slug"),
    startsAt: input.get("startsAt"),
    endsAt: input.get("endsAt"),
    venueName: input.get("venueName"),
    address: input.get("address"),
    room: input.get("room"),
    description: input.get("description"),
    complianceNotes: input.get("complianceNotes"),
    capacity: input.get("capacity") || undefined,
    status: input.get("status"),
    visibility: input.get("visibility"),
    minimumAge: input.get("minimumAge"),
    ...zeffyFields,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid event." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Event validated. Connect Supabase to persist it.", persisted: false };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: existingEvent, error: eventError } = await supabase
    .from("events")
    .select("id, organization_id, slug")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError || !existingEvent) return { ok: false, message: "Event not found." };

  const { error } = await supabase
    .from("events")
    .update({
      title: values.title,
      slug: values.slug,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      venue_name: values.venueName || null,
      address: values.address || null,
      room: values.room || null,
      description: values.description,
      compliance_notes: values.complianceNotes || null,
      capacity: values.capacity ?? null,
      status: values.status,
      visibility: values.visibility,
      minimum_age: values.minimumAge,
      zeffy_campaign_id: values.zeffyCampaignId || null,
      zeffy_form_url: values.zeffyFormUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.eventId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: existingEvent.organization_id,
    action: "event.updated",
    entityType: "event",
    entityId: existingEvent.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/check-in");
  revalidatePath("/");
  revalidatePath(`/dashboard/events/${existingEvent.slug}`);
  revalidatePath(`/dashboard/events/${values.slug}`);
  revalidatePath(`/e/${existingEvent.slug}`);
  revalidatePath(`/e/${values.slug}`);

  return { ok: true, message: "Event updated.", persisted: true, slug: values.slug };
}

export async function updateEventZeffySettingsAction(input: FormData) {
  const zeffyFields = readZeffyFields(input);
  const parsed = zeffyEventSettingsSchema.safeParse({
    eventId: input.get("eventId"),
    ...zeffyFields,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid Zeffy settings." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Zeffy settings validated. Connect Supabase to persist them." };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, organization_id, slug")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError || !event) return { ok: false, message: "Event not found." };

  const { error } = await supabase
    .from("events")
    .update({
      zeffy_campaign_id: values.zeffyCampaignId || null,
      zeffy_form_url: values.zeffyFormUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.eventId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: event.organization_id,
    action: "event.zeffy_settings.updated",
    entityType: "event",
    entityId: event.id,
  });

  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${event.slug}`);
  revalidatePath(`/e/${event.slug}`);
  return { ok: true, message: "Zeffy settings updated." };
}

export async function createTicketTypeAction(input: FormData): Promise<ActionResult> {
  const access = await requireDashboardAccess(EVENT_MANAGEMENT_ROLES);
  const parsed = ticketTypeSchema.safeParse(readTicketTypeForm(input));

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid ticket type." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Ticket type validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, organization_id, slug")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError || !event) return { ok: false, message: "Event not found." };

  const { data, error } = await supabase
    .from("ticket_types")
    .insert({
      organization_id: event.organization_id,
      event_id: event.id,
      ...toTicketTypePayload(values),
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: event.organization_id,
    actorUserId: access.userId ?? undefined,
    action: "ticket_type.created",
    entityType: "ticket_type",
    entityId: data.id,
    metadata: { eventId: event.id, name: values.name },
  });

  revalidateTicketTypePaths(event.slug);
  return { ok: true, message: "Ticket type created." };
}

export async function updateTicketTypeAction(input: FormData): Promise<ActionResult> {
  const access = await requireDashboardAccess(EVENT_MANAGEMENT_ROLES);
  const parsed = ticketTypeSchema.safeParse(readTicketTypeForm(input, { requireId: true }));

  if (!parsed.success || !parsed.data.id) {
    return { ok: false, message: parsed.error?.issues[0]?.message ?? "Choose a ticket type to update." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Ticket type changes validated. Connect Supabase to persist them." };
  }

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, organization_id, slug")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError || !event) return { ok: false, message: "Event not found." };

  const { data, error } = await supabase
    .from("ticket_types")
    .update({
      ...toTicketTypePayload(values),
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.id)
    .eq("event_id", event.id)
    .eq("organization_id", event.organization_id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Ticket type not found." };

  await writeAuditLog({
    organizationId: event.organization_id,
    actorUserId: access.userId ?? undefined,
    action: "ticket_type.updated",
    entityType: "ticket_type",
    entityId: data.id,
    metadata: { eventId: event.id, name: values.name },
  });

  revalidateTicketTypePaths(event.slug);
  return { ok: true, message: "Ticket type updated." };
}

function readTicketTypeForm(input: FormData, options?: { requireId?: boolean }) {
  const ticketTypeId = String(input.get("id") ?? "").trim();

  return {
    id: options?.requireId ? ticketTypeId : ticketTypeId || undefined,
    eventId: input.get("eventId"),
    name: input.get("name"),
    description: input.get("description") ?? "",
    price: input.get("price"),
    currency: input.get("currency") || "CAD",
    capacityLimit: input.get("capacityLimit"),
    visibility: input.get("visibility"),
  };
}

function toTicketTypePayload(values: ReturnType<typeof ticketTypeSchema.parse>) {
  return {
    name: values.name,
    description: values.description || "",
    price: values.price,
    currency: values.currency,
    capacity_limit: values.capacityLimit ?? null,
    visibility: values.visibility,
    payment_method: values.price === 0 ? "free" : "manual",
  };
}

function revalidateTicketTypePaths(eventSlug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/discounts");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/check-in");
  revalidatePath(`/dashboard/events/${eventSlug}`);
  revalidatePath(`/e/${eventSlug}`);
}

function readZeffyFields(input: FormData) {
  let zeffyCampaignId = String(input.get("zeffyCampaignId") ?? "").trim();
  let zeffyFormUrl = String(input.get("zeffyFormUrl") ?? "").trim();

  if (isZeffyUrl(zeffyCampaignId)) {
    zeffyFormUrl ||= zeffyCampaignId;
    zeffyCampaignId = "";
  }

  return { zeffyCampaignId, zeffyFormUrl };
}

function isZeffyUrl(value: string) {
  return /^https?:\/\/([^/]+\.)?zeffy\.com\//i.test(value);
}
