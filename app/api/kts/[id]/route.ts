import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { ladeTarif } from '../../../../lib/tarifLookup';

export async function GET(
  request: Request,
  context: any
) {
  try {
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

    if (verordnung.status !== 'offen') {
      return NextResponse.json(
        {
          success: false,
          error: 'Diese Verordnung wurde bereits abgerechnet.',
          status: verordnung.status,
        },
        { status: 409 }
      );
    }

    // Datum-basierter Tarif-Lookup — heutiges Datum verwenden
    const heute = new Date().toISOString().slice(0, 10);
    const tarif = await ladeTarif(verordnung.kasse_name, heute);

    return NextResponse.json(
      { success: true, verordnung, tarif },
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