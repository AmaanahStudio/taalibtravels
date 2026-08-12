import type { Metadata } from "next";

import { ContentArticle } from "@/components/content/content-article";
import { JsonLd } from "@/components/seo/json-ld";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import { SITE, getContentPage } from "@/lib/content";
import { articleSchema, graph } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

const PAGE = getContentPage("umrah");

export const metadata: Metadata = pageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: "/umrah",
  type: "article",
  modifiedTime: PAGE.updatedAt,
});

export default function UmrahPage() {
  return (
    <>
      <JsonLd data={graph(articleSchema(PAGE))} />

      <ContentArticle
        page={PAGE}
        trail={[
          { name: "Home", path: "/" },
          { name: "Umrah", path: "/umrah" },
        ]}
      >
        <WhatsAppCta
          eyebrow="Meegaan"
          title="Klaar om te gaan?"
          description="Bekijk onze vertrekdata of stel je vraag via WhatsApp. Ook als je nog niets wil vastleggen — meedenken kost niets."
          message={`Assalaamu alaykum, ik heb een vraag over de Umrah-reizen van ${SITE.name}.`}
        />
      </ContentArticle>
    </>
  );
}
