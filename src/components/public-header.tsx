import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicHeader({ signupHref = "/#events" }: { signupHref?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/fcf-wordmark-white.png"
            alt="The Federation of Cannabis Farmers"
            width={260}
            height={61}
            priority
            className="h-auto w-32 min-[420px]:w-40 sm:w-52"
          />
        </Link>
        <nav className="flex shrink-0 items-center gap-1 min-[380px]:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <LogIn className="h-4 w-4" aria-hidden />
              Log in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={signupHref}>
              Sign up
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
