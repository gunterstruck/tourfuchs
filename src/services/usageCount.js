/**
 * Anonyme Nutzungszählung – der neutrale Beleg, ob TourFuchs gebraucht wird.
 *
 * Gezählt werden nur Seitenaufrufe, über Vercel Web Analytics: ohne Cookies,
 * ohne Kennung im Browser, ohne Konto. TourFuchs schickt keine eigenen
 * Ereignisse – kein „Import gemacht", kein „Tour geplant" –, denn das wäre der
 * Schritt von „wird es genutzt?" zu „was tut wer?", und genau den soll es
 * nicht geben (Betriebsrat, Vertrauen, lokal-first).
 *
 * Bewusst eng:
 *  - nur auf den Adressen aus CONFIG.usageCount.hosts (keine Vorschauen,
 *    keine Entwicklung, keine fremde Installation),
 *  - nicht bei „Do Not Track" oder Global Privacy Control,
 *  - nicht in der eingebetteten Handy-Vorschau (sonst doppelt gezählt),
 *  - gemeldet wird nur Adresse ohne Suchteil und Fragment: Eine geteilte
 *    Tour steckt im Fragment und verlässt das Gerät so nie.
 */
import { CONFIG } from '../core/config.js';

/** Soll auf dieser Seite gezählt werden? Rein, damit testbar. */
export function shouldCount({ hostname, doNotTrack, globalPrivacyControl, embedded, hosts = CONFIG.usageCount.hosts } = {}) {
    if (!hostname || !hosts.includes(hostname)) return false;
    if (embedded) return false;
    if (globalPrivacyControl === true) return false;
    if (doNotTrack === '1' || doNotTrack === 'yes') return false;
    return true;
}

/** Ereignis vor dem Senden kürzen: nur Seitenaufrufe, nur Ursprung + Pfad. */
export function trimEvent(event) {
    if (!event || event.type !== 'pageview') return null;
    try {
        const url = new URL(event.url);
        return { ...event, url: `${url.origin}${url.pathname}` };
    } catch {
        return null;
    }
}

export function startUsageCount(win = window) {
    const nav = win.navigator || {};
    let embedded = false;
    try { embedded = win.self !== win.top; } catch { embedded = true; }
    const ok = shouldCount({
        hostname: win.location?.hostname,
        doNotTrack: nav.doNotTrack ?? win.doNotTrack,
        globalPrivacyControl: nav.globalPrivacyControl,
        embedded
    });
    if (!ok) return false;
    // Warteschlange nach Vercel-Vorgabe: Aufrufe vor dem Laden des Skripts
    // werden gesammelt und danach abgearbeitet.
    win.va = win.va || function queue(...args) { (win.vaq = win.vaq || []).push(args); };
    win.va('beforeSend', trimEvent);
    const script = win.document.createElement('script');
    script.defer = true;
    script.src = CONFIG.usageCount.scriptSrc;
    win.document.head.appendChild(script);
    return true;
}
