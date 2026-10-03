// Werbefilm Serie 2, Woche 5 „Gebiete umverteilen. In Minuten.“ – Aufnahme (Querformat, GeoFuchs).
// Szenen: Cockpit → Was-wäre-wenn aufklappen → Augsburg (2 Landkreise) auswählen,
// Ziel Stuttgart-Neckar → zuweisen, Kennzahlen ändern sich → Alt/Neu auf der Karte.
// Es bleibt eine Simulation: „Zuweisung übernehmen“ wird nicht geklickt.
//
// Aufruf: node film/lichterkarte/record-umverteilen.mjs <ordner> <app-url>
import { clickOn, glide, openApp, ring, sleep, startRecording } from './recorder.mjs';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const { b, ctx, p } = await openApp(appUrl, { mode: 'gebietsplanung' });
const mapApi = '/src/features/map.js';
const SOUTH = { center: [48.75, 10.6], zoom: 7.4 };
const AUGSBURG = { center: [48.45, 10.4], zoom: 8.6 };

const setSelect = (id, value) => p.evaluate(({ id, value }) => {
    const s = document.getElementById(id);
    s.value = value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
}, { id, value });
const view = (v) => p.evaluate(async ({ api, v }) => {
    const { getMap } = await import(api);
    getMap().setView(v.center, v.zoom, { animate: false });
}, { api: mapApi, v });
/** Zum Auswahlfeld gleiten, Ring zeigen, Wert setzen (native Listen zeigt der Mitschnitt nicht). */
async function choose(id, value) {
    const box = await p.locator(`#${id}`).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await glide(p, x, y, 16);
    await sleep(250);
    await ring(p, x, y);
    await setSelect(id, value);
    await sleep(500);
}
const scrollCockpit = (selector, block = 'start') => p.evaluate(({ selector, block }) => {
    document.querySelector(selector)?.scrollIntoView({ block, behavior: 'smooth' });
}, { selector, block });

// Bühne: Bezirksflächen im Süden, Seitenleiste mit „Gebiete“.
await setSelect('colormode-select', 'bezirk');
await view(AUGSBURG);
await sleep(3500);
await view(SOUTH);
await sleep(3500);
await p.evaluate(() => document.querySelector('.tab-button[data-tab="gebiete"]')?.click());
await sleep(600);
await p.evaluate(() => document.getElementById('btn-cockpit')?.scrollIntoView({ block: 'center' }));
await glide(p, 1060, 640, 2);

const rec = await startRecording(ctx, p, `${outDir}/rec-umverteilen`);
await sleep(500);

// 1) Was wäre, wenn …? – Cockpit öffnen, Simulation aufklappen.
rec.mark('whatif');
await clickOn(p, '#btn-cockpit', { steps: 20 });
await sleep(1600);
await clickOn(p, '#simulation-panel > summary', { steps: 18 });
await sleep(500);
await scrollCockpit('#simulation-panel');
await sleep(1700);

// 2) Augsburg nach Stuttgart.
rec.mark('pick');
await choose('sim-level', 'kreise');
await clickOn(p, '#sim-search', { steps: 14 });
await p.keyboard.type('Augsburg', { delay: 80 });
await sleep(900);
await clickOn(p, '#sim-select-all', { steps: 14 });
await sleep(700);
await choose('sim-rep', 'Bezirk Stuttgart-Neckar');
await sleep(500);

// 3) Zuweisen – Wirkung sofort sichtbar.
rec.mark('effect');
await clickOn(p, '#sim-apply', { steps: 14 });
await sleep(1800);
const changes = await p.evaluate(() => document.getElementById('sim-changes')?.innerText || '');
if (!/8 Kunden/.test(changes)) throw new Error(`Simulation nicht wie erwartet: ${changes.slice(0, 120)}`);
await scrollCockpit('#cockpit-summary', 'start');
await sleep(3200);

// 4) Alt und Neu auf der Karte.
rec.mark('map');
await clickOn(p, '#cockpit-to-map', { steps: 18 });
await sleep(700);
await p.evaluate(() => document.documentElement.classList.add('film-hide-side'));
await p.evaluate(async ({ api, v }) => {
    const { getMap } = await import(api);
    getMap().flyTo(v.center, v.zoom, { duration: 1.6 });
}, { api: mapApi, v: AUGSBURG });
await sleep(2200);
const seg = (label) => p.evaluate((label) => {
    const btn = [...document.querySelectorAll('button.seg')].find((x) => x.textContent.trim() === label && x.offsetParent);
    const r = btn?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}, label);
for (const label of ['Alt', 'Neu', 'Änderungen']) {
    const s = await seg(label);
    if (!s) throw new Error(`Umschalter „${label}“ fehlt`);
    await glide(p, s.x, s.y, 12);
    await sleep(200);
    await ring(p, s.x, s.y);
    await p.mouse.click(s.x, s.y);
    await sleep(label === 'Änderungen' ? 2600 : 1500);
}
await rec.stop({ lead: 0.2 });
console.log('Simulation:', changes.split('\n')[0]);
await b.close();
