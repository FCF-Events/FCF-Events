import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { TextInputProps } from "react-native";
import {
  Camera,
  CheckCircle2,
  Clock3,
  Keyboard,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  TicketCheck,
  UserPlus,
  XCircle,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  ApiError,
  checkInTicket,
  createWalkUp,
  fetchAttendees,
  fetchCheckInContext,
  hasApiConfig,
  searchCheckInGuests,
} from "@/lib/api";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  CheckInLookupResult,
  CheckInResult,
  EventDaySummary,
  EventAttendeeSummary,
  EventSummary,
  SessionSummary,
  TicketTypeSummary,
  WalkUpCheckInResult,
  WalkUpFormState,
} from "@/lib/types";

const colors = {
  background: "#080909",
  panel: "#111315",
  panelAlt: "#181b1f",
  border: "#2a2f35",
  text: "#f7f7f4",
  muted: "#a8adb4",
  soft: "#d7d9dc",
  red: "#e50913",
  redDark: "#99070d",
  green: "#34d399",
  amber: "#fbbf24",
  blue: "#7dd3fc",
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

export function CheckInScreen() {
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventDays, setEventDays] = useState<EventDaySummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [eventDayId, setEventDayId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [contextLoaded, setContextLoaded] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [ticketCode, setTicketCode] = useState("");
  const [result, setResult] = useState<CheckInResult | WalkUpCheckInResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendeeSummary[]>([]);
  const [attendeeFilter, setAttendeeFilter] = useState<"all" | "checked_in" | "not_checked_in">("all");
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [isRefreshingAttendees, setIsRefreshingAttendees] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<CheckInLookupResult[]>([]);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [walkUp, setWalkUp] = useState<WalkUpFormState>(emptyWalkUpForm);
  const [isAddingWalkUp, setIsAddingWalkUp] = useState(false);

  const token = session?.access_token ?? null;
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId) ?? null, [eventId, events]);
  const eventDayOptions = useMemo(() => eventDays.filter((item) => item.event_id === eventId), [eventDays, eventId]);
  const selectedEventDay = useMemo(() => eventDayOptions.find((item) => item.id === eventDayId) ?? null, [eventDayId, eventDayOptions]);
  const eventSessions = useMemo(
    () => sessions.filter((item) => item.event_id === eventId && (!eventDayId || !item.event_day_id || item.event_day_id === eventDayId)),
    [eventDayId, eventId, sessions],
  );
  const eventTicketTypes = useMemo(() => ticketTypes.filter((item) => item.event_id === eventId), [eventId, ticketTypes]);
  const selectedSession = useMemo(
    () => eventSessions.find((item) => item.id === sessionId) ?? null,
    [eventSessions, sessionId],
  );
  const checkedInCount = useMemo(
    () => attendees.filter((attendee) => Boolean(attendee.checked_in_at)).length,
    [attendees],
  );
  const visibleAttendees = useMemo(() => {
    const query = attendeeQuery.trim().toLowerCase();

    return attendees.filter((attendee) => {
      const statusMatches =
        attendeeFilter === "all" ||
        (attendeeFilter === "checked_in" && attendee.checked_in_at) ||
        (attendeeFilter === "not_checked_in" && !attendee.checked_in_at);

      if (!statusMatches) return false;
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
  }, [attendeeFilter, attendeeQuery, attendees]);

  const loadContext = useCallback(async (nextToken: string | null) => {
    setIsLoadingContext(true);
    setContextMessage(null);

    try {
      const data = await fetchCheckInContext(nextToken);
      setEvents(data.events);
      setEventDays(data.eventDays);
      setSessions(data.sessions);
      setTicketTypes(data.ticketTypes);
      setAttendees(data.initialAttendees);
      setEventId(data.events[0]?.id ?? "");
      setEventDayId(data.eventDays.find((day) => day.event_id === data.events[0]?.id)?.id ?? "");
      setSessionId("");
      setContextLoaded(true);
      setContextMessage(data.message ?? null);
    } catch (error) {
      setContextLoaded(false);
      setContextMessage(messageFromError(error));
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  const refreshAttendees = useCallback(
    async (targetEventId = eventId, targetEventDayId = eventDayId, targetSessionId = sessionId) => {
      if (!targetEventId || !targetEventDayId) {
        setAttendees([]);
        return;
      }

      setIsRefreshingAttendees(true);
      try {
        const data = await fetchAttendees(token, {
          eventId: targetEventId,
          eventDayId: targetEventDayId,
          sessionId: targetSessionId || null,
        });
        setAttendees(data.attendees);
        setStatusMessage(data.message ?? null);
      } catch (error) {
        setStatusMessage(messageFromError(error));
        setAttendees([]);
      } finally {
        setIsRefreshingAttendees(false);
      }
    },
    [eventDayId, eventId, sessionId, token],
  );

  useEffect(() => {
    let mounted = true;

    if (!hasSupabaseConfig || !supabase) {
      setAuthReady(true);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authReady && session && !contextLoaded && !isLoadingContext) {
      void loadContext(session.access_token);
    }
  }, [authReady, contextLoaded, isLoadingContext, loadContext, session]);

  useEffect(() => {
    if (contextLoaded && eventId) {
      void refreshAttendees(eventId, eventDayId, sessionId);
    }
  }, [contextLoaded, eventDayId, eventId, refreshAttendees, sessionId]);

  useEffect(() => {
    if (eventDayId && eventDayOptions.some((day) => day.id === eventDayId)) return;
    setEventDayId(eventDayOptions[0]?.id ?? "");
  }, [eventDayId, eventDayOptions]);

  useEffect(() => {
    setWalkUp((current) => {
      if (eventTicketTypes.some((ticketType) => ticketType.id === current.ticketTypeId)) return current;
      return {
        ...current,
        ticketTypeId: eventTicketTypes[0]?.id ?? "",
      };
    });
  }, [eventTicketTypes]);

  async function signIn() {
    if (!supabase) return;
    setIsSigningIn(true);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      setSession(data.session);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setDemoMode(false);
    setContextLoaded(false);
    setEvents([]);
    setEventDays([]);
    setSessions([]);
    setTicketTypes([]);
    setAttendees([]);
    setResult(null);
  }

  async function openDemoMode() {
    setDemoMode(true);
    await loadContext(null);
  }

  const submitTicket = useCallback(
    async (rawCode: string) => {
      const code = extractTicketCode(rawCode);
      if (!code || !eventId || !eventDayId) return;

      setTicketCode(code);
      setIsCheckingIn(true);
      setStatusMessage(null);

      try {
        const data = await checkInTicket(token, {
          eventId,
          eventDayId,
          sessionId: sessionId || null,
          ticketCode: code,
        });
        setResult(data);
        if (data.result === "success") {
          await refreshAttendees(eventId, eventDayId, sessionId);
        }
      } catch (error) {
        if (error instanceof ApiError && isCheckInResult(error.payload)) {
          setResult(error.payload);
        }
        setStatusMessage(messageFromError(error));
      } finally {
        setIsCheckingIn(false);
      }
    },
    [eventDayId, eventId, refreshAttendees, sessionId, token],
  );

  async function runLookup() {
    const query = lookupQuery.trim();
    if (query.length < 2) {
      setLookupResults([]);
      setLookupMessage("Enter at least 2 characters.");
      return;
    }

    setIsSearching(true);
    setLookupMessage(null);

    try {
      const data = await searchCheckInGuests(token, {
        eventId,
        eventDayId,
        sessionId: sessionId || null,
        query,
      });
      setLookupResults(data.results);
      setLookupMessage(data.message ?? (data.results.length ? null : "No matching guests found."));
    } catch (error) {
      setLookupResults([]);
      setLookupMessage(messageFromError(error));
    } finally {
      setIsSearching(false);
    }
  }

  async function addWalkUp() {
    if (!eventId || !walkUp.ticketTypeId) return;

    setIsAddingWalkUp(true);
    setStatusMessage(null);

    try {
      const data = await createWalkUp(token, {
        ...walkUp,
        eventId,
        eventDayId,
        sessionId: sessionId || null,
      });
      setResult(data);
      setStatusMessage(data.message ?? null);
      setWalkUp({
        ...emptyWalkUpForm,
        ticketTypeId: walkUp.ticketTypeId,
        paymentMode: walkUp.paymentMode,
      });
      await refreshAttendees(eventId, eventDayId, sessionId);
    } catch (error) {
      if (error instanceof ApiError && isCheckInResult(error.payload)) {
        setResult(error.payload);
      }
      setStatusMessage(messageFromError(error));
    } finally {
      setIsAddingWalkUp(false);
    }
  }

  const canCheckIn = Boolean(eventId && eventDayId);
  const notCheckedInCount = Math.max(attendees.length - checkedInCount, 0);

  if (!authReady) {
    return (
      <ScreenShell>
        <CenteredPanel>
          <ActivityIndicator color={colors.red} />
          <Text selectable style={{ color: colors.soft, fontSize: 16, marginTop: 12 }}>
            Opening check-in
          </Text>
        </CenteredPanel>
      </ScreenShell>
    );
  }

  if (!hasApiConfig()) {
    return (
      <ScreenShell>
        <CenteredPanel>
          <XCircle color={colors.red} size={28} />
          <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 12 }}>
            App URL missing
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" }}>
            Set EXPO_PUBLIC_APP_URL to the deployed FCF Events web app.
          </Text>
        </CenteredPanel>
      </ScreenShell>
    );
  }

  if (hasSupabaseConfig && !session && !demoMode) {
    return (
      <ScreenShell>
        <View style={{ gap: 18, paddingTop: 14 }}>
          <SignInHeader />
          <Panel title="Admin Sign In" icon={TicketCheck}>
            <Field label="Email">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                onChangeText={setEmail}
                placeholder="admin@example.com"
                placeholderTextColor="#717780"
                style={inputStyle}
                value={email}
              />
            </Field>
            <Field label="Password">
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#717780"
                secureTextEntry
                style={inputStyle}
                value={password}
              />
            </Field>
            {authMessage ? (
              <Text selectable style={{ color: colors.amber, fontSize: 14, lineHeight: 20 }}>
                {authMessage}
              </Text>
            ) : null}
            <ActionButton
              disabled={!email.trim() || !password || isSigningIn}
              icon={Mail}
              label={isSigningIn ? "Signing In" : "Sign In"}
              onPress={signIn}
            />
          </Panel>
        </View>
      </ScreenShell>
    );
  }

  if (!hasSupabaseConfig && !demoMode && !contextLoaded) {
    return (
      <ScreenShell>
        <Panel title="Demo Check-in" icon={TicketCheck}>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Supabase mobile auth variables are not set. Demo mode can connect only to a local web app running without service-role check-in auth.
          </Text>
          {contextMessage ? (
            <Text selectable style={{ color: colors.amber, fontSize: 14, lineHeight: 20 }}>
              {contextMessage}
            </Text>
          ) : null}
          <ActionButton disabled={isLoadingContext} icon={TicketCheck} label="Open Demo Check-in" onPress={openDemoMode} />
        </Panel>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
              {selectedSession ? "Session check-in" : "Event check-in"}
            </Text>
            <Text selectable style={{ color: colors.text, fontSize: width > 420 ? 30 : 25, fontWeight: "800", marginTop: 4 }}>
              {selectedEvent?.title ?? "Check-in"}
            </Text>
          </View>
          <IconButton disabled={isLoadingContext} icon={LogOut} onPress={signOut} />
        </View>

        {contextMessage ? (
          <StatusBanner tone="warning" text={contextMessage} />
        ) : null}

        <Panel title="Context" icon={TicketCheck}>
          <OptionRail
            items={events.map((event) => ({
              label: event.title,
              detail: formatEventDate(event.starts_at),
              value: event.id,
            }))}
            onChange={(value) => {
              setEventId(value);
              setEventDayId(eventDays.find((day) => day.event_id === value)?.id ?? "");
              setSessionId("");
              setLookupResults([]);
              setLookupMessage(null);
              setResult(null);
            }}
            value={eventId}
          />
          <OptionRail
            items={eventDayOptions.map((day) => ({
              label: day.label,
              detail: formatEventDate(day.starts_at),
              value: day.id,
            }))}
            onChange={(value) => {
              setEventDayId(value);
              setSessionId("");
              setLookupResults([]);
              setLookupMessage(null);
              setResult(null);
            }}
            value={eventDayId}
          />
          <OptionRail
            items={[
              { label: "Event gate", detail: selectedEventDay?.label ?? "Daily admission", value: "" },
              ...eventSessions.map((sessionItem) => ({
                label: sessionItem.title,
                detail: sessionItem.room ?? "Session",
                value: sessionItem.id,
              })),
            ]}
            onChange={(value) => {
              setSessionId(value);
              setLookupResults([]);
              setLookupMessage(null);
              setResult(null);
            }}
            value={sessionId}
          />
        </Panel>

        <Panel title="Scan Ticket" icon={Camera}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#000",
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              height: 286,
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {cameraActive && permission?.granted ? (
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                facing="back"
                onBarcodeScanned={
                  scanLocked
                    ? undefined
                    : ({ data }) => {
                        setScanLocked(true);
                        setCameraActive(false);
                        void submitTicket(data).finally(() => {
                          setTimeout(() => setScanLocked(false), 900);
                        });
                      }
                }
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <View style={{ alignItems: "center", gap: 14, padding: 20 }}>
                <Camera color={colors.red} size={42} />
                {!permission?.granted ? (
                  <ActionButton icon={Camera} label="Allow Camera" onPress={requestPermission} />
                ) : (
                  <ActionButton disabled={!canCheckIn || isCheckingIn} icon={Camera} label="Start Camera" onPress={() => setCameraActive(true)} />
                )}
              </View>
            )}
          </View>
          <View style={{ gap: 10 }}>
            <Field label="Ticket code">
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setTicketCode}
                onSubmitEditing={() => void submitTicket(ticketCode)}
                placeholder="FCF-..."
                placeholderTextColor="#717780"
                style={inputStyle}
                value={ticketCode}
              />
            </Field>
            <ActionButton
              disabled={!ticketCode.trim() || !canCheckIn || isCheckingIn}
              icon={Keyboard}
              label={isCheckingIn ? "Checking In" : "Check In"}
              onPress={() => void submitTicket(ticketCode)}
            />
          </View>
        </Panel>

        <Panel title="Result" icon={resultIcon(result)}>
          {result ? (
            <View style={{ gap: 12 }}>
              <StatusBanner tone={resultTone(result.result)} text={result.result.replaceAll("_", " ")} />
              {statusMessage ? (
                <Text selectable style={{ color: colors.soft, fontSize: 14, lineHeight: 20 }}>
                  {statusMessage}
                </Text>
              ) : null}
              {result.attendeeName ? (
                <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
                  {result.attendeeName}
                </Text>
              ) : null}
              {result.ticketTypeName ? (
                <Text selectable style={{ color: colors.muted, fontSize: 15 }}>
                  {result.ticketTypeName}
                </Text>
              ) : null}
              {"ticketCode" in result && result.ticketCode ? (
                <Text selectable style={{ color: colors.text, fontFamily: "monospace", fontSize: 14 }}>
                  {result.ticketCode}
                </Text>
              ) : null}
              {result.checkedInAt ? <InfoLine label="Checked in" value={formatDate(result.checkedInAt)} /> : null}
              {result.priorCheckedInAt ? <InfoLine label="Prior check-in" value={formatDate(result.priorCheckedInAt)} /> : null}
            </View>
          ) : (
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              No check-in result yet.
            </Text>
          )}
        </Panel>

        <Panel title="Attendees" icon={TicketCheck}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <CounterPill label="In" value={checkedInCount} tone="success" />
            <CounterPill label="Not in" value={notCheckedInCount} tone="muted" />
            <Pressable
              disabled={isRefreshingAttendees}
              onPress={() => void refreshAttendees()}
              style={{
                alignItems: "center",
                backgroundColor: colors.panelAlt,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                flexDirection: "row",
                gap: 6,
                minHeight: 40,
                paddingHorizontal: 12,
              }}
            >
              <RefreshCw color={colors.soft} size={16} />
              <Text style={{ color: colors.soft, fontSize: 13, fontWeight: "700" }}>
                Refresh
              </Text>
            </Pressable>
          </View>
          <TextInput
            autoCorrect={false}
            onChangeText={setAttendeeQuery}
            placeholder="Filter attendees"
            placeholderTextColor="#717780"
            style={inputStyle}
            value={attendeeQuery}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <FilterButton active={attendeeFilter === "all"} label="All" onPress={() => setAttendeeFilter("all")} />
            <FilterButton active={attendeeFilter === "checked_in"} label="In" onPress={() => setAttendeeFilter("checked_in")} />
            <FilterButton active={attendeeFilter === "not_checked_in"} label="Not In" onPress={() => setAttendeeFilter("not_checked_in")} />
          </View>
          <View style={{ gap: 10 }}>
            {visibleAttendees.length ? (
              visibleAttendees.map((attendee) => (
                <AttendeeRow
                  attendee={attendee}
                  disabled={isCheckingIn}
                  key={attendee.registration_id}
                  onCheckIn={(code) => void submitTicket(code)}
                />
              ))
            ) : (
              <EmptyText text={attendees.length ? "No attendees match the current filters." : "No attendees are registered for this event."} />
            )}
          </View>
        </Panel>

        <Panel title="Find Guest" icon={Search}>
          <Field label="Guest lookup">
            <TextInput
              autoCorrect={false}
              onChangeText={setLookupQuery}
              onSubmitEditing={() => void runLookup()}
              placeholder="Name, email, phone, or code"
              placeholderTextColor="#717780"
              style={inputStyle}
              value={lookupQuery}
            />
          </Field>
          <ActionButton disabled={!canCheckIn || isSearching} icon={Search} label={isSearching ? "Searching" : "Search"} onPress={() => void runLookup()} />
          {lookupMessage ? (
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {lookupMessage}
            </Text>
          ) : null}
          <View style={{ gap: 10 }}>
            {lookupResults.map((guest) => (
              <LookupRow disabled={isCheckingIn} guest={guest} key={guest.ticketId} onCheckIn={(code) => void submitTicket(code)} />
            ))}
          </View>
        </Panel>

        <Panel title="Add Walk-up" icon={UserPlus}>
          <TwoColumn width={width}>
            <Field label="First name">
              <WalkUpInput value={walkUp.firstName} onChangeText={(value) => setWalkUp((current) => ({ ...current, firstName: value }))} />
            </Field>
            <Field label="Last name">
              <WalkUpInput value={walkUp.lastName} onChangeText={(value) => setWalkUp((current) => ({ ...current, lastName: value }))} />
            </Field>
            <Field label="Email">
              <WalkUpInput
                autoCapitalize="none"
                inputMode="email"
                value={walkUp.email}
                onChangeText={(value) => setWalkUp((current) => ({ ...current, email: value }))}
              />
            </Field>
            <Field label="Phone">
              <WalkUpInput
                inputMode="tel"
                value={walkUp.phone}
                onChangeText={(value) => setWalkUp((current) => ({ ...current, phone: value }))}
              />
            </Field>
          </TwoColumn>
          <Field label="Ticket type">
            <OptionRail
              items={eventTicketTypes.map((ticketType) => ({
                label: ticketType.name,
                detail: formatMoney(ticketType.price, ticketType.currency),
                value: ticketType.id,
              }))}
              onChange={(value) => setWalkUp((current) => ({ ...current, ticketTypeId: value }))}
              value={walkUp.ticketTypeId}
            />
          </Field>
          <Field label="Payment">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <FilterButton
                active={walkUp.paymentMode === "cash"}
                label="Cash"
                onPress={() => setWalkUp((current) => ({ ...current, paymentMode: "cash" }))}
              />
              <FilterButton
                active={walkUp.paymentMode === "comp"}
                label="Comp"
                onPress={() => setWalkUp((current) => ({ ...current, paymentMode: "comp" }))}
              />
            </View>
          </Field>
          <TwoColumn width={width}>
            <Field label="Company">
              <WalkUpInput value={walkUp.company} onChangeText={(value) => setWalkUp((current) => ({ ...current, company: value }))} />
            </Field>
            <Field label="Role / title">
              <WalkUpInput value={walkUp.roleTitle} onChangeText={(value) => setWalkUp((current) => ({ ...current, roleTitle: value }))} />
            </Field>
          </TwoColumn>
          <ActionButton
            disabled={!walkUp.firstName.trim() || !walkUp.lastName.trim() || !walkUp.ticketTypeId || isAddingWalkUp}
            icon={UserPlus}
            label={isAddingWalkUp ? "Adding" : "Add and Check In"}
            onPress={() => void addWalkUp()}
          />
        </Panel>
      </View>
    </ScreenShell>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 36 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.panel,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.24)",
        justifyContent: "center",
        minHeight: 320,
        padding: 22,
      }}
    >
      {children}
    </View>
  );
}

