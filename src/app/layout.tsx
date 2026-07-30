import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { FloatingWhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE } from "@/lib/content";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

/** Display-font voor de grote uppercase koppen, zoals op de poster. */
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/** Body-font. */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    "umrah budget",
    "umrah België",
    "Makkah",
    "Madinah",
    "islamitische reis",
    "TaalibTravels",
  ],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: SITE.locale,
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
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090c11" },
    { media: "(prefers-color-scheme: light)", color: "#090c11" },
  ],
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
