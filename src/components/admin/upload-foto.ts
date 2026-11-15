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

const ONLEESBAAR = "Dit bestand kan niet als foto gelezen worden. Kies een JPEG, PNG of WebP.";

/** Een foutmelding die zo aan de beheerder getoond kan worden. */
export class UploadFout extends Error {}

export interface Varianten {
  width: number;
  height: number;
  varianten: Map<number, Blob>;
}

/* -------------------------------------------------------------------------- */
/* WebP coderen                                                               */
/* -------------------------------------------------------------------------- */

let canvasWebp: Promise<boolean> | null = null;

/**
 * Kan deze browser via canvas WebP coderen? Eén keer getest en onthouden.
 *
 * Safari en élke browser op iOS (allemaal WebKit) kunnen dat niet: `toBlob`
 * met "image/webp" geeft daar stilzwijgend een PNG terug. Het portaal roept
 * dit al bij het openen aan, zodat de eerste upload niet op de test wacht.
 */
export function canvasMaaktWebp(): Promise<boolean> {
  canvasWebp ??= new Promise((klaar) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    canvas.toBlob((blob) => klaar(blob?.type === "image/webp"), "image/webp", 0.5);
  });
  return canvasWebp;
}

type Encoder = (canvas: HTMLCanvasElement) => Promise<Blob | null>;

const viaCanvas: Encoder = (canvas) =>
  // toBlob wil de kwaliteit als 0–1; WEBP_QUALITY staat in sharp-schaal (0–100).
  new Promise((klaar) => canvas.toBlob(klaar, "image/webp", WEBP_QUALITY / 100));

/**
 * Terugval voor WebKit: libwebp als WebAssembly (`@jsquash/webp`, de encoder
 * van Squoosh), met dezelfde kwaliteit als sharp. De `import()` staat alleen in
 * dit pad, zodat code en .wasm (~350 KB) nooit geladen worden in een browser die
 * het zelf kan. De .wasm komt van onze eigen origin: de bundler zet hem bij de
 * chunks in `_next/static`.
 */
const viaWasm: Encoder = async (canvas) => {
  const { default: encode } = await import("@jsquash/webp/encode");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const buffer = await encode(pixels, { quality: WEBP_QUALITY });
  return new Blob([buffer], { type: "image/webp" });
};

/* -------------------------------------------------------------------------- */
/* Varianten                                                                  */
/* -------------------------------------------------------------------------- */

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
    throw new UploadFout("Deze browser kan geen foto's verkleinen. Werk de browser bij en probeer het opnieuw.");
  }

  const encoder = (await canvasMaaktWebp()) ? viaCanvas : viaWasm;
  const echt = await leesAfmetingen(bestand);
  const schaal = Math.min(1, MAX_BRON / Math.max(echt.width, echt.height));
  const width = Math.max(1, Math.round(echt.width * schaal));
  const height = Math.max(1, Math.round(echt.height * schaal));

  let bron: ImageBitmap;
  try {
    /*
     * Meteen op het afgetopte formaat decoderen: een foto van 48 MP volledig
     * uitpakken kost bijna 200 MB, en daarop sluit een telefoon de tab.
     * `from-image` draait een telefoonfoto volgens zijn EXIF-oriëntatie rechtop.
     */
    bron = await createImageBitmap(bestand, {
      imageOrientation: "from-image",
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
  } catch {
    throw new UploadFout(ONLEESBAAR);
  }

  try {
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
        // De WASM-terugval leest de pixels terug; dat gaat sneller met deze hint.
        const context = canvas.getContext("2d", { willReadFrequently: encoder === viaWasm });
        if (!context) throw new UploadFout("De browser kon de foto niet verwerken.");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        // Met de doelmaat erbij: negeert een browser de resize-opties hierboven,
        // dan klopt het formaat hier alsnog.
        context.drawImage(vorige, 0, 0, doelBreedte, doelHoogte);

        vorigeBlob = await naarWebp(canvas, breedte, encoder);
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

/**
 * Breedte en hoogte zoals de foto rechtop staat, zonder hem helemaal te
 * decoderen: een `<img>` kent zijn afmetingen zodra de kop gelezen is, en past
 * daarbij de EXIF-oriëntatie al toe.
 */
function leesAfmetingen(bestand: File): Promise<{ width: number; height: number }> {
  return new Promise((klaar, mislukt) => {
    const url = URL.createObjectURL(bestand);
    const beeld = new Image();
    beeld.onload = () => {
      URL.revokeObjectURL(url);
      klaar({ width: beeld.naturalWidth, height: beeld.naturalHeight });
    };
    beeld.onerror = () => {
      URL.revokeObjectURL(url);
      mislukt(new UploadFout(ONLEESBAAR));
    };
    beeld.src = url;
  });
}

async function naarWebp(canvas: HTMLCanvasElement, breedte: number, encoder: Encoder): Promise<Blob> {
  let blob: Blob | null;
  try {
    blob = await encoder(canvas);
  } catch (fout) {
    // Bv. de .wasm die niet laadt; de beheerder krijgt hieronder een eerlijke melding.
    console.error("WebP coderen mislukt:", fout);
    blob = null;
  }

  // Geen stille PNG of leeg resultaat doorsturen: de Worker zou het weigeren,
  // maar pas na het uploaden en met een vagere melding.
  if (!blob || blob.type !== "image/webp") {
    throw new UploadFout(
      "Deze browser kon de foto niet omzetten naar WebP. Herlaad de pagina en probeer het opnieuw; lukt het dan nog niet, upload de foto dan vanaf een computer.",
    );
  }
  if (blob.size > UPLOAD.maxVariantBytes) {
    throw new UploadFout(
      `De variant van ${breedte}px wordt groter dan ${UPLOAD.maxVariantBytes / (1024 * 1024)} MB. Kies een foto met minder fijne details of een kleinere versie.`,
    );
  }
  return blob;
}

/* -------------------------------------------------------------------------- */
/* Uploaden                                                                   */
/* -------------------------------------------------------------------------- */

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
