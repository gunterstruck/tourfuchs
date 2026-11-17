// Offline authoring tool. Piper/model stay on the author's machine, not in the app.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { speechTexts } from './speech-texts.mjs';

const output = resolve('public/audio/thorsten');
const scratch = resolve('.speech-build');
mkdirSync(output, { recursive: true });
mkdirSync(scratch, { recursive: true });
const run = (bin, args, input) => new Promise((resolveRun, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-2000); });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(error)));
    child.stdin.end(input);
});
if (!process.env.PIPER_MODEL) throw new Error('PIPER_MODEL and PIPER_BIN required');
const manifest = {};
for (const text of speechTexts()) {
    const hash = createHash('sha256').update(text).digest('hex');
    const file = `${hash}.mp3`;
    manifest[text] = file;
    if (existsSync(join(output, file))) continue;
    const wav = join(scratch, `${hash}.wav`);
    await run(process.env.PIPER_BIN || 'piper', ['-m', process.env.PIPER_MODEL, '-f', wav,
        '--length_scale', '1.02', '--sentence_silence', '0.26'], text.replace(/[①②③④📋🦊]/gu, '').trim() + '\n');
    await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ar', '22050', join(output, file)]);
    console.log(`Thorsten: ${Object.keys(manifest).length} ${text.slice(0, 55)}`);
}
await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '0.15', '-codec:a', 'libmp3lame', join(output, 'ready.mp3')]);
writeFileSync(join(output, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest).length} training sentences ready.`);
