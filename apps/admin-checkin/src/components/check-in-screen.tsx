import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  Crown,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Keyboard,
  LogOut,
  Mail,
  NotebookPen,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TicketCheck,
  Undo2,
  UserPlus,
  Users,
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
  background: "#05070c",
  backgroundAlt: "#0b1020",
  panel: "#0f1724",
  panelAlt: "#151f31",
  panelElevated: "#182235",
  border: "#263348",
  text: "#f8fbff",
  muted: "#97a3b6",
  soft: "#d9e4f2",
  accent: "#e50913",
  accentDark: "#b20711",
  accentSoft: "#ffb3b6",
  danger: "#fb7185",
  green: "#34d399",
  amber: "#fbbf24",
  blue: "#7dd3fc",
  red: "#e50913",
  redDark: "#b20711",
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

const rememberMeKey = "fcf-checkin-remember-me";
const rememberedEmailKey = "fcf-checkin-email";
const tabletBreakpoint = 760;
const tabletRailWidth = 164;
const tabletRailGap = 16;
const tabletShellMaxWidth = 1280;

type CheckInTab = "scan" | "event" | "manual" | "attendees" | "walkUp" | "account";

const checkInTabs: { key: CheckInTab; label: string; icon: LucideIcon; prominent?: boolean }[] = [
  { key: "event", label: "Event", icon: Sparkles },
  { key: "manual", label: "Manual", icon: Keyboard },
  { key: "scan", label: "Scan", icon: Camera, prominent: true },
  { key: "attendees", label: "Attendees", icon: Users },
  { key: "walkUp", label: "Walk-Up", icon: UserPlus },
];

type CheckInOverviewItem = {
  id: string;
  scope: "event" | "session";
  label: string;
  detail: string;
  checkedInCount: number;
  totalCount: number;
  waitingCount: number;
  checkInRate: number;
  startsAt?: string;
  endsAt?: string;
  room?: string | null;
  requiresRegistration?: boolean;
};

