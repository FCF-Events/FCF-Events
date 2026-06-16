import { KeyRound, Mail, Save, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAccountEmailAction,
  updateAccountPasswordAction,
  updateAccountProfileAction,
} from "@/lib/actions/account";
import { requireAccountAccess } from "@/lib/auth";

const messages: Record<string, string> = {
  profile: "Profile updated.",
  email: "Email update requested. You may need to confirm the new email address.",
  password: "Password updated.",
  demo: "Settings form validated.",
};

const errors: Record<string, string> = {
  profile: "Check your name and phone number.",
  email: "Use a valid email address.",
  password: "Use matching passwords with at least 12 characters.",
};

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  const [account, params] = await Promise.all([requireAccountAccess(), searchParams]);
  const updated = params?.updated ? messages[params.updated] : null;
  const error = params?.error ? errors[params.error] : null;

  return (
    <div className="space-y-4">
      {updated ? <Badge variant="success">{updated}</Badge> : null}
      {error ? <Badge variant="danger">{error}</Badge> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-[#e50913]" aria-hidden />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Update the name and phone number attached to your FCF account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAccountProfileAction} className="space-y-4">
              <Field label="Full name">
                <Input name="fullName" defaultValue={account.fullName ?? ""} autoComplete="name" required />
              </Field>
              <Field label="Phone number">
                <Input name="phone" defaultValue={account.phone ?? ""} autoComplete="tel" />
              </Field>
              <Button type="submit">
                <Save className="h-4 w-4" aria-hidden />
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#e50913]" aria-hidden />
              <CardTitle>Email</CardTitle>
            </div>
            <CardDescription>Changing email may require confirmation before it becomes your login email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAccountEmailAction} className="space-y-4">
              <Field label="Email address">
                <Input name="email" type="email" defaultValue={account.email ?? ""} autoComplete="email" required />
              </Field>
              <Button type="submit" variant="outline">
                Update Email
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#e50913]" aria-hidden />
              <CardTitle>Password</CardTitle>
            </div>
            <CardDescription>Use a unique password with at least 12 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAccountPasswordAction} className="space-y-4">
              <Field label="New password">
                <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Field label="Confirm password">
                <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Button type="submit" variant="outline">
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
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
