import Image from "next/image";
import Link from "next/link";

const legalLinks = [
  { href: "/features", label: "Features" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/communications", label: "CASL & SMS" },
  { href: "/legal/cannabis-compliance", label: "Cannabis Compliance" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050505]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[1fr_auto] md:px-8">
        <div>
          <Image
            src="/brand/fcf-wordmark-white.png"
            alt="The Federation of Cannabis Farmers"
            width={260}
            height={61}
            className="h-auto w-44"
          />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#999999]">
            Event registration, QR check-in, and operational reminders for adult cannabis industry events.
            This site provides compliance-supportive product flows, not legal advice.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#dddddd] md:justify-end">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-[#666666] md:px-8">
        Copyright {new Date().getFullYear()} The Federation of Cannabis Farmers. All rights reserved.
      </div>
    </footer>
  );
}
