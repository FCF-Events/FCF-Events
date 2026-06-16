import Image from "next/image";
import { ArrowRight, KeyRound, Mail, UserRound } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/lib/actions/auth";

const messages: Record<string, string> = {
  check_email: "Account created. Check your email if confirmation is required, then sign in.",
  demo: "Account form validated. Connect Supabase to create attendee accounts.",
};

const errors: Record<string, string> = {
  invalid: "Check your name, email, and matching password.",
  signup: "Could not create that account. Try signing in or use another email.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; redirect?: string; created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const defaultEmail = params?.email ?? "";
  const redirectTo = params?.redirect?.startsWith("/") && !params.redirect.startsWith("//") ? params.redirect : "/account";
  const message = params?.created ? messages[params.created] : null;
  const error = params?.error ? errors[params.error] : null;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader showLogin />
      <section className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:py-16">
        <div className="relative hidden min-h-[480px] overflow-hidden rounded-lg border border-white/10 bg-[#101010] p-8 lg:block">
          <Image
            src="/brand/fcf-mark-red.png"
            alt=""
            width={420}
            height={420}
            className="pointer-events-none absolute -right-24 bottom-0 w-96 opacity-20"
            aria-hidden
          />
          <div className="relative z-10 max-w-xl">
            <p className="text-sm font-medium uppercase text-[#e50913]">Attendee account</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">Keep your FCF tickets together</h1>
            <p className="mt-5 text-base leading-7 text-[#bbbbbb]">
              Use the same email from registration and set a password so your tickets appear in your account.
            </p>
          </div>
        </div>

        <Card className="border-white/15 bg-[#111111]/95">
          <CardHeader className="space-y-3 p-6 pb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-[#1a1a1a]">
              <UserRound className="h-5 w-5 text-[#e50913]" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-2xl">Set Password & Sign Up</CardTitle>
              <CardDescription className="mt-2 text-[#bbbbbb]">
                Create your account to save tickets and manage attendee details.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-4">
            {message ? <Badge variant="success">{message}</Badge> : null}
            {error ? <Badge variant="danger">{error}</Badge> : null}
            <form action={signUpAction} className="space-y-4">
              <input type="hidden" name="redirect" value={redirectTo} />
              <Field label="Full name">
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                  <Input name="fullName" autoComplete="name" className="h-12 border-white/15 bg-[#080808] pl-10" required />
                </div>
              </Field>
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                  <Input
                    name="email"
                    type="email"
                    defaultValue={defaultEmail}
                    autoComplete="email"
                    className="h-12 border-white/15 bg-[#080808] pl-10"
                    required
                  />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    className="h-12 border-white/15 bg-[#080808] pl-10"
                    required
                  />
                </div>
              </Field>
              <Field label="Confirm password">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" aria-hidden />
                  <Input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    className="h-12 border-white/15 bg-[#080808] pl-10"
                    required
                  />
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full">
                Set Password & Sign Up
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
      <PublicFooter />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
