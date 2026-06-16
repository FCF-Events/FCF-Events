import Link from "next/link";
import { Settings, Ticket } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { requireAccountAccess } from "@/lib/auth";

const accountLinks = [
  { href: "/account", label: "Tickets", icon: Ticket },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccountAccess();

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader />
      <section className="border-b border-white/10 bg-[#111111]">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e50913]">My account</p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{account.fullName ?? "FCF attendee"}</h1>
              <p className="mt-1 text-sm text-[#999999]">{account.email ?? "Demo attendee"}</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto">
              {accountLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-[#dddddd] transition hover:bg-white/10 hover:text-white"
                >
                  <link.icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</div>
      <PublicFooter />
    </main>
  );
}
