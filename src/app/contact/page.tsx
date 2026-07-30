import type { Metadata } from "next";

import {
  InstagramIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import { FAQ, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Neem contact op met TaalibTravels via WhatsApp, telefoon, e-mail of Instagram. We beantwoorden je vragen over onze Umrah-reizen meestal binnen enkele uren.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${SITE.name}`,
    description:
      "Vragen over een Umrah-reis? Bereik ons het snelst via WhatsApp.",
    url: `${SITE.url}/contact`,
  },
};

const WHATSAPP_MESSAGE = `Assalaamu alaykum, ik heb een vraag over de Umrah-reizen van ${SITE.name}.`;

/** De overige kanalen, voor wie liever niet via WhatsApp werkt. */
const CHANNELS = [
  {
    icon: PhoneIcon,
    label: "Telefoon",
    value: SITE.whatsapp.display,
    href: `tel:+${SITE.whatsapp.international}`,
  },
  {
    icon: MailIcon,
    label: "E-mail",
    value: SITE.email,
    href: `mailto:${SITE.email}`,
  },
  {
    icon: InstagramIcon,
    label: "Instagram",
    value: SITE.instagram.handle,
    href: SITE.instagram.url,
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <Section spacing="none" className="pt-24 pb-16 sm:pt-28 sm:pb-20">
        <SectionHeading
          as="h1"
          align="center"
          eyebrow="Contact"
          title="Neem contact op"
          intro="Heb je een vraag? Stuur ons gerust een bericht."
        />

        <WhatsAppCta
          className="mt-10"
          title="Bereik ons via WhatsApp"
          description="Vragen over een reis, de prijs of het visum? App ons gerust, ook als je nog niets wil vastleggen."
          label="WhatsApp"
          message={WHATSAPP_MESSAGE}
          footnote="Meestal binnen enkele uren antwoord."
        />

        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const isExternal = channel.href.startsWith("http");

            return (
              <li key={channel.label}>
                <a
                  href={channel.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="group flex h-full flex-col items-center gap-2 rounded-3xl border border-line bg-surface px-5 py-7 text-center transition-all hover:border-accent/40 hover:bg-surface-strong"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-strong text-accent transition-colors group-hover:border-accent/40">
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-1 text-[0.65rem] font-semibold tracking-[0.22em] text-accent uppercase">
                    {channel.label}
                  </span>
                  <span className="text-sm font-semibold break-words text-heading transition-colors group-hover:text-accent">
                    {channel.value}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Veelgestelde vragen — vangt de meest voorkomende vragen alvast af. */}
      <Section spacing="none" className="pb-20 sm:pb-24">
        <h2 className="display-title text-3xl text-heading sm:text-4xl">
          Veelgestelde vragen
        </h2>

        <dl className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.question} className="flex flex-col gap-2">
              <dt className="font-display text-base tracking-[0.06em] text-heading uppercase">
                {item.question}
              </dt>
              <dd className="text-sm leading-relaxed text-body">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
