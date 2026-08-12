import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Vraag-en-antwoordlijst als `<dl>`.
 *
 * Wordt op drie plekken gebruikt — homepage, contactpagina en de FAQ-pagina —
 * met steeds een andere selectie uit `faq.json`. Het bijbehorende
 * `FAQPage`-schema staat bewust niet hier maar op de FAQ-pagina zelf: dat
 * schema hoort maar één keer per site op de pagina die de vragen volledig
 * beantwoordt, niet op elk fragment.
 */
export function FaqList({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-10 gap-y-8 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.question} className="flex flex-col gap-2">
          <dt className="font-display text-base tracking-[0.06em] text-heading uppercase">
            {item.question}
          </dt>
          <dd className="text-sm leading-relaxed text-body">{item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
