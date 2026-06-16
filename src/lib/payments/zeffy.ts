import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSentTicketConfirmation, logEmailSend } from "@/lib/email/logging";
import { sendRegistrationConfirmationEmail } from "@/lib/email/registration-confirmation";
import { createTicketCode, hashTicketToken } from "@/lib/security/qr";
import { getZeffyBuyerEmail, type ZeffyPayment, zeffyAmountToMajorUnits } from "@/lib/zeffy";
import { writeAuditLog } from "@/lib/audit";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type PaymentProcessResult = {
  ok: boolean;
  matched: boolean;
  ticketCode?: string;
  registrationId?: string;
  message: string;
};

type RegistrationRecord = {
  id: string;
  organization_id: string;
  event_id: string;
  attendee_id: string;
  ticket_type_id: string | null;
  email_consent: boolean;
  amount_due: number | string;
  amount_paid: number | string;
  payment_status: string;
  custom_responses: Record<string, unknown> | null;
};

export async function processZeffyCompletedPayment(payment: ZeffyPayment): Promise<PaymentProcessResult> {
  if (payment.status !== "succeeded") {
    return { ok: true, matched: false, message: "Payment was not succeeded." };
  }

  const supabase = createSupabaseAdminClient();
  const existing = await findRegistrationByExternalPaymentId(supabase, payment.id);
  if (existing) {
    const ticketCode = await issueTicketIfNeeded(supabase, existing);
    await sendTicketConfirmationIfNeeded(supabase, existing, ticketCode);
    return {
      ok: true,
      matched: true,
      ticketCode,
      registrationId: existing.id,
      message: "Payment was already reconciled.",
    };
  }

  const buyerEmail = getZeffyBuyerEmail(payment);
  if (!buyerEmail || !payment.campaign_id) {
    return { ok: true, matched: false, message: "Payment is missing buyer email or campaign ID." };
  }

  const registration = await findPendingRegistrationForPayment(supabase, payment, buyerEmail);
  if (!registration) {
    return { ok: true, matched: false, message: "No matching pending registration found." };
  }

  const amountPaid = zeffyAmountToMajorUnits(payment.amount);
  const amountDue = Number(registration.amount_due ?? 0);
  const isFullyPaid = amountPaid >= amountDue;
  const updatedResponses = {
    ...(registration.custom_responses ?? {}),
    zeffy: {
      paymentId: payment.id,
      campaignId: payment.campaign_id,
      contactId: payment.contact,
      receiptUrl: payment.receipt_url,
      buyerQuestions: payment.buyer_questions,
      items: payment.items,
    },
  };

  const { data: updated, error } = await supabase
    .from("registrations")
    .update({
      status: isFullyPaid ? "confirmed" : "pending",
      payment_status: isFullyPaid ? "paid" : "partially_paid",
      amount_paid: amountPaid,
      payment_reference: payment.id,
      external_payment_provider: "zeffy",
      external_payment_id: payment.id,
      external_payment_payload: payment,
      external_payment_completed_at: new Date(payment.created * 1000).toISOString(),
      custom_responses: updatedResponses,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registration.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, matched: true, registrationId: registration.id, message: "Could not update registration." };
  }

  if (!isFullyPaid) {
    await writeAuditLog({
      organizationId: registration.organization_id,
      action: "payment.zeffy.partially_paid",
      entityType: "registration",
      entityId: registration.id,
      metadata: { paymentId: payment.id, amountPaid, amountDue },
    });
    return {
      ok: true,
      matched: true,
      registrationId: registration.id,
      message: "Payment was reconciled as partially paid.",
    };
  }

  await supabase
    .from("registration_sessions")
    .update({ status: "confirmed" })
    .eq("registration_id", registration.id)
    .eq("status", "pending");

  const ticketCode = await issueTicketIfNeeded(supabase, updated as RegistrationRecord);
  await sendTicketConfirmationIfNeeded(supabase, updated as RegistrationRecord, ticketCode);
  await writeAuditLog({
    organizationId: registration.organization_id,
    action: "payment.zeffy.completed",
    entityType: "registration",
    entityId: registration.id,
    metadata: { paymentId: payment.id, ticketCode, amountPaid },
  });

  return {
    ok: true,
    matched: true,
    ticketCode,
    registrationId: registration.id,
    message: "Payment reconciled and ticket issued.",
  };
}

async function findRegistrationByExternalPaymentId(supabase: SupabaseAdminClient, paymentId: string) {
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("external_payment_provider", "zeffy")
    .eq("external_payment_id", paymentId)
    .maybeSingle();

  return (data as RegistrationRecord | null) ?? null;
}