function SignInHeader() {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#050606",
          borderColor: "#1f242a",
          borderRadius: 8,
          borderWidth: 1,
          boxShadow: "0 16px 32px rgba(0, 0, 0, 0.3)",
          height: 118,
          justifyContent: "center",
          width: 118,
        }}
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require("../../assets/icon.png")}
          style={{ height: 92, width: 92 }}
        />
      </View>
      <View style={{ alignItems: "center", gap: 5 }}>
        <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: "900", textAlign: "center" }}>
          FCF Check-in
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
          Admin access
        </Text>
      </View>
    </View>
  );
}

function Panel({ children, icon: Icon, title }: { children: React.ReactNode; icon: LucideIcon; title: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
        gap: 14,
        padding: 14,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Icon color={colors.red} size={20} />
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ActionButton({
  disabled,
  icon: Icon,
  label,
  onPress,
  variant = "primary",
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  const isSecondary = variant === "secondary";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: disabled ? "#36393e" : isSecondary ? colors.panelAlt : pressed ? colors.redDark : colors.red,
        borderColor: disabled ? "#44484e" : isSecondary ? colors.border : colors.red,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 48,
        opacity: disabled ? 0.58 : 1,
        paddingHorizontal: 14,
      })}
    >
      <Icon color={colors.text} size={18} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({ disabled, icon: Icon, onPress }: { disabled?: boolean; icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? "#24282d" : colors.panel,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 46,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        width: 46,
      })}
    >
      <Icon color={colors.soft} size={20} />
    </Pressable>
  );
}

