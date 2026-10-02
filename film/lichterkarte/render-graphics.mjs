// Rendert die Grafiken des Werbefilms „Lichterkarte“ aus stage.html zu PNGs.
// Aufruf: node film/lichterkarte/render-graphics.mjs <ausgabe-ordner>
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const stage = 'file://' + resolve(here, 'stage.html');
const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
const b = await chromium.launch(launch);
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const parts = [['bg'], ['frame'], ['intro'], ['outro'], ['mask'], ...['lights', 'zoom', 'tap', 'out'].map((s) => ['text', s])];
let geo = null;
for (const [part, scene] of parts) {
    await p.goto(`${stage}?part=${part}&scene=${scene || ''}`);
    await p.evaluate(() => window.ready);
    geo = await p.evaluate(() => window.GEO);
    if (part === 'mask') await p.setViewportSize({ width: geo.screen.w, height: geo.screen.h });
    await p.screenshot({ path: join(out, `${part}${scene ? '-' + scene : ''}.png`), omitBackground: part === 'frame' || part === 'text' });
    await p.setViewportSize({ width: 1080, height: 1920 });
}
writeFileSync(join(out, 'geo.json'), JSON.stringify(geo, null, 2));
console.log('Grafiken gerendert:', readdirSync(out).length - 1);
await b.close();