export function CheckInScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
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
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CheckInTab>("scan");
  const [eventOverviewItems, setEventOverviewItems] = useState<CheckInOverviewItem[]>([]);
  const [overviewMessage, setOverviewMessage] = useState<string | null>(null);
  const [isRefreshingOverview, setIsRefreshingOverview] = useState(false);
  const resultPulse = useRef(new Animated.Value(0)).current;
  const overviewRequestId = useRef(0);
  const contextAutoLoadTokenRef = useRef<string | null>(null);

  const token = session?.access_token ?? null;
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId) ?? null, [eventId, events]);
  const eventDayOptions = useMemo(() => eventDays.filter((item) => item.event_id === eventId), [eventDays, eventId]);
  const selectedEventDay = useMemo(() => eventDayOptions.find((item) => item.id === eventDayId) ?? null, [eventDayId, eventDayOptions]);
  const overviewSessions = useMemo(() => sessions.filter((item) => item.event_id === eventId), [eventId, sessions]);
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
      setContextLoaded(true);
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

  const refreshEventOverview = useCallback(
    async (
      targetEventId = eventId,
      targetEventDayId = eventDayId,
      targetSessions: SessionSummary[] = overviewSessions,
    ) => {
      if (!targetEventId || !targetEventDayId) {
        setEventOverviewItems([]);
        return;
      }

      const requestId = overviewRequestId.current + 1;
      overviewRequestId.current = requestId;
      setIsRefreshingOverview(true);
      setOverviewMessage(null);

      try {
        const eventDaysById = new Map(
          eventDays
            .filter((day) => day.event_id === targetEventId)
            .map((day) => [day.id, day.label]),
        );
        const gatePromise = fetchAttendees(token, {
          eventId: targetEventId,
          eventDayId: targetEventDayId,
          sessionId: null,
        });
        const sessionPromises = targetSessions.map(async (sessionItem) => {
          const sessionEventDayId = sessionItem.event_day_id ?? targetEventDayId;
          const data = await fetchAttendees(token, {
            eventId: targetEventId,
            eventDayId: sessionEventDayId,
            sessionId: sessionItem.id,
          });

          return { data, eventDayId: sessionEventDayId, session: sessionItem };
        });
        const [gateData, sessionData] = await Promise.all([gatePromise, Promise.all(sessionPromises)]);

        if (requestId !== overviewRequestId.current) return;

        setEventOverviewItems([
          createOverviewItem({
            attendees: gateData.attendees,
            detail: eventDaysById.get(targetEventDayId) ?? "Selected check-in day",
            id: "event-gate",
            label: "Event gate",
            scope: "event",
          }),
          ...sessionData.map(({ data, eventDayId: sessionEventDayId, session: sessionItem }) =>
            createOverviewItem({
              attendees: data.attendees,
              detail: [eventDaysById.get(sessionEventDayId), sessionItem.room].filter(Boolean).join(" - ") || "Seminar",
              endsAt: sessionItem.ends_at,
              id: sessionItem.id,
              label: sessionItem.title,
              requiresRegistration: sessionItem.requires_registration,
              room: sessionItem.room,
              scope: "session",
              startsAt: sessionItem.starts_at,
            }),
          ),
        ]);
      } catch (error) {
        if (requestId !== overviewRequestId.current) return;
        setEventOverviewItems([]);
        setOverviewMessage(messageFromError(error));
      } finally {
        if (requestId === overviewRequestId.current) {
          setIsRefreshingOverview(false);
        }
      }
    },
    [eventDayId, eventDays, eventId, overviewSessions, token],
  );

  useEffect(() => {
    let mounted = true;

    if (!hasSupabaseConfig || !supabase) {
      setAuthReady(true);
      return undefined;
    }

    async function prepareAuth() {
      try {
        const [savedRememberMe, savedEmail, sessionResult] = await Promise.all([
          SecureStore.getItemAsync(rememberMeKey),
          SecureStore.getItemAsync(rememberedEmailKey),
          supabase!.auth.getSession(),
        ]);

        if (!mounted) return;

        const shouldRemember = savedRememberMe !== "false";
        setRememberMe(shouldRemember);
        if (savedEmail) setEmail(savedEmail);

        if (shouldRemember) {
          setSession(sessionResult.data.session);
        } else {
          if (sessionResult.data.session) await supabase!.auth.signOut();
          if (mounted) setSession(null);
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    }

    void prepareAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token ?? null;
    if (authReady && accessToken && !contextLoaded && !isLoadingContext && contextAutoLoadTokenRef.current !== accessToken) {
      contextAutoLoadTokenRef.current = accessToken;
      void loadContext(accessToken);
    }
  }, [authReady, contextLoaded, isLoadingContext, loadContext, session]);

  useEffect(() => {
    if (contextLoaded && eventId) {
      void refreshAttendees(eventId, eventDayId, sessionId);
    }
  }, [contextLoaded, eventDayId, eventId, refreshAttendees, sessionId]);

  useEffect(() => {
    if (contextLoaded && eventId && eventDayId) {
      void refreshEventOverview(eventId, eventDayId, overviewSessions);
    }
  }, [contextLoaded, eventDayId, eventId, overviewSessions, refreshEventOverview]);

  useEffect(() => {
    if (eventDayId && eventDayOptions.some((day) => day.id === eventDayId)) return;
    setEventDayId(eventDayOptions[0]?.id ?? "");
  }, [eventDayId, eventDayOptions]);

  useEffect(() => {
    if (!sessionId) return;
    if (eventSessions.some((sessionItem) => sessionItem.id === sessionId)) return;
    setSessionId("");
  }, [eventSessions, sessionId]);

  useEffect(() => {
    setWalkUp((current) => {
      if (eventTicketTypes.some((ticketType) => ticketType.id === current.ticketTypeId)) return current;
      return {
        ...current,
        ticketTypeId: eventTicketTypes[0]?.id ?? "",
      };
    });
  }, [eventTicketTypes]);

  useEffect(() => {
    if (!result) return;

    resultPulse.setValue(0);
    Animated.timing(resultPulse, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [result, resultPulse]);

  async function signIn() {
    if (!supabase) return;
    setIsSigningIn(true);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      await SecureStore.setItemAsync(rememberMeKey, rememberMe ? "true" : "false");
      if (rememberMe) {
        await SecureStore.setItemAsync(rememberedEmailKey, email.trim().toLowerCase());
      } else {
        await SecureStore.deleteItemAsync(rememberedEmailKey);
      }

      setSession(data.session);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    contextAutoLoadTokenRef.current = null;
    setSession(null);
    setDemoMode(false);
    setContextLoaded(false);
    setEvents([]);
    setEventDays([]);
    setSessions([]);
    setTicketTypes([]);
    setAttendees([]);
    setEventOverviewItems([]);
    setOverviewMessage(null);
    setResult(null);
    setCameraActive(false);
    setCameraReady(false);
    setCameraMessage(null);
  }

  async function openDemoMode() {
    setDemoMode(true);
    await loadContext(null);
  }

  function closeCamera() {
    setCameraActive(false);
    setCameraReady(false);
    setScanLocked(false);
  }

  async function startCamera() {
    setCameraMessage(null);
    setCameraReady(false);

    if (!canCheckIn) {
      setCameraMessage("Choose an event and day before scanning tickets.");
      return;
    }

    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        setCameraMessage("Camera permission is required to scan tickets.");
        return;
      }
    }

    setCameraActive(true);
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
          await refreshEventOverview(eventId, eventDayId, overviewSessions);
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
      await refreshEventOverview(eventId, eventDayId, overviewSessions);
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
  const isTabletLayout = width >= tabletBreakpoint;
  const shellHorizontalPadding = isTabletLayout ? 48 : 32;
  const shellContentWidth = Math.min(Math.max(width - shellHorizontalPadding, 0), tabletShellMaxWidth);
  const tabletMainColumnWidth = isTabletLayout
    ? Math.max(0, shellContentWidth - tabletRailWidth - tabletRailGap)
    : shellContentWidth;
  const canUseWideTabletPanels = isTabletLayout && tabletMainColumnWidth >= 860;
  const formColumnWidth = canUseWideTabletPanels ? tabletMainColumnWidth : Math.min(tabletMainColumnWidth, 620);
  const cameraHeight = isTabletLayout ? (canUseWideTabletPanels ? 420 : 360) : 286;
  const selectedScopeLabel = selectedSession?.title ?? "Event gate";
  const selectedDayLabel = selectedEventDay?.label ?? "Daily admission";
  const checkInRate = attendees.length ? Math.round((checkedInCount / attendees.length) * 100) : 0;
  const resultScale = resultPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const panelGridStyle: StyleProp<ViewStyle> = canUseWideTabletPanels
    ? { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 }
    : { gap: 16 };
  const halfPanelStyle: StyleProp<ViewStyle> = canUseWideTabletPanels
    ? { flexBasis: "48%", flexGrow: 1, minWidth: 330 }
    : undefined;
  const fullPanelStyle: StyleProp<ViewStyle> = isTabletLayout ? { flexBasis: "100%", minWidth: 0 } : undefined;
  const tabletCardGridStyle: StyleProp<ViewStyle> = canUseWideTabletPanels
    ? { flexDirection: "row", flexWrap: "wrap", gap: 12 }
    : { gap: 10 };
  const tabletCardItemStyle: StyleProp<ViewStyle> = canUseWideTabletPanels
    ? { flexBasis: "48%", flexGrow: 1, minWidth: 360 }
    : undefined;
  async function refreshCurrentScope() {
    await Promise.all([refreshAttendees(), refreshEventOverview()]);
  }

  const eventCommandPanel = (
    <Panel title="Event Overview" icon={Sparkles} style={fullPanelStyle}>
      <EventOverviewSnapshot
        activeScopeId={sessionId || "event-gate"}
        dayLabel={selectedDayLabel}
        isLoading={isRefreshingOverview}
        items={eventOverviewItems}
        message={overviewMessage}
        onRefresh={() => void refreshEventOverview()}
        onSelectScope={(scopeId) => {
          setSessionId(scopeId === "event-gate" ? "" : scopeId);
          setLookupResults([]);
          setLookupMessage(null);
          setResult(null);
          setCameraActive(false);
        }}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <SummaryPill label="Now scanning" value={selectedEvent?.title ?? "Choose an event"} emphasis />
        <SummaryPill label="Day" value={selectedDayLabel} />
        <SummaryPill label="Area" value={selectedScopeLabel} emphasis={Boolean(selectedSession)} />
        <SummaryPill label="Progress" value={`${checkedInCount}/${attendees.length} (${checkInRate}%)`} />
      </View>

      <Field label="Quick event switcher">
        <OptionRail
          emptyText="No events are available for this scanner account."
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
            setEventOverviewItems([]);
            setOverviewMessage(null);
            setCameraActive(false);
          }}
          value={eventId}
        />
      </Field>
      <Field label="Check-in day">
        <OptionRail
          emptyText="No check-in days are configured for this event."
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
            setEventOverviewItems([]);
            setOverviewMessage(null);
            setCameraActive(false);
          }}
          value={eventDayId}
        />
      </Field>
      <Field label="Gate or seminar">
        <OptionRail
          items={[
            { label: "Event gate", detail: selectedDayLabel, value: "" },
            ...eventSessions.map((sessionItem) => ({
              label: sessionItem.title,
              detail: sessionItem.room ?? "Seminar",
              value: sessionItem.id,
            })),
          ]}
          onChange={(value) => {
            setSessionId(value);
            setLookupResults([]);
            setLookupMessage(null);
            setResult(null);
            setCameraActive(false);
          }}
          value={sessionId}
        />
      </Field>
    </Panel>
  );
  const scannerPanel = (
    <Panel title="Live Scanner" icon={Camera} style={[halfPanelStyle, canUseWideTabletPanels ? { flexBasis: "58%", minWidth: 520 } : undefined]}>
      <ScannerLaunchCard
        cameraHeight={cameraHeight}
        cameraMessage={cameraMessage}
        canCheckIn={canCheckIn}
        isCheckingIn={isCheckingIn}
        onManualTicket={() => {
          setManualEntryOpen(true);
          setActiveTab("manual");
        }}
        onOpenScanner={() => void startCamera()}
        permissionGranted={permission?.granted}
        selectedDayLabel={selectedDayLabel}
        selectedEventTitle={selectedEvent?.title ?? "Choose an event"}
        selectedSession={selectedSession}
        selectedScopeLabel={selectedScopeLabel}
      />
      <QuickActionDock
        onNote={() => setStatusMessage("Guest notes are managed from the attendee profile. Search the guest below to open the right record.")}
        onUndo={() => {
          setResult(null);
          setTicketCode("");
          setStatusMessage("Last scan cleared.");
        }}
        onVip={() => {
          setAttendeeQuery("vip");
          setAttendeeFilter("all");
          setActiveTab("attendees");
          setStatusMessage("VIP filter ready.");
        }}
      />
    </Panel>
  );
  const resultPanel = (
    <Panel title="Instant Feedback" icon={resultIcon(result)} style={[halfPanelStyle, canUseWideTabletPanels ? { flexBasis: "38%", minWidth: 330 } : undefined]}>
      <Animated.View style={{ transform: [{ scale: resultScale }] }}>
        <PremiumResultCard result={result} statusMessage={statusMessage} />
      </Animated.View>
    </Panel>
  );
  const attendeePanel = (
    <Panel title="Attendee Flow" icon={Users} style={fullPanelStyle}>
      <AttendeeStatsStrip checkedInCount={checkedInCount} checkInRate={checkInRate} notCheckedInCount={notCheckedInCount} />
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            autoCorrect={false}
            onChangeText={setAttendeeQuery}
            placeholder="Search attendees, ticket code, company"
            placeholderTextColor="#717780"
            style={inputStyle}
            value={attendeeQuery}
          />
        </View>
        <Pressable
          disabled={isRefreshingAttendees}
          onPress={() => void refreshAttendees()}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: pressed ? colors.panelElevated : colors.panelAlt,
            borderColor: colors.border,
            borderRadius: 18,
            borderWidth: 1,
            height: 56,
            justifyContent: "center",
            opacity: isRefreshingAttendees ? 0.55 : 1,
            width: 56,
          })}
        >
          {isRefreshingAttendees ? <ActivityIndicator color={colors.accent} /> : <RefreshCw color={colors.soft} size={21} />}
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <FilterButton active={attendeeFilter === "all"} label="All" onPress={() => setAttendeeFilter("all")} />
        <FilterButton active={attendeeFilter === "checked_in"} label="In" onPress={() => setAttendeeFilter("checked_in")} />
        <FilterButton active={attendeeFilter === "not_checked_in"} label="Waiting" onPress={() => setAttendeeFilter("not_checked_in")} />
      </View>
      <View style={tabletCardGridStyle}>
        {visibleAttendees.length ? (
          visibleAttendees.map((attendee) => (
            <View key={attendee.registration_id} style={tabletCardItemStyle}>
              <AttendeeRow
                attendee={attendee}
                disabled={isCheckingIn}
                onCheckIn={(code) => void submitTicket(code)}
              />
            </View>
          ))
        ) : (
          <EmptyText text={attendees.length ? "No attendees match the current filters." : "No attendees are registered for this event."} />
        )}
      </View>
    </Panel>
  );
  const manualPanel = (
    <View style={{ gap: 16 }}>
      <Panel title="Manual Ticket" icon={Keyboard} style={fullPanelStyle}>
        <ActionButton
          icon={Keyboard}
          label={manualEntryOpen || isTabletLayout || activeTab === "manual" ? "Manual Entry Ready" : "Manual Ticket"}
          onPress={() => setManualEntryOpen((current) => !current)}
          variant={manualEntryOpen || isTabletLayout || activeTab === "manual" ? "secondary" : "primary"}
        />
        {manualEntryOpen || isTabletLayout || activeTab === "manual" ? (
          <View style={{ gap: 12 }}>
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
              icon={TicketCheck}
              label={isCheckingIn ? "Checking In" : "Check In Ticket"}
              onPress={() => void submitTicket(ticketCode)}
            />
          </View>
        ) : null}
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 12, paddingTop: 14 }}>
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
          <ActionButton disabled={!canCheckIn || isSearching} icon={Search} label={isSearching ? "Searching" : "Search Guest"} onPress={() => void runLookup()} />
          {lookupMessage ? (
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {lookupMessage}
            </Text>
          ) : null}
          <View style={tabletCardGridStyle}>
            {lookupResults.map((guest) => (
              <View key={guest.ticketId} style={tabletCardItemStyle}>
                <LookupRow disabled={isCheckingIn} guest={guest} onCheckIn={(code) => void submitTicket(code)} />
              </View>
            ))}
          </View>
        </View>
      </Panel>
      {result || statusMessage ? resultPanel : null}
    </View>
  );
  const walkUpPanel = (
    <View style={{ gap: 16 }}>
      <Panel title="Walk-up Guest" icon={UserPlus} style={fullPanelStyle}>
        <TwoColumn width={formColumnWidth}>
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
        <TwoColumn width={formColumnWidth}>
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
      {result || statusMessage ? resultPanel : null}
    </View>
  );
  const accountPanel = (
    <Panel title="Scanner Account" icon={ShieldCheck} style={fullPanelStyle}>
      <View style={{ flexDirection: isTabletLayout ? "row" : "column", flexWrap: "wrap", gap: 10 }}>
        <SummaryPill label="Signed in as" value={session?.user?.email ?? (demoMode ? "Demo mode" : "Scanner account")} emphasis />
        <SummaryPill label="Current event" value={selectedEvent?.title ?? "No event selected"} />
        <SummaryPill label="Check-in day" value={selectedDayLabel} />
        <SummaryPill label="Area" value={selectedScopeLabel} emphasis={Boolean(selectedSession)} />
      </View>
      <View style={{ flexDirection: isTabletLayout ? "row" : "column", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ActionButton disabled={isLoadingContext} icon={RefreshCw} label={isLoadingContext ? "Refreshing" : "Refresh Access"} onPress={() => void loadContext(token)} />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton icon={LogOut} label="Sign Out" onPress={signOut} variant="secondary" />
        </View>
      </View>
    </Panel>
  );
  const activeTabContent =
    activeTab === "scan" ? (
      <View style={{ gap: 16 }}>
        <View style={panelGridStyle}>
          {scannerPanel}
          {resultPanel}
        </View>
      </View>
    ) : activeTab === "event" ? (
      eventCommandPanel
    ) : activeTab === "manual" ? (
      manualPanel
    ) : activeTab === "attendees" ? (
      attendeePanel
    ) : activeTab === "walkUp" ? (
      walkUpPanel
    ) : (
      accountPanel
    );
  const emptyEventContent =
    activeTab === "account" ? (
      accountPanel
    ) : (
      <NoEventsState
        isLoading={isLoadingContext}
        message={contextMessage ?? "No events are available for this scanner account yet."}
        onRefresh={() => {
          void loadContext(token);
        }}
        onSignOut={signOut}
      />
    );
  const bottomNavigation = !isTabletLayout ? (
    <CheckInBottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
  ) : null;

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
      <ScreenShell maxWidth={680}>
        <View style={{ gap: 18, paddingTop: 14 }}>
          <SignInHeader />
          <Panel title="Admin Sign In" icon={TicketCheck}>
            <Field label="Email">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                onChangeText={setEmail}
                placeholder="login@fcf.events"
                placeholderTextColor="#717780"
                style={inputStyle}
                value={email}
              />
            </Field>
            <Field label="Password">
              <View style={{ position: "relative" }}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#717780"
                  secureTextEntry={!passwordVisible}
                  style={[inputStyle, { paddingRight: 52 }]}
                  value={password}
                />
                <PasswordToggleButton
                  visible={passwordVisible}
                  onPress={() => setPasswordVisible((current) => !current)}
                />
              </View>
            </Field>
            <RememberMeToggle
              active={rememberMe}
              onPress={() => setRememberMe((current) => !current)}
            />
            {authMessage ? (
              <Text selectable style={{ color: colors.amber, fontSize: 14, lineHeight: 20 }}>
                {authMessage}
              </Text>
            ) : null}
            <ActionButton
              disabled={!email.trim() || !password.trim() || isSigningIn}
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
    <>
      <ScreenShell bottomBar={bottomNavigation} maxWidth={tabletShellMaxWidth}>
        {/* NEW SLEEK MODERN DESIGN - Material 3 inspired event check-in surface */}
        <View style={{ gap: isTabletLayout ? 22 : 16 }}>
          <StaffTopBar
            accountActive={activeTab === "account"}
            checkedInCount={checkedInCount}
            isLoading={isLoadingContext}
            modeLabel={selectedSession ? "Seminar scan" : "Event gate"}
            onOpenAccount={() => setActiveTab("account")}
            onRefresh={() => void refreshCurrentScope()}
            selectedEventTitle={selectedEvent?.title ?? "Choose event"}
            selectedScopeLabel={selectedScopeLabel}
            totalCount={attendees.length}
          />

          {contextMessage ? (
            <StatusBanner tone="warning" text={contextMessage} />
          ) : null}

          <CheckInNavigationShell activeTab={activeTab} isTabletLayout={isTabletLayout} onTabChange={setActiveTab}>
            {events.length ? activeTabContent : emptyEventContent}
          </CheckInNavigationShell>
        </View>
      </ScreenShell>
      <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={closeCamera}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={cameraActive && Boolean(permission?.granted)}
      >
        <View style={{ backgroundColor: "#000", flex: 1 }}>
          <CameraView
            active={cameraActive && Boolean(permission?.granted)}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            facing="back"
            onBarcodeScanned={
              scanLocked
                ? undefined
                : ({ data }) => {
                    setScanLocked(true);
                    setCameraActive(false);
                    setCameraReady(false);
                    void submitTicket(data).finally(() => {
                      setTimeout(() => setScanLocked(false), 900);
                    });
                  }
            }
            onCameraReady={() => setCameraReady(true)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              left: 14,
              position: "absolute",
              right: 14,
              top: insets.top + 12,
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
              <View
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.72)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  borderRadius: 8,
                  borderWidth: 1,
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
                  {selectedSession ? "Seminar scan" : "Event gate scan"}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 2 }}>
                  {selectedScopeLabel}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.soft, fontSize: 13, fontWeight: "700", marginTop: 2 }}>
                  {selectedEvent?.title ?? "Check-in"} - {selectedDayLabel}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close scanner"
                accessibilityRole="button"
                onPress={closeCamera}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? "rgba(229, 9, 19, 0.92)" : "rgba(0, 0, 0, 0.72)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  borderRadius: 8,
                  borderWidth: 1,
                  height: 54,
                  justifyContent: "center",
                  width: 54,
                })}
              >
                <XCircle color={colors.text} size={26} />
              </Pressable>
            </View>
          </View>
          <View
            pointerEvents="none"
            style={{
              alignItems: "center",
              bottom: insets.bottom + 28,
              left: 20,
              position: "absolute",
              right: 20,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.72)",
                borderColor: colors.red,
                borderRadius: 8,
                borderWidth: 1,
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900", textAlign: "center" }}>
                Hold ticket QR in frame
              </Text>
            </View>
          </View>
          {!cameraReady ? (
            <View
              pointerEvents="none"
              style={{
                alignItems: "center",
                backgroundColor: "rgba(0, 0, 0, 0.72)",
                bottom: 0,
                justifyContent: "center",
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            >
              <ActivityIndicator color={colors.red} />
              <Text style={{ color: colors.soft, fontSize: 14, fontWeight: "700", marginTop: 10 }}>
                Opening camera
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function ScreenShell({
  bottomBar,
  children,
  maxWidth = tabletShellMaxWidth,
}: {
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= tabletBreakpoint;
  const horizontalPadding = isWide ? 24 : 16;
  const topPadding = isWide ? 24 : 16;
  const bottomPadding = isWide ? 44 : 36;
  const stableTopInset = process.env.EXPO_OS === "android" ? 44 : insets.top;
  const stableBottomInset = process.env.EXPO_OS === "android" ? 0 : insets.bottom;
  const hasBottomBar = Boolean(bottomBar);

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.background, flex: 1, paddingBottom: stableBottomInset, paddingTop: stableTopInset }}
    >
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          gap: 16,
          paddingBottom: bottomPadding + (hasBottomBar ? 132 : 0),
          paddingHorizontal: horizontalPadding,
          paddingTop: topPadding,
        }}
        contentInsetAdjustmentBehavior={process.env.EXPO_OS === "ios" ? "automatic" : "never"}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <View style={{ gap: 16, maxWidth, width: "100%" }}>{children}</View>
      </ScrollView>
      {bottomBar ? (
        <View
          style={{
            backgroundColor: "transparent",
            paddingBottom: process.env.EXPO_OS === "android" ? 12 : Math.max(insets.bottom, 12),
            paddingHorizontal: 12,
            paddingTop: 16,
          }}
        >
          {bottomBar}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function CheckInNavigationShell({
  activeTab,
  children,
  isTabletLayout,
  onTabChange,
}: {
  activeTab: CheckInTab;
  children: React.ReactNode;
  isTabletLayout: boolean;
  onTabChange: (tab: CheckInTab) => void;
}) {
  if (!isTabletLayout) {
    return <View style={{ gap: 16 }}>{children}</View>;
  }

  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: tabletRailGap }}>
      <View
        style={{
          backgroundColor: "rgba(10, 16, 32, 0.96)",
          borderColor: "rgba(255, 179, 182, 0.16)",
          borderRadius: 28,
          borderWidth: 1,
          boxShadow: "0 18px 42px rgba(0, 0, 0, 0.30)",
          gap: 8,
          padding: 10,
          width: tabletRailWidth,
        }}
      >
        {checkInTabs.map((tab) => (
          <CheckInTabButton
            active={activeTab === tab.key}
            icon={tab.icon}
            key={tab.key}
            label={tab.label}
            layout="rail"
            onPress={() => onTabChange(tab.key)}
            prominent={tab.prominent}
          />
        ))}
      </View>
      <View style={{ flex: 1, gap: 16, minWidth: 0 }}>{children}</View>
    </View>
  );
}

function CheckInBottomNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: CheckInTab;
  onTabChange: (tab: CheckInTab) => void;
}) {
  return (
    <View
      style={{
        // NEW SLEEK PROFESSIONAL DESIGN - floating glass tab bar
        alignItems: "stretch",
        backgroundColor: "rgba(10, 16, 32, 0.98)",
        borderColor: "rgba(255, 179, 182, 0.18)",
        borderRadius: 32,
        borderWidth: 1,
        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.36)",
        flexDirection: "row",
        gap: 4,
        minHeight: 86,
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      {checkInTabs.map((tab) => (
        <CheckInTabButton
          active={activeTab === tab.key}
          icon={tab.icon}
          key={tab.key}
          label={tab.label}
          layout="bottom"
          onPress={() => onTabChange(tab.key)}
          prominent={tab.prominent}
        />
      ))}
    </View>
  );
}

function CheckInTabButton({
  active,
  icon: Icon,
  label,
  layout,
  onPress,
  prominent,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  layout: "bottom" | "rail";
  onPress: () => void;
  prominent?: boolean;
}) {
  const isRail = layout === "rail";
  const isCenterAction = Boolean(prominent && !isRail);

  if (isCenterAction) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={onPress}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: "rgba(5, 7, 12, 0.98)",
            borderColor: active ? colors.accentSoft : "rgba(255, 179, 182, 0.35)",
            borderRadius: 44,
            borderWidth: 1,
            boxShadow: active
              ? "0 18px 38px rgba(229, 9, 19, 0.36)"
              : "0 14px 30px rgba(229, 9, 19, 0.24)",
            height: 86,
            justifyContent: "center",
            marginTop: -34,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            width: 86,
          })}
        >
          {({ pressed }) => (
            <View
              style={{
                alignItems: "center",
                backgroundColor: pressed ? colors.accentDark : colors.accent,
                borderColor: "rgba(255, 255, 255, 0.16)",
                borderRadius: 37,
                borderWidth: 1,
                height: 74,
                justifyContent: "center",
                overflow: "hidden",
                width: 74,
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                  borderRadius: 999,
                  height: 24,
                  left: 14,
                  position: "absolute",
                  right: 14,
                  top: 8,
                }}
              />
              <Icon color={colors.text} size={31} strokeWidth={2.35} />
            </View>
          )}
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            color: active ? colors.accentSoft : colors.muted,
            fontSize: 11,
            fontWeight: "900",
            marginTop: 5,
            textAlign: "center",
            width: "100%",
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? "rgba(229, 9, 19, 0.14)" : pressed ? "rgba(255, 255, 255, 0.06)" : "transparent",
        borderColor: active ? "rgba(255, 179, 182, 0.30)" : "transparent",
        borderRadius: 22,
        borderWidth: 1,
        flex: isRail ? undefined : 1,
        flexDirection: isRail ? "row" : "column",
        gap: isRail ? 10 : 5,
        justifyContent: "center",
        minWidth: 0,
        minHeight: isRail ? 58 : 68,
        paddingHorizontal: isRail ? 12 : 4,
      })}
    >
      <Icon color={active ? colors.accentSoft : colors.soft} size={isRail ? 20 : 22} strokeWidth={active ? 2.45 : 2} />
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.text : colors.muted,
          fontSize: isRail ? 13 : 10,
          fontWeight: "900",
          textAlign: "center",
          width: "100%",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.panelElevated,
        borderColor: colors.border,
        borderRadius: 28,
        borderWidth: 1,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.3)",
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
  const { width } = useWindowDimensions();
  const isWide = width >= tabletBreakpoint;
  const tileSize = isWide ? 140 : 118;
  const markSize = isWide ? 110 : 92;

  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.backgroundAlt,
          borderColor: `${colors.accent}66`,
          borderRadius: 30,
          borderWidth: 1,
          boxShadow: "0 18px 38px rgba(229, 9, 19, 0.16)",
          height: tileSize,
          justifyContent: "center",
          width: tileSize,
        }}
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require("../../assets/icon.png")}
          style={{ height: markSize, width: markSize }}
        />
      </View>
      <View style={{ alignItems: "center", gap: 5 }}>
        <Text selectable style={{ color: colors.text, fontSize: isWide ? 36 : 30, fontWeight: "900", textAlign: "center" }}>
          FCF Check-in
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
          Admin access
        </Text>
      </View>
    </View>
  );
}

