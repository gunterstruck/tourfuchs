/**
 * Erzeugt leichte WebP-Vorschauen für die Bildanzeige im Custom GPT.
 * Die hochauflösenden PNG-Dateien bleiben als Originale erhalten.
 *
 * Aufruf:
 *   npm run docs:previews
 *
 * Voraussetzung:
 *   `cwebp` im PATH oder CWEBP_PATH=/pfad/zu/cwebp
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_DIR = resolve(ROOT, 'public/docs/screenshots');
const CWEBP = process.env.CWEBP_PATH || 'cwebp';
const MAX_WIDTH = 960;
const QUALITY = 80;

function pngDimensions(path) {
    const png = readFileSync(path);
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const pngNames = readdirSync(IMAGE_DIR).filter((name) => name.endsWith('.png')).sort();
let originalBytes = 0;
let previewBytes = 0;

for (const name of pngNames) {
    const input = resolve(IMAGE_DIR, name);
    const output = resolve(IMAGE_DIR, name.replace(/\.png$/i, '-preview.webp'));
    const { width } = pngDimensions(input);
    const args = ['-quiet', '-mt', '-m', '6', '-q', String(QUALITY)];
    if (width > MAX_WIDTH) args.push('-resize', String(MAX_WIDTH), '0');
    args.push(input, '-o', output);
    try {
        execFileSync(CWEBP, args, { stdio: 'inherit' });
    } catch (error) {
        throw new Error(`WebP-Vorschau fehlgeschlagen. Ist cwebp installiert? (${error.message})`);
    }
    const inputSize = statSync(input).size;
    const outputSize = statSync(output).size;
    originalBytes += inputSize;
    previewBytes += outputSize;
    console.log(`${name} -> ${output.split('/').pop()} (${Math.round(outputSize / 1024)} KB)`);
}

const saving = originalBytes ? Math.round((1 - previewBytes / originalBytes) * 100) : 0;
console.log(
    `${pngNames.length} WebP-Vorschauen: ${(previewBytes / 1048576).toFixed(2)} MiB ` +
    `statt ${(originalBytes / 1048576).toFixed(2)} MiB (${saving}% kleiner).`,
);
