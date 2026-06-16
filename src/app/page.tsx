import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEvents } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export default async function Home() {
  const events = await getEvents();
  const upcomingEvents = events
    .filter((event) => event.status === "published" && event.visibility !== "private")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const signupHref = upcomingEvents[0] ? `/e/${upcomingEvents[0].slug}` : "#events";

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader signupHref={signupHref} />

      <section id="events" className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.65fr_1fr]">
          <div>
            <Badge className="mb-4 w-fit">Upcoming events</Badge>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">Register for FCF Events</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#dddddd]">
              Browse upcoming FCF conferences, seminars, and networking events. Choose an event, sign up, and bring your QR ticket to check in.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#999999]">
              <span className="rounded-md border border-white/10 px-3 py-2">Digital tickets</span>
              <span className="rounded-md border border-white/10 px-3 py-2">QR check-in</span>
              <span className="rounded-md border border-white/10 px-3 py-2">SMS reminders</span>
            </div>
          </div>

          <div className="grid gap-4">
            {upcomingEvents.length ? (
              upcomingEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                      <div className="flex flex-col justify-between bg-[#b20711] p-5">
                        <div>
                          <p className="text-sm uppercase text-white/75">{new Date(event.starts_at).toLocaleString("en-CA", { month: "short" })}</p>
                          <p className="mt-1 text-5xl font-semibold">{new Date(event.starts_at).getDate()}</p>
                        </div>
                        <p className="mt-6 text-sm text-white/80">{new Date(event.starts_at).toLocaleString("en-CA", { weekday: "long" })}</p>
                      </div>
                      <div className="p-5 md:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <Badge variant="muted">{event.event_category ?? "Conference"}</Badge>
                            <h2 className="mt-3 text-2xl font-semibold text-white">{event.title}</h2>
                          </div>
                          <Badge variant="success">{event.minimum_age}+</Badge>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[#bbbbbb]">{event.description}</p>
                        <div className="mt-5 grid gap-3 text-sm text-[#dddddd] md:grid-cols-2">
                          <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#e50913]" aria-hidden />
                            {new Date(event.starts_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#e50913]" aria-hidden />
                            {event.venue_name ?? "Venue TBA"}
                          </span>
                          <span className="flex items-center gap-2 md:col-span-2">
                            <CalendarDays className="h-4 w-4 text-[#e50913]" aria-hidden />
                            {new Date(event.starts_at).toLocaleDateString("en-CA", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          <Button asChild size="lg">
                            <Link href={`/e/${event.slug}`}>Sign up for this event</Link>
                          </Button>
                          <Button asChild variant="outline" size="lg">
                            <Link href={`/e/${event.slug}`}>View details</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold text-white">No public events yet</h2>
                  <p className="mt-2 text-sm leading-6 text-[#999999]">
                    Check back soon or log in if you are part of the event team.
                  </p>
                  <Button asChild className="mt-5" variant="outline">
                    <Link href="/login">Log in</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