function Panel({
  children,
  icon: Icon,
  style,
  title,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.panelElevated,
          borderColor: colors.border,
          borderRadius: 24,
          borderWidth: 1,
          boxShadow: "0 16px 36px rgba(0, 0, 0, 0.24)",
          gap: 16,
          padding: 18,
        },
        style,
      ]}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.accent}18`,
            borderColor: `${colors.accent}44`,
            borderRadius: 14,
            borderWidth: 1,
            height: 34,
            justifyContent: "center",
            width: 34,
          }}
        >
          <Icon color={colors.accent} size={19} />
        </View>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
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
      <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>
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
        backgroundColor: disabled ? "#343a46" : isSecondary ? (pressed ? colors.panelElevated : colors.panelAlt) : pressed ? colors.accentDark : colors.accent,
        borderColor: disabled ? "#475063" : isSecondary ? colors.border : colors.accent,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 56,
        opacity: disabled ? 0.58 : 1,
        paddingHorizontal: 16,
      })}
    >
      <Icon color={colors.text} size={18} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({
  accessibilityLabel,
  active,
  disabled,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.accent : pressed ? colors.panelElevated : colors.panelAlt,
        borderColor: active ? colors.accent : colors.border,
        borderRadius: 16,
        borderWidth: 1,
        height: 48,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        width: 48,
      })}
    >
      <Icon color={active ? colors.text : colors.soft} size={19} />
    </Pressable>
  );
}

function PasswordToggleButton({ onPress, visible }: { onPress: () => void; visible: boolean }) {
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      accessibilityRole="button"
      accessibilityState={{ selected: visible }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.panelElevated : "transparent",
        borderRadius: 14,
        height: 48,
        justifyContent: "center",
        position: "absolute",
        right: 4,
        top: 4,
        width: 48,
      })}
    >
      <Icon color={colors.soft} size={20} />
    </Pressable>
  );
}

function RememberMeToggle({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Remember me on this device"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.panelElevated : colors.panelAlt,
        borderColor: active ? colors.accent : colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: "row",
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 14,
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: active ? colors.accent : "transparent",
          borderColor: active ? colors.accent : colors.muted,
          borderRadius: 6,
          borderWidth: 1,
          height: 24,
          justifyContent: "center",
          width: 24,
        }}
      >
        {active ? <CheckCircle2 color={colors.text} size={16} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
          Remember me
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 }}>
          Keep this scanner account signed in on this device.
        </Text>
      </View>
    </Pressable>
  );
}

function StaffTopBar({
  accountActive,
  checkedInCount,
  isLoading,
  modeLabel,
  onOpenAccount,
  onRefresh,
  selectedEventTitle,
  selectedScopeLabel,
  totalCount,
}: {
  accountActive: boolean;
  checkedInCount: number;
  isLoading: boolean;
  modeLabel: string;
  onOpenAccount: () => void;
  onRefresh: () => void;
  selectedEventTitle: string;
  selectedScopeLabel: string;
  totalCount: number;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= tabletBreakpoint;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.panel,
        borderColor: colors.border,
        borderRadius: 26,
        borderWidth: 1,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.28)",
        flexDirection: "row",
        gap: isWide ? 14 : 10,
        justifyContent: "space-between",
        padding: isWide ? 18 : 14,
      }}
    >
      <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: isWide ? 14 : 10, minWidth: 0 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.backgroundAlt,
            borderColor: `${colors.accent}66`,
            borderRadius: isWide ? 20 : 17,
            borderWidth: 1,
            height: isWide ? 58 : 48,
            justifyContent: "center",
            width: isWide ? 58 : 48,
          }}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require("../../assets/icon.png")}
            style={{ height: isWide ? 40 : 34, width: isWide ? 40 : 34 }}
          />
        </View>
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatusPill label={modeLabel} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
              {checkedInCount}/{totalCount} checked in
            </Text>
          </View>
          <Text numberOfLines={2} selectable style={{ color: colors.text, fontSize: isWide ? 27 : 22, fontWeight: "900", lineHeight: isWide ? 32 : 27 }}>
            {selectedEventTitle}
          </Text>
          <Text numberOfLines={1} selectable style={{ color: colors.soft, fontSize: 14, fontWeight: "700" }}>
            {selectedScopeLabel}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <IconButton accessibilityLabel="Refresh attendees" disabled={isLoading} icon={RefreshCw} onPress={onRefresh} />
        <IconButton
          accessibilityLabel="Open scanner account"
          active={accountActive}
          icon={ShieldCheck}
          onPress={onOpenAccount}
        />
      </View>
    </View>
  );
}

function NoEventsState({
  isLoading,
  message,
  onRefresh,
  onSignOut,
}: {
  isLoading: boolean;
  message: string;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  return (
    <Panel title="No Events Assigned" icon={ShieldCheck}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.backgroundAlt,
          borderColor: colors.border,
          borderRadius: 24,
          borderWidth: 1,
          gap: 14,
          minHeight: 280,
          justifyContent: "center",
          padding: 22,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.accent}18`,
            borderColor: `${colors.accent}55`,
            borderRadius: 30,
            borderWidth: 1,
            height: 64,
            justifyContent: "center",
            width: 64,
          }}
        >
          <TicketCheck color={colors.accent} size={34} />
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text selectable style={{ color: colors.text, fontSize: 23, fontWeight: "900", textAlign: "center" }}>
            No check-in events yet
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
            {message}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", width: "100%" }}>
          <View style={{ flexGrow: 1, minWidth: 180 }}>
            <ActionButton disabled={isLoading} icon={RefreshCw} label={isLoading ? "Refreshing" : "Refresh Access"} onPress={onRefresh} />
          </View>
          <View style={{ flexGrow: 1, minWidth: 150 }}>
            <ActionButton icon={LogOut} label="Sign Out" onPress={onSignOut} variant="secondary" />
          </View>
        </View>
      </View>
    </Panel>
  );
}