async function findPendingRegistrationForPayment(
  supabase: SupabaseAdminClient,
  payment: ZeffyPayment,
  buyerEmail: string,
) {
  const { data: events } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("zeffy_campaign_id", payment.campaign_id);

  if (!events?.length) return null;

  const eventIds = events.map((event) => event.id);
  const organizationIds = [...new Set(events.map((event) => event.organization_id))];
  const { data: attendees } = await supabase
    .from("attendees")
    .select("id")
    .in("organization_id", organizationIds)
    .eq("normalized_email", buyerEmail);

  if (!attendees?.length) return null;

  const attendeeIds = attendees.map((attendee) => attendee.id);
  const { data: registrations } = await supabase
    .from("registrations")
    .select("*")
    .in("event_id", eventIds)
    .in("attendee_id", attendeeIds)
    .eq("payment_status", "pending")
    .order("registered_at", { ascending: false })
    .limit(5);

  if (!registrations?.length) return null;

  const amountPaid = zeffyAmountToMajorUnits(payment.amount);
  const exactOrUnderPaidMatch = registrations.find((registration) => Number(registration.amount_due ?? 0) <= amountPaid);
  return (exactOrUnderPaidMatch ?? registrations[0]) as RegistrationRecord;
}

async function issueTicketIfNeeded(supabase: SupabaseAdminClient, registration: RegistrationRecord) {
  const { data: existingTicket } = await supabase
    .from("tickets")
    .select("ticket_code")
    .eq("registration_id", registration.id)
    .maybeSingle();

  if (existingTicket?.ticket_code) return existingTicket.ticket_code as string;

  const ticketCode = createTicketCode();
  const { error } = await supabase.from("tickets").insert({
    organization_id: registration.organization_id,
    registration_id: registration.id,
    event_id: registration.event_id,
    attendee_id: registration.attendee_id,
    ticket_type_id: registration.ticket_type_id,
    ticket_code: ticketCode,
    qr_token_hash: hashTicketToken(ticketCode),
    status: "active",
  });

  if (error) throw new Error("Could not issue ticket.");
  return ticketCode;
}

async function sendTicketConfirmationIfNeeded(
  supabase: SupabaseAdminClient,
  registration: RegistrationRecord,
  ticketCode: string,
) {
  if (!registration.email_consent) return;
  if (await hasSentTicketConfirmation(supabase, registration.id)) return;

  const [{ data: event }, { data: attendee }, ticketTypeResult] = await Promise.all([
    supabase
      .from("events")
      .select("title, starts_at, ends_at, timezone, venue_name, address")
      .eq("id", registration.event_id)
      .maybeSingle(),
    supabase
      .from("attendees")
      .select("first_name, last_name, email")
      .eq("id", registration.attendee_id)
      .maybeSingle(),
    registration.ticket_type_id
      ? supabase
          .from("ticket_types")
          .select("name, price, currency")
          .eq("id", registration.ticket_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!event || !attendee?.email) return;

  const attendeeName = [attendee.first_name, attendee.last_name].filter(Boolean).join(" ") || "there";
  const ticketType = ticketTypeResult.data;
  const subject = `Your FCF ticket for ${event.title}`;

  try {
    const email = await sendRegistrationConfirmationEmail({
      attendeeName,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      eventEndsAt: event.ends_at,
      eventTimezone: event.timezone,
      venueName: event.venue_name,
      address: event.address,
      ticketCode,
      ticketTypeName: ticketType?.name ?? "Event ticket",
      ticketPrice: Number(ticketType?.price ?? registration.amount_due ?? 0),
      ticketCurrency: ticketType?.currency ?? "CAD",
      toEmail: attendee.email,
      organizationId: registration.organization_id,
      eventId: registration.event_id,
      registrationId: registration.id,
    });
    await logEmailSend({
      supabase,
      organizationId: registration.organization_id,
      registrationId: registration.id,
      attendeeId: registration.attendee_id,
      toEmail: attendee.email,
      subject: email.subject,
      body: email.text,
      status: "sent",
      providerStatus: email.providerId ?? "sent",
    });
  } catch (error) {
    await logEmailSend({
      supabase,
      organizationId: registration.organization_id,
      registrationId: registration.id,
      attendeeId: registration.attendee_id,
      toEmail: attendee.email,
      subject,
      body: `Registration confirmed for ticket ${ticketCode}.`,
      status: "failed",
      providerStatus: error instanceof Error ? error.message : "Unknown email error",
    });
  }
}
