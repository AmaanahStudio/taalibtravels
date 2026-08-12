import type { Metadata } from "next";

import { ContentArticle } from "@/components/content/content-article";
import { JsonLd } from "@/components/seo/json-ld";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import { SITE, getContentPage } from "@/lib/content";
import { articleSchema, graph } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

const PAGE = getContentPage("over-ons");

export const metadata: Metadata = pageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: "/over-ons",
  type: "article",
  modifiedTime: PAGE.updatedAt,
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={graph(articleSchema(PAGE))} />

      <ContentArticle
        page={PAGE}
        trail={[
          { name: "Home", path: "/" },
          { name: "Over ons", path: "/over-ons" },
        ]}
      >
        <WhatsAppCta
          eyebrow="Kennismaken"
          title="Nog iets te vragen?"
          description="App ons gerust. We beantwoorden vragen over de reizen, de prijs of de praktische kant, ook als je nog niet zeker weet of je meegaat."
          label="Stel je vraag via WhatsApp"
          message={`Assalaamu alaykum, ik heb een vraag over ${SITE.name}.`}
        />
      </ContentArticle>
    </>
  );
}
