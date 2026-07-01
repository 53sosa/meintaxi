import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '../../../../lib/session';
import { openDb } from '../../../../lib/db';

// GET /api/patient/history
// Fahrtenhistorie für den eingeloggten Patienten (US-PAT-01)
// Nur eigene Fahrten via KVNR-Join — kein freigabe_status zurückgegeben

export async function GET(request: Request) {
  try {
    // Session prüfen (gleiche Methode wie bestehende patient-Endpoints)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 });
    }

    const session = await decrypt(sessionCookie);
    if (!session || session.role !== 'patient') {
      return NextResponse.json({ error: 'Kein Patientenzugang.' }, { status: 403 });
    }

    const patientId = session.userId;
    const db = await openDb();

    // Ownership-Check via Join: patienten → verordnungen (kvnr) → fahrten
    // wartet_auf_rueckfahrt wird nicht angezeigt (interner Status)
    const fahrten = await db.all(`
      SELECT
        f.id,
        f.fahrtdatum,
        f.fahrt_von,
        f.fahrt_nach,
        f.fahrtrichtung,
        f.gesamt_brutto,
        f.zuzahlung
      FROM fahrten f
      JOIN verordnungen v ON f.verordnung_id = v.id
      JOIN patienten p    ON v.patient_kvnr  = p.kvnr
      WHERE p.id = ?
        AND f.freigabe_status != 'wartet_auf_rueckfahrt'
      ORDER BY f.fahrtdatum DESC
    `, [patientId]);

    return NextResponse.json({ fahrten });

  } catch (err: any) {
    console.error('❌ PATIENT HISTORY:', err);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}