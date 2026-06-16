"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Clock3, Keyboard, Mail, Phone, RefreshCw, Search, TicketCheck, UserPlus, XCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { SelectField } from "@/components/ui/select-field";
import type {
  CheckInLookupResponse,
  CheckInLookupResult,
  CheckInResult,
  EventAttendeeSummary,
  EventSummary,
  SessionSummary,
  TicketTypeSummary,
  WalkUpCheckInResult,
} from "@/lib/types";

type WalkUpFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  roleTitle: string;
  ticketTypeId: string;
  paymentMode: "cash" | "comp";
};

type CheckInScannerProps = {
  events: EventSummary[];
  sessions: SessionSummary[];
  ticketTypes: TicketTypeSummary[];
  initialAttendees: EventAttendeeSummary[];
};

type CheckInAttendeeListResponse = {
  ok: boolean;
  message?: string;
  attendees: EventAttendeeSummary[];
};

const emptyWalkUpForm: WalkUpFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  roleTitle: "",
  ticketTypeId: "",
  paymentMode: "cash",
};

export function CheckInScanner({ events, sessions, ticketTypes, initialAttendees }: CheckInScannerProps) {
  const scannerId = useId().replaceAll(":", "");
  const attendeeRequestId = useRef(0);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [sessionId, setSessionId] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<CheckInLookupResult[]>([]);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<EventAttendeeSummary[]>(initialAttendees);
  const [attendeeFilter, setAttendeeFilter] = useState<"all" | "checked_in" | "not_checked_in">("all");
  const [attendeeListQuery, setAttendeeListQuery] = useState("");
  const [attendeeListMessage, setAttendeeListMessage] = useState<string | null>(null);
  const [isRefreshingAttendees, setIsRefreshingAttendees] = useState(false);
  const [result, setResult] = useState<CheckInResult | WalkUpCheckInResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [walkUp, setWalkUp] = useState<WalkUpFormState>(emptyWalkUpForm);
  const [isCheckingIn, startCheckInTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [isAddingWalkUp, startWalkUpTransition] = useTransition();

  const filteredSessions = useMemo(
    () => sessions.filter((session) => session.event_id === eventId),
    [eventId, sessions],
  );
  const activeSession = useMemo(
    () => filteredSessions.find((session) => session.id === sessionId) ?? null,
    [filteredSessions, sessionId],
  );
  const filteredTicketTypes = useMemo(
    () => ticketTypes.filter((ticketType) => ticketType.event_id === eventId),
    [eventId, ticketTypes],
  );
  const checkInScopeLabel = sessionId ? activeSession?.title ?? "Selected session" : "Event-level check-in";
  const checkedInCount = useMemo(
    () => attendees.filter((attendee) => Boolean(attendee.checked_in_at)).length,
    [attendees],
  );
  const visibleAttendees = useMemo(() => {
    const query = attendeeListQuery.trim().toLowerCase();

    return attendees.filter((attendee) => {
      const matchesStatus =
        attendeeFilter === "all" ||
        (attendeeFilter === "checked_in" && attendee.checked_in_at) ||
        (attendeeFilter === "not_checked_in" && !attendee.checked_in_at);

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        attendee.full_name,
        attendee.email,
        attendee.phone,
        attendee.company,
        attendee.ticket_code,
        attendee.ticket_type_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [attendeeFilter, attendeeListQuery, attendees]);

  const loadAttendees = useCallback(async (targetEventId: string, targetSessionId: string) => {
    if (!targetEventId) {
      setAttendees([]);
      return;
    }

    const requestId = attendeeRequestId.current + 1;
    attendeeRequestId.current = requestId;
    setIsRefreshingAttendees(true);
    setAttendeeListMessage(null);

    try {
      const response = await fetch("/api/check-in/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: targetEventId,
          sessionId: targetSessionId || null,
        }),
      });
      const data = (await response.json()) as CheckInAttendeeListResponse;
      if (requestId !== attendeeRequestId.current) return;

      setAttendees(data.attendees ?? []);
      setAttendeeListMessage(data.message ?? (!response.ok ? "Could not load attendees." : null));
    } catch {
      if (requestId !== attendeeRequestId.current) return;
      setAttendees([]);
      setAttendeeListMessage("Could not load attendees.");
    } finally {
      if (requestId === attendeeRequestId.current) {
        setIsRefreshingAttendees(false);
      }
    }
  }, []);

  useEffect(() => {
    if (sessionId && !filteredSessions.some((session) => session.id === sessionId)) {
      setSessionId("");
    }
  }, [filteredSessions, sessionId]);

  useEffect(() => {
    setWalkUp((current) => {
      if (filteredTicketTypes.some((ticketType) => ticketType.id === current.ticketTypeId)) return current;
      return {
        ...current,
        ticketTypeId: filteredTicketTypes[0]?.id ?? "",
      };
    });
  }, [filteredTicketTypes]);

  useEffect(() => {
    void loadAttendees(eventId, sessionId);
  }, [eventId, loadAttendees, sessionId]);

  const submitTicket = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || !eventId) return;

      startCheckInTransition(async () => {
        setStatusMessage(null);
        const response = await fetch("/api/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            sessionId: sessionId || null,
            ticketCode: code,
          }),
        });
        const data = (await response.json()) as CheckInResult;
        setResult(data);
        if (data.result === "success") {
          await loadAttendees(eventId, sessionId);
        }
        if (!response.ok) {
          setStatusMessage(resultMessage(data.result));
        }
      });
    },
    [eventId, loadAttendees, sessionId],
  );

  useEffect(() => {
    if (!cameraActive) return;
    const scanner = new Html5Qrcode(scannerId);
    let mounted = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          if (!mounted) return;
          const code = decodedText.split("/").pop()?.trim() || decodedText.trim();
          setTicketCode(code);
          setCameraActive(false);
          submitTicket(code);
        },
        () => undefined,
      )
      .catch(() => setCameraActive(false));

    return () => {
      mounted = false;
      scanner.stop().catch(() => undefined);
    };
  }, [cameraActive, scannerId, submitTicket]);

  function handleTicketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitTicket(ticketCode);
  }

  function runLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = lookupQuery.trim();
    if (query.length < 2) {
      setLookupResults([]);
      setLookupMessage("Enter at least 2 characters.");
      return;
    }

    startSearchTransition(async () => {
      setLookupMessage(null);
      const response = await fetch("/api/check-in/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          sessionId: sessionId || null,
          query,
        }),
      });
      const data = (await response.json()) as CheckInLookupResponse;
      setLookupResults(data.results);
      setLookupMessage(data.message ?? (data.results.length ? null : "No matching guests found."));
      if (!response.ok && data.message) {
        setStatusMessage(data.message);
      }
    });
  }

  function updateWalkUp<Value extends keyof WalkUpFormState>(field: Value, value: WalkUpFormState[Value]) {
    setWalkUp((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function createWalkUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startWalkUpTransition(async () => {
      setStatusMessage(null);
      const response = await fetch("/api/check-in/walk-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...walkUp,
          eventId,
          sessionId: sessionId || null,
        }),
      });
      const data = (await response.json()) as WalkUpCheckInResult;
      setResult(data);
      setStatusMessage(data.message ?? (!response.ok ? resultMessage(data.result) : null));

      if (response.ok) {
        setWalkUp({
          ...emptyWalkUpForm,
          ticketTypeId: walkUp.ticketTypeId,
          paymentMode: walkUp.paymentMode,
        });
        await loadAttendees(eventId, sessionId);
      }
    });
  }

  const canUseCheckIn = Boolean(eventId);
  const canAddWalkUp = canUseCheckIn && Boolean(walkUp.ticketTypeId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Check-in Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="check-in-event">Event</Label>
              <SelectField
                id="check-in-event"
                value={eventId}
                onChange={(event) => {
                  setEventId(event.target.value);
                  setLookupResults([]);
                  setLookupMessage(null);
                  setAttendeeFilter("all");
                  setAttendeeListQuery("");
                }}
                options={events.map((event) => ({ label: event.title, value: event.id }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-in-session">Session</Label>
              <SelectField
                id="check-in-session"
                value={sessionId}
                onChange={(event) => {
                  setSessionId(event.target.value);
                  setLookupResults([]);
                  setLookupMessage(null);
                  setAttendeeFilter("all");
                  setAttendeeListQuery("");
                }}
                options={[
                  { label: "Event-level check-in", value: "" },
                  ...filteredSessions.map((session) => ({ label: session.title, value: session.id })),
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-h-72 items-center justify-center rounded-lg border border-white/10 bg-black">
                {cameraActive ? (
                  <div id={scannerId} className="w-full max-w-md overflow-hidden rounded-lg" />
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto h-10 w-10 text-[#e50913]" aria-hidden />
                    <Button className="mt-4" onClick={() => setCameraActive(true)} disabled={!canUseCheckIn || isCheckingIn}>
                      <Camera className="h-4 w-4" aria-hidden />
                      Start Camera
                    </Button>
                  </div>
                )}
              </div>

              <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleTicketSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="ticket-code">Ticket code</Label>
                  <Input
                    id="ticket-code"
                    value={ticketCode}
                    onChange={(event) => setTicketCode(event.target.value)}
                    placeholder="FCF-..."
                    autoComplete="off"
                  />
                </div>
                <Button className="self-end" type="submit" disabled={!ticketCode.trim() || !canUseCheckIn || isCheckingIn}>
                  <Keyboard className="h-4 w-4" aria-hidden />
                  Check In
                </Button>
              </form>
            </CardContent>
          </Card>

          <AttendeeCheckInList
            attendees={visibleAttendees}
            totalCount={attendees.length}
            checkedInCount={checkedInCount}
            filter={attendeeFilter}
            onFilterChange={setAttendeeFilter}
            query={attendeeListQuery}
            onQueryChange={setAttendeeListQuery}
            message={attendeeListMessage}
            scopeLabel={checkInScopeLabel}
            isRefreshing={isRefreshingAttendees}
            isCheckingIn={isCheckingIn}
            onRefresh={() => void loadAttendees(eventId, sessionId)}
            onCheckIn={(code) => {
              setTicketCode(code);
              submitTicket(code);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Find Guest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={runLookup}>
                <div className="space-y-2">
                  <Label htmlFor="guest-lookup">Guest lookup</Label>
                  <Input
                    id="guest-lookup"
                    value={lookupQuery}
                    onChange={(event) => setLookupQuery(event.target.value)}
                    placeholder="Name, email, phone, or code"
                    autoComplete="off"
                  />
                </div>
                <Button className="self-end" type="submit" variant="secondary" disabled={!canUseCheckIn || isSearching}>
                  <Search className="h-4 w-4" aria-hidden />
                  Search
                </Button>
              </form>

              {lookupMessage ? <p className="text-sm text-[#999999]">{lookupMessage}</p> : null}
              {lookupResults.length ? (
                <div className="space-y-2">
                  {lookupResults.map((guest) => (
                    <LookupRow
                      key={guest.ticketId}
                      guest={guest}
                      onCheckIn={() => {
                        setTicketCode(guest.ticketCode);
                        submitTicket(guest.ticketCode);
                      }}
                      disabled={isCheckingIn}
                    />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Walk-up</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createWalkUp}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="First name" htmlFor="walkup-first">
                    <Input
                      id="walkup-first"
                      value={walkUp.firstName}
                      onChange={(event) => updateWalkUp("firstName", event.target.value)}
                      required
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Last name" htmlFor="walkup-last">
                    <Input
                      id="walkup-last"
                      value={walkUp.lastName}
                      onChange={(event) => updateWalkUp("lastName", event.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </Field>
                  <Field label="Email" htmlFor="walkup-email">
                    <Input
                      id="walkup-email"
                      type="email"
                      value={walkUp.email}
                      onChange={(event) => updateWalkUp("email", event.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Phone" htmlFor="walkup-phone">
                    <PhoneInput
                      id="walkup-phone"
                      value={walkUp.phone}
                      onChange={(event) => updateWalkUp("phone", event.target.value)}
                    />
                  </Field>
                  <Field label="Ticket type" htmlFor="walkup-ticket-type">
                    <SelectField
                      id="walkup-ticket-type"
                      value={walkUp.ticketTypeId}
                      onChange={(event) => updateWalkUp("ticketTypeId", event.target.value)}
                      options={filteredTicketTypes.map((ticketType) => ({ label: ticketType.name, value: ticketType.id }))}
                    />
                  </Field>
                  <Field label="Payment" htmlFor="walkup-payment">
                    <SelectField
                      id="walkup-payment"
                      value={walkUp.paymentMode}
                      onChange={(event) => updateWalkUp("paymentMode", event.target.value as WalkUpFormState["paymentMode"])}
                      options={[
                        { label: "Cash at door", value: "cash" },
                        { label: "Let in / comp", value: "comp" },
                      ]}
                    />
                  </Field>
                  <Field label="Company" htmlFor="walkup-company">
                    <Input
                      id="walkup-company"
                      value={walkUp.company}
                      onChange={(event) => updateWalkUp("company", event.target.value)}
                    />
                  </Field>
                  <Field label="Role / title" htmlFor="walkup-role">
                    <Input
                      id="walkup-role"
                      value={walkUp.roleTitle}
                      onChange={(event) => updateWalkUp("roleTitle", event.target.value)}
                    />
                  </Field>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={!canAddWalkUp || isAddingWalkUp}>
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Add and Check In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4 xl:self-start">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className={`rounded-lg border p-4 ${resultTone(result.result)}`}>
                  <div className="flex items-center gap-3">
                    {isAcceptedResult(result.result) ? (
                      <CheckCircle2 className="h-6 w-6" aria-hidden />
                    ) : (
                      <XCircle className="h-6 w-6" aria-hidden />
                    )}
                    <div>
                      <p className="text-sm opacity-80">Status</p>
                      <p className="text-2xl font-semibold capitalize text-white">{result.result.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                </div>
                {statusMessage ? <p className="text-sm text-[#dddddd]">{statusMessage}</p> : null}
                {result.attendeeName ? <p className="text-lg font-medium text-white">{result.attendeeName}</p> : null}
                {result.ticketTypeName ? <p className="text-sm text-[#999999]">{result.ticketTypeName}</p> : null}
                {"ticketCode" in result && result.ticketCode ? (
                  <p className="font-mono text-sm text-white">{result.ticketCode}</p>
                ) : null}
                {result.checkedInAt ? <p className="text-sm text-[#999999]">Checked in at {formatDate(result.checkedInAt)}</p> : null}
                {result.priorCheckedInAt ? (
                  <p className="text-sm text-red-200">Already checked in at {formatDate(result.priorCheckedInAt)}</p>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center text-[#999999]">
                <TicketCheck className="mb-3 h-8 w-8" aria-hidden />
                Scan, enter, search, or add a guest to see check-in status.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AttendeeCheckInList({
  attendees,
  totalCount,
  checkedInCount,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  message,
  scopeLabel,
  isRefreshing,
  isCheckingIn,
  onRefresh,
  onCheckIn,
}: {
  attendees: EventAttendeeSummary[];
  totalCount: number;
  checkedInCount: number;
  filter: "all" | "checked_in" | "not_checked_in";
  onFilterChange: (filter: "all" | "checked_in" | "not_checked_in") => void;
  query: string;
  onQueryChange: (query: string) => void;
  message: string | null;
  scopeLabel: string;
  isRefreshing: boolean;
  isCheckingIn: boolean;
  onRefresh: () => void;
  onCheckIn: (ticketCode: string) => void;
}) {
  const notCheckedInCount = Math.max(totalCount - checkedInCount, 0);
  const filters = [
    { label: "All", value: "all", count: totalCount },
    { label: "Checked in", value: "checked_in", count: checkedInCount },
    { label: "Not in", value: "not_checked_in", count: notCheckedInCount },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Attendee List</CardTitle>
            <p className="mt-1 text-sm text-[#999999]">{scopeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{checkedInCount} checked in</Badge>
            <Badge variant="muted">{notCheckedInCount} not checked in</Badge>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="attendee-list-filter" className="sr-only">
              Filter attendees
            </Label>
            <Input
              id="attendee-list-filter"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Filter attendees"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-white/10">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFilterChange(option.value)}
                className={`min-w-0 border-r border-white/10 px-3 py-2 text-sm transition last:border-r-0 ${
                  filter === option.value ? "bg-[#b20711] text-white" : "bg-[#0b0b0b] text-[#dddddd] hover:bg-white/10"
                }`}
              >
                <span className="block truncate">{option.label}</span>
                <span className="block text-xs opacity-75">{option.count}</span>
              </button>
            ))}
          </div>
        </div>

        {message ? <p className="text-sm text-red-200">{message}</p> : null}

        {totalCount ? (
          attendees.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-[#999999]">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-4 font-medium">Name</th>
                    <th className="py-3 pr-4 font-medium">Ticket</th>
                    <th className="py-3 pr-4 font-medium">Contact</th>
                    <th className="py-3 pr-4 font-medium">Check-in</th>
                    <th className="py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((attendee) => (
                    <tr key={attendee.registration_id} className="border-b border-white/5 last:border-b-0">
                      <td className="py-4 pr-4 text-white">
                        <p className="font-medium">{attendee.full_name}</p>
                        <p className="text-[#999999]">{attendee.company ?? attendee.role_title ?? "No company listed"}</p>
                      </td>
                      <td className="py-4 pr-4 text-[#dddddd]">
                        <p>{attendee.ticket_type_name ?? "No ticket type"}</p>
                        <p className="font-mono text-[#999999]">{attendee.ticket_code ?? "No ticket issued"}</p>
                      </td>
                      <td className="py-4 pr-4 text-[#999999]">
                        <p>{attendee.email ?? "No email"}</p>
                        <p>{attendee.phone ?? "No phone"}</p>
                      </td>
                      <td className="py-4 pr-4">
                        {attendee.checked_in_at ? (
                          <div className="space-y-2">
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              Checked in
                            </Badge>
                            <p className="text-[#999999]">{formatDate(attendee.checked_in_at)}</p>
                          </div>
                        ) : (
                          <Badge variant="muted" className="gap-1">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden />
                            Not checked in
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={attendee.checked_in_at ? "outline" : "default"}
                          className="min-w-[96px] whitespace-nowrap"
                          disabled={!attendee.ticket_code || isCheckingIn}
                          onClick={() => {
                            if (attendee.ticket_code) onCheckIn(attendee.ticket_code);
                          }}
                        >
                          <TicketCheck className="h-4 w-4" aria-hidden />
                          {attendee.checked_in_at ? "Review" : "Check In"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/10 px-4 py-8 text-sm text-[#999999]">
              No attendees match the current filters.
            </div>
          )
        ) : (
          <div className="rounded-md border border-white/10 px-4 py-8 text-sm text-[#999999]">
            No attendees have registered for this event yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LookupRow({
  guest,
  onCheckIn,
  disabled,
}: {
  guest: CheckInLookupResult;
  onCheckIn: () => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-[#0b0b0b] p-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{guest.attendeeName}</p>
          <span className="rounded-sm border border-white/10 px-2 py-0.5 text-xs uppercase text-[#999999]">
            {guest.ticketStatus}
          </span>
          {guest.checkedInAt ? (
            <span className="rounded-sm border border-emerald-400/30 px-2 py-0.5 text-xs uppercase text-emerald-200">
              In
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#999999]">
          {guest.attendeeEmail ? (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {guest.attendeeEmail}
            </span>
          ) : null}
          {guest.attendeePhone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {guest.attendeePhone}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[#bbbbbb]">
          {guest.ticketTypeName ?? "Ticket"} <span className="font-mono text-[#999999]">{guest.ticketCode}</span>
        </p>
      </div>
      <Button type="button" onClick={onCheckIn} disabled={disabled} variant={guest.checkedInAt ? "outline" : "default"}>
        <TicketCheck className="h-4 w-4" aria-hidden />
        {guest.checkedInAt ? "Review" : "Check In"}
      </Button>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function isAcceptedResult(result: CheckInResult["result"]) {
  return result === "success" || result === "duplicate";
}

function resultTone(result: CheckInResult["result"]) {
  if (result === "success") return "border-emerald-400/30 bg-emerald-950/40 text-emerald-100";
  if (result === "duplicate") return "border-amber-300/30 bg-amber-950/40 text-amber-100";
  return "border-red-400/30 bg-red-950/40 text-red-100";
}

function resultMessage(result: CheckInResult["result"]) {
  const messages: Record<CheckInResult["result"], string> = {
    success: "Guest checked in.",
    duplicate: "This guest has already been checked in.",
    invalid: "Ticket was not found.",
    wrong_event: "This ticket belongs to another event.",
    revoked: "This ticket has been revoked.",
    cancelled: "This ticket has been cancelled.",
    not_authorized: "You are not authorized to check in this event.",
  };

  return messages[result];
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
