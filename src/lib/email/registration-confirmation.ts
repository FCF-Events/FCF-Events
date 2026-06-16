import QRCode from "qrcode";
import { sendEmail } from "@/lib/email/provider";
import {
  getEmailTemplateForSend,
  REGISTRATION_CONFIRMATION_TEMPLATE_NAME,
  renderEmailTemplate,
} from "@/lib/email/templates";
import { ticketUrl } from "@/lib/security/qr";
import { currency, eventLocationLabel } from "@/lib/utils";

type RegistrationConfirmationInput = {
  attendeeName: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  eventTimezone: string | null;
  venueName: string | null;
  address: string | null;
  ticketCode: string;
  ticketTypeName: string;
  ticketPrice: number;
  ticketCurrency: string;
  toEmail: string;
  organizationId: string;
  eventId: string;
  registrationId: string;
};

export type RegistrationConfirmationEmail = {
  providerId?: string;
  subject: string;
  text: string;
};

export async function sendRegistrationConfirmationEmail(
  input: RegistrationConfirmationInput,
): Promise<RegistrationConfirmationEmail> {
  const ticketLink = ticketUrl(input.ticketCode);
  const qrImage = await QRCode.toBuffer(ticketLink, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "png",
    width: 360,
  });
  const qrContentId = "ticket-qr";
  const startsAt = formatEventDate(input.eventStartsAt, input.eventTimezone);
  const location = eventLocationLabel(input.venueName, input.address) || "Venue TBA";
  const ticketPrice = currency(input.ticketPrice, input.ticketCurrency);
  const calendarUrl = googleCalendarUrl({
    title: input.eventTitle,
    startsAt: input.eventStartsAt,
    endsAt: input.eventEndsAt,
    location,
    details: [
      `Ticket code: ${input.ticketCode}`,
      `Ticket type: ${input.ticketTypeName} (${ticketPrice})`,
      `Ticket: ${ticketLink}`,
    ].join("\n"),
  });
  const calendarFile = calendarFileContent({
    title: input.eventTitle,
    startsAt: input.eventStartsAt,
    endsAt: input.eventEndsAt,
    location,
    details: [
      `Ticket code: ${input.ticketCode}`,
      `Ticket type: ${input.ticketTypeName} (${ticketPrice})`,
      `Ticket: ${ticketLink}`,
    ].join("\n"),
    url: ticketLink,
  });
  const template = await getEmailTemplateForSend(input.organizationId, REGISTRATION_CONFIRMATION_TEMPLATE_NAME);
  const templateValues = {
    first_name: input.attendeeName.split(" ")[0] ?? input.attendeeName,
    attendee_name: input.attendeeName,
    event: input.eventTitle,
    event_start_time: startsAt,
    venue: location,
    ticket_type: input.ticketTypeName,
    ticket_price: ticketPrice,
    ticket_code: input.ticketCode,
    ticket_url: ticketLink,
    calendar_url: calendarUrl,
  };
  const subject = renderEmailTemplate(template?.subject ?? "Your FCF ticket for {{event}}", templateValues);
  const text = withRequiredPlainTextDetails(
    renderEmailTemplate(
      template?.body ?? "Hi {{first_name}},\n\nYour registration for {{event}} is confirmed.\n\nOpen your QR ticket: {{ticket_url}}",
      templateValues,
    ),
    {
      eventTitle: input.eventTitle,
      startsAt,
      location,
      ticketCode: input.ticketCode,
      ticketLink,
      calendarUrl,
    },
  );

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6f6f6;color:#111;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:#e50913;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">FCF Events</p>
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#111;">Your registration is confirmed</h1>
                ${plainTextToHtml(text)}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:collapse;">
                  ${detailRow("When", startsAt)}
                  ${detailRow("Where", location)}
                  ${detailRow("Ticket", `${input.ticketTypeName} (${ticketPrice})`)}
                  ${detailRow("Code", input.ticketCode)}
                </table>
                <div style="margin:0 0 22px;text-align:center;">
                  <img src="cid:${qrContentId}" width="240" height="240" alt="Ticket QR code" style="display:inline-block;border:12px solid #ffffff;outline:1px solid #e5e5e5;" />
                </div>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Bring this QR code with you for check-in. Staff will validate your ticket status at the door.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;">
                  <tr>
                    <td style="padding:0 10px 10px 0;">
                      <a href="${escapeHtml(ticketLink)}" style="display:inline-block;background:#e50913;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;">Open ticket</a>
                    </td>
                    <td style="padding:0 0 10px 0;">
                      <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;">Add to calendar</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const result = await sendEmail({
    to: input.toEmail,
    subject,
    html,
    text,
    attachments: [
      {
        filename: `${input.ticketCode}.png`,
        content: qrImage.toString("base64"),
        content_type: "image/png",
        content_id: qrContentId,
        content_disposition: "inline",
      },
      {
        filename: `${safeFileName(input.eventTitle)}.ics`,
        content: Buffer.from(calendarFile).toString("base64"),
        content_type: "text/calendar; charset=utf-8; method=PUBLISH",
        content_disposition: "attachment",
      },
    ],
    tags: {
      type: "registration_confirmation",
      organization_id: input.organizationId,
      event_id: input.eventId,
      registration_id: input.registrationId,
    },
  });

  return { providerId: result.id, subject, text };
}

