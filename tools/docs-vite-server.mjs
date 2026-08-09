/** Lokaler App-Server für Browser-Prüfung und Dokumentationsbilder. */
import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 4173);
const server = await createServer({
    configFile: false,
    root,
    publicDir: resolve(root, 'public'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false }
});
await server.listen();

const stop = async () => {
    await server.close();
    process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
