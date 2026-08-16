/**
 * Sessie en wachtwoordcontrole voor het admin-gedeelte.
 *
 * Er is één beheerder en één wachtwoord, dus er komt geen gebruikerstabel aan te
 * pas. De sessie is een ondertekend vervalmoment in een cookie: de Worker hoeft
 * daardoor niets bij te houden, en een cookie die iemand zelf in elkaar zet,
 * klopt niet met de handtekening.
 */

const COOKIE_NAAM = "tt_admin";

/** Acht uur: lang genoeg voor een werkdag, kort genoeg om niet te blijven staan. */
const SESSIE_DUUR_MS = 8 * 60 * 60 * 1000;

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

/** Waarde voor de `Set-Cookie`-kop na een geslaagde login. */
export async function maakSessieCookie(secret: string): Promise<string> {
  const vervalt = String(Date.now() + SESSIE_DUUR_MS);
  const handtekening = await onderteken(secret, vervalt);
  const maxAge = Math.floor(SESSIE_DUUR_MS / 1000);

  return `${COOKIE_NAAM}=${vervalt}.${handtekening}; ${COOKIE_OPTIES}; Max-Age=${maxAge}`;
}

/** Waarde voor de `Set-Cookie`-kop bij uitloggen. */
export function wisSessieCookie(): string {
  return `${COOKIE_NAAM}=; ${COOKIE_OPTIES}; Max-Age=0`;
}

/** Controleert de handtekening én het vervalmoment van de sessiecookie. */
export async function heeftGeldigeSessie(
  request: Request,
  secret: string,
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

  return gelijkInConstanteTijd(handtekening, await onderteken(secret, vervalt));
}

/**
 * Onomkeerbare vingerafdruk van een IP-adres. Met dezelfde `salt` levert
 * hetzelfde adres altijd dezelfde hash op — genoeg om te zien dat twintig
 * inschrijvingen van één plek komen — maar het adres zelf is er niet uit terug
 * te halen. Zonder de salt zou een lijst van alle IPv4-adressen dat wel kunnen.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  return base64url(await sha256(`${ip}${salt}`));
}
