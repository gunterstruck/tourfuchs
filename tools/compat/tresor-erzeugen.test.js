// Erzeugt mit dem Tresor-Code DIESES (historischen) Stands einen echten Tresor.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('richtet einen Tresor mit dem damaligen Code ein', async () => {
    const vault = await import('../src/services/vault.js');
    const OUT = process.env.VAULT_OUT;
    const TAG = process.env.VAULT_TAG;
    const pin = process.env.VAULT_PIN;
    localStorage.clear();
    const { recoveryCode } = await vault.setup(pin, { recovery: true });
    const meta = localStorage.getItem('tf_vault');
    const dataset = {
        customers: [{ id: 'k-nr:10001', nummer: '10001', name: 'Tresor Kunde GmbH', plz: '50667', ort: 'Köln', lat: 50.94, lng: 6.96, geo: 'exakt', besuche: ['2026-09-01'], extra: { VK: 'Vera' } }],
        fileName: `Tresor-${TAG}.xlsx`,
        importedAt: '2026-09-01T08:00:00.000Z',
        territories: {}
    };
    const payload = await vault.encryptForStore(dataset);
    writeFileSync(resolve(OUT, `tresor-${TAG}.json`), JSON.stringify({
        stand: TAG, pin, recoveryCode, meta: JSON.parse(meta), payload, inhalt: dataset
    }, null, 2));
    console.log(TAG, 'Tresor erzeugt, Wiederherstellungscode', recoveryCode ? 'ja' : 'nein');
});
