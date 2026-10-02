// Nimmt die Lichterkarte in der echten App auf (Handy-Format, dunkler Stil).
// Szenen: Lichter gehen an → Flug ins Ruhrgebiet → Kunde antippen → zurück auf Deutschland.
// Speichert Einzelbilder, Zeitstempel (list.txt für ffmpeg) und Szenenmarken (marks.json).
//
// Aufruf: node film/lichterkarte/record.mjs <ordner> <app-url>
// Hinter einem TLS-prüfenden Proxy (Kartenkacheln): FILM_PROXY=<http://host:port>
// und FILM_PROXY_CA=<ca-bundle.pem> setzen.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;

function proxyArgs() {
    const ca = process.env.FILM_PROXY_CA;
    if (!ca) return [];
    const pins = readFileSync(ca, 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
        .map((pem) => createHash('sha256').update(new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    return [`--ignore-certificate-errors-spki-list=${pins.join(',')}`];
}
const launch = { args: ['--lang=de-DE', ...proxyArgs()] };
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
if (process.env.FILM_PROXY) launch.proxy = { server: process.env.FILM_PROXY, bypass: new URL(appUrl).hostname };

const b = await chromium.launch(launch);
const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'dark'
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.error('Browserfehler:', e.message));
await p.goto(appUrl);
await p.waitForSelector('#map');
await sleep(9000);
await p.locator('#btn-demo-welcome-ack').click().catch(() => {});
await sleep(600);
await p.evaluate(() => { if (document.body.classList.contains('sheet-open')) document.querySelector('#sheet-grip')?.click(); });
await sleep(800);

// Bühne: Lichterkarte, Blatt und Hinweise aus dem Bild, Lichter zunächst aus, Karte noch „Tag“.
await p.addStyleTag({ content: `
    .sidebar, .toasts, #toasts, .mobile-preview-hint, .context-help, .first-steps-float { visibility: hidden !important; }
    .leaflet-layer.basemap-lights { transition: filter 2.6s ease-in-out; }
    html.film-day .leaflet-layer.basemap-lights { filter: brightness(0.95) saturate(0.9) contrast(1) !important; }
    .leaflet-lights-pane canvas {
        -webkit-mask-image: linear-gradient(to left, #000 calc(var(--sweep, 140%) - 30%), transparent var(--sweep, 140%));
        mask-image: linear-gradient(to left, #000 calc(var(--sweep, 140%) - 30%), transparent var(--sweep, 140%));
    }
    .film-tap { position: fixed; z-index: 99999; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
        border: 3px solid rgba(255,255,255,.95); box-shadow: 0 0 18px rgba(253,224,71,.8); pointer-events: none;
        animation: film-tap 0.9s ease-out forwards; }
    @keyframes film-tap { 0% { transform: scale(.4); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
` });
await p.evaluate(() => {
    const s = document.getElementById('basemap-select');
    s.value = 'lights';
    s.dispatchEvent(new Event('change', { bubbles: true }));
});
await sleep(1500);

const mapApi = '/src/features/map.js';
const home = await p.evaluate(async (api) => {
    const { getMap } = await import(api);
    const m = getMap();
    return { center: m.getCenter(), zoom: m.getZoom() };
}, mapApi);
const TARGET = { center: [51.38, 7.08], zoom: 9.6 };

// Kacheln vorab laden: denselben Weg einmal ohne Kamera fliegen.
await p.evaluate(async ({ api, t }) => {
    const { getMap } = await import(api);
    const m = getMap();
    m.flyTo(t.center, t.zoom, { duration: 1.5 });
}, { api: mapApi, t: TARGET });
await sleep(6000);
// … und den Rückflug, damit beim Herauszoomen keine Kacheln fehlen.
await p.evaluate(async ({ api, h }) => {
    const { getMap } = await import(api);
    getMap().flyTo(h.center, h.zoom, { duration: 3.2 });
}, { api: mapApi, h: home });
await sleep(7000);
await p.evaluate(async ({ api, h }) => {
    const { getMap } = await import(api);
    getMap().setView(h.center, h.zoom, { animate: false });
}, { api: mapApi, h: home });
await sleep(3000);
await p.evaluate(() => {
    document.documentElement.classList.add('film-day');
    document.documentElement.style.setProperty('--sweep', '-5%');
});
await sleep(2800);

// Aufnahme
const dir = `${outDir}/rec`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
    const file = `${dir}/f${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* Ende */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
const marks = {};
await sleep(700);

// 1) Deutschland wird Nacht, die Lichter gehen von Ost nach West an.
marks.lights = now();
await p.evaluate(() => {
    document.documentElement.classList.remove('film-day');
    const start = performance.now() + 700, dur = 3600;
    const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    const step = (t) => {
        const k = Math.min(1, Math.max(0, (t - start) / dur));
        document.documentElement.style.setProperty('--sweep', `${-5 + ease(k) * 145}%`);
        if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
});
await sleep(6200);

// 2) Flug ins Ruhrgebiet.
marks.zoom = now();
await p.evaluate(async ({ api, t }) => {
    const { getMap } = await import(api);
    getMap().flyTo(t.center, t.zoom, { duration: 3.6 });
}, { api: mapApi, t: TARGET });
await sleep(5200);

// 3) Einen Kunden antippen (überfällig, damit der Status sichtbar wird).
marks.tap = now();
const target = await p.evaluate(async (api) => {
    const { getMap, customersOnMap } = await import(api);
    const { visitStatus } = await import('/src/features/visits.js');
    const m = getMap();
    const rect = m.getContainer().getBoundingClientRect();
    const want = { x: 200, y: 480 };
    const cands = customersOnMap().map((c) => ({ c, pt: m.latLngToContainerPoint([c.lat, c.lng]) }))
        .filter(({ pt }) => pt.x > 120 && pt.x < 280 && pt.y > 400 && pt.y < 540);
    const score = ({ c, pt }) => Math.hypot(pt.x - want.x, pt.y - want.y) - (visitStatus(c) === 'ueberfaellig' ? 50 : 0);
    cands.sort((a, b) => score(a) - score(b));
    const pick = cands[0];
    return pick ? { x: rect.left + pick.pt.x, y: rect.top + pick.pt.y, name: pick.c.name } : null;
}, mapApi);
if (!target) throw new Error('Kein Kunde zum Antippen gefunden');
await sleep(500);
await p.evaluate(({ x, y }) => {
    const ring = document.createElement('div');
    ring.className = 'film-tap';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);
}, target);
await sleep(250);
await p.mouse.click(target.x, target.y);
await sleep(4600);
const opened = await p.evaluate(() => document.querySelector('.popup-customer h3')?.textContent || '');
if (!opened) throw new Error('Popup hat sich nicht geöffnet');

// 4) Zurück auf ganz Deutschland – als weiche Überblendung statt Flug: Am Handy
//    lädt Leaflet Kacheln erst nach einer Bewegung, ein Herauszoom-Flug zeigte
//    sonst eine schrumpfende Karte vor schwarzem Grund.
marks.out = now();
await p.evaluate(() => {
    const m = document.getElementById('map').getBoundingClientRect();
    const veil = document.createElement('div');
    veil.id = 'film-veil';
    veil.style.cssText = `position:fixed;left:${m.left}px;top:${m.top}px;width:${m.width}px;height:${m.height}px;`
        + 'background:#0b0a14;opacity:0;transition:opacity .55s ease;z-index:1200;pointer-events:none';
    document.body.appendChild(veil);
    requestAnimationFrame(() => { veil.style.opacity = '1'; });
});
await sleep(650);
await p.evaluate(async ({ api, h }) => {
    const { getMap } = await import(api);
    const m = getMap();
    m.closePopup();
    m.setView(h.center, h.zoom, { animate: false });
}, { api: mapApi, h: home });
await sleep(900);
await p.evaluate(() => {
    const veil = document.getElementById('film-veil');
    veil.style.transition = 'opacity .9s ease';
    veil.style.opacity = '0';
});
await sleep(3900);
marks.done = now();
await sleep(300);
await cdp.send('Page.stopScreencast');

const end = frames[frames.length - 1].t + 0.04;
let list = '';
frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
});
list += `file '${frames[frames.length - 1].file}'\n`;
writeFileSync(`${dir}/list.txt`, list);
const t0 = frames[0].t;
const rel = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +(v - t0).toFixed(3)]));
writeFileSync(`${dir}/marks.json`, JSON.stringify(rel, null, 2));
console.log('Bilder', frames.length, 'Marken', JSON.stringify(rel), 'Kunde', target.name, '→', opened);
await b.close();
