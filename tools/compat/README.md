# Kompatibilitäts-Testdaten (Release 17.0)

Die Dateien in `tests/fixtures/umzug/` (Umzugsdateien `.tfsafe`) und
`tests/fixtures/tresor/` (Datentresore) wurden am 11.10.2026 **mit dem Code
der jeweiligen historischen Stände** erzeugt – nicht nachgebaut. Sie sind
eingefroren und dürfen nicht neu erzeugt werden: Sie stehen für Dateien und
Tresore, die Nutzer heute schon haben.

Geprüft werden sie doppelt:

1. `tests/safeTransferHistory.test.js` und `tests/vaultHistory.test.js`
   (Logik: entschlüsseln, vollständig übernehmen, Transportschäden, falsche
   Schlüssel/PIN),
2. `tools/smoke-check.mjs` (echter Browser: Datei + Schlüssel über die
   Oberfläche einlösen und nach dem Neuladen behalten; Tresor am
   Sperrbildschirm mit der alten PIN öffnen).

## Herkunft

| Datei | Commit | Stand |
|---|---|---|
| `umzug/…-2026-07-11-v1-kunden` | `3b0ea34` | erster Umzug: Kunden + Gebiete |
| `umzug/…-2026-07-11-v1-ohne-position` | `3b0ea34` | dito, ein Kunde ohne Koordinaten (`TFSAFE_NOCOORDS=1`) |
| `umzug/…-2026-07-17-v2-vertraege` | `3bc0ceb` | + Serviceverträge (schemaVersion 2) |
| `umzug/…-2026-07-17-v3-einsaetze` | `285375f` | + Serviceeinsätze (schemaVersion 3) |
| `umzug/…-2026-09-27-v3-orte` | `8af4a56` | + eigene Orte, tolerantes Einlesen |
| `umzug/…-2026-10-11-v3-heute` | `117f3d3` | + Umsatzjahre, Kontakte, Opps, Produkte |
| `tresor/…-2026-07-11-erster-tresor` | `5b7641e` | erster Tresor, 4-stellige PIN |
| `tresor/…-2026-07-11-recovery-neue-pin` | `6d6d522` | Wiederherstellung → neue PIN |
| `tresor/…-2026-07-17-recovery-bias-fix` | `8713ba0` | geänderte Code-Erzeugung |
| `tresor/…-2026-09-30-starke-pin` | `fd85978` | mind. 6 Zeichen |
| `tresor/…-2026-10-04-schreibreihenfolge` | `37e0047` | Passphrase |

Dazu die ältere Einzeldatei `tests/fixtures/TourFuchs-Umzug-2026-10-09.tfsafe`
(`tests/safeTransferCompat.test.js`).

## So wurden sie erzeugt

Je Commit eine Arbeitskopie, darin der Generator als Test (er nutzt nur die
APIs dieses Stands: Excel-Import, State, Verschlüsselung):

```sh
git worktree add --detach /tmp/stand-3b0ea34 3b0ea34
ln -s "$PWD/node_modules" /tmp/stand-3b0ea34/node_modules
cp tools/compat/umzug-erzeugen.test.js /tmp/stand-3b0ea34/tests/
cd /tmp/stand-3b0ea34 && TFSAFE_OUT=/tmp/out TFSAFE_TAG=2026-07-11-v1-kunden \
  npx vitest run tests/umzug-erzeugen.test.js
# Tresor entsprechend: tresor-erzeugen.test.js mit VAULT_OUT, VAULT_TAG, VAULT_PIN
```

Der heutige Stand bekam zusätzlich `TFSAFE_RICH=1` (alle neuen Kundenfelder).
Kommt künftig ein neues Format hinzu, wird **eine weitere** Datei mit dem
neuen Stand erzeugt und ergänzt – die vorhandenen bleiben unverändert.
