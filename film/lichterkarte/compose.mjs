// Setzt den Werbefilm „Lichterkarte“ zusammen: Intro → App im Handyrahmen mit
// Szenentexten → Abschluss, mit Musik. 1080 × 1920, H.264/AAC, unter 30 Sekunden
// (WhatsApp-Status).
// Aufruf: node film/lichterkarte/compose.mjs <grafik-ordner> <aufnahme-ordner> <ausgabe.mp4>
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [,, gfx, rec, out] = process.argv;
const geo = JSON.parse(readFileSync(join(gfx, 'geo.json')));
const marks = JSON.parse(readFileSync(join(rec, 'marks.json')));
const music = resolve(here, '../../public/audio/tropical-island-house-2024.mp3');
const s = geo.screen;

const INTRO = 2.5, OUTRO = 4.0, XF = 0.5, TF = 0.35;
// Kurz vor dem Einbruch der Nacht beginnen: Die Karte ist noch „Tag“.
const start = Math.max(0, marks.lights - 0.35);
const main = +(marks.done - start).toFixed(2);
const at = (n) => +(marks[n] - start).toFixed(2);
const texts = [
    ['lights', 0, at('zoom')],
    ['zoom', at('zoom'), at('tap')],
    ['tap', at('tap'), at('out')],
    ['out', at('out'), main],
];
const total = +(INTRO + main + OUTRO - 2 * XF).toFixed(2);
if (total > 30) throw new Error(`Film zu lang für den WhatsApp-Status: ${total} s`);

const loop = (file, t) => ['-loop', '1', '-t', String(t), '-i', join(gfx, file)];
const inputs = [
    ...loop('intro.png', INTRO),                                   // 0
    ...loop('bg.png', main),                                       // 1
    '-f', 'concat', '-safe', '0', '-i', join(rec, 'list.txt'),     // 2
    ...loop('mask.png', main),                                     // 3
    ...loop('frame.png', main),                                    // 4
    ...texts.flatMap(([n]) => loop(`text-${n}.png`, main)),        // 5–8
    ...loop('outro.png', OUTRO),                                   // 9
    '-i', music,                                                   // 10
];

const f = [];
f.push('[0]fps=30,format=yuv420p,setsar=1[intro]');
f.push(`[2]trim=start=${start}:duration=${main},setpts=PTS-STARTPTS,fps=30,scale=${s.w}:${s.h}:flags=lanczos,format=rgba[app0]`);
f.push(`[3]fps=30,format=gray,scale=${s.w}:${s.h}[mask]`);
f.push('[app0][mask]alphamerge[app]');
f.push('[1]fps=30,format=rgba[bg]');
f.push(`[bg][app]overlay=${s.x}:${s.y}:shortest=1[m1]`);
f.push('[m1][4]overlay=0:0:shortest=1[m2]');
let last = 'm2';
texts.forEach(([, a, b], i) => {
    const fadeIn = i === 0 ? `,fade=t=in:st=0.4:d=0.5:alpha=1` : `,fade=t=in:st=${a}:d=${TF}:alpha=1`;
    const fadeOut = i === texts.length - 1 ? '' : `,fade=t=out:st=${Math.max(0, b - TF)}:d=${TF}:alpha=1`;
    f.push(`[${5 + i}]fps=30,format=rgba${fadeIn}${fadeOut}[t${i}]`);
    f.push(`[${last}][t${i}]overlay=0:0:enable='between(t,${Math.max(0, a - 0.01)},${b})'[m${3 + i}]`);
    last = `m${3 + i}`;
});
f.push(`[${last}]format=yuv420p,setsar=1[main]`);
f.push('[9]fps=30,format=yuv420p,setsar=1[outro]');
f.push(`[intro][main]xfade=transition=fade:duration=${XF}:offset=${INTRO - XF}[x1]`);
f.push(`[x1][outro]xfade=transition=fade:duration=${XF}:offset=${(INTRO + main - 2 * XF).toFixed(2)}[v]`);
f.push(`[10]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.6,afade=t=in:d=0.8,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[a]`);

execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs,
    '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[a]', '-t', String(total),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '21',
    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(out, `${total} s`, `${(statSync(out).size / 1e6).toFixed(1)} MB`, JSON.stringify({ start, main, texts }));
