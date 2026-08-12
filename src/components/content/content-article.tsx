import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/section";
import type { ContentPage } from "@/lib/types";

/**
 * Weergave van een tekstpagina uit `src/data/pages`.
 *
 * De koppen krijgen een `id` uit de data, zodat elke sectie een eigen anker
 * heeft. De inhoudsopgave hieronder gebruikt diezelfde ankers: dat helpt de
 * bezoeker op een lange pagina, en het geeft Google de haakjes om naar een
 * specifieke passage te springen vanuit het zoekresultaat.
 *
 * De tekstkolom blijft smal. Een regel van honderd tekens leest niemand uit,
 * en verblijfsduur is iets waar zoekmachines op letten.
 */
export function ContentArticle({
  page,
  trail,
  children,
}: {
  page: ContentPage;
  trail: Crumb[];
  /** Afsluitend blok, bv. een oproep om te reserveren. */
  children?: React.ReactNode;
}) {
  return (
    <article className="pt-24 pb-16 sm:pt-28 sm:pb-20 lg:pb-28">
      <Container>
        <Breadcrumbs trail={trail} />

        <header className="mt-8 flex max-w-3xl flex-col gap-6">
          <h1 className="display-title text-4xl text-heading sm:text-5xl lg:text-6xl">
            {page.heading}
          </h1>
          <p className="text-base leading-relaxed text-body sm:text-lg">
            {page.intro}
          </p>
        </header>

        <nav
          aria-label="Op deze pagina"
          className="mt-12 max-w-3xl rounded-3xl border border-line bg-surface p-6 sm:p-8"
        >
          <h2 className="text-[0.7rem] font-semibold tracking-[0.28em] text-accent uppercase">
            Op deze pagina
          </h2>
          <ol className="mt-4 flex flex-col gap-2.5">
            {page.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-body transition-colors hover:text-accent"
                >
                  <span className="mr-2 text-muted tabular-nums">
                    {index + 1}.
                  </span>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 flex max-w-3xl flex-col gap-14">
          {page.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="display-title text-2xl text-heading sm:text-3xl">
                {section.heading}
              </h2>

              <div className="mt-5 flex flex-col gap-4">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-base leading-relaxed text-body"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.bullets && (
                <ul className="mt-6 flex flex-col gap-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet.slice(0, 40)}
                      className="relative pl-5 text-base leading-relaxed text-body"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute top-[0.6em] left-0 size-1.5 rounded-full bg-accent"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {children && <div className="mt-16 max-w-3xl">{children}</div>}
      </Container>
    </article>
  );
}
