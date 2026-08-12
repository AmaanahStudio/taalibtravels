"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { CloseIcon, MenuIcon, WhatsAppIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NAV, SITE } from "@/lib/content";
import { cn, whatsappUrl } from "@/lib/utils";

const WHATSAPP_MESSAGE = `Assalaamu alaykum, ik heb een vraag over de Umrah-reizen van ${SITE.name}.`;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Achtergrond pas invullen zodra de bezoeker scrollt — bovenaan blijft de
  // navbar volledig transparant over de hero heen liggen.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Achtergrond niet laten scrollen zolang het mobiele menu open staat.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "border-b border-line bg-page/85 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Hoofdnavigatie"
        className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8"
      >
        <Link href="/" aria-label={`${SITE.name} — naar de homepage`}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.main.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "text-heading"
                  : "text-muted hover:text-heading",
              )}
            >
              {link.label}
            </Link>
          ))}

          <a
            href={whatsappUrl(WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-3 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-heading transition-all hover:border-whatsapp-500/60 hover:bg-surface-strong"
          >
            <WhatsAppIcon className="size-4 text-whatsapp-500" />
            {SITE.whatsapp.display}
          </a>

          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobiel-menu"
            aria-label={open ? "Menu sluiten" : "Menu openen"}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-heading transition-colors hover:bg-surface-strong"
          >
            {open ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobiel menu */}
      <div
        id="mobiel-menu"
        hidden={!open}
        className="border-t border-line bg-page/95 backdrop-blur-xl md:hidden"
      >
        <div className="flex flex-col gap-1 px-5 py-6">
          {NAV.main.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-2xl px-4 py-3.5 text-base font-medium transition-colors",
                isActive(link.href)
                  ? "bg-surface-strong text-heading"
                  : "text-body hover:bg-surface hover:text-heading",
              )}
            >
              {link.label}
            </Link>
          ))}

          <a
            href={whatsappUrl(WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex items-center justify-center gap-2.5 rounded-full bg-whatsapp-500 px-6 py-3.5 text-sm font-semibold text-on-whatsapp"
          >
            <WhatsAppIcon className="size-5" />
            {SITE.whatsapp.display}
          </a>
        </div>
      </div>
    </header>
  );
}
