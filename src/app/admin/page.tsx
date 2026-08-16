import type { Metadata } from "next";

import { AdminPaneel } from "@/components/admin/admin-paneel";
import { Section } from "@/components/ui/section";

/*
 * Uit de zoekresultaten houden gebeurt op drie plekken, want één ervan is nooit
 * genoeg: hier voor de crawlers die de meta-tag lezen, in robots.ts voor wie
 * eerst dat bestand ophaalt, en in public/_headers als X-Robots-Tag voor het
 * geval de pagina zelf nooit geparseerd wordt.
 */
export const metadata: Metadata = {
  title: "Beheer",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Section spacing="none" className="pt-24 pb-20 sm:pt-28 sm:pb-24">
      <AdminPaneel />
    </Section>
  );
}
