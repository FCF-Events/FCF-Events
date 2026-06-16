import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PrintTicketButton } from "@/components/print-ticket-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TicketQr } from "@/components/ticket-qr";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { ticketUrl } from "@/lib/security/qr";

export default async function TicketPage({ params }: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = await params;
  const decoded = decodeURIComponent(ticketCode);
  const url = ticketUrl(decoded);

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white print:bg-white print:text-black">
      <div className="print:hidden">
        <PublicHeader />
      </div>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button asChild variant="outline">
            <Link href="/">FCF Events</Link>
          </Button>
          <PrintTicketButton />
        </div>
        <Card className="border-white/20 print:border-black print:bg-white">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-semibold text-white print:text-black">FCF Event Ticket</h1>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <TicketQr value={url} />
            <div className="text-center">
              <p className="text-sm text-[#999999] print:text-gray-600">Ticket code</p>
              <p className="mt-2 font-mono text-xl font-semibold tracking-[0.12em] print:text-black">{decoded}</p>
            </div>
            <div className="rounded-md border border-white/10 p-4 text-sm leading-6 text-[#dddddd] print:border-gray-300 print:text-gray-800">
              <div className="mb-2 flex items-center gap-2 font-medium text-white print:text-black">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Secure check-in
              </div>
              This QR code contains an opaque ticket URL only. Staff validation checks ticket status server-side.
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="print:hidden">
        <PublicFooter />
      </div>
    </main>
  );
}
