import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currency(value: number, code = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: code,
  }).format(value);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function segmentCount(message: string) {
  return Math.max(1, Math.ceil(message.length / 153));
}

export function eventLocationLabel(venueName: string | null | undefined, address: string | null | undefined) {
  return [venueName, address]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

export function googleMapsSearchUrl(query: string | null | undefined) {
  const normalizedQuery = query?.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedQuery)}`;
}

export function toDateTimeLocalInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const trimmedDigits = localDigits.slice(0, 10);

  if (trimmedDigits.length <= 3) return trimmedDigits;
  if (trimmedDigits.length <= 6) return `(${trimmedDigits.slice(0, 3)}) ${trimmedDigits.slice(3)}`;

  return `(${trimmedDigits.slice(0, 3)}) ${trimmedDigits.slice(3, 6)}-${trimmedDigits.slice(6)}`;
}
