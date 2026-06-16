import Image from "next/image";
import Link from "next/link";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, TicketCheck } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/lib/actions/auth";
import { isSupabaseConfigured } from "@/lib/env";

const errorMessages: Record<string, string> = {
  invalid_credentials: "That email or password did not match an active account.",
  missing_credentials: "Enter both email and password.",
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const configured = isSupabaseConfigured();
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : null;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader showLogin={false} />
      <section className="bg-[linear-gradient(180deg,#0b0b0b_0%,#111111_55%,#070707_100%)]">
        <div className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:py-16">
          <div className="relative hidden min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-[#101010] p-8 shadow-2xl shadow-black/40 lg:block">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#b20711]" />
            <Image
              src="/brand/fcf-mark-red.png"
              alt=""
              width={420}
              height={420}
              className="pointer-events-none absolute -right-24 bottom-2 w-96 opacity-20"
              aria-hidden
            />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <Image
                  src="/brand/fcf-wordmark-white.png"
                  alt="The Federation of Cannabis Farmers"
                  width={260}
                  height={61}
                  priority
                  className="h-auto w-48"
                />
                <div className="mt-14 max-w-xl">
                  <p className="text-sm font-medium uppercase text-[#e50913]">Secure event access</p>
                  <h1 className="mt-4 text-5xl font-semibold leading-tight text-white">Welcome back to FCF Events</h1>
                  <p className="mt-5 max-w-md text-base leading-7 text-[#bbbbbb]">
                    Organizer and attendee access for Federation event operations.
                  </p>
                </div>
              </div>
              <div className="grid max-w-xl gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
                {[
                  { icon: ShieldCheck, label: "Protected" },
                  { icon: TicketCheck, label: "Tickets" },
                  { icon: LockKeyhole, label: "Operations" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-[#e50913]" aria-hidden />
                    <p className="text-sm font-medium text-[#dddddd]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="w-full border-white/15 bg-[#111111]/95 shadow-2xl shadow-black/40">
            <CardHeader className="space-y-3 p-6 pb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-[#1a1a1a]">
                <LockKeyhole className="h-5 w-5 text-[#e50913]" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-2xl">Sign in</CardTitle>
                <CardDescription className="mt-2 text-[#bbbbbb]">Access your FCF event account.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6 pt-4">
              <form action={signInAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="events@example.com"
                      autoComplete="email"
                      disabled={!configured}
                      required
                      className="h-12 border-white/15 bg-[#080808] pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      disabled={!configured}
                      required
                      className="h-12 border-white/15 bg-[#080808] pl-10"
                    />
                  </div>
                </div>
                {error ? (
                  <p className="rounded-md border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" size="lg" className="w-full" disabled={!configured}>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </form>
              {!configured ? (
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm leading-6 text-[#bbbbbb]">Authentication is not configured for this environment.</p>
                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link href="/dashboard">
                      Continue to dashboard
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
