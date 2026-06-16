import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader />
      <section className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e50913]">Legal information</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">{title}</h1>
        <p className="mt-5 text-sm leading-7 text-[#dddddd]">{intro}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="rounded-lg border border-white/10 bg-[#111111] p-5">
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <div className="mt-4 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-[#bbbbbb]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
