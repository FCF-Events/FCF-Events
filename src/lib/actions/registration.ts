"use server";

import { differenceInYears } from "date-fns";
import { isServiceRoleConfigured } from "@/lib/env";
import { demoEvents, demoOrganizationId } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEmailSend } from "@/lib/email/logging";
import { sendRegistrationConfirmationEmail } from "@/lib/email/registration-confirmation";
import { createTicketCode, hashTicketToken } from "@/lib/security/qr";
import { registrationSchema } from "@/lib/validation";
import type { RegistrationResult } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";
import { buildZeffyPaymentUrl } from "@/lib/zeffy";

export async function registerForEvent(input: unknown): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid registration." };
  }

  const values = parsed.data;
  const age = differenceInYears(new Date(), new Date(values.dateOfBirth));

  if (!isServiceRoleConfigured()) {
    if (age < 19) return { ok: false, message: "You must meet the event age requirement." };
    return { ok: true, ticketCode: createTicketCode(), message: "Demo registration confirmed." };
  }

  const supabase = createSupabaseAdminClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError || !event) {
    if (demoEvents.some((demoEvent) => demoEvent.id === values.eventId)) {
      return { ok: true, ticketCode: createTicketCode(), message: "Demo registration confirmed." };
    }
    return { ok: false, message: "Event is not available." };
  }
  if (event.status !== "published") return { ok: false, message: "Registration is not open for this event." };
  if (age < Number(event.minimum_age ?? 19)) return { ok: false, message: "You must meet the event age requirement." };

  const { count: registrationCount } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", values.eventId)
    .neq("status", "cancelled");

  if (event.capacity && (registrationCount ?? 0) >= event.capacity) {
    return { ok: false, message: "This event is at capacity." };
  }

  const { data: ticketType } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("id", values.ticketTypeId)
    .eq("event_id", values.eventId)
    .maybeSingle();

  if (!ticketType) return { ok: false, message: "Ticket type is not available." };

  const amountDue = Number(ticketType.price ?? 0);
  if (amountDue > 0 && !event.zeffy_form_url) {
    return { ok: false, message: "Payment is not configured for this event yet." };
  }

  const normalizedEmail = values.email.toLowerCase().trim();
  const { data: existingAttendee } = await supabase
    .from("attendees")
    .select("*")
    .eq("organization_id", event.organization_id)
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  const attendeePayload = {
    organization_id: event.organization_id,
    first_name: values.firstName,
    last_name: values.lastName,
    email: values.email,
    phone: values.phone,
    company: values.company,
    role_title: values.roleTitle,
    date_of_birth: values.dateOfBirth,
    sms_consent_status: values.smsConsent,
    email_consent_status: values.emailConsent,
  };

  const attendeeId = existingAttendee?.id;
  const { data: attendee, error: attendeeError } = attendeeId
    ? await supabase.from("attendees").update(attendeePayload).eq("id", attendeeId).select("*").single()
    : await supabase.from("attendees").insert(attendeePayload).select("*").single();

  if (attendeeError || !attendee) return { ok: false, message: "Could not save attendee." };

  const requiresPayment = amountDue > 0;
  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .insert({
      organization_id: event.organization_id,
      event_id: values.eventId,
      attendee_id: attendee.id,
      ticket_type_id: values.ticketTypeId,
      status: requiresPayment ? "pending" : "confirmed",
      payment_status: amountDue === 0 ? "not_required" : "pending",
      payment_method: amountDue === 0 ? "free" : "future_provider",
      amount_due: amountDue,
      amount_paid: 0,
      sms_consent: values.smsConsent,
      email_consent: values.emailConsent,
      privacy_terms_accepted_at: new Date().toISOString(),
      consent_source: "public_registration_form",
      custom_responses: {
        company: values.company,
        roleTitle: values.roleTitle,
        discountCode: values.discountCode,
        ...(requiresPayment
          ? {
              zeffy: {
                campaignId: event.zeffy_campaign_id,
                formUrl: event.zeffy_form_url,
              },
            }
          : {}),
      },
    })
    .select("*")
    .single();

  if (registrationError || !registration) return { ok: false, message: "Could not create registration." };

  if (values.sessionIds.length) {
    await supabase.from("registration_sessions").insert(
      values.sessionIds.map((sessionId) => ({
        organization_id: event.organization_id,
        registration_id: registration.id,
        session_id: sessionId,
        status: requiresPayment ? "pending" : "confirmed",
      })),
    );
  }

  if (requiresPayment) {
    await writeAuditLog({
      organizationId: event.organization_id,
      action: "registration.payment_pending",
      entityType: "registration",
      entityId: registration.id,
      metadata: { eventId: values.eventId, attendeeId: attendee.id, provider: "zeffy" },
    });

    return {
      ok: true,
      requiresPayment: true,
      registrationId: registration.id,
      paymentUrl: buildZeffyPaymentUrl({
        formUrl: event.zeffy_form_url,
        registrationId: registration.id,
        eventSlug: event.slug,
      }),
      message: "Continue to Zeffy to complete payment.",
    };
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

  if (ticketError) return { ok: false, message: "Could not issue ticket." };

  if (values.smsConsent) {
    await supabase.from("sms_consents").insert({
      organization_id: event.organization_id,
      attendee_id: attendee.id,
      phone: values.phone,
      consented: true,
      purpose: "event_registration_and_reminders",
      source: "public_registration_form",
      consent_text: "I consent to receive event-related SMS reminders from FCF Events. Reply STOP to unsubscribe.",
    });
  }

  let message = "Registration confirmed.";
  if (values.emailConsent) {
    try {
      const email = await sendRegistrationConfirmationEmail({
        attendeeName: `${values.firstName} ${values.lastName}`.trim(),
        eventTitle: event.title,
        eventStartsAt: event.starts_at,
        eventEndsAt: event.ends_at,
        eventTimezone: event.timezone,
        venueName: event.venue_name,
        address: event.address,
        ticketCode,
        ticketTypeName: ticketType.name,
        ticketPrice: Number(ticketType.price ?? 0),
        ticketCurrency: ticketType.currency ?? "CAD",
        toEmail: values.email,
        organizationId: event.organization_id,
        eventId: values.eventId,
        registrationId: registration.id,
      });
      await logEmailSend({
        supabase,
        organizationId: event.organization_id,
        registrationId: registration.id,
        attendeeId: attendee.id,
        toEmail: values.email,
        subject: email.subject,
        body: email.text,
        status: "sent",
        providerStatus: email.providerId ?? "sent",
      });
    } catch (error) {
      message = "Registration confirmed. Save or print this ticket because the confirmation email could not be sent.";
      await logEmailSend({
        supabase,
        organizationId: event.organization_id,
        registrationId: registration.id,
        attendeeId: attendee.id,
        toEmail: values.email,
        subject: `Your FCF ticket for ${event.title}`,
        body: `Registration confirmed for ticket ${ticketCode}.`,
        status: "failed",
        providerStatus: error instanceof Error ? error.message : "Unknown email error",
      });
    }
  }

  await writeAuditLog({
    organizationId: event.organization_id,
    action: "registration.created",
    entityType: "registration",
    entityId: registration.id,
    metadata: { eventId: values.eventId, attendeeId: attendee.id },
  });

  return { ok: true, ticketCode, message };
}

export async function demoTicketOrganizationId() {
  return demoOrganizationId;
}
