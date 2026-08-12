import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  /** Pad met leidende slash. */
  path: string;
}

/**
 * Kruimelpad, inclusief het bijbehorende `BreadcrumbList`-schema.
 *
 * Zichtbaar pad en schema komen bewust uit dezelfde `trail`: Google verlangt
 * dat de opmaak overeenkomt met wat de bezoeker ziet, en dat kan hier niet uit
 * elkaar lopen. Het levert de padregel onder het zoekresultaat in plaats van
 * een kale URL, en het geeft elke diepere pagina een link omhoog.
 *
 * De laatste kruimel is de huidige pagina en wordt geen link.
 */
export function Breadcrumbs({
  trail,
  className,
}: {
  trail: Crumb[];
  className?: string;
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <nav aria-label="Kruimelpad" className={className}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;

            return (
              <li key={crumb.path} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-line-strong">
                    /
                  </span>
                )}

                {isLast ? (
                  <span aria-current="page" className="text-body">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={crumb.path}
                    className={cn("transition-colors hover:text-heading")}
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
