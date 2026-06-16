import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AirVent,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Percent,
  Settings,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const nav: Array<{ href: string; label: string; icon: React.ElementType; roles?: Role[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/events", label: "Events", icon: CalendarDays },
  { href: "/dashboard/sessions", label: "Sessions", icon: ClipboardList },
  { href: "/dashboard/attendees", label: "Attendees", icon: ContactRound },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/communications", label: "Communications", icon: MessageSquare },
  { href: "/dashboard/email-templates", label: "Email Templates", icon: Mail, roles: ["owner", "admin"] },
  { href: "/dashboard/discounts", label: "Discounts", icon: Percent, roles: ["owner", "admin", "manager"] },
  { href: "/dashboard/users", label: "Users", icon: UserCog, roles: ["owner", "admin"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] },
  { href: "/dashboard/check-in", label: "Check-in", icon: CheckCircle2, roles: ["owner", "admin", "manager", "check_in_staff"] },
  { href: "/dashboard/airtable-sync", label: "Airtable Sync", icon: AirVent, roles: ["owner", "admin"] },
  { href: "/dashboard/audit-logs", label: "Audit Logs", icon: ShieldCheck, roles: ["owner", "admin", "manager", "viewer"] },
];

const footerLinks = [
  { href: "/features", label: "Features" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/communications", label: "CASL & SMS" },
  { href: "/legal/cannabis-compliance", label: "Cannabis Compliance" },
];

function visibleNavItems(role: Role | null) {
  if (!role) return nav;
  return nav.filter((item) => !item.roles || item.roles.includes(role));
}

export function AppShell({
  children,
  currentEmail,
  currentRole,
}: {
  children: React.ReactNode;
  currentEmail?: string | null;
  currentRole?: Role | null;
}) {
  const items = visibleNavItems(currentRole ?? null);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/10 bg-[#0f0f0f] p-4 lg:block">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3">
          <Image
            src="/brand/fcf-wordmark-white.png"
            alt="The Federation of Cannabis Farmers"
            width={230}
            height={54}
            className="h-auto w-48"
          />
        </Link>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#dddddd] transition hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="group/account absolute bottom-4 left-4 right-4 rounded-md border border-white/10 bg-[#0b0b0b] p-3 transition hover:border-white/20 hover:bg-white/[0.03]">
          <Link
            href="/account/settings"
            className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e50913]"
            aria-label="Edit account settings"
            title="Edit account settings"
          />
          <p className="pointer-events-none truncate text-xs text-[#999999] transition group-hover/account:text-[#cfcfcf]">
            {currentEmail ?? "Demo user"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="pointer-events-none text-sm font-medium text-white">
              {currentRole ? ROLE_LABELS[currentRole] : "Authenticated"}
            </span>
            <form action={signOutAction} className="relative">
              <button
                type="submit"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#999999] transition hover:bg-white/10 hover:text-white"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b0b]/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <Image
                src="/brand/fcf-wordmark-white.png"
                alt="The Federation of Cannabis Farmers"
                width={210}
                height={49}
                className="h-auto w-36"
              />
            </Link>
            <div className="hidden text-sm text-[#999999] lg:block">Private event operations platform</div>
            <Link
              href="/account/settings"
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-[#999999] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e50913]"
              title="Edit account settings"
            >
              <Activity className="h-4 w-4 text-emerald-300" aria-hidden />
              {currentRole ? ROLE_LABELS[currentRole] : "Demo-safe mode"}
            </Link>
          </div>
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto border-t border-white/10 px-4 pt-3 lg:hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-[#dddddd]"
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 lg:px-8">
          {children}
          <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-xs text-[#999999]">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </footer>
        </main>
      </div>
    </div>
  );
}
