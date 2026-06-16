import Link from "next/link";
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
      <PublicHeader />
      <section className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your organizer or attendee account. Demo mode opens the organizer dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={signInAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="events@example.com"
                  autoComplete="email"
                  disabled={!configured}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={!configured}
                  required
                />
              </div>
              {error ? <p className="rounded-md border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={!configured}>
                Sign In
              </Button>
            </form>
            {!configured ? (
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">Continue in Demo Mode</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <PublicFooter />
    </main>
  );
}
