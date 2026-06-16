import Link from "next/link";
import { Ticket } from "lucide-react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendees } from "@/lib/data";

export default async function AttendeesPage() {
  const attendees = await getAttendees();
  const attendeeExportColumns = [
    { key: "id", header: "ID" },
    { key: "first_name", header: "First name" },
    { key: "last_name", header: "Last name" },
    { key: "full_name", header: "Full name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "company", header: "Company" },
    { key: "role_title", header: "Role title" },
    { key: "sms_consent_status", header: "SMS consent" },
    { key: "email_consent_status", header: "Email consent" },
    { key: "events_registered_count", header: "Events registered" },
    { key: "events_attended_count", header: "Events attended" },
    { key: "sessions_attended_count", header: "Sessions attended" },
    { key: "last_registered_at", header: "Last registered at" },
    { key: "last_attended_at", header: "Last attended at" },
  ];
  const attendeeExportRows = attendees.map((attendee) => ({
    id: attendee.id,
    first_name: attendee.first_name,
    last_name: attendee.last_name,
    full_name: attendee.full_name,
    email: attendee.email,
    phone: attendee.phone,
    company: attendee.company,
    role_title: attendee.role_title,
    sms_consent_status: attendee.sms_consent_status,
    email_consent_status: attendee.email_consent_status,
    events_registered_count: attendee.events_registered_count,
    events_attended_count: attendee.events_attended_count,
    sessions_attended_count: attendee.sessions_attended_count,
    last_registered_at: attendee.last_registered_at,
    last_attended_at: attendee.last_attended_at,
  }));

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Attendees"
        description="Centralized attendee profiles, repeat tracking, consent status, and operational notes."
        action={<ExportCsvButton columns={attendeeExportColumns} rows={attendeeExportRows} filename="attendees.csv" />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Guest List</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-[#999999]">
              <tr className="border-b border-white/10">
                <th className="py-3 font-medium">Name</th>
                <th className="py-3 font-medium">Company</th>
                <th className="py-3 font-medium">Contact</th>
                <th className="py-3 font-medium">Repeat</th>
                <th className="py-3 font-medium">Consent</th>
                <th className="py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <tr key={attendee.id} className="border-b border-white/5">
                  <td className="py-4 text-white">
                    <Link href={`/dashboard/attendees/${attendee.id}`} className="font-medium transition hover:text-[#ff6b6f]">
                      {attendee.full_name}
                    </Link>
                    {attendee.role_title ? <p className="text-[#999999]">{attendee.role_title}</p> : null}
                  </td>
                  <td className="py-4 text-[#dddddd]">{attendee.company ?? "None"}</td>
                  <td className="py-4 text-[#999999]">
                    {attendee.email ?? "No email"}
                    <br />
                    {attendee.phone ?? "No phone"}
                  </td>
                  <td className="py-4 text-[#dddddd]">
                    {attendee.events_registered_count} registered{" · "}
                    {attendee.events_attended_count} attended
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <Badge variant={attendee.sms_consent_status ? "success" : "muted"}>SMS</Badge>
                      <Badge variant={attendee.email_consent_status ? "success" : "muted"}>Email</Badge>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/attendees/${attendee.id}`}>
                        <Ticket className="h-4 w-4" aria-hidden />
                        Manage
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
