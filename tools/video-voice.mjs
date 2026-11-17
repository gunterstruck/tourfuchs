// Recording only. Never send a demo or a customer record to a speech service.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function synthesize(text, file) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.env.PIPER_BIN || 'piper', ['-m', process.env.PIPER_MODEL, '-f', file,
            '--length_scale', '1.02', '--sentence_silence', '0.26']);
        let err = '';
        child.stdout.resume();
        child.stderr.on('data', chunk => { err = (err + chunk).slice(-1500); });
        child.on('error', reject);
        child.stdin.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(err)));
        child.stdin.end(text.replace(/[①②③④📋🦊]/gu, '').trim() + '\n', 'utf8');
    });
}

export function wavDuration(bytes) {
    let rate = 0;
    for (let i = 12; i + 8 <= bytes.length;) {
        const id = bytes.toString('ascii', i, i + 4), size = bytes.readUInt32LE(i + 4);
        if (id === 'fmt ') rate = bytes.readUInt32LE(i + 16);
        if (id === 'data' && rate && size && i + 8 + size <= bytes.length) return size / rate;
        i += 8 + size + (size % 2);
    }
    throw new Error('Unvollständige Sprecheraufnahme');
}

export async function recordVoice(page, folder, clock) {
    const cues = [];
    await page.exposeFunction('__tfFilmSpeech', async text => {
        const file = join(folder, createHash('sha256').update(text).digest('hex') + '.wav');
        if (!existsSync(file)) await synthesize(text, file);
        const seconds = wavDuration(readFileSync(file));
        cues.push({ text, file, seconds, start: clock() });
        await new Promise(resolve => setTimeout(resolve, seconds * 1000 + 150));
    });
    return cues;
}

const stamp = s => new Date(Math.round(s * 1000)).toISOString().slice(11,23).replace('.', ',');
export function narrationArgs(cues, subtitles, seconds) {
    if (!cues.length || cues.some((c,i) => c.start < 0 || c.start + c.seconds > seconds ||
        (i && cues[i-1].start + cues[i-1].seconds > c.start))) throw new Error('Fehlende oder überlappende Sprecherzeiten');
    writeFileSync(subtitles, cues.map((c,i) => `${i+1}\n${stamp(c.start)} --> ${stamp(c.start+c.seconds)}\n${c.text}\n`).join('\n'));
    const labels = cues.map((_,i) => `[s${i}]`);
    const parts = cues.map((c,i) => `[${i+2}:a]adelay=${Math.round(c.start*1000)}:all=1${labels[i]}`);
    parts.unshift(`[1:a]volume=0.15,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0,seconds-2.5)}:d=2.5[m]`);
    parts.push(`[m]${labels.join('')}amix=inputs=${1+cues.length}:normalize=0,alimiter=limit=0.95[a]`);
    return { inputs: [...cues.flatMap(c => ['-i', c.file]), '-i', subtitles],
        maps: ['-filter_complex',parts.join(';'),'-map','[a]','-map',`${2+cues.length}:s:0`,'-c:s','mov_text',
            '-metadata:s:s:0','language=deu','-metadata:s:a:0','language=deu'] };
}
