"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoOrganizationId } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  eventSchema,
  eventTicketTypesCreateSchema,
  eventUpdateSchema,
  ticketTypeSchema,
  zeffyEventSettingsSchema,
} from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import type { Role } from "@/lib/types";
import { fetchZeffyTicketOffers, type ZeffyTicketOffer } from "@/lib/zeffy";

const EVENT_MANAGEMENT_ROLES: Role[] = ["owner", "admin", "manager"];

type ActionResult = {
  ok: boolean;
  message: string;
};

export async function createEventAction(input: FormData) {
  const zeffyFields = readZeffyFields(input);
  const ticketTypes = readTicketTypeDraftForms(input);
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
  const parsedTicketTypes = eventTicketTypesCreateSchema.safeParse(ticketTypes);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid event." };
  }

  if (!parsedTicketTypes.success) {
    return { ok: false, message: parsedTicketTypes.error.issues[0]?.message ?? "Invalid ticket types." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Event and ticket types validated. Connect Supabase to persist them.", persisted: false };
  }

  const values = parsed.data;
  const ticketTypeValues = parsedTicketTypes.data;
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

  const eventDays = await ensureEventDaysForEvent(supabase, {
    eventId: data.id,
    organizationId: demoOrganizationId,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
  });

  if (ticketTypeValues.length) {
    const { data: createdTicketTypes, error: ticketTypeError } = await supabase.from("ticket_types").insert(
      ticketTypeValues.map((ticketType) => ({
        organization_id: demoOrganizationId,
        event_id: data.id,
        ...toTicketTypePayload(ticketType),
      })),
    ).select("id");

    if (ticketTypeError) {
      await supabase.from("events").delete().eq("id", data.id).eq("organization_id", demoOrganizationId);
      return { ok: false, message: ticketTypeError.message };
    }

    await setTicketTypesDefaultDayAccess({
      supabase,
      organizationId: demoOrganizationId,
      ticketTypeIds: (createdTicketTypes ?? []).map((ticketType) => ticketType.id as string),
      eventDayIds: eventDays.map((day) => day.id),
    });
  }

  const syncResult = values.zeffyFormUrl
    ? await syncZeffyTicketTypes({
        supabase,
        eventId: data.id,
        organizationId: demoOrganizationId,
        formUrl: values.zeffyFormUrl,
      })
    : null;

  await writeAuditLog({
    organizationId: demoOrganizationId,
    action: "event.created",
    entityType: "event",
    entityId: data.id,
    metadata: { ticketTypeCount: ticketTypeValues.length + (syncResult?.synced ?? 0) },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/check-in");
  revalidatePath(`/e/${values.slug}`);
  return {
    ok: true,
    message: withZeffySyncMessage(
      ticketTypeValues.length ? "Event and ticket types created." : "Event created.",
      syncResult,
    ),
    persisted: true,
    slug: values.slug,
  };
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

  await ensureEventDaysForEvent(supabase, {
    eventId: existingEvent.id,
    organizationId: existingEvent.organization_id,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
  });

  const syncResult = values.zeffyFormUrl
    ? await syncZeffyTicketTypes({
        supabase,
        eventId: existingEvent.id,
        organizationId: existingEvent.organization_id,
        formUrl: values.zeffyFormUrl,
      })
    : null;

  await writeAuditLog({
    organizationId: existingEvent.organization_id,
    action: "event.updated",
    entityType: "event",
    entityId: existingEvent.id,
    metadata: syncResult ? { zeffyTicketTypesSynced: syncResult.synced } : undefined,
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

  return {
    ok: true,
    message: withZeffySyncMessage("Event updated.", syncResult),
    persisted: true,
    slug: values.slug,
  };
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

  const syncResult = values.zeffyFormUrl
    ? await syncZeffyTicketTypes({
        supabase,
        eventId: event.id,
        organizationId: event.organization_id,
        formUrl: values.zeffyFormUrl,
      })
    : null;

  await writeAuditLog({
    organizationId: event.organization_id,
    action: "event.zeffy_settings.updated",
    entityType: "event",
    entityId: event.id,
    metadata: syncResult ? { zeffyTicketTypesSynced: syncResult.synced } : undefined,
  });

  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${event.slug}`);
  revalidatePath(`/e/${event.slug}`);
  return { ok: true, message: withZeffySyncMessage("Zeffy settings updated.", syncResult) };
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

  await replaceTicketTypeDayAccess({
    supabase,
    organizationId: event.organization_id,
    eventId: event.id,
    ticketTypeId: data.id,
    eventDayIds: values.eventDayIds,
  });

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

  await replaceTicketTypeDayAccess({
    supabase,
    organizationId: event.organization_id,
    eventId: event.id,
    ticketTypeId: data.id,
    eventDayIds: values.eventDayIds,
  });

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
    eventDayIds: input.getAll("eventDayIds").map((value) => String(value)),
  };
}

type TicketTypePayloadValues = {
  name: string;
  description?: string;
  price: number;
  currency: string;
  capacityLimit?: number;
  visibility: "public" | "private" | "hidden";
};

function toTicketTypePayload(values: TicketTypePayloadValues) {
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

type ZeffyTicketSyncResult = {
  synced: number;
  inserted: number;
  updated: number;
  error?: string;
};

async function syncZeffyTicketTypes({
  supabase,
  eventId,
  organizationId,
  formUrl,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  eventId: string;
  organizationId: string;
  formUrl: string;
}): Promise<ZeffyTicketSyncResult> {
  try {
    const offers = await fetchZeffyTicketOffers(formUrl);
    if (!offers.length) {
      return { synced: 0, inserted: 0, updated: 0, error: "No Zeffy ticket prices were found on the form." };
    }

    const { data: existingTicketTypes, error } = await supabase
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", eventId)
      .eq("organization_id", organizationId);

    if (error) return { synced: 0, inserted: 0, updated: 0, error: error.message };

    const existingByName = new Map(
      (existingTicketTypes ?? []).map((ticketType) => [normalizeTicketName(ticketType.name as string), ticketType.id as string]),
    );
    let inserted = 0;
    let updated = 0;

    for (const offer of offers) {
      const existingId = existingByName.get(normalizeTicketName(offer.name));
      const payload = toZeffyTicketTypePayload(offer);

      if (existingId) {
        const { error: updateError } = await supabase
          .from("ticket_types")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId)
          .eq("event_id", eventId)
          .eq("organization_id", organizationId);

        if (updateError) return { synced: inserted + updated, inserted, updated, error: updateError.message };
        updated += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("ticket_types").insert({
        organization_id: organizationId,
        event_id: eventId,
        ...payload,
      });

      if (insertError) return { synced: inserted + updated, inserted, updated, error: insertError.message };
      inserted += 1;
    }

    await ensureTicketTypesHaveDefaultDayAccess({ supabase, eventId, organizationId });
    return { synced: inserted + updated, inserted, updated };
  } catch (error) {
    return {
      synced: 0,
      inserted: 0,
      updated: 0,
      error: error instanceof Error ? error.message : "Could not sync Zeffy ticket prices.",
    };
  }
}

type EventDayRow = {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
};

async function ensureEventDaysForEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  values: { eventId: string; organizationId: string; startsAt: string; endsAt: string },
): Promise<EventDayRow[]> {
  const drafts = buildEventDayDrafts(values.startsAt, values.endsAt);
  const { data: existingDays } = await supabase
    .from("event_days")
    .select("id, label, sort_order")
    .eq("event_id", values.eventId)
    .order("sort_order");
  const existingBySortOrder = new Map((existingDays ?? []).map((day) => [day.sort_order as number, day]));

  const { data, error } = await supabase
    .from("event_days")
    .upsert(
      drafts.map((day) => ({
        organization_id: values.organizationId,
        event_id: values.eventId,
        label: String(existingBySortOrder.get(day.sortOrder)?.label ?? `Day ${day.sortOrder + 1}`),
        starts_at: day.startsAt,
        ends_at: day.endsAt,
        sort_order: day.sortOrder,
      })),
      { onConflict: "event_id,sort_order" },
    )
    .select("id, label, starts_at, ends_at, sort_order")
    .order("sort_order");

  if (error) throw new Error(error.message);
  return (data ?? []) as EventDayRow[];
}

function buildEventDayDrafts(startsAt: string, endsAt: string) {
  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return [{ startsAt, endsAt, sortOrder: 0 }];
  }

  const firstDayUtc = Date.UTC(starts.getUTCFullYear(), starts.getUTCMonth(), starts.getUTCDate());
  const lastDayUtc = Date.UTC(ends.getUTCFullYear(), ends.getUTCMonth(), ends.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const dayCount = Math.max(1, Math.round((lastDayUtc - firstDayUtc) / dayMs) + 1);

  return Array.from({ length: dayCount }, (_, index) => {
    const dayStart = new Date(firstDayUtc + index * dayMs);
    const nextDayStart = new Date(firstDayUtc + (index + 1) * dayMs);
    const draftStarts = index === 0 ? starts : dayStart;
    const draftEnds = index === dayCount - 1 ? ends : nextDayStart;

    return {
      startsAt: draftStarts.toISOString(),
      endsAt: draftEnds.toISOString(),
      sortOrder: index,
    };
  }).filter((day) => new Date(day.endsAt) > new Date(day.startsAt));
}

async function getEventDayIds(supabase: ReturnType<typeof createSupabaseAdminClient>, eventId: string) {
  const { data } = await supabase.from("event_days").select("id").eq("event_id", eventId).order("sort_order");
  return (data ?? []).map((day) => day.id as string);
}

async function replaceTicketTypeDayAccess({
  supabase,
  organizationId,
  eventId,
  ticketTypeId,
  eventDayIds,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  eventDayIds: string[];
}) {
  const fallbackDayIds = await getEventDayIds(supabase, eventId);
  const dayIds = eventDayIds.length ? eventDayIds : fallbackDayIds;

  await supabase.from("ticket_type_day_access").delete().eq("ticket_type_id", ticketTypeId);

  if (dayIds.length) {
    await supabase.from("ticket_type_day_access").insert(
      dayIds.map((eventDayId) => ({
        organization_id: organizationId,
        ticket_type_id: ticketTypeId,
        event_day_id: eventDayId,
      })),
    );
  }
}

async function setTicketTypesDefaultDayAccess({
  supabase,
  organizationId,
  ticketTypeIds,
  eventDayIds,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  ticketTypeIds: string[];
  eventDayIds: string[];
}) {
  if (!ticketTypeIds.length || !eventDayIds.length) return;

  await supabase.from("ticket_type_day_access").insert(
    ticketTypeIds.flatMap((ticketTypeId) =>
      eventDayIds.map((eventDayId) => ({
        organization_id: organizationId,
        ticket_type_id: ticketTypeId,
        event_day_id: eventDayId,
      })),
    ),
  );
}

async function ensureTicketTypesHaveDefaultDayAccess({
  supabase,
  eventId,
  organizationId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  eventId: string;
  organizationId: string;
}) {
  const [{ data: ticketTypes }, eventDayIdsResult] = await Promise.all([
    supabase.from("ticket_types").select("id").eq("event_id", eventId).eq("organization_id", organizationId),
    getEventDayIds(supabase, eventId),
  ]);
  const eventDayIds = eventDayIdsResult;
  const ticketTypeIds = (ticketTypes ?? []).map((ticketType) => ticketType.id as string);
  if (!ticketTypeIds.length || !eventDayIds.length) return;

  const { data: accessRows } = await supabase
    .from("ticket_type_day_access")
    .select("ticket_type_id")
    .in("ticket_type_id", ticketTypeIds);
  const ticketTypesWithAccess = new Set((accessRows ?? []).map((access) => access.ticket_type_id as string));
  const missingTicketTypeIds = ticketTypeIds.filter((ticketTypeId) => !ticketTypesWithAccess.has(ticketTypeId));

  await setTicketTypesDefaultDayAccess({
    supabase,
    organizationId,
    ticketTypeIds: missingTicketTypeIds,
    eventDayIds,
  });
}

function toZeffyTicketTypePayload(offer: ZeffyTicketOffer) {
  return {
    name: offer.name,
    description: offer.description.slice(0, 1000),
    price: offer.price,
    currency: offer.currency,
    capacity_limit: null,
    visibility: "public" as const,
    payment_method: offer.price === 0 ? "free" : "future_provider",
  };
}

function normalizeTicketName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function withZeffySyncMessage(message: string, syncResult: ZeffyTicketSyncResult | null) {
  if (!syncResult) return message;
  if (syncResult.error) return `${message} Zeffy ticket sync warning: ${syncResult.error}`;
  if (!syncResult.synced) return `${message} No Zeffy ticket prices were found.`;
  return `${message} Synced ${syncResult.synced} Zeffy ticket type${syncResult.synced === 1 ? "" : "s"}.`;
}

function readTicketTypeDraftForms(input: FormData) {
  const names = input.getAll("ticketName");
  const descriptions = input.getAll("ticketDescription");
  const prices = input.getAll("ticketPrice");
  const currencies = input.getAll("ticketCurrency");
  const capacityLimits = input.getAll("ticketCapacityLimit");
  const visibilities = input.getAll("ticketVisibility");
  const count = Math.max(
    names.length,
    descriptions.length,
    prices.length,
    currencies.length,
    capacityLimits.length,
    visibilities.length,
  );

  return Array.from({ length: count }).flatMap((_, index) => {
    const name = String(names[index] ?? "").trim();
    const description = String(descriptions[index] ?? "").trim();
    const price = String(prices[index] ?? "").trim();
    const capacityLimit = String(capacityLimits[index] ?? "").trim();

    if (!name && !description && !price && !capacityLimit) return [];

    return {
      name,
      description,
      price,
      currency: String(currencies[index] ?? "CAD"),
      capacityLimit,
      visibility: String(visibilities[index] ?? "public"),
    };
  });
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
