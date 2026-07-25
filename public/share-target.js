/**
 * Teilen-Ziel (Android): „Excel-Anhang → Teilen → TourFuchs".
 *
 * Der Browser schickt die geteilte Datei als POST an /share-target. Es gibt
 * keinen Server, der das entgegennehmen könnte – und genau deshalb ist es hier
 * richtig aufgehoben: Der Service Worker fängt den POST ab, legt die Datei in
 * einen lokalen Cache und leitet die App auf `/?share=1` um. Die Datei verlässt
 * das Gerät zu keinem Zeitpunkt.
 *
 * Wird über `workbox.importScripts` in den generierten Service Worker gezogen
 * und registriert seinen Fetch-Handler vor den Workbox-Routen.
 */

const SHARE_CACHE = 'tf-share-inbox';
const SHARE_ENTRY = '/__shared-import';

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'POST') return;

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }
    if (url.pathname !== '/share-target') return;

    event.respondWith((async () => {
        try {
            const form = await request.formData();
            const file = form.get('file')
                || form.getAll('file')[0]
                || form.getAll('files')[0];
            if (file && typeof file.arrayBuffer === 'function') {
                const cache = await caches.open(SHARE_CACHE);
                await cache.put(SHARE_ENTRY, new Response(file, {
                    headers: {
                        'content-type': file.type || 'application/octet-stream',
                        // Dateiname headertauglich ablegen (Umlaute, Leerzeichen)
                        'x-tf-filename': encodeURIComponent(file.name || 'geteilte-liste.xlsx')
                    }
                }));
            }
        } catch {
            // Nicht lesbare Freigabe: Die App zeigt danach schlicht den normalen
            // Startbildschirm statt eines Fehlers aus dem Nichts.
        }
        return Response.redirect('/?share=1', 303);
    })());
});