function formatEventDate(value: string, timezone: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone ?? "America/Toronto",
  }).format(new Date(value));
}

function googleCalendarUrl(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  details: string;
}) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", input.title);
  url.searchParams.set("dates", `${calendarDate(input.startsAt)}/${calendarDate(input.endsAt)}`);
  url.searchParams.set("details", input.details);
  url.searchParams.set("location", input.location);
  return url.toString();
}

function calendarFileContent(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  details: string;
  url: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FCF Events//Registration Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${safeFileName(input.title)}-${calendarDate(input.startsAt)}@fcf.events`,
    `DTSTAMP:${calendarDate(new Date().toISOString())}`,
    `DTSTART:${calendarDate(input.startsAt)}`,
    `DTEND:${calendarDate(input.endsAt)}`,
    `SUMMARY:${escapeCalendarText(input.title)}`,
    `DESCRIPTION:${escapeCalendarText(input.details)}`,
    `LOCATION:${escapeCalendarText(input.location)}`,
    `URL:${escapeCalendarText(input.url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.flatMap(foldCalendarLine).join("\r\n")}\r\n`;
}

function calendarDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldCalendarLine(line: string) {
  const folded: string[] = [];
  let remaining = line;

  while (remaining.length > 75) {
    folded.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }

  folded.push(remaining);
  return folded;
}

function withRequiredPlainTextDetails(
  value: string,
  details: {
    eventTitle: string;
    startsAt: string;
    location: string;
    ticketCode: string;
    ticketLink: string;
    calendarUrl: string;
  },
) {
  const requiredLines = [
    { value: details.eventTitle, line: `Event: ${details.eventTitle}` },
    { value: details.startsAt, line: `When: ${details.startsAt}` },
    { value: details.location, line: `Where: ${details.location}` },
    { value: details.ticketCode, line: `Ticket code: ${details.ticketCode}` },
    { value: details.ticketLink, line: `Open your QR ticket: ${details.ticketLink}` },
    { value: details.calendarUrl, line: `Add to calendar: ${details.calendarUrl}` },
  ];
  const normalized = value.toLowerCase();
  const missingLines = requiredLines
    .filter((item) => !normalized.includes(item.value.toLowerCase()))
    .map((item) => item.line);

  return missingLines.length ? `${value.trim()}\n\n${missingLines.join("\n")}` : value;
}

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "fcf-event"
  );
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="width:88px;padding:8px 0;color:#666;font-size:14px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#111;font-size:14px;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
