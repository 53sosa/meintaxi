import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log("📥 NEUE VERORDNUNG EMPFANGEN:", data);

    // 1. Sichere KTS-ID (Token) generieren
    const kts_id = crypto.randomUUID();

    // 2. Datenbank öffnen
    const db = await openDb();

    // 3. Daten in die SQLite Tabelle schreiben (Hier sind die wichtigen Backticks!)
    await db.run(
      `INSERT INTO verordnungen (
        id, status, patient_vorname, patient_nachname, patient_geburtsdatum, 
        patient_kvnr, kasse_name, kasse_ik, arzt_bsnr, arzt_lanr, 
        verordnungsdatum, fahrt_von, fahrt_nach, fahrt_grund, zuzahlungspflichtig
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kts_id, 
        'offen', 
        data.patient_vorname, 
        data.patient_nachname, 
        data.patient_geburtsdatum, 
        data.patient_kvnr, 
        data.kasse_name, 
        data.kasse_ik, 
        data.arzt_bsnr, 
        data.arzt_lanr, 
        data.verordnungsdatum, 
        data.fahrt_von, 
        data.fahrt_nach, 
        data.fahrt_grund, 
        data.zuzahlungspflichtig ? 1 : 0 
      ]
    );

    await db.close();

    // 4. Erfolgsmeldung an Arzt (Postman) zurücksenden
    return NextResponse.json({ 
      success: true, 
      message: "Verordnung sicher in meintaxi.db gespeichert",
      kts_id: kts_id 
    }, { status: 201 });

  } catch (error) {
    console.error("❌ DATENBANK-FEHLER:", error);
    return NextResponse.json({ success: false, error: "Fehler beim Speichern in der Datenbank" }, { status: 500 });
  }
}