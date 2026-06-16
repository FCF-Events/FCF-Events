import { KeyRound, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  createManagedUserAction,
  grantEventAccessAction,
  revokeEventAccessAction,
  updateManagedUserAction,
} from "@/lib/actions/users";
import { requireUserManagementAccess } from "@/lib/auth";
import { getEvents, getManagedUsers } from "@/lib/data";
import { EVENT_ACCESS_ROLES, OWNER_MANAGED_ROLES, ROLE_LABELS, USER_MANAGED_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

const eventRoleOptions = EVENT_ACCESS_ROLES.map((role) => ({
  label: ROLE_LABELS[role],
  value: role,
}));

export default async function UsersPage() {
  const access = await requireUserManagementAccess();
  const [users, events] = await Promise.all([getManagedUsers(), getEvents()]);
  const eventOptions = events.map((event) => ({ label: event.title, value: event.id }));
  const manageableRoles = access.role === "owner" ? OWNER_MANAGED_ROLES : USER_MANAGED_ROLES;
  const userRoleOptions = manageableRoles.map(roleToOption);

  async function createUser(formData: FormData) {
    "use server";
    await createManagedUserAction(formData);
  }

  async function updateUser(formData: FormData) {
    "use server";
    await updateManagedUserAction(formData);
  }

  async function grantEventAccess(formData: FormData) {
    "use server";
    await grantEventAccessAction(formData);
  }

  async function revokeEventAccess(formData: FormData) {
    "use server";
    await revokeEventAccessAction(formData);
  }

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Users"
        description="Invite organizers, manage role-based access, and scope check-in staff to specific events."
      />

      <div className="grid gap-4 xl:grid-cols-[0.78fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createUser} className="space-y-4">
              <Field label="Email">
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Full name">
                <Input name="fullName" autoComplete="name" />
              </Field>
              <Field label="Temporary password">
                <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Field label="Organization role">
                <SelectField name="role" options={userRoleOptions} required />
              </Field>
              <Button type="submit">
                <UserPlus className="h-4 w-4" aria-hidden />
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.user_id}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{user.full_name ?? user.email ?? "Unnamed user"}</CardTitle>
                    <p className="mt-1 text-sm text-[#999999]">{user.email ?? "No email on profile"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={user.is_active ? "success" : "muted"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="muted">{ROLE_LABELS[user.role]}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <form action={updateUser} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <input type="hidden" name="userId" value={user.user_id} />
                  <Field label="Role">
                    <SelectField name="role" defaultValue={user.role} options={roleOptionsFor(user.role, userRoleOptions, access.role === "owner")} required />
                  </Field>
                  <Field label="Status">
                    <SelectField
                      name="isActive"
                      defaultValue={String(user.is_active)}
                      options={[
                        { label: "Active", value: "true" },
                        { label: "Inactive", value: "false" },
                      ]}
                      required
                    />
                  </Field>
                  <Button type="submit" variant="outline">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    Update
                  </Button>
                </form>

                <div className="rounded-md border border-white/10 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#e50913]" aria-hidden />
                    <h3 className="text-sm font-semibold text-white">Event access</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {user.event_access.length ? (
                      user.event_access.map((assignment) => (
                        <form
                          key={`${assignment.event_id}-${assignment.role}`}
                          action={revokeEventAccess}
                          className="flex flex-col gap-3 rounded-md bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <input type="hidden" name="userId" value={user.user_id} />
                          <input type="hidden" name="eventId" value={assignment.event_id} />
                          <div>
                            <p className="text-sm font-medium text-white">{assignment.event_title}</p>
                            <p className="mt-1 text-xs text-[#999999]">{ROLE_LABELS[assignment.role]}</p>
                          </div>
                          <Button type="submit" variant="ghost" size="sm">
                            <UserMinus className="h-4 w-4" aria-hidden />
                            Revoke
                          </Button>
                        </form>
                      ))
                    ) : (
                      <p className="text-sm text-[#999999]">No event-specific access assigned.</p>
                    )}
                  </div>

                  <form action={grantEventAccess} className="mt-4 grid gap-3 md:grid-cols-[1fr_0.75fr_auto] md:items-end">
                    <input type="hidden" name="userId" value={user.user_id} />
                    <Field label="Event">
                      <SelectField name="eventId" options={eventOptions} disabled={!eventOptions.length} required />
                    </Field>
                    <Field label="Access role">
                      <SelectField name="role" options={eventRoleOptions} required />
                    </Field>
                    <Button type="submit" disabled={!eventOptions.length}>
                      Grant
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function roleOptionsFor(currentRole: Role, roleOptions: Array<{ label: string; value: string }>, canManageOwners: boolean) {
  if (currentRole === "owner" && !canManageOwners) {
    return [roleToOption("owner")];
  }

  return roleOptions;
}

function roleToOption(role: Role) {
  return {
    label: ROLE_LABELS[role],
    value: role,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
