import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LayoutDashboard,
  ScanLine,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardMetrics, getEvents } from "@/lib/data";

const adminNav = [
  { href: "/dashboard/events", label: "Events", icon: CalendarDays },
  { href: "/dashboard/attendees", label: "Attendees", icon: Users },
  { href: "/dashboard/analytics", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/users", label: "Staff", icon: UserCog },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const reminderRows = ["48h before event", "24h before event", "3h before doors"];

export default async function DashboardPage() {
  const [metrics, events] = await Promise.all([getDashboardMetrics(), getEvents()]);
  const upcoming = events.slice(0, 5);
  const activeEvent = upcoming[0] ?? null;

  return (
    // NEW SLEEK MODERN DESIGN - premium admin dashboard
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0d1324] shadow-2xl shadow-black/30">
        <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
          <div className="relative min-w-0 overflow-hidden p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/80 to-transparent" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  Live operations
                </div>
                <div className="space-y-2">
                  <h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                    Admin Dashboard
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                    Manage event flow, attendee movement, staff access, reminders, and check-in performance from one fast command center.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/dashboard/check-in">
                    <ScanLine className="h-4 w-4" aria-hidden />
                    Check-in
                  </Link>
                </Button>
                <Button asChild className="bg-[#e50913] text-white hover:bg-[#b20711]">
                  <Link href="/dashboard/communications">
                    <Send className="h-4 w-4" aria-hidden />
                    Send Reminder
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                detail={`${metrics.activePublishedEvents} published`}
                icon={CalendarDays}
                label="Upcoming Events"
                series={[35, 42, 40, 54, 62, 70, 76]}
                tone="red"
                value={metrics.upcomingEvents}
              />
              <StatCard
                detail={`${metrics.repeatAttendeeRate}% repeat attendee rate`}
                icon={Ticket}
                label="Registered"
                series={[20, 38, 44, 58, 63, 72, 86]}
                tone="rose"
                value={metrics.totalRegistered}
              />
              <StatCard
                detail={`${metrics.checkInPercentage}% check-in rate`}
                icon={CheckCircle2}
                label="Checked In"
                series={[12, 18, 33, 48, 57, 72, 91]}
                tone="emerald"
                value={metrics.totalCheckedIn}
              />
              <StatCard
                detail={`${metrics.smsDelivered} delivered / ${metrics.smsFailed} failed`}
                icon={ShieldCheck}
                label="SMS Consent"
                series={[44, 46, 52, 55, 61, 66, 71]}
                tone="amber"
                value={`${metrics.smsConsentRate}%`}
              />
            </div>
          </div>

          <AdminNavRail />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-red-200">Event Pipeline</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Upcoming events</h2>
            </div>
            <Link href="/dashboard/events" className="inline-flex items-center gap-2 text-sm font-semibold text-red-200 hover:text-red-100">
              View all events
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {upcoming.length ? (
              upcoming.map((event, index) => <EventCarouselCard event={event} index={index} key={event.id} />)
            ) : (
              <div className="min-w-full rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                No upcoming events are available yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-[#101827] p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-red-200">Quick Actions</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Run the room</h2>
              </div>
              <Sparkles className="h-5 w-5 text-red-200" aria-hidden />
            </div>
            <div className="mt-5 grid gap-2">
              <QuickActionChip href="/dashboard/check-in" icon={ScanLine} label="Open check-in console" />
              <QuickActionChip href="/dashboard/events" icon={CalendarDays} label="Manage events" />
              <QuickActionChip href="/dashboard/attendees" icon={Users} label="Review attendee list" />
              <QuickActionChip href="/dashboard/app-download" icon={Download} label="Download Android app" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#101827] p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-red-200">Automation</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Upcoming reminders</h2>
              </div>
              <Badge variant="muted">Queued</Badge>
            </div>
            <div className="mt-5 space-y-2">
              {reminderRows.map((item) => (
                <Link
                  href="/dashboard/communications"
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 transition hover:border-red-300/40 hover:bg-red-500/10"
                >
                  <span>{item}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {activeEvent ? (
        <section className="grid gap-4 rounded-lg border border-white/10 bg-[#0e1524] p-5 shadow-xl shadow-black/20 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-red-200">Next live event</p>
            <h2 className="mt-2 truncate text-2xl font-semibold text-white">{activeEvent.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {formatEventDate(activeEvent.starts_at)} - {activeEvent.venue_name ?? "Venue TBA"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#e50913] text-white hover:bg-[#b20711]">
              <Link href={`/dashboard/events/${activeEvent.slug}`}>
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                Manage Event
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href="/dashboard/check-in">
                <ScanLine className="h-4 w-4" aria-hidden />
                Start Door Mode
              </Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AdminNavRail() {
  return (
    <nav className="border-t border-white/10 bg-white/[0.03] p-4 xl:border-l xl:border-t-0">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
        {adminNav.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className="group flex min-h-16 items-center gap-3 rounded-lg border border-white/10 bg-[#101827] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-white"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-red-200 transition group-hover:border-red-300/40">
              <item.icon className="h-4 w-4" aria-hidden />
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function StatCard({
  detail,
  icon: Icon,
  label,
  series,
  tone,
  value,
}: {
  detail: string;
  icon: React.ElementType;
  label: string;
  series: number[];
  tone: "red" | "rose" | "emerald" | "amber";
  value: number | string;
}) {
  const toneClasses = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    red: "border-red-300/25 bg-red-500/10 text-red-100",
    rose: "border-rose-300/25 bg-rose-500/10 text-rose-100",
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClasses}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <Sparkline series={series} tone={tone} />
      <p className="mt-3 truncate text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Sparkline({ series, tone }: { series: number[]; tone: "red" | "rose" | "emerald" | "amber" }) {
  const barClass = {
    amber: "bg-amber-300",
    emerald: "bg-emerald-300",
    red: "bg-red-400",
    rose: "bg-rose-300",
  }[tone];

  return (
    <div className="mt-4 flex h-10 items-end gap-1.5" aria-hidden>
      {series.map((value, index) => (
        <span
          className={`w-full rounded-t-sm ${barClass} opacity-80`}
          key={`${value}-${index}`}
          style={{ height: `${Math.max(18, Math.min(value, 100))}%` }}
        />
      ))}
    </div>
  );
}

function EventCarouselCard({ event, index }: { event: Awaited<ReturnType<typeof getEvents>>[number]; index: number }) {
  return (
    <Link
      href={`/dashboard/events/${event.slug}`}
      className="group min-w-[280px] flex-1 rounded-lg border border-white/10 bg-[#101827] p-5 shadow-xl shadow-black/20 transition hover:border-red-300/40 hover:bg-[#121d31]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-300/25 bg-red-500/10 text-red-100">
          <span className="text-sm font-semibold">{index + 1}</span>
        </div>
        <Badge variant={event.status === "published" ? "success" : "muted"}>{event.status}</Badge>
      </div>
      <h3 className="mt-5 line-clamp-2 text-lg font-semibold leading-6 text-white">{event.title}</h3>
      <p className="mt-3 text-sm leading-5 text-slate-300">
        {formatEventDate(event.starts_at)}
        <br />
        {event.venue_name ?? "Venue TBA"}
      </p>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-red-200">
        Manage event
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}

function QuickActionChip({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-white"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-red-200" aria-hidden />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
    </Link>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
