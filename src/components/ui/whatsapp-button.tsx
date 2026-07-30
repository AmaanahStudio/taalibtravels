import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { cn, whatsappUrl } from "@/lib/utils";

/**
 * De belangrijkste conversie-actie van de site. Opent WhatsApp met een
 * voorgevuld bericht, zodat de klant enkel nog op verzenden hoeft te tikken.
 */
export function WhatsAppButton({
  label = "Reserveer je plek via WhatsApp",
  message,
  variant = "whatsapp",
  size = "lg",
  className,
}: {
  label?: string;
  message?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Button
      href={whatsappUrl(message)}
      variant={variant}
      size={size}
      className={className}
    >
      <WhatsAppIcon className="size-5 shrink-0" />
      {label}
    </Button>
  );
}

/**
 * Zwevende knop, alleen op mobiel. Klanten boeken vanaf hun telefoon, dus
 * WhatsApp blijft altijd binnen duimbereik.
 */
export function FloatingWhatsAppButton({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <a
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacteer TaalibTravels via WhatsApp"
      className={cn(
        "fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-whatsapp-500 text-on-whatsapp shadow-whatsapp transition-transform duration-200 hover:scale-105 active:scale-95 md:hidden",
        className,
      )}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
