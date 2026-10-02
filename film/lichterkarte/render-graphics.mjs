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
const geo = {};
for (const layout of ['phone', 'desktop']) {
    const size = layout === 'phone' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
    const p = await b.newPage({ viewport: size });
    const parts = [['bg'], ['frame'], ['intro'], ['outro'], ['mask'], ...['lights', 'zoom', 'tap', 'out'].map((s) => ['text', s])];
    for (const [part, scene] of parts) {
        await p.goto(`${stage}?layout=${layout}&part=${part}&scene=${scene || ''}`);
        await p.evaluate(() => window.ready);
        geo[layout] = await p.evaluate(() => window.GEO);
        if (part === 'mask') await p.setViewportSize({ width: geo[layout].screen.w, height: geo[layout].screen.h });
        await p.screenshot({ path: join(out, `${layout}-${part}${scene ? '-' + scene : ''}.png`), omitBackground: part === 'frame' || part === 'text' });
        await p.setViewportSize(size);
    }
    await p.close();
}
writeFileSync(join(out, 'geo.json'), JSON.stringify(geo, null, 2));
console.log('Grafiken gerendert:', readdirSync(out).length - 1);
await b.close();
