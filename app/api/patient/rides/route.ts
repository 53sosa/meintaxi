import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '../../../../lib/session';
import { openDb } from '../../../../lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let kvnr = searchParams.get('kvnr');
    const geburtsdatum = searchParams.get('geburtsdatum');

    // Session prüfen
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    let session: any = null;

    if (sessionCookie) {
      session = await decrypt(sessionCookie);
    }

    const db = await openDb();
    let ride = null;

    // ==========================================
    // SZENARIO A: Eingeloggter Patient
    // KVNR aus DB holen, nur Session nötig
    // ==========================================
    if (session && session.role === 'patient') {
      if (!kvnr) {
        const patient = await db.get(
          `SELECT kvnr FROM patienten WHERE id = ?`,
          [session.userId]
        );
        kvnr = patient?.kvnr ?? null;
      }

      if (!kvnr) {
        return NextResponse.json(
          { success: false, error: 'Keine gültige KVNR für diesen Patienten gefunden.' },
          { status: 400 }
        );
      }

      ride = await db.get(
        `SELECT
          id, status,
          patient_vorname, patient_nachname,
          patient_geburtsdatum, patient_kvnr,
          versichertenstatus,
          kasse_name, kasse_ik,
          arzt_bsnr, arzt_lanr, verordnungsdatum,
          fahrt_von, fahrt_nach,
          fahrt_grund_code, befoerderungsart,
          hinfahrt, rueckfahrt,
          zuzahlungspflichtig, zuzahlungsbefreit,
          behandlung_beschreibung, gueltig_bis,
          erstellt_am
        FROM verordnungen
        WHERE UPPER(patient_kvnr) = ? AND status = 'offen'
        ORDER BY erstellt_am DESC LIMIT 1`,
        [kvnr.trim().toUpperCase()]
      );

    // ==========================================
    // SZENARIO B: Kein Login
    // KVNR + Geburtsdatum als URL-Parameter
    // ==========================================
    } else {
      if (!kvnr || !geburtsdatum) {
        return NextResponse.json(
          { success: false, error: 'Bitte Versichertennummer und Geburtsdatum angeben oder einloggen.' },
          { status: 400 }
        );
      }

      ride = await db.get(
        `SELECT
          id, status,
          patient_vorname, patient_nachname,
          patient_geburtsdatum, patient_kvnr,
          versichertenstatus,
          kasse_name, kasse_ik,
          arzt_bsnr, arzt_lanr, verordnungsdatum,
          fahrt_von, fahrt_nach,
          fahrt_grund_code, befoerderungsart,
          hinfahrt, rueckfahrt,
          zuzahlungspflichtig, zuzahlungsbefreit,
          behandlung_beschreibung, gueltig_bis,
          erstellt_am
        FROM verordnungen
        WHERE UPPER(patient_kvnr) = ?
          AND patient_geburtsdatum = ?
          AND status = 'offen'
        ORDER BY erstellt_am DESC LIMIT 1`,
        [kvnr.trim().toUpperCase(), geburtsdatum.trim()]
      );
    }

    if (!ride) {
      return NextResponse.json(
        { success: true, ride: null, message: 'Keine offene Verordnung gefunden.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, ride }, { status: 200 });

  } catch (error: any) {
    console.error('❌ PATIENTEN-API-FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler beim Abrufen der Fahrt' },
      { status: 500 }
    );
  }
}