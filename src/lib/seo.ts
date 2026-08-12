import type { Metadata } from "next";

import { SITE } from "@/lib/content";
import type { ImageAsset } from "@/lib/types";

/**
 * Bouwt de metadata van één pagina.
 *
 * Dit bestaat om één valkuil dicht te zetten: Next merget metadata **ondiep**.
 * Zodra een pagina een eigen `openGraph` zet, vervangt die het hele object uit
 * de root layout — inclusief `images`, `siteName`, `locale` en `type`. Dat is
 * hier eerder misgegaan: `/reizen` en `/contact` deelden een og:title zonder
 * og:image, waardoor een gedeelde link een kale kaart opleverde. Hetzelfde geldt
 * voor `twitter`, dat anders op de tekst van de homepage bleef staan.
 *
 * Elke pagina gaat daarom via deze functie, zodat alle drie de blokken
 * (`alternates`, `openGraph`, `twitter`) altijd compleet zijn.
 */

/** De standaard-deelafbeelding; los van `images.json` omdat hij 1200×630 is. */
const DEFAULT_OG_IMAGE = {
  url: "/images/og-image.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE.name} — Umrah reizen met Nederlandstalige begeleiding`,
};

export interface PageMetadataOptions {
  /** Zonder de sitenaam; het template in de layout plakt die eraan. */
  title: string;
  description: string;
  /** Pad met leidende slash, bv. "/reizen". */
  path: string;
  /** Eigen deelafbeelding; standaard de og-image van de site. */
  image?: ImageAsset;
  /** "article" voor reizen en tekstpagina's, anders "website". */
  type?: "website" | "article";
  /** Vult `article:modified_time`; ISO-8601. */
  modifiedTime?: string;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  modifiedTime,
}: PageMetadataOptions): Metadata {
  const ogImage = image
    ? {
        url: image.src,
        width: image.width,
        height: image.height,
        alt: image.alt,
      }
    : DEFAULT_OG_IMAGE;

  // De og:title draagt de sitenaam zelf, want het `%s | naam`-template van de
  // layout geldt alleen voor `<title>`.
  const socialTitle = `${title} | ${SITE.name}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: SITE.locale,
      alternateLocale: SITE.alternateLocales,
      siteName: SITE.name,
      url: path,
      title: socialTitle,
      description,
      images: [ogImage],
      ...(type === "article" && modifiedTime
        ? { modifiedTime }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImage.url],
    },
  };
}
