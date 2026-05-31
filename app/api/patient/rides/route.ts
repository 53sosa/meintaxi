import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function GET(request: Request) {
  try {
    // 1. KVNR und Geburtsdatum aus den URL-Parametern auslesen
    const { searchParams } = new URL(request.url);
    const kvnr = searchParams.get('kvnr');
    const geburtsdatum = searchParams.get('geburtsdatum');

    if (!kvnr || !geburtsdatum) {
      return NextResponse.json(
        { success: false, error: "Bitte Versichertennummer und Geburtsdatum angeben." }, 
        { status: 400 }
      );
    }

    // 2. Datenbank öffnen
    const db = await openDb();

    // 3. Nach einer offenen Verordnung für diesen Patienten suchen
    const ride = await db.get(
      `SELECT * FROM verordnungen 
       WHERE patient_kvnr = ? AND patient_geburtsdatum = ? AND status = 'offen'
       LIMIT 1`,
      [kvnr.trim(), geburtsdatum.trim()]
    );

    await db.close();

    // 4. Wenn keine Fahrt gefunden wurde
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Keine offene Verordnung für diese Daten gefunden." }, 
        { status: 404 }
      );
    }

    // 5. Fahrt erfolgreich gefunden!
    return NextResponse.json({ success: true, ride }, { status: 200 });

  } catch (error) {
    console.error("❌ PATIENTEN-API-FEHLER:", error);
    return NextResponse.json({ success: false, error: "Serverfehler beim Abrufen der Fahrt" }, { status: 500 });
  }
}