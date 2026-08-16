/**
 * Sessie en inlogcontrole voor het admin-gedeelte.
 *
 * Er is één beheerder met één gebruikersnaam en wachtwoord, dus er komt geen
 * gebruikerstabel aan te pas. De sessie is een ondertekend vervalmoment in een
 * cookie: de Worker hoeft daardoor niets bij te houden, en een cookie die iemand
 * zelf in elkaar zet, klopt niet met de handtekening.
 */

/*
 * Het `__Host-`-voorvoegsel is geen naamgevingskwestie maar een instructie aan de
 * browser: een cookie met deze naam mag alleen gezet worden vanaf een veilige
 * verbinding, zonder `Domain`, met `Path=/`. Daarmee kan een ander subdomein er
 * geen eigen versie van neerzetten die `leesCookie` als eerste tegenkomt — dat
 * zou geen sessie vervalsen (de handtekening houdt stand) maar wel een 401
 * opleveren waar je niet uitkomt.
 */
const COOKIE_NAAM = "__Host-tt_admin";

/** Acht uur: lang genoeg voor een werkdag, kort genoeg om niet te blijven staan. */
const SESSIE_DUUR_MS = 8 * 60 * 60 * 1000;

/**
 * Scheidingsteken tussen gebruikersnaam en wachtwoord in de vingerafdruk.
 * Opgebouwd met een charcode in plaats van als letterlijk teken: een nulbyte is
 * onzichtbaar in een editor, en een onzichtbaar teken dat iemand per ongeluk
 * wist, verandert stilzwijgend elke handtekening.
 */
const NULBYTE = String.fromCharCode(0);

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binair = "";
  for (const byte of bytes) binair += String.fromCharCode(byte);
  return btoa(binair).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(tekst: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(tekst)),
  );
}

/**
 * Vergelijkt twee waarden zonder bij het eerste verschil te stoppen.
 *
 * Een gewone `===` op een geheim geeft via de duur van het antwoord prijs
 * hoeveel tekens er klopten, en daarmee is een wachtwoord teken voor teken te
 * raden. Beide waarden gaan eerst door SHA-256, zodat ook de lengte niets
 * verraadt, en daarna gaat de lus altijd over alle 32 bytes.
 */
export async function gelijkInConstanteTijd(
  a: string,
  b: string,
): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);

  let verschil = 0;
  for (let i = 0; i < hashA.length; i++) verschil |= hashA[i] ^ hashB[i];

  return verschil === 0;
}

async function onderteken(secret: string, bericht: string): Promise<string> {
  const sleutel = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return base64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", sleutel, encoder.encode(bericht)),
    ),
  );
}

function leesCookie(request: Request, naam: string): string | null {
  const kop = request.headers.get("Cookie");
  if (!kop) return null;

  for (const deel of kop.split(";")) {
    const scheiding = deel.indexOf("=");
    if (scheiding === -1) continue;
    if (deel.slice(0, scheiding).trim() === naam) {
      return deel.slice(scheiding + 1).trim();
    }
  }

  return null;
}

/*
 * `HttpOnly` houdt de cookie buiten bereik van JavaScript, `Secure` buiten een
 * onversleutelde verbinding (localhost telt voor browsers als veilig, dus dit
 * werkt ook lokaal), en `SameSite=Strict` zorgt dat een andere site de cookie
 * nooit meestuurt — dat is meteen de afscherming tegen CSRF.
 */
const COOKIE_OPTIES = "HttpOnly; Secure; SameSite=Strict; Path=/";

/** Een gebruikersnaam is hoofdletterongevoelig; niemand onthoudt hoe hij hem typte. */
export function normaliseerGebruiker(waarde: string): string {
  return waarde.trim().toLowerCase();
}

/**
 * Vingerafdruk van de huidige inloggegevens, die meegetekend wordt in de sessie.
 *
 * Hierdoor maakt het wijzigen van de gebruikersnaam of het wachtwoord elke
 * bestaande cookie in één klap ongeldig. Zonder dit blijft een gestolen cookie
 * de volle acht uur werken, óók nadat je het wachtwoord hebt vervangen ómdat het
 * gelekt was — en dan is er geen enkele manier om iemand eruit te zetten.
 *
 * De nulbyte ertussen kan in geen van beide waarden voorkomen, dus ("ab", "c")
 * levert nooit dezelfde afdruk op als ("a", "bc").
 */
export async function inlogVingerafdruk(
  gebruiker: string,
  wachtwoord: string,
): Promise<string> {
  return base64url(
    await sha256(`${normaliseerGebruiker(gebruiker)}${NULBYTE}${wachtwoord}`),
  );
}

/** Waarde voor de `Set-Cookie`-kop na een geslaagde login. */
export async function maakSessieCookie(
  secret: string,
  vingerafdruk: string,
): Promise<string> {
  const vervalt = String(Date.now() + SESSIE_DUUR_MS);
  const handtekening = await onderteken(secret, `${vervalt}|${vingerafdruk}`);
  const maxAge = Math.floor(SESSIE_DUUR_MS / 1000);

  return `${COOKIE_NAAM}=${vervalt}.${handtekening}; ${COOKIE_OPTIES}; Max-Age=${maxAge}`;
}

/** Waarde voor de `Set-Cookie`-kop bij uitloggen. */
export function wisSessieCookie(): string {
  return `${COOKIE_NAAM}=; ${COOKIE_OPTIES}; Max-Age=0`;
}

/**
 * Controleert de handtekening, het vervalmoment én of de sessie nog bij de
 * huidige inloggegevens hoort.
 */
export async function heeftGeldigeSessie(
  request: Request,
  secret: string,
  vingerafdruk: string,
): Promise<boolean> {
  const cookie = leesCookie(request, COOKIE_NAAM);
  if (!cookie) return false;

  const scheiding = cookie.lastIndexOf(".");
  if (scheiding === -1) return false;

  const vervalt = cookie.slice(0, scheiding);
  const handtekening = cookie.slice(scheiding + 1);

  // Het vervalmoment is mee ondertekend; wie het oprekt, breekt de handtekening.
  const verlooptOp = Number(vervalt);
  if (!Number.isSafeInteger(verlooptOp) || verlooptOp <= Date.now()) return false;

  return gelijkInConstanteTijd(
    handtekening,
    await onderteken(secret, `${vervalt}|${vingerafdruk}`),
  );
}
