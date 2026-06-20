import { openDb } from './db';
import { Tarif, FALLBACK_TARIF } from './preisberechnung';

export async function ladeTarif(
  kasse_name: string,
  fahrtdatum: string
): Promise<Tarif> {
  const db = await openDb();

  // Debug: alle Tarife anzeigen
  const alleTarife = await db.all(`SELECT * FROM tarife`);
  console.log('📋 Alle Tarife in DB:', JSON.stringify(alleTarife));
  console.log('🔍 Suche Tarif für:', kasse_name, 'Datum:', fahrtdatum);

  const tarif = await db.get(
    `SELECT * FROM tarife
     WHERE (kasse_name = ? OR kasse_name = 'vdek-NRW' OR kasse_name = 'Standard')
       AND gueltig_ab <= ?
       AND (gueltig_bis IS NULL OR gueltig_bis >= ?)
     ORDER BY
       CASE WHEN kasse_name = ? THEN 0
            WHEN kasse_name = 'vdek-NRW' THEN 1
            ELSE 2 END,
       gueltig_ab DESC
     LIMIT 1`,
    [kasse_name, fahrtdatum, fahrtdatum, kasse_name]
  );

  console.log('✅ Gefundener Tarif:', JSON.stringify(tarif));
  return tarif ?? FALLBACK_TARIF;
}