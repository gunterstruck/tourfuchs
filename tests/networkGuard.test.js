import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CONFIG } from '../src/core/config.js';

/**
 * Netzwerk-Wächter (Release 17.0d) – der Grundsatz aus AGENTS.md als Test:
 * „Jede neue externe Verbindung wird in public/datenschutz.html und README
 * offengelegt." Kundendaten verlassen das Gerät nicht.
 *
 * Drei Listen, alle abschließend:
 *  1. Wer im App-Code selbst etwas abruft (fetch & Co.).
 *  2. Eigene Daten (Geodaten, Demo-Routen) kommen vom eigenen Server.
 *  3. Jedes externe Ziel im App-Code – Abruf oder Link – ist in Datenschutz-
 *     erklärung und README benannt.
 * Schlägt der Test an, ist nicht der Test im Weg, sondern eine Offenlegung
 * fällig: erst datenschutz.html und README, dann die Liste hier.
 */
const ROOT = process.cwd();
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

function jsFiles(dir) {
    return readdirSync(resolve(ROOT, dir)).flatMap((name) => {
        const path = join(dir, name);
        return statSync(resolve(ROOT, path)).isDirectory() ? jsFiles(path) : path.endsWith('.js') ? [path] : [];
    });
}
const SOURCES = jsFiles('src').map((path) => ({ path: relative(ROOT, resolve(ROOT, path)), text: read(path) }));
// Kommentarblöcke und -zeilen zählen nicht – nur Code und Zeichenketten.
// Bewusst nur Kommentare am Zeilenanfang: Ein „/*" in einer Zeichenkette
// (etwa accept="image/*") dürfte sonst echten Code bis zum nächsten „*/" verschlucken.
const code = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/^\s*\/\/.*$/gm, '');

// 1. Wer selbst Daten abruft.
const NETWORK_API = /\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|new\s+WebSocket\b|new\s+EventSource\b|importScripts\s*\(/;
const NETWORK_CALLERS = {
    'src/services/geocode.js': 'eigene PLZ- und Ortsdaten (/geodata); Nominatim nur auf Wunsch (Datenschutz 5)',
    'src/services/routing.js': 'OSRM-Straßenrouten nur auf Wunsch (Datenschutz 6)',
    'src/services/geodata.js': 'eigene Gebietsflächen (/geodata)',
    'src/ui/showcase.js': 'eigene Demo-Routen (/geodata)'
};

// 3. Externe Ziele und das Wort, unter dem Datenschutzerklärung und README sie nennen.
const EXTERNAL_TARGETS = {
    'tile.openstreetmap.org': 'OpenStreetMap',     // Kartenkacheln (Datenschutz 4)
    'www.openstreetmap.org': 'OpenStreetMap',      // Quellenangabe der Karte
    'server.arcgisonline.com': 'Esri',             // Luftbild-Kacheln (Datenschutz 4)
    'nominatim.openstreetmap.org': 'Nominatim',    // Adress-Geocodierung, Opt-in (5)
    'router.project-osrm.org': 'OSRM',             // Straßenrouten, Opt-in (6)
    'www.google.com': 'Google Maps',               // Navigation, nur auf Klick (7)
    'zanobo.vercel.app': 'Zanobo',                 // Link zur Schwester-App, nur auf Klick (7)
    'chatgpt.com': 'ChatGPT',                      // Briefing-Assistent, nur auf Klick (8)
    'm365.cloud.microsoft': 'Copilot',             // dito
    'gemini.google.com': 'Gemini'                  // dito
};
// Keine Ziele: Platzhalter in Eingabefeldern und Beispieltexten, XML-Namensräume.
const NOT_TARGETS = new Set(['example.com', 'example.test', 'firma.sharepoint.com', 'assistent.meine-firma.de', 'www.w3.org']);

function externalHosts() {
    const hosts = new Map();
    for (const { path, text } of SOURCES) {
        for (const [, host] of code(text).matchAll(/https?:\/\/([a-z0-9{}.-]+\.[a-z]{2,})/gi)) {
            const name = host.replace(/^\{s\}\./, '').toLowerCase();
            if (NOT_TARGETS.has(name) || name.endsWith('.example.test')) continue;
            if (!hosts.has(name)) hosts.set(name, new Set());
            hosts.get(name).add(path);
        }
    }
    return hosts;
}

describe('Netzwerk-Wächter', () => {
    it('nur die bekannten Module rufen selbst etwas ab', () => {
        const callers = SOURCES.filter(({ text }) => NETWORK_API.test(code(text))).map(({ path }) => path).sort();
        expect(callers, 'Neuer Netzwerkabruf? Erst offenlegen (datenschutz.html, README), dann hier eintragen.')
            .toEqual(Object.keys(NETWORK_CALLERS).sort());
    });

    it('eigene Daten kommen vom eigenen Server, nicht von fremden', () => {
        const own = [
            CONFIG.plzCentroidsUrl, CONFIG.plzPlacesUrl, CONFIG.demoStreetsUrl, CONFIG.demoRoutesUrl,
            ...Object.values(CONFIG.levels).map((level) => level.file).filter(Boolean)
        ];
        expect(own.length).toBeGreaterThan(5);
        for (const url of own) expect(url, url).toMatch(/^\/[^/]/);
    });

    it('jedes externe Ziel im App-Code ist bekannt', () => {
        const unknown = [...externalHosts()].filter(([host]) => !(host in EXTERNAL_TARGETS))
            .map(([host, files]) => `${host} (${[...files].join(', ')})`);
        expect(unknown, 'Neues externes Ziel: in datenschutz.html und README offenlegen, dann hier eintragen.').toEqual([]);
    });

    it('jedes bekannte Ziel ist in Datenschutzerklärung und README benannt', () => {
        const privacy = read('public/datenschutz.html');
        const readme = read('README.md');
        for (const [host, name] of Object.entries(EXTERNAL_TARGETS)) {
            expect(privacy.includes(name), `datenschutz.html nennt „${name}" (${host}) nicht`).toBe(true);
            expect(readme.includes(name), `README nennt „${name}" (${host}) nicht`).toBe(true);
        }
    });

    it('die Liste veraltet nicht: jedes bekannte Ziel kommt im App-Code noch vor', () => {
        const hosts = externalHosts();
        for (const host of Object.keys(EXTERNAL_TARGETS)) expect(hosts.has(host), host).toBe(true);
    });

    it('index.html lädt keine Skripte oder Stile von fremden Servern', () => {
        const html = read('index.html');
        expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
        expect(html).not.toMatch(/<link[^>]+rel=["'](?:stylesheet|preload|modulepreload)["'][^>]+href=["']https?:/i);
        expect(html).not.toMatch(/<link[^>]+href=["']https?:[^>]+rel=["'](?:stylesheet|preload|modulepreload)["']/i);
        expect(html).not.toMatch(/@import\s+url\(["']?https?:/i);
    });
});