function OptionRail({
  items,
  onChange,
  value,
}: {
  items: { label: string; detail?: string; value: string }[];
  onChange: (value: string) => void;
  value: string;
}) {
  if (!items.length) return <EmptyText text="No options available." />;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <Pressable
              key={`${item.value}-${item.label}`}
              onPress={() => onChange(item.value)}
              style={{
                backgroundColor: active ? colors.red : colors.panelAlt,
                borderColor: active ? colors.red : colors.border,
                borderRadius: 8,
                borderWidth: 1,
                maxWidth: 240,
                minHeight: 56,
                minWidth: 132,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                {item.label}
              </Text>
              {item.detail ? (
                <Text numberOfLines={1} style={{ color: active ? "#ffe3e5" : colors.muted, fontSize: 12, marginTop: 3 }}>
                  {item.detail}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function StatusBanner({ text, tone }: { text: string; tone: "success" | "warning" | "danger" | "muted" }) {
  const toneColor = tone === "success" ? colors.green : tone === "warning" ? colors.amber : tone === "danger" ? colors.red : colors.blue;
  return (
    <View
      style={{
        backgroundColor: `${toneColor}22`,
        borderColor: `${toneColor}66`,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" }}>
        {text}
      </Text>
    </View>
  );
}

function CounterPill({ label, tone, value }: { label: string; tone: "success" | "muted"; value: number }) {
  const color = tone === "success" ? colors.green : colors.muted;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: `${color}18`,
        borderColor: `${color}55`,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: "row",
        gap: 7,
        minHeight: 40,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: active ? colors.red : colors.panelAlt,
        borderColor: active ? colors.red : colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        minHeight: 42,
        justifyContent: "center",
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function AttendeeRow({
  attendee,
  disabled,
  onCheckIn,
}: {
  attendee: EventAttendeeSummary;
  disabled: boolean;
  onCheckIn: (ticketCode: string) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.panelAlt,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 10,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            {attendee.full_name}
          </Text>
          <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
            {attendee.company ?? attendee.role_title ?? attendee.email ?? "No contact listed"}
          </Text>
        </View>
        {attendee.checked_in_at ? <CheckCircle2 color={colors.green} size={22} /> : <Clock3 color={colors.muted} size={22} />}
      </View>
      <InfoLine label={attendee.ticket_type_name ?? "Ticket"} value={attendee.ticket_code ?? "No ticket issued"} />
      {attendee.checked_in_at ? <InfoLine label="Checked in" value={formatDate(attendee.checked_in_at)} /> : null}
      <ActionButton
        disabled={!attendee.ticket_code || disabled}
        icon={TicketCheck}
        label={attendee.checked_in_at ? "Review" : "Check In"}
        onPress={() => {
          if (attendee.ticket_code) onCheckIn(attendee.ticket_code);
        }}
        variant={attendee.checked_in_at ? "secondary" : "primary"}
      />
    </View>
  );
}

function LookupRow({
  disabled,
  guest,
  onCheckIn,
}: {
  disabled: boolean;
  guest: CheckInLookupResult;
  onCheckIn: (ticketCode: string) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.panelAlt,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 10,
        padding: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
          {guest.attendeeName}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
          {guest.attendeeEmail ?? guest.attendeePhone ?? "No contact listed"}
        </Text>
      </View>
      <InfoLine label={guest.ticketTypeName ?? "Ticket"} value={guest.ticketCode} />
      {guest.checkedInAt ? <InfoLine label="Checked in" value={formatDate(guest.checkedInAt)} /> : null}
      <ActionButton
        disabled={disabled}
        icon={TicketCheck}
        label={guest.checkedInAt ? "Review" : "Check In"}
        onPress={() => onCheckIn(guest.ticketCode)}
        variant={guest.checkedInAt ? "secondary" : "primary"}
      />
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
      <Text selectable style={{ color: colors.muted, flex: 1, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.soft, flex: 1.4, fontSize: 13, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.panelAlt,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        padding: 14,
      }}
    >
      <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}

function WalkUpInput(props: TextInputProps) {
  return <TextInput autoCorrect={false} placeholderTextColor="#717780" style={inputStyle} {...props} />;
}

function TwoColumn({ children, width }: { children: React.ReactNode; width: number }) {
  const useColumns = width >= 620;
  return (
    <View style={{ flexDirection: useColumns ? "row" : "column", flexWrap: "wrap", gap: 12 }}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <View key={index} style={{ flex: useColumns ? 1 : undefined, minWidth: useColumns ? 250 : undefined }}>
              {child}
            </View>
          ))
        : children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: colors.panelAlt,
  borderColor: colors.border,
  borderRadius: 8,
  borderWidth: 1,
  color: colors.text,
  fontSize: 16,
  minHeight: 48,
  paddingHorizontal: 12,
} as const;

function extractTicketCode(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) ?? value).trim();
  } catch {
    return value.split("?")[0]?.split("/").pop()?.trim() ?? value;
  }
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function isCheckInResult(value: unknown): value is CheckInResult {
  return Boolean(value && typeof value === "object" && "result" in value && typeof (value as CheckInResult).result === "string");
}

function resultIcon(result: CheckInResult | WalkUpCheckInResult | null): LucideIcon {
  if (!result) return TicketCheck;
  return result.result === "success" || result.result === "duplicate" ? CheckCircle2 : XCircle;
}

function resultTone(result: CheckInResult["result"]): "success" | "warning" | "danger" | "muted" {
  if (result === "success") return "success";
  if (result === "duplicate") return "warning";
  return "danger";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency,
    style: "currency",
  }).format(value);
}
