import Image from "next/image";

import type { ImageAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Fotogrid met afgeronde cards, subtiele border en een lichte zoom bij hover.
 *
 * De rijhoogte wordt vastgezet met `auto-rows-*` in plaats van met een
 * aspect-ratio per foto. Zo kan de eerste foto netjes twee rijen overspannen
 * zonder dat de rest van het raster verspringt.
 *
 * TODO(content): de afbeeldingen in /public/images zijn placeholders. Zet er de
 * echte reisfoto's neer (zelfde bestandsnamen) of laat ze straks uit de
 * database komen.
 */
export function GallerySection({
  images,
  className,
  featureFirst = false,
}: {
  images: ImageAsset[];
  className?: string;
  /** Laat de eerste foto twee kolommen én twee rijen innemen (vanaf sm). */
  featureFirst?: boolean;
}) {
  return (
    <ul
      className={cn(
        "grid auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] sm:gap-4 lg:auto-rows-[13.5rem] lg:grid-cols-3",
        className,
      )}
    >
      {images.map((image, index) => {
        const featured = featureFirst && index === 0;

        return (
          <li
            key={image.src}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-line bg-sunken shadow-card sm:rounded-3xl",
              featured && "col-span-2 row-span-2",
            )}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={
                featured
                  ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 620px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 45vw, 320px"
              }
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Donkere gradient onderaan houdt het geheel rustig en premium */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/55 via-transparent to-transparent"
            />
          </li>
        );
      })}
    </ul>
  );
}