function ScannerLaunchCard({
  cameraHeight,
  cameraMessage,
  canCheckIn,
  isCheckingIn,
  onManualTicket,
  onOpenScanner,
  permissionGranted,
  selectedDayLabel,
  selectedEventTitle,
  selectedSession,
  selectedScopeLabel,
}: {
  cameraHeight: number;
  cameraMessage: string | null;
  canCheckIn: boolean;
  isCheckingIn: boolean;
  onManualTicket: () => void;
  onOpenScanner: () => void;
  permissionGranted?: boolean;
  selectedDayLabel: string;
  selectedEventTitle: string;
  selectedSession: SessionSummary | null;
  selectedScopeLabel: string;
}) {
  const scopeText = canCheckIn ? selectedScopeLabel : "Choose an event and day";
  const detailText = `${selectedEventTitle} - ${selectedDayLabel}${selectedSession?.room ? ` - ${selectedSession.room}` : ""}`;

  return (
    <View
      style={{
        // NEW SLEEK PROFESSIONAL DESIGN - attendee/staff camera-first scan surface
        backgroundColor: "#050914",
        borderColor: canCheckIn ? "rgba(255, 179, 182, 0.26)" : `${colors.amber}55`,
        borderRadius: 32,
        borderWidth: 1,
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.34)",
        gap: 14,
        minHeight: cameraHeight,
        overflow: "hidden",
        padding: 16,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text numberOfLines={1} selectable style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
            {scopeText}
          </Text>
          <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
            {detailText}
          </Text>
        </View>
        <View
          style={{
            alignItems: "center",
            backgroundColor: permissionGranted ? "rgba(229, 9, 19, 0.13)" : "rgba(251, 191, 36, 0.12)",
            borderColor: permissionGranted ? "rgba(255, 179, 182, 0.28)" : "rgba(251, 191, 36, 0.26)",
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: "row",
            gap: 6,
            minHeight: 34,
            paddingHorizontal: 10,
          }}
        >
          <View
            style={{
              backgroundColor: permissionGranted ? colors.accent : colors.amber,
              borderRadius: 5,
              height: 9,
              width: 9,
            }}
          />
          <Text style={{ color: permissionGranted ? colors.accentSoft : colors.amber, fontSize: 11, fontWeight: "900" }}>
            {permissionGranted ? "Ready" : "Permission"}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.background,
          borderColor: "rgba(255, 179, 182, 0.16)",
          borderRadius: 28,
          borderWidth: 1,
          flex: 1,
          justifyContent: "center",
          minHeight: cameraHeight - 92,
          overflow: "hidden",
          padding: 18,
        }}
      >
          <View style={{ backgroundColor: "rgba(229, 9, 19, 0.10)", borderRadius: 999, height: 210, position: "absolute", right: -80, top: -92, width: 210 }} />
        <View style={{ backgroundColor: "rgba(229, 9, 19, 0.12)", borderRadius: 999, bottom: -92, height: 220, left: -96, position: "absolute", width: 220 }} />
        <View
          style={{
            alignItems: "center",
            borderColor: "rgba(217, 228, 242, 0.14)",
            borderRadius: 26,
            borderWidth: 1,
            gap: 16,
            justifyContent: "center",
            minHeight: cameraHeight - 132,
            overflow: "hidden",
            padding: 20,
            width: "100%",
          }}
        >
          <ScannerCorner top={14} left={14} />
          <ScannerCorner top={14} right={14} rotate="90deg" />
          <ScannerCorner bottom={14} right={14} rotate="180deg" />
          <ScannerCorner bottom={14} left={14} rotate="270deg" />
          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(229, 9, 19, 0.14)",
              borderColor: "rgba(255, 179, 182, 0.36)",
              borderRadius: 42,
              borderWidth: 1,
              boxShadow: "0 14px 30px rgba(229, 9, 19, 0.20)",
              height: 84,
              justifyContent: "center",
              width: 84,
            }}
          >
            <Camera color={colors.accentSoft} size={42} strokeWidth={2.2} />
          </View>
          <View style={{ alignItems: "center", gap: 7 }}>
            <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
              Scan attendee QR
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "700", lineHeight: 20, textAlign: "center" }}>
              Full-screen camera opens instantly and closes after a valid scan.
            </Text>
          </View>
          <StatusPill label={selectedSession ? "Seminar check-in" : "Event gate check-in"} />
        </View>
      </View>

      {cameraMessage ? (
        <Text selectable style={{ color: colors.amber, fontSize: 13, fontWeight: "700", lineHeight: 18, textAlign: "center" }}>
          {cameraMessage}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", width: "100%" }}>
        <View style={{ flexGrow: 1, minWidth: 220 }}>
          <ActionButton
            disabled={isCheckingIn}
            icon={Camera}
            label={permissionGranted ? "Start Full-Screen Scanner" : "Allow Camera"}
            onPress={onOpenScanner}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: 160 }}>
          <ActionButton icon={Keyboard} label="Manual Ticket" onPress={onManualTicket} variant="secondary" />
        </View>
      </View>
    </View>
  );
}

