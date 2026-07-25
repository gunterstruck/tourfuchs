import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: './',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 3000,
        open: true
    },
    plugins: [
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['icons/favicon.svg'],
            manifest: {
                id: '/',
                name: 'TourFuchs Vertrieb',
                short_name: 'TourFuchs',
                description: 'Kundenlisten aus Excel auf der Deutschlandkarte: Vertriebsgebiete, Besuchsplanung und Servicevertrags-Radar.',
                lang: 'de',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#f8fafc',
                theme_color: '#0d9488',
                categories: ['business', 'productivity', 'navigation'],
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ],
                // Ohne Screenshot zeigt der Browser nur den kargen Installations-
                // Dialog; mit Screenshot die ausführliche App-Karte.
                screenshots: [
                    {
                        src: '/og-image.png',
                        sizes: '1200x630',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Kunden und Vertriebsgebiete auf der Deutschlandkarte'
                    }
                ],
                // Long-Press auf das App-Icon: direkt in die Aufgabe statt auf den Start.
                shortcuts: [
                    {
                        name: 'Meine Tour',
                        short_name: 'Tour',
                        description: 'Tagestour planen und navigieren',
                        url: '/?start=tour',
                        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
                    },
                    {
                        name: 'Kunden in der Nähe',
                        short_name: 'In der Nähe',
                        description: 'Wen könnte ich hier noch besuchen?',
                        url: '/?start=nearby',
                        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
                    },
                    {
                        name: 'Liste importieren',
                        short_name: 'Import',
                        description: 'Excel-/CSV-Liste laden oder einfügen',
                        url: '/?start=import',
                        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
                    }
                ],
                // Doppelklick auf eine Kundenliste im Explorer/Finder öffnet TourFuchs.
                file_handlers: [
                    {
                        action: '/',
                        accept: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                            'application/vnd.ms-excel': ['.xls'],
                            'text/csv': ['.csv']
                        },
                        launch_type: 'single-client'
                    }
                ],
                // Android: Excel-Anhang aus Outlook/Drive per „Teilen" an TourFuchs.
                // Der POST wird im Service Worker abgefangen (public/share-target.js).
                share_target: {
                    action: '/share-target',
                    method: 'POST',
                    enctype: 'multipart/form-data',
                    params: {
                        files: [{
                            name: 'file',
                            accept: [
                                '.xlsx', '.xls', '.csv',
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                'application/vnd.ms-excel',
                                'text/csv'
                            ]
                        }]
                    }
                },
                // Eine geteilte Datei soll die laufende App weiterverwenden,
                // statt ein zweites Fenster mit leerem Zustand zu öffnen.
                launch_handler: { client_mode: 'navigate-existing' }
            },
            workbox: {
                // Eigener Fetch-Handler für das Android-Teilen-Ziel. Wird vor der
                // Workbox-Routenkonfiguration eingebunden, damit der POST auf
                // /share-target zuerst greift.
                importScripts: ['share-target.js'],
                // Der Handler wird importiert, nicht als Seite geladen.
                globIgnores: ['share-target.js'],
                // App-Shell + kleine Gebietsdaten vorab cachen (offline-fähig ab dem ersten Besuch)
                globPatterns: [
                    '**/*.{js,css,html,svg,png,woff2,xlsx,csv}',
                    'geodata/kreise.geojson',
                    'geodata/plz1.geojson',
                    'geodata/plz2.geojson',
                    'geodata/plz-centroids.json',
                    'geodata/plz-places.json'
                ],
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // große PLZ-Ebenen (3-/5-stellig): beim ersten Gebrauch cachen
                        urlPattern: /\/geodata\/plz[35]\.geojson$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'geodata-large',
                            expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 90 }
                        }
                    },
                    {
                        // Karten-Tiles: zuletzt gesehene Ausschnitte offline verfügbar
                        urlPattern: /^https:\/\/[a-z]\.basemaps\.cartocdn\.com\/.*/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'map-tiles',
                            expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] }
                        }
                    }
                ]
            }
        })
    ]
});
