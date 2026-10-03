// Werbefilm Serie 2, Woche 4 „Deine Bezirke. Im Griff.“ – Aufnahme (Querformat, GeoFuchs).
// Szenen: Lichterkarte → farbige Vertriebsbezirke → Fläche anklicken (Zahlen) →
// Gebiets-Cockpit (ausgewogen? Top/Flop).
//
// Aufruf: node film/lichterkarte/record-bezirke.mjs <ordner> <app-url>
import { clickOn, glide, openApp, ring, sleep, startRecording } from './recorder.mjs';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const { b, ctx, p } = await openApp(appUrl, { mode: 'gebietsplanung' });
const mapApi = '/src/features/map.js';
const GERMANY = { center: [51.2, 10.4], zoom: 6 };
const SOUTH = { center: [48.75, 10.6], zoom: 7.4 };

const setSelect = (id, value) => p.evaluate(({ id, value }) => {
    const s = document.getElementById(id);
    s.value = value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
}, { id, value });
const view = (v, animate = false, duration = 2.2) => p.evaluate(async ({ api, v, animate, duration }) => {
    const { getMap } = await import(api);
    if (animate) getMap().flyTo(v.center, v.zoom, { duration });
    else getMap().setView(v.center, v.zoom, { animate: false });
}, { api: mapApi, v, animate, duration });
const veil = (on, ms = 450) => p.evaluate(({ on, ms }) => {
    let v = document.getElementById('film-veil');
    if (!v) {
        const m = document.getElementById('map').getBoundingClientRect();
        v = document.createElement('div');
        v.id = 'film-veil';
        v.style.cssText = `position:fixed;left:${m.left}px;top:${m.top}px;width:${m.width}px;height:${m.height}px;`
            + 'background:#0b0a14;opacity:0;z-index:1200;pointer-events:none';
        document.body.appendChild(v);
    }
    v.style.transition = `opacity ${ms}ms ease`;
    requestAnimationFrame(() => { v.style.opacity = on ? '1' : '0'; });
}, { on, ms });

// Bühne: volle Karte, Lichterkarte, Bezirksflächen vorbereitet (für den späteren Wechsel).
await p.evaluate(() => document.documentElement.classList.add('film-hide-side'));
await setSelect('colormode-select', 'bezirk');
await view(GERMANY);
await sleep(1500);
// Kacheln für beide Ansichten vorab laden.
await setSelect('basemap-select', 'standard');
await view(SOUTH);
await sleep(4000);
await view(GERMANY);
await sleep(3000);
await setSelect('basemap-select', 'lights');
await sleep(3000);
await glide(p, 1060, 640, 2);

const rec = await startRecording(ctx, p, `${outDir}/rec-bezirke`);
await sleep(500);

// 1) Viele Lichter.
rec.mark('lights');
await sleep(4800);

// 2) Hinter den Lichtern: die Bezirke.
rec.mark('areas');
await veil(true);
await sleep(500);
await setSelect('basemap-select', 'standard');
await sleep(900);
await veil(false, 700);
await sleep(1600);
await view(SOUTH, true, 2.4);
await sleep(3000);

// 3) Die Bezirkskachel anklicken – Kunden, Umsatz, stärkste Standorte.
rec.mark('detail');
const tile = await p.evaluate(() => {
    const t = [...document.querySelectorAll('.territory-label-wrapper')].find((e) => /München-Oberbayern/.test(e.textContent));
    const r = t?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
});
if (!tile) throw new Error('Bezirkskachel München-Oberbayern nicht gefunden');
await glide(p, tile.x, tile.y, 22);
await sleep(300);
await ring(p, tile.x, tile.y);
await p.mouse.click(tile.x, tile.y);
await sleep(4200);
const detail = await p.evaluate(() => document.getElementById('territory-summary-dialog')?.open ? document.querySelector('#territory-summary-dialog h2, #territory-summary-dialog h3')?.textContent : '');
if (!detail) throw new Error('Bezirks-Detailkarte hat sich nicht geöffnet');

// 4) Gebiets-Cockpit.
rec.mark('cockpit');
await p.evaluate(() => {
    document.getElementById('territory-summary-dialog')?.close();
    document.documentElement.classList.remove('film-hide-side');
    document.querySelector('.tab-button[data-tab="gebiete"]')?.click();
});
await sleep(600);
await clickOn(p, '#btn-cockpit', { steps: 18 });
await sleep(4600);
await rec.stop({ lead: 0.2 });
console.log('Detailkarte:', detail);
await b.close();
