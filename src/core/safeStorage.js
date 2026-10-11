/**
 * Browser-Speicher oder null. Sind Website-Daten gesperrt (Safari, Chrome mit
 * blockierten Cookies), wirft schon der Zugriff auf `localStorage` – als
 * Vorgabewert eines Parameters brach das den Start ab. Lesen und Schreiben
 * sichern die Aufrufer weiter selbst ab.
 */
export function localStore() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

export function sessionStore() {
    try { return globalThis.sessionStorage || null; } catch { return null; }
}
