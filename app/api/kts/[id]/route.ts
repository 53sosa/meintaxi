import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { ladeTarif } from '../../../../lib/tarifLookup';
import { getSession } from '../../../../lib/session';

export async function GET(
  request: Request,
  context: any
) {
  try {
    // 1. JWT-Pflicht — nur eingeloggte Fahrer dürfen Verordnungsdaten abrufen (US-2.3 AC2)
    const session = await getSession();
    if (!session || session.role !== 'fahrer') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const kts_id = resolvedParams.id?.trim();

    if (!kts_id) {
      return NextResponse.json(
        { success: false, error: 'Keine KTS-ID angegeben.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    const verordnung = await db.get(
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
        behandlung_beschreibung, gueltig_bis
       FROM verordnungen
       WHERE id = ?`,
      [kts_id]
    );

    if (!verordnung) {
      return NextResponse.json(
        { success: false, error: 'Verordnung nicht gefunden.' },
        { status: 404 }
      );
    }

    // Status 'abgeschlossen' → QR-Code endgültig ungültig, kein erneuter Scan möglich
    if (verordnung.status === 'abgeschlossen') {
      return NextResponse.json(
        {
          success: false,
          error: 'Diese Verordnung wurde bereits vollständig abgerechnet.',
          status: verordnung.status,
        },
        { status: 409 }
      );
    }

    // Datum-basierter Tarif-Lookup — heutiges Datum verwenden
    const heute = new Date().toISOString().slice(0, 10);
    const tarif = await ladeTarif(verordnung.kasse_name, heute);

    // Status 'hinfahrt_abgeschlossen' → kein Fehler mehr, sondern Hinweis-Objekt
    // mit Vergleich ob der scannende Fahrer derselbe wie bei der Hinfahrt ist
    let hinweis = null;
    if (verordnung.status === 'hinfahrt_abgeschlossen') {
      const hinfahrtEintrag = await db.get(
        `SELECT fahrer_id, fahrtdatum, km_einfach, fahrt_von, fahrt_nach FROM fahrten
         WHERE verordnung_id = ? AND fahrtrichtung = 'hinfahrt'`,
        [kts_id]
      );

      hinweis = {
        nachricht: hinfahrtEintrag
          ? `Hinfahrt bereits durchgeführt am ${hinfahrtEintrag.fahrtdatum}`
          : 'Hinfahrt bereits durchgeführt.',
        hinfahrt_datum: hinfahrtEintrag?.fahrtdatum ?? null,
        hinfahrt_km:    hinfahrtEintrag?.km_einfach ?? null,
        // Tatsächlich gefahrene Adressen der Hinfahrt — für korrekte
        // Adressumkehrung bei der Rückfahrt (unabhängig vom manuellen Tausch)
        hinfahrt_von:   hinfahrtEintrag?.fahrt_von  ?? null,
        hinfahrt_nach:  hinfahrtEintrag?.fahrt_nach ?? null,
        gleicher_fahrer: hinfahrtEintrag?.fahrer_id === session.userId,
      };
    }

    return NextResponse.json(
      { success: true, verordnung, tarif, hinweis },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ KTS-GET FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}