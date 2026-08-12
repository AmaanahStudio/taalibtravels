import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { InstagramIcon, MailIcon, WhatsAppIcon } from "@/components/ui/icons";
import { NAV, SITE } from "@/lib/content";
import { whatsappUrl } from "@/lib/utils";

const FOOTER_MESSAGE = `Assalaamu alaykum, ik wil graag meer info over de Umrah-reizen van ${SITE.name}.`;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-line bg-raised">
      {/* Zachte blauwe gloed onderaan de pagina */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              {SITE.description}
            </p>
          </div>

          <nav aria-label="Footernavigatie" className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
              Menu
            </h2>
            <ul className="flex flex-col gap-3">
              {NAV.footer.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-body transition-colors hover:text-heading"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
              Contact
            </h2>
            <ul className="flex flex-col gap-3.5 text-sm">
              <li>
                <a
                  href={whatsappUrl(FOOTER_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-heading transition-colors hover:text-whatsapp-400"
                >
                  <WhatsAppIcon className="size-4 shrink-0 text-whatsapp-500" />
                  {SITE.whatsapp.display}
                </a>
              </li>
              <li>
                <a
                  href={SITE.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-body transition-colors hover:text-heading"
                >
                  <InstagramIcon className="size-4 shrink-0" />
                  {SITE.instagram.handle}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-flex items-center gap-2.5 text-body transition-colors hover:text-heading"
                >
                  <MailIcon className="size-4 shrink-0" />
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.name}. Alle rechten voorbehouden.
          </p>
          <p className="tracking-[0.18em] uppercase">{SITE.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