function ScannerCorner({
  bottom,
  left,
  right,
  rotate = "0deg",
  top,
}: {
  bottom?: number;
  left?: number;
  right?: number;
  rotate?: string;
  top?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        borderColor: colors.accent,
        borderLeftWidth: 3,
        borderTopWidth: 3,
        borderTopLeftRadius: 8,
        bottom,
        height: 34,
        left,
        opacity: 0.9,
        position: "absolute",
        right,
        top,
        transform: [{ rotate }],
        width: 34,
      }}
    />
  );
}

function QuickActionDock({ onNote, onUndo, onVip }: { onNote: () => void; onUndo: () => void; onVip: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <QuickDockButton icon={Crown} label="VIP" onPress={onVip} />
      <QuickDockButton icon={NotebookPen} label="Note" onPress={onNote} />
      <QuickDockButton icon={Undo2} label="Undo" onPress={onUndo} />
    </View>
  );
}

function QuickDockButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.panelElevated : colors.panelAlt,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flex: 1,
        gap: 6,
        minHeight: 70,
        justifyContent: "center",
      })}
    >
      <Icon color={colors.accent} size={21} />
      <Text style={{ color: colors.soft, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function PremiumResultCard({
  result,
  statusMessage,
}: {
  result: CheckInResult | WalkUpCheckInResult | null;
  statusMessage: string | null;
}) {
  if (!result) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.backgroundAlt, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: 14, minHeight: 260, justifyContent: "center", padding: 20 }}>
        <Sparkles color={colors.accent} size={42} />
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            Ready for next scan
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
            Scan a QR ticket or enter a code manually.
          </Text>
        </View>
      </View>
    );
  }

  const Icon = resultIcon(result);
  const tone = resultTone(result.result);
  const toneColor = tone === "success" ? colors.green : tone === "warning" ? colors.amber : colors.danger;
  const ticketCode = "ticketCode" in result ? result.ticketCode : null;
  const name = result.attendeeName ?? "Guest";

  return (
    <View
      style={{
        backgroundColor: `${toneColor}12`,
        borderColor: `${toneColor}66`,
        borderRadius: 24,
        borderWidth: 1,
        gap: 14,
        minHeight: 260,
        padding: 18,
      }}
    >
      <View style={{ alignItems: "center", gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${toneColor}22`,
            borderColor: `${toneColor}66`,
            borderRadius: 36,
            borderWidth: 1,
            height: 72,
            justifyContent: "center",
            width: 72,
          }}
        >
          <Icon color={toneColor} size={42} />
        </View>
        <StatusBanner tone={tone} text={result.result.replaceAll("_", " ")} />
      </View>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.panel,
          borderColor: colors.border,
          borderRadius: 20,
          borderWidth: 1,
          flexDirection: "row",
          gap: 12,
          padding: 14,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.accent}20`,
            borderColor: `${colors.accent}55`,
            borderRadius: 22,
            borderWidth: 1,
            height: 48,
            justifyContent: "center",
            width: 48,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{getInitials(name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text numberOfLines={2} selectable style={{ color: colors.text, fontSize: 19, fontWeight: "900", lineHeight: 23 }}>
            {name}
          </Text>
          <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
            {result.ticketTypeName ?? "Ticket"}
          </Text>
        </View>
      </View>
      {statusMessage ? (
        <Text selectable style={{ color: colors.soft, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
          {statusMessage}
        </Text>
      ) : null}
      {ticketCode ? <InfoLine label="Ticket code" value={ticketCode} /> : null}
      {result.checkedInAt ? <InfoLine label="Checked in" value={formatDate(result.checkedInAt)} /> : null}
      {result.priorCheckedInAt ? <InfoLine label="Prior check-in" value={formatDate(result.priorCheckedInAt)} /> : null}
    </View>
  );
}

function AttendeeStatsStrip({
  checkedInCount,
  checkInRate,
  notCheckedInCount,
}: {
  checkedInCount: number;
  checkInRate: number;
  notCheckedInCount: number;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <CounterPill label="Checked in" value={checkedInCount} tone="success" />
        <CounterPill label="Waiting" value={notCheckedInCount} tone="muted" />
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.accent}14`,
            borderColor: `${colors.accent}55`,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: "row",
            gap: 8,
            minHeight: 42,
            paddingHorizontal: 14,
          }}
        >
          <Star color={colors.accent} size={16} />
          <Text style={{ color: colors.text, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{checkInRate}% flow</Text>
        </View>
      </View>
      <View style={{ backgroundColor: colors.panelAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.accent, borderRadius: 999, height: 8, width: `${Math.min(checkInRate, 100)}%` }} />
      </View>
    </View>
  );
}

function OptionRail({
  emptyText = "No options available.",
  items,
  onChange,
  value,
}: {
  emptyText?: string;
  items: { label: string; detail?: string; value: string }[];
  onChange: (value: string) => void;
  value: string;
}) {
  if (!items.length) return <EmptyText text={emptyText} />;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 10, paddingRight: 4 }}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <Pressable
              key={`${item.value}-${item.label}`}
              onPress={() => onChange(item.value)}
              style={({ pressed }) => ({
                backgroundColor: active ? colors.accentDark : pressed ? colors.panelElevated : colors.panelAlt,
                borderColor: active ? colors.accent : colors.border,
                borderRadius: 18,
                borderWidth: 1,
                maxWidth: 280,
                minHeight: 68,
                minWidth: 150,
                paddingHorizontal: 14,
                paddingVertical: 12,
              })}
            >
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
                {item.label}
              </Text>
              {item.detail ? (
                <Text numberOfLines={1} style={{ color: active ? colors.accentSoft : colors.muted, fontSize: 12, fontWeight: "700", marginTop: 5 }}>
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

function SummaryPill({ emphasis, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: emphasis ? `${colors.accent}18` : colors.panelAlt,
        borderColor: emphasis ? colors.accent : colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flexGrow: 1,
        minHeight: 66,
        minWidth: 150,
        paddingHorizontal: 14,
        paddingVertical: 11,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, fontWeight: "900", lineHeight: 19, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function EventOverviewSnapshot({
  activeScopeId,
  dayLabel,
  isLoading,
  items,
  message,
  onRefresh,
  onSelectScope,
}: {
  activeScopeId: string;
  dayLabel: string;
  isLoading: boolean;
  items: CheckInOverviewItem[];
  message: string | null;
  onRefresh: () => void;
  onSelectScope: (scopeId: string) => void;
}) {
  const gateItem = items.find((item) => item.scope === "event") ?? null;
  const seminarItems = items.filter((item) => item.scope === "session");
  const seminarCheckedInCount = seminarItems.reduce((total, item) => total + item.checkedInCount, 0);
  const seminarEligibleCount = seminarItems.reduce((total, item) => total + item.totalCount, 0);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text selectable style={{ color: colors.text, fontSize: 21, fontWeight: "900" }}>
            Current event count
          </Text>
          <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
            {dayLabel}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh event overview"
          accessibilityRole="button"
          disabled={isLoading}
          onPress={onRefresh}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: pressed ? colors.panelElevated : colors.panelAlt,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            height: 48,
            justifyContent: "center",
            opacity: isLoading ? 0.6 : 1,
            width: 48,
          })}
        >
          {isLoading ? <ActivityIndicator color={colors.accent} /> : <RefreshCw color={colors.soft} size={19} />}
        </Pressable>
      </View>

      {message ? <StatusBanner tone="warning" text={message} /> : null}

      {gateItem ? (
        <Pressable
          accessibilityLabel="Select event gate check-in"
          accessibilityRole="button"
          accessibilityState={{ selected: activeScopeId === gateItem.id }}
          onPress={() => onSelectScope(gateItem.id)}
          style={({ pressed }) => ({
            backgroundColor: activeScopeId === gateItem.id ? `${colors.accent}18` : pressed ? colors.panelElevated : colors.backgroundAlt,
            borderColor: activeScopeId === gateItem.id ? colors.accent : colors.border,
            borderRadius: 24,
            borderWidth: 1,
            gap: 14,
            padding: 16,
          })}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: `${colors.accent}20`,
                borderColor: `${colors.accent}66`,
                borderRadius: 22,
                borderWidth: 1,
                height: 50,
                justifyContent: "center",
                width: 50,
              }}
            >
              <TicketCheck color={colors.accent} size={25} />
            </View>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text numberOfLines={1} selectable style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                Event gate
              </Text>
              <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
                {gateItem.detail}
              </Text>
            </View>
            {activeScopeId === gateItem.id ? <StatusPill label="Active" /> : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <OverviewMetricTile detail={`of ${gateItem.totalCount}`} label="Checked in" value={String(gateItem.checkedInCount)} />
            <OverviewMetricTile detail="not checked in" label="Waiting" value={String(gateItem.waitingCount)} />
            <OverviewMetricTile detail="gate flow" label="Rate" value={`${gateItem.checkInRate}%`} />
          </View>
          <OverviewProgressBar rate={gateItem.checkInRate} />
        </Pressable>
      ) : (
        <EmptyText text={isLoading ? "Loading event overview counts." : "Event overview counts are not loaded yet."} />
      )}

      <View style={{ gap: 10 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
              Seminar check-in
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 3 }}>
              {seminarItems.length ? `${seminarCheckedInCount}/${seminarEligibleCount} checked in across ${seminarItems.length} seminars` : "No seminars scheduled"}
            </Text>
          </View>
        </View>
        {seminarItems.length ? (
          <View style={{ gap: 10 }}>
            {seminarItems.map((item) => (
              <SeminarOverviewRow
                active={activeScopeId === item.id}
                item={item}
                key={item.id}
                onPress={() => onSelectScope(item.id)}
              />
            ))}
          </View>
        ) : (
          <EmptyText text={isLoading ? "Loading seminar counts." : "No seminars are configured for this event."} />
        )}
      </View>
    </View>
  );
}

function OverviewMetricTile({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flex: 1,
        minWidth: 94,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 4 }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.soft, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
        {detail}
      </Text>
    </View>
  );
}

function SeminarOverviewRow({
  active,
  item,
  onPress,
}: {
  active: boolean;
  item: CheckInOverviewItem;
  onPress: () => void;
}) {
  const timeLabel = item.startsAt && item.endsAt ? formatTimeRange(item.startsAt, item.endsAt) : null;

  return (
    <Pressable
      accessibilityLabel={`Select ${item.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? `${colors.accent}16` : pressed ? colors.panelElevated : colors.panelAlt,
        borderColor: active ? colors.accent : colors.border,
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 14,
      })}
    >
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.accent}16`,
            borderColor: `${colors.accent}44`,
            borderRadius: 18,
            borderWidth: 1,
            height: 42,
            justifyContent: "center",
            width: 42,
          }}
        >
          <Users color={colors.soft} size={21} />
        </View>
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text numberOfLines={2} selectable style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: "900", lineHeight: 20 }}>
              {item.label}
            </Text>
            {active ? <StatusPill label="Active" /> : null}
          </View>
          <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            {item.detail}
          </Text>
          {timeLabel ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Clock3 color={colors.muted} size={14} />
              <Text numberOfLines={1} selectable style={{ color: colors.soft, fontSize: 12, fontWeight: "800" }}>
                {timeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <OverviewProgressBar rate={item.checkInRate} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <CompactOverviewStat label="Checked in" value={`${item.checkedInCount}/${item.totalCount}`} />
        <CompactOverviewStat label="Waiting" value={String(item.waitingCount)} />
        <CompactOverviewStat label="Rate" value={`${item.checkInRate}%`} />
        <CompactOverviewStat label="Access" value={item.requiresRegistration ? "Registered" : "Open"} />
      </View>
    </Pressable>
  );
}

function OverviewProgressBar({ rate }: { rate: number }) {
  return (
    <View style={{ backgroundColor: colors.backgroundAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
      <View style={{ backgroundColor: colors.accent, borderRadius: 999, height: 8, width: `${Math.min(Math.max(rate, 0), 100)}%` }} />
    </View>
  );
}

function CompactOverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.backgroundAlt,
        borderColor: colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: `${colors.accent}18`,
        borderColor: `${colors.accent}66`,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function StatusBanner({ text, tone }: { text: string; tone: "success" | "warning" | "danger" | "muted" }) {
  const toneColor = tone === "success" ? colors.green : tone === "warning" ? colors.amber : tone === "danger" ? colors.danger : colors.blue;
  return (
    <View
      style={{
        backgroundColor: `${toneColor}22`,
        borderColor: `${toneColor}66`,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 11,
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
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 7,
        minHeight: 42,
        paddingHorizontal: 14,
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
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.accent : pressed ? colors.panelElevated : colors.panelAlt,
        borderColor: active ? colors.accent : colors.border,
        borderRadius: 16,
        borderWidth: 1,
        flex: 1,
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 10,
      })}
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
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 14,
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
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 14,
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
        borderRadius: 18,
        borderWidth: 1,
        padding: 16,
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
  borderRadius: 18,
  borderWidth: 1,
  color: colors.text,
  fontSize: 16,
  minHeight: 56,
  paddingHorizontal: 14,
} as const;

function createOverviewItem({
  attendees,
  detail,
  endsAt,
  id,
  label,
  requiresRegistration,
  room,
  scope,
  startsAt,
}: {
  attendees: EventAttendeeSummary[];
  detail: string;
  endsAt?: string;
  id: string;
  label: string;
  requiresRegistration?: boolean;
  room?: string | null;
  scope: CheckInOverviewItem["scope"];
  startsAt?: string;
}): CheckInOverviewItem {
  const totalCount = attendees.length;
  const checkedInCount = attendees.filter((attendee) => Boolean(attendee.checked_in_at)).length;
  const waitingCount = Math.max(totalCount - checkedInCount, 0);
  const checkInRate = totalCount ? Math.round((checkedInCount / totalCount) * 100) : 0;

  return {
    checkedInCount,
    checkInRate,
    detail,
    endsAt,
    id,
    label,
    requiresRegistration,
    room,
    scope,
    startsAt,
    totalCount,
    waitingCount,
  };
}

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

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "FC";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function formatTimeRange(startsAt: string, endsAt: string) {
  const options = {
    hour: "numeric",
    minute: "2-digit",
  } as const;

  return `${new Date(startsAt).toLocaleTimeString(undefined, options)} - ${new Date(endsAt).toLocaleTimeString(undefined, options)}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency,
    style: "currency",
  }).format(value);
}
