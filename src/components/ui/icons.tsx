import type { SVGProps } from "react";

import type { IconKey } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement>;

/** Gedeelde basis voor alle lijn-iconen: 24×24, currentColor, ronde uiteinden. */
function LineIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
    </LineIcon>
  );
}

export function HotelIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M12 4v6M2 17h20" />
    </LineIcon>
  );
}

export function PassportIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="4" y="2" width="16" height="20" rx="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16.5h6" />
    </LineIcon>
  );
}

export function GuideIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </LineIcon>
  );
}

export function ActivitiesIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
    </LineIcon>
  );
}

export function EducationIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" />
    </LineIcon>
  );
}

export function MealsIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
    </LineIcon>
  );
}

export function TransportIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 17H3V9l2-4h10l3 4h3v8h-2" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="17.5" cy="17" r="2" />
      <path d="M9.5 17h6" />
    </LineIcon>
  );
}

/**
 * Koppelt een `IconKey` uit de data aan een component. Zo bepaalt de (straks:
 * uit content.json komende) data welk icoon getoond wordt, zonder dat de UI een
 * lange if/else nodig heeft.
 */
export const INCLUSION_ICONS: Record<
  IconKey,
  (props: IconProps) => React.ReactElement
> = {
  plane: PlaneIcon,
  hotel: HotelIcon,
  passport: PassportIcon,
  guide: GuideIcon,
  activities: ActivitiesIcon,
  education: EducationIcon,
  meals: MealsIcon,
  transport: TransportIcon,
};

export function CalendarIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </LineIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </LineIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m20 6-11 11-5-5" />
    </LineIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </LineIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </LineIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
    </LineIcon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m2.5 7 8.4 5.6a2 2 0 0 0 2.2 0L21.5 7" />
    </LineIcon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M15.5 21A12.5 12.5 0 0 1 3 8.5 2.5 2.5 0 0 1 5.5 6h1.8c.5 0 .9.3 1 .8l.8 3c.1.4 0 .8-.3 1l-1.4 1.2a11 11 0 0 0 4.6 4.6l1.2-1.4c.2-.3.6-.4 1-.3l3 .8c.5.1.8.5.8 1v1.8A2.5 2.5 0 0 1 15.5 21Z" />
    </LineIcon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </LineIcon>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <path d="M17.5 6.5h.01" />
    </LineIcon>
  );
}

/** WhatsApp-glyph — gevuld pad, dus zonder de LineIcon-basis. */
export function WhatsAppIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
