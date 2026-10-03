// Werbefilm Woche 2 „Dein Tag in 30 Sekunden“ – Aufnahme in der echten App (Querformat).
// Szenen: Gebiet mit dem Lasso umkreisen → alle in die Tour → Start setzen,
// Reihenfolge optimieren, Route → per QR aufs Handy.
//
// Aufruf: node film/lichterkarte/record-tour.mjs <ordner> <app-url>
import { clickOn, glide, openApp, sleep, startRecording } from './recorder.mjs';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const { b, ctx, p } = await openApp(appUrl);
const mapApi = '/src/features/map.js';
const VIEWPOINT = { center: [51.49, 7.36], zoom: 10.5 };

// Bühne: volle Karte, Seitenleiste zunächst ausgeblendet, Tour leer.
await p.evaluate(() => document.documentElement.classList.add('film-hide-side'));
await p.evaluate(async ({ api, v }) => {
    const { getMap } = await import(api);
    getMap().setView(v.center, v.zoom, { animate: false });
}, { api: mapApi, v: VIEWPOINT });
await sleep(4000);

// Lasso so legen, dass ein Tagespensum (6–8 Kunden) nahe der Kartenmitte liegt.
const RX = 150, RY = 105;
const spot = await p.evaluate(async ({ api, rx, ry }) => {
    const { getMap, customersOnMap } = await import(api);
    const m = getMap();
    const pts = customersOnMap().map((c) => m.latLngToContainerPoint([c.lat, c.lng]));
    let best = null;
    for (let x = 520; x <= 760; x += 20) for (let y = 260; y <= 440; y += 20) {
        const n = pts.filter((q) => ((q.x - x) / rx) ** 2 + ((q.y - y) / ry) ** 2 < 1).length;
        const d = Math.hypot(x - 640, y - 350);
        if (n >= 6 && n <= 8 && (!best || d < best.d)) best = { x, y, n, d };
    }
    return best;
}, { api: mapApi, rx: RX, ry: RY });
if (!spot) throw new Error('Keine passende Lasso-Stelle gefunden');
const mapTop = await p.evaluate(() => document.getElementById('map').getBoundingClientRect().top);
const cx = spot.x, cy = spot.y + mapTop;
const lasso = [];
for (let i = 0; i <= 44; i++) {
    const a = -Math.PI / 2 + (i / 44) * Math.PI * 2;
    lasso.push([cx + RX * Math.cos(a) * (1 + 0.07 * Math.sin(3 * a)), cy + RY * Math.sin(a) * (1 + 0.05 * Math.cos(2 * a))]);
}
await glide(p, 900, 600, 2);

const rec = await startRecording(ctx, p, `${outDir}/rec-tour`);
await sleep(600);

// 1) Lasso ziehen.
rec.mark('lasso');
await clickOn(p, '#btn-lasso', { steps: 22 });
await sleep(500);
await glide(p, lasso[0][0], lasso[0][1], 20);
await sleep(250);
await p.mouse.down();
for (const [x, y] of lasso) { await p.mouse.move(x, y, { steps: 2 }); await sleep(18); }
await p.mouse.up();
await sleep(2200);

// 2) Alle in die Tour, Auswahl schließen – die nummerierten Stopps bleiben.
rec.mark('add');
await clickOn(p, '[data-lasso="tour"]', { steps: 22 });
await sleep(1600);
await clickOn(p, '[data-lasso="clear"]', { steps: 14 });
await sleep(1300);

// 3) Startpunkt, Reihenfolge, Route.
rec.mark('route');
await p.evaluate(() => {
    document.documentElement.classList.remove('film-hide-side');
    const h = document.querySelector('[data-acc="start"] .acc-head');
    if (h?.getAttribute('aria-expanded') !== 'true') h.click();
});
await sleep(500);
await p.evaluate(() => document.querySelector('[data-acc="start"]')?.scrollIntoView({ block: 'start' }));
await sleep(300);
await clickOn(p, '#start-search', { steps: 20 });
await p.keyboard.type('Dortmund', { delay: 70 });
await sleep(700);
await clickOn(p, '#start-results [data-point="0"]', { steps: 14 });
await sleep(700);
await p.evaluate(() => {
    const h = document.querySelector('[data-acc="mytour"] .acc-head');
    if (h?.getAttribute('aria-expanded') !== 'true') h.click();
    document.querySelector('[data-acc="mytour"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
await sleep(900);
await clickOn(p, '#btn-optimize', { steps: 16 });
await sleep(900);
await clickOn(p, '#btn-route-focus', { steps: 12 });
await sleep(2400);
const summary = await p.evaluate(() => document.getElementById('tour-summary')?.textContent || '');
if (!/km/.test(summary)) throw new Error(`Keine Route: ${summary}`);

// 4) Per QR aufs Handy.
rec.mark('go');
await clickOn(p, '#btn-tour-qr', { steps: 14 });
await sleep(3400);
await rec.stop({ lead: 0.2 });
console.log('Lasso', spot.n, 'Kunden ·', summary.trim());
await b.close();
