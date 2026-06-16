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
