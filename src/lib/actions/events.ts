"use server";

import { revalidatePath } from "next/cache";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoOrganizationId } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { eventSchema, eventUpdateSchema, zeffyEventSettingsSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

export async function createEventAction(input: FormData) {
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
    zeffyCampaignId: input.get("zeffyCampaignId"),
    zeffyFormUrl: input.get("zeffyFormUrl"),
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

  revalidatePath("/dashboard/events");
  return { ok: true, message: "Event created." };
}

export async function updateEventAction(input: FormData) {
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
    zeffyCampaignId: input.get("zeffyCampaignId"),
    zeffyFormUrl: input.get("zeffyFormUrl"),
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
  revalidatePath(`/dashboard/events/${existingEvent.slug}`);
  revalidatePath(`/dashboard/events/${values.slug}`);
  revalidatePath(`/e/${existingEvent.slug}`);
  revalidatePath(`/e/${values.slug}`);

  return { ok: true, message: "Event updated.", persisted: true, slug: values.slug };
}

export async function updateEventZeffySettingsAction(input: FormData) {
  const parsed = zeffyEventSettingsSchema.safeParse({
    eventId: input.get("eventId"),
    zeffyCampaignId: input.get("zeffyCampaignId"),
    zeffyFormUrl: input.get("zeffyFormUrl"),
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
