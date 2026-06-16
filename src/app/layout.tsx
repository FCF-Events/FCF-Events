import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-VariableFont_wght.ttf",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FCF Events",
  description: "Private event operations, ticketing, QR check-in, and SMS reminders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
