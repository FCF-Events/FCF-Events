import type {
  CheckInAttendeeListResponse,
  CheckInContextResponse,
  CheckInLookupResponse,
  CheckInResult,
  WalkUpCheckInResult,
  WalkUpFormState,
} from "@/lib/types";

const appUrl = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  payload: unknown;
  status: number;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
    this.status = status;
  }
}

export function hasApiConfig() {
  return Boolean(appUrl);
}

async function apiFetch<T>(
  path: string,
  token: string | null,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  if (!appUrl) {
    throw new ApiError("Set EXPO_PUBLIC_APP_URL to your FCF Events web app URL.", 0);
  }

  const response = await fetch(`${appUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { message?: string; result?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? resultMessage(data?.result) ?? `Request failed with HTTP ${response.status}.`,
      response.status,
      data,
    );
  }

  return data as T;
}

export function fetchCheckInContext(token: string | null) {
  return apiFetch<CheckInContextResponse>("/api/check-in/context", token);
}

export function fetchAttendees(token: string | null, input: { eventId: string; eventDayId: string; sessionId: string | null }) {
  return apiFetch<CheckInAttendeeListResponse>("/api/check-in/attendees", token, {
    method: "POST",
    body: input,
  });
}

export function checkInTicket(token: string | null, input: { eventId: string; eventDayId: string; sessionId: string | null; ticketCode: string }) {
  return apiFetch<CheckInResult>("/api/check-in", token, {
    method: "POST",
    body: input,
  });
}

export function searchCheckInGuests(token: string | null, input: { eventId: string; eventDayId: string; sessionId: string | null; query: string }) {
  return apiFetch<CheckInLookupResponse>("/api/check-in/search", token, {
    method: "POST",
    body: input,
  });
}

export function createWalkUp(token: string | null, input: WalkUpFormState & { eventId: string; eventDayId: string; sessionId: string | null }) {
  return apiFetch<WalkUpCheckInResult>("/api/check-in/walk-up", token, {
    method: "POST",
    body: input,
  });
}

function resultMessage(result: unknown) {
  const messages: Record<string, string> = {
    success: "Guest checked in.",
    duplicate: "This guest has already been checked in.",
    invalid: "Ticket was not found.",
    wrong_event: "This ticket belongs to another event.",
    revoked: "This ticket has been revoked.",
    cancelled: "This ticket has been cancelled.",
    not_authorized: "You are not authorized to check in this event.",
    unpaid: "This registration has not been paid or comped.",
    not_confirmed: "This registration is not confirmed.",
    not_entitled_for_day: "This ticket does not include the selected event day.",
    not_entitled_for_session: "This ticket is not eligible for the selected seminar.",
    daily_check_in_required: "Check this guest in at the event gate for this day before seminar check-in.",
  };

  return typeof result === "string" ? messages[result] : null;
}
