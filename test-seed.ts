import { openDb } from './lib/db';

async function seed() {
  try {
    console.log("⏳ Öffne Datenbank...");
    const db = await openDb();

    console.log("⏳ Füge Test-Verordnung ein...");
    await db.run(`
      INSERT OR REPLACE INTO verordnungen (
        id, status, patient_vorname, patient_nachname, 
        patient_geburtsdatum, patient_kvnr, kasse_name, 
        fahrt_von, fahrt_nach, fahrt_grund
      ) VALUES (
        'V-TEST-2026', 'offen', 'Max', 'Mustermann', 
        '1980-01-01', 'Z123456789', 'Techniker Krankenkasse', 
        'Musterstraße 1, Bonn', 'Uniklinik Köln', 'Dialyse'
      )
    `);

    await db.close();
    console.log("✅ Testdaten erfolgreich in SQLite eingefügt!");
  } catch (error) {
    console.error("❌ Fehler beim Seeden der Datenbank:", error);
  }
}

// Skript ausführen
seed();