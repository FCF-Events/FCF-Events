"use client";

import { CalendarPlus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type AddToCalendarButtonProps = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  fileName?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export function AddToCalendarButton({
  title,
  startsAt,
  endsAt,
  location,
  description,
  url,
  fileName,
  className,
  variant = "outline",
  size,
}: AddToCalendarButtonProps) {
  function downloadCalendarFile() {
    const eventUrl = url ?? window.location.href;
    const content = buildCalendarFile({
      title,
      startsAt,
      endsAt,
      location,
      description,
      url: eventUrl,
    });
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName ?? `${toSafeFileName(title)}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={downloadCalendarFile}>
      <CalendarPlus className="h-4 w-4" aria-hidden />
      Add to Calendar
    </Button>
  );
}

function buildCalendarFile({
  title,
  startsAt,
  endsAt,
  location,
  description,
  url,
}: {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  description?: string | null;
  url: string;
}) {
  const details = [description, url].filter(Boolean).join("\n\n");
  const uid = `${toSafeFileName(title)}-${formatCalendarDate(startsAt)}@fcf.events`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FCF Events//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatCalendarDate(new Date().toISOString())}`,
    `DTSTART:${formatCalendarDate(startsAt)}`,
    `DTEND:${formatCalendarDate(endsAt)}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(details)}`,
    `LOCATION:${escapeCalendarText(location ?? "")}`,
    `URL:${escapeCalendarText(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.flatMap(foldCalendarLine).join("\r\n")}\r\n`;
}

function formatCalendarDate(value: string) {
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

function toSafeFileName(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "fcf-event";
}
