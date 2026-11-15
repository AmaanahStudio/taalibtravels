/**
 * Een foto verkleinen en uploaden, zonder React: de component in
 * `fotos-beheer.tsx` roept dit aan en houdt alleen de status bij.
 *
 * De browser maakt de varianten, niet de Worker: een Worker heeft geen sharp en
 * te weinig CPU-tijd om een foto van 4000px te herschalen. De Worker controleert
 * wel elke variant (WebP-handtekening, grootte, de volledige ladder).
 */

import { API, UPLOAD, variantVeld, type AfbeeldingAntwoord, type AfbeeldingRecord } from "@/lib/api";
import { ALL_WIDTHS, WEBP_QUALITY } from "@/lib/foto-breedtes";

/**
 * Langste zijde waarop de bron wordt afgetopt. Een foto van een moderne camera
 * (6000px+) kan anders voorbij `UPLOAD.maxAfmeting` van de Worker vallen, terwijl
 * de grootste variant toch maar 1600px is. Breedte en hoogte die we opsturen zijn
 * die van de afgetopte bron: de verhouding blijft gelijk, en daar draait het om.
 */
const MAX_BRON = 4000;

/** Een foutmelding die zo aan de beheerder getoond kan worden. */
export class UploadFout extends Error {}

export interface Varianten {
  width: number;
  height: number;
  varianten: Map<number, Blob>;
}

/**
 * Maakt van `bestand` een WebP voor elke breedte uit de ladder.
 *
 * Breedtes boven de bron krijgen een variant op bronformaat — nooit opschalen —
 * zodat elke breedte bestaat, net als bij `build-images.mjs` en het seed-script.
 * Zulke breedtes delen één Blob in plaats van hetzelfde beeld opnieuw te coderen.
 *
 * Van groot naar klein, elke stap getekend vanaf de vorige: één grote
 * verkleining in één keer geeft op canvas zichtbare kartels, kleine stappen niet.
 */
export async function maakVarianten(bestand: File): Promise<Varianten> {
  if (typeof createImageBitmap !== "function") {
    throw new UploadFout("Deze browser kan geen foto's verkleinen. Gebruik een recente Chrome, Edge, Firefox of Safari.");
  }

  let bron: ImageBitmap;
  try {
    // `from-image` draait een telefoonfoto volgens zijn EXIF-oriëntatie rechtop.
    bron = await createImageBitmap(bestand, { imageOrientation: "from-image" });
  } catch {
    throw new UploadFout("Dit bestand kan niet als foto gelezen worden. Kies een JPEG, PNG of WebP.");
  }

  try {
    const schaal = Math.min(1, MAX_BRON / Math.max(bron.width, bron.height));
    const width = Math.max(1, Math.round(bron.width * schaal));
    const height = Math.max(1, Math.round(bron.height * schaal));

    const varianten = new Map<number, Blob>();
    let vorige: CanvasImageSource = bron;
    let vorigeBreedte = 0;
    let vorigeBlob: Blob | null = null;

    for (const breedte of [...ALL_WIDTHS].sort((a, b) => b - a)) {
      const doelBreedte = Math.min(breedte, width);

      if (doelBreedte !== vorigeBreedte || !vorigeBlob) {
        const doelHoogte = Math.max(1, Math.round((height * doelBreedte) / width));
        const canvas = document.createElement("canvas");
        canvas.width = doelBreedte;
        canvas.height = doelHoogte;
        const context = canvas.getContext("2d");
        if (!context) throw new UploadFout("De browser kon de foto niet verwerken.");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(vorige, 0, 0, doelBreedte, doelHoogte);

        vorigeBlob = await naarWebp(canvas, breedte);
        vorige = canvas;
        vorigeBreedte = doelBreedte;
      }

      varianten.set(breedte, vorigeBlob);
    }

    return { width, height, varianten };
  } finally {
    bron.close();
  }
}

async function naarWebp(canvas: HTMLCanvasElement, breedte: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((klaar) =>
    // toBlob wil de kwaliteit als 0–1; WEBP_QUALITY staat in sharp-schaal.
    canvas.toBlob(klaar, "image/webp", WEBP_QUALITY / 100),
  );

  /*
   * Een browser die geen WebP kan coderen (Safari vóór 14 en andere oude
   * versies) geeft stilzwijgend een PNG terug. Die zou de Worker weigeren, maar
   * pas na het uploaden en met een vagere melding — dus hier al stoppen.
   */
  if (!blob || blob.type !== "image/webp") {
    throw new UploadFout(
      "Deze browser kan geen WebP-bestanden maken. Upload de foto met een recente Chrome, Edge of Firefox.",
    );
  }
  if (blob.size > UPLOAD.maxVariantBytes) {
    throw new UploadFout(
      `De variant van ${breedte}px wordt groter dan ${UPLOAD.maxVariantBytes / (1024 * 1024)} MB. Kies een foto met minder fijne details of een kleinere versie.`,
    );
  }
  return blob;
}

export type UploadUitkomst =
  | { soort: "klaar"; afbeelding: AfbeeldingRecord }
  | { soort: "uitgelogd" }
  | { soort: "fout"; melding: string };

/**
 * Verstuurt de varianten als één multipart-formulier, met voortgang.
 *
 * XMLHttpRequest in plaats van fetch: alleen XHR meldt hoeveel er al verstuurd
 * is, en bij een paar MB op een mobiele verbinding wil je dat zien.
 * `onVoortgang` krijgt een getal van 0 tot 1.
 */
export function uploadFoto(
  { width, height, varianten }: Varianten,
  alt: string,
  onVoortgang: (deel: number) => void,
): Promise<UploadUitkomst> {
  const formulier = new FormData();
  formulier.append("alt", alt);
  formulier.append("width", String(width));
  formulier.append("height", String(height));
  for (const [breedte, blob] of varianten) {
    formulier.append(variantVeld(breedte), blob, `${breedte}.webp`);
  }

  return new Promise((klaar) => {
    const verzoek = new XMLHttpRequest();
    verzoek.open("POST", API.afbeeldingen);
    verzoek.responseType = "json";
    verzoek.setRequestHeader("Accept", "application/json");

    verzoek.upload.onprogress = (event) => {
      if (event.lengthComputable) onVoortgang(event.loaded / event.total);
    };

    verzoek.onload = () => {
      if (verzoek.status === 401) return klaar({ soort: "uitgelogd" });

      const data = verzoek.response as AfbeeldingAntwoord | null;
      if (verzoek.status === 201 && data?.ok) {
        return klaar({ soort: "klaar", afbeelding: data.afbeelding });
      }
      klaar({
        soort: "fout",
        melding:
          (data && !data.ok && data.melding) ||
          (verzoek.status === 413 ? "De upload is te groot." : "Uploaden is niet gelukt."),
      });
    };

    verzoek.onerror = () => klaar({ soort: "fout", melding: "Geen verbinding met de server." });
    verzoek.send(formulier);
  });
}
