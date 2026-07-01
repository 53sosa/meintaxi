import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { openDb } from '../../../../lib/db';

export async function GET(request: Request) {
  try {
    // Nur Unternehmer
    const session = await getSession();
    if (!session || session.role !== 'unternehmen') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    // Filter-Parameter aus URL
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');  // nicht_freigegeben / freigegeben / abgelehnt / alle
    const filterJahr   = searchParams.get('jahr');    // z.B. 2026
    const filterMonat  = searchParams.get('monat');   // z.B. 05

    const db = await openDb();

    // Query dynamisch aufbauen je nach Filter
    // 'gebuendelt': aufgegangene Hinfahrt-Einträge bei gleichen Fahrern
    // 'wartet_auf_rueckfahrt': Hinfahrt die noch auf Rückfahrt wartet —
    //   beide niemals im Dashboard anzeigen (TASK-01)
    let whereKlauseln = [
      'f.unternehmen_id = ?',
      "f.freigabe_status != 'gebuendelt'",
      "f.freigabe_status != 'wartet_auf_rueckfahrt'",
    ];
    const params: any[] = [session.userId];

    if (filterStatus && filterStatus !== 'alle') {
      // 'gkv_uebermittelt' ist keine eigene freigabe_status-Spalte, sondern
      // eine Kombination aus freigegeben + erfolgreich an die GKV übermittelt
      // (US-1.4 AC2 — bisher nur als Unter-Badge sichtbar, jetzt auch als
      // eigener Filter)
      if (filterStatus === 'gkv_uebermittelt') {
        whereKlauseln.push("f.freigabe_status = 'freigegeben'", "f.gkv_status = 'success'");
      } else {
        whereKlauseln.push('f.freigabe_status = ?');
        params.push(filterStatus);
      }
    }

    if (filterJahr) {
      whereKlauseln.push(`strftime('%Y', f.fahrtdatum) = ?`);
      params.push(filterJahr);
    }

    if (filterMonat) {
      whereKlauseln.push(`strftime('%m', f.fahrtdatum) = ?`);
      params.push(filterMonat.padStart(2, '0'));
    }

    const whereString = whereKlauseln.join(' AND ');

    const fahrten = await db.all(
      `SELECT
        f.id, f.fahrtdatum, f.fahrt_von, f.fahrt_nach,
        f.km_einfach, f.km_kommentar,
        f.gesamt_brutto, f.zuzahlung, f.gesamt_netto,
        f.hinfahrt, f.rueckfahrt,
        f.fahrtrichtung,
        f.freigabe_status, f.freigabe_zeitstempel, f.freigabe_begruendung,
        f.gkv_status, f.gkv_uebermittelt_am, f.gkv_referenz,
        f.edifact_dateiname,
        fa.vorname  AS fahrer_vorname,
        fa.nachname AS fahrer_nachname,
        v.patient_vorname, v.patient_nachname,
        v.kasse_name
       FROM fahrten f
       JOIN fahrer fa      ON f.fahrer_id     = fa.id
       JOIN verordnungen v ON f.verordnung_id = v.id
       WHERE ${whereString}
       ORDER BY f.erstellt_am DESC`,
      params
    );

    // Statistiken berechnen
    const alleFreigabe = await db.all(
      `SELECT freigabe_status, COUNT(*) as anzahl, SUM(gesamt_netto) as summe
       FROM fahrten
       WHERE unternehmen_id = ?
       GROUP BY freigabe_status`,
      [session.userId]
    );

    const stats = {
      gesamt:            fahrten.length,
      nicht_freigegeben: 0,
      freigegeben:       0,
      abgelehnt:         0,
      kassenanteil:      0,
      gkv_failed:        0,
      gkv_uebermittelt:  0,
    };

    alleFreigabe.forEach((row: any) => {
      if (row.freigabe_status === 'nicht_freigegeben') stats.nicht_freigegeben = row.anzahl;
      if (row.freigabe_status === 'freigegeben')       stats.freigegeben       = row.anzahl;
      if (row.freigabe_status === 'abgelehnt')         stats.abgelehnt         = row.anzahl;
    });

    // GKV-Fehler zählen
    const gkvFehler = await db.get(
      `SELECT COUNT(*) as count FROM fahrten
       WHERE unternehmen_id = ? AND gkv_status = 'failed'`,
      [session.userId]
    );
    stats.gkv_failed = gkvFehler?.count ?? 0;

    // GKV erfolgreich übermittelt zählen (für den neuen Filter-Button)
    const gkvUebermittelt = await db.get(
      `SELECT COUNT(*) as count FROM fahrten
       WHERE unternehmen_id = ? AND freigabe_status = 'freigegeben' AND gkv_status = 'success'`,
      [session.userId]
    );
    stats.gkv_uebermittelt = gkvUebermittelt?.count ?? 0;

    // Kassenanteil aller freigegebenen Fahrten
    const kassenanteil = await db.get(
      `SELECT SUM(gesamt_netto) as summe FROM fahrten
       WHERE unternehmen_id = ? AND freigabe_status = 'freigegeben'`,
      [session.userId]
    );
    stats.kassenanteil = Math.round((kassenanteil?.summe ?? 0) * 100) / 100;

    return NextResponse.json(
      { success: true, fahrten, stats },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ DASHBOARD FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}