import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { JsonLd } from "@/components/seo/json-ld";
import { FloatingWhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE } from "@/lib/content";
import { siteSchema } from "@/lib/schema";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

/** Display-font voor de grote uppercase koppen, zoals op de poster. */
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Body-font. Alleen de gewichten die echt voorkomen: 400 als basis, 500 voor
 * `font-medium`, 600 voor `font-semibold` en 700 voor `<strong>` in de
 * tekstpagina's. Elk gewicht extra is een render-blocking preload in `<head>`.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "umrah",
    "umrah reis",
    "umrah reizen",
    "umrah vanuit België",
    "umrah vanuit Nederland",
    "umrah met begeleiding",
    "umrah in groep",
    "Makkah",
    "Madinah",
    "TaalibTravels",
  ],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "travel",
  // Voorkomt dat iOS de prijzen en datums in de tekst als telefoonnummers
  // opmaakt, wat de opmaak breekt en zoekmachines rare links laat zien.
  formatDetection: { telephone: false, address: false, email: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    alternateLocale: SITE.alternateLocales,
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${SITE.name} — Umrah reizen`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ["/images/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    // Zonder deze regel toont Google een miniatuur ter grootte van een
    // postzegel. Voor een reissite is de foto het halve zoekresultaat.
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Een lege waarde zou een lege meta-tag opleveren; vul het token uit Google
  // Search Console in site.json in om de verificatie aan te zetten.
  ...(SITE.verification.google
    ? { verification: { google: SITE.verification.google } }
    : {}),
};

/** Browserbalk op de paginakleur van het standaardthema (light). */
export const viewport: Viewport = {
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      data-theme={DEFAULT_THEME}
      data-scroll-behavior="smooth"
      // Het script hierboven wijzigt data-theme vóór React hydrateert.
      suppressHydrationWarning
      className={`${anton.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        {/* Draait synchroon tijdens het parsen van de HTML, dus vóór de eerste
            paint. Zonder dit flitst de pagina donker voor wie licht koos. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Het bedrijf en de site, één keer beschreven met een vaste `@id`.
            Elke pagina verwijst er alleen naar. */}
        <JsonLd data={siteSchema()} />
        <AmbientBackground />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingWhatsAppButton
          message={`Assalaamu alaykum, ik heb een vraag over de Umrah-reizen van ${SITE.name}.`}
        />
      </body>
    </html>
  );
}
