import { CalendarDays, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Secure QR check-in",
    icon: CheckCircle2,
    text: "Staff can scan tickets, handle manual entry, and prevent duplicate entry with database-backed attendance records.",
  },
  {
    title: "SMS reminders",
    icon: MessageSquare,
    text: "Event reminders are designed around consent capture, opt-out handling, message logs, and auditable send history.",
  },
  {
    title: "Session programming",
    icon: CalendarDays,
    text: "Multi-session conferences can track agenda registration and attendance separately from event-level entry.",
  },
  {
    title: "Compliance support",
    icon: ShieldCheck,
    text: "Age gates, privacy workflows, cannabis compliance notes, audit logs, and careful copy defaults support event operations.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader />
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <Badge className="mb-4">Platform features</Badge>
        <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">FCF Events operations platform</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#dddddd] md:text-lg">
          The private operations layer behind FCF event registration, check-in, attendee CRM, analytics, and communications.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map((item) => (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <item.icon className="h-5 w-5 text-[#e50913]" aria-hidden />
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-[#999999]">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
