import { AppShell } from "@/components/app-shell";
import { requireDashboardAccess } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await requireDashboardAccess();

  return (
    <AppShell currentEmail={access.email} currentRole={access.role}>
      {children}
    </AppShell>
  );
}
