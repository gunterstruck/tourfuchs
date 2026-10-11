/**
 * Beispieldaten: flächendeckende Demo-Kunden mit glaubwürdiger Besuchslage.
 *
 * Bis Release 17.1b lag das in excel.js – die Demo lädt beim Start, und mit
 * ihr kam die ganze Excel-Bibliothek (SheetJS, 500 KB) ins Startpaket, obwohl
 * die Beispieldaten kein Excel brauchen. Inhalt unverändert verschoben.
 */
import { loadDemoStreets, loadPlzCentroids, loadPlzPlaces } from './geocode.js';
import { applyDemoStreets, demoCustomerIdentity } from '../core/demoSafety.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ruhige, aber glaubwürdige Besuchslage für die Demo: exakt jeder zwanzigste
 * Kunde ist fällig oder überfällig. Die übrigen 95 % liegen im Rhythmus.
 */
export function demoVisitSchedule(index, rhythmusWochen, now = new Date()) {
    const rhythmDays = Math.max(1, Number(rhythmusWochen) || 6) * 7;
    const overdue = index > 0 && index % 40 === 0;
    const due = index % 40 === 20;
    const daysAgo = overdue ? rhythmDays + 5 : due ? rhythmDays - 3 : Math.min(14, rhythmDays - 10);
    const date = new Date(now.getTime() - Math.max(1, daysAgo) * DAY_MS);
    return {
        status: overdue ? 'ueberfaellig' : due ? 'faellig' : 'ok',
        besuche: [date.toISOString().slice(0, 10)]
    };
}

/**
 * Umfangreiche, flächendeckende Demodaten.
 * Hierarchie: Channel „Digital" → Vertriebsgruppe (Nord/Ost/Süd) →
 * Vertriebsbezirk (viele, je eine Farbe). Jeder Bezirk ist ein zusammenhängendes
 * Gebiet aus mehreren Landkreisen – realisiert über eine Nächster-Anker-Zuordnung
 * (Voronoi) aller echten deutschen PLZ zu Bezirks-Ankern. So füllt sich ganz
 * Deutschland; die Färbung hängt am Vertriebsbezirk.
 */
export function createDemoCustomers(centroids, places) {
    // Bezirks-Anker (Name, Vertriebsgruppe, optionaler VB, Position)
    const anchors = [
        // Nord (inkl. West)
        { name: 'Bezirk Hamburg-Küste',   gruppe: 'Nord', vb: 'Lena Krüger',    lat: 53.55, lng: 9.99 },
        { name: 'Bezirk Bremen-Weser',    gruppe: 'Nord', vb: '',               lat: 53.08, lng: 8.80 },
        { name: 'Bezirk Hannover-Leine',  gruppe: 'Nord', vb: 'Jonas Weber',    lat: 52.37, lng: 9.73 },
        { name: 'Bezirk Ruhr-Dortmund',   gruppe: 'Nord', vb: 'Max Mustermann', lat: 51.51, lng: 7.47 },
        { name: 'Bezirk Rheinland-Köln',  gruppe: 'Nord', vb: 'Max Mustermann', lat: 50.94, lng: 6.96 },
        // Ost
        { name: 'Bezirk Berlin-Spree',    gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.52, lng: 13.40 },
        { name: 'Bezirk Rostock-Ostsee',  gruppe: 'Ost',  vb: '',               lat: 54.09, lng: 12.13 },
        { name: 'Bezirk Magdeburg-Elbe',  gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.13, lng: 11.63 },
        { name: 'Bezirk Leipzig-Sachsen', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.34, lng: 12.37 },
        { name: 'Bezirk Dresden-Elbland', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.05, lng: 13.74 },
        // Süd (inkl. Mitte)
        { name: 'Bezirk Frankfurt-Main',  gruppe: 'Süd',  vb: 'Sofia Richter',  lat: 50.11, lng: 8.68 },
        { name: 'Bezirk Stuttgart-Neckar', gruppe: 'Süd', vb: 'Sofia Richter',  lat: 48.78, lng: 9.18 },
        { name: 'Bezirk Freiburg-Schwarzwald', gruppe: 'Süd', vb: '',           lat: 48.00, lng: 7.85 },
        { name: 'Bezirk Franken-Nürnberg', gruppe: 'Süd', vb: 'Anna Beispiel',  lat: 49.45, lng: 11.08 },
        { name: 'Bezirk München-Oberbayern', gruppe: 'Süd', vb: 'Anna Beispiel', lat: 48.14, lng: 11.58 }
    ];

    // Jede PLZ dem nächstgelegenen Anker zuordnen (Voronoi -> zusammenhängende Bezirke)
    const pools = anchors.map(() => []);
    for (const plz in centroids) {
        if (!places[plz]) continue;
        const [la, ln] = centroids[plz];
        let best = 0, bestD = Infinity;
        for (let a = 0; a < anchors.length; a++) {
            const dl = la - anchors[a].lat, dn = ln - anchors[a].lng;
            const d = dl * dl + dn * dn;
            if (d < bestD) { bestD = d; best = a; }
        }
        pools[best].push(plz);
    }

    // Deterministischer Pseudo-Zufall, damit die Demo bei jedem Laden gleich aussieht
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    const branchen = ['Autohaus', 'Bäckerei', 'Metallbau', 'Getränke', 'MedTech', 'Baustoffe', 'Elektro', 'Logistik', 'Hotel', 'Feinkost', 'Werkzeuge', 'Maschinenbau', 'Sanitär', 'Druckerei', 'Gartenbau', 'Fliesen', 'Dachdecker', 'Kfz-Service', 'Textil', 'Optik'];
    const umsatzChoices = [24000, 33000, 48000, 61000, 79000, 104000, 138000, 176000, 224000, 295000, 360000];
    const rhythmChoices = [4, 6, 6, 8, 12];
    const PER_BEZIRK = 150;
    const out = [];
    let i = 0;
    anchors.forEach((anchor, ai) => {
        const pool = pools[ai];
        if (pool.length === 0) return;
        for (let n = 0; n < PER_BEZIRK; n++) {
            const plz = pool[Math.floor(rnd() * pool.length)];
            const identity = demoCustomerIdentity(i, pick(branchen));
            // Die frühere Namens- und Straßenwahl verbrauchte vier Zufallswerte.
            // Weiterziehen erhält die bewährte geografische Demo-Verteilung.
            rnd(); rnd(); rnd(); rnd();
            const rhythmusWochen = rhythmChoices[i % rhythmChoices.length];
            const { besuche } = demoVisitSchedule(i, rhythmusWochen);
            out.push({
                id: `demo-${i}`,
                nummer: String(20000 + i),
                ...identity,
                strasse: '',
                plz,
                ort: places[plz] || '',
                vb: anchor.vb,
                channel: 'Digital',
                gruppe: anchor.gruppe,
                bezirk: anchor.name,
                umsatz: pick(umsatzChoices),
                rhythmusWochen,
                besuche,
                lat: null, lng: null, geo: 'none'
            });
            i++;
        }
    });
    return out;
}

export async function demoCustomers() {
    const [centroids, places, streets] = await Promise.all([loadPlzCentroids(), loadPlzPlaces(), loadDemoStreets()]);
    const customers = createDemoCustomers(centroids, places);
    applyDemoStreets(customers, streets);
    return customers;
}
