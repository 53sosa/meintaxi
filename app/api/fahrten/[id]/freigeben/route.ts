import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { openDb } from '../../../../../lib/db';
import { getSession } from '../../../../../lib/session';
import { generiereEdifact } from '../../../../../lib/edifact';
import { ladeTarif } from '../../../../../lib/tarifLookup';
import { sendeAnGkv } from '../../../../../lib/gkvTransmit';

export async function POST(
  request: Request,
  context: any
) {
  try {
    // 1. JWT-Session prüfen — nur Taxiunternehmer
    const session = await getSession();
    if (!session || session.role !== 'unternehmen') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert. Nur Taxiunternehmer dürfen freigeben.' },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const fahrt_id = resolvedParams.id?.trim();

    if (!fahrt_id) {
      return NextResponse.json(
        { success: false, error: 'Keine Fahrt-ID angegeben.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { aktion, begruendung } = body;
    // aktion: 'freigeben' oder 'ablehnen'

    if (!aktion || !['freigeben', 'ablehnen'].includes(aktion)) {
      return NextResponse.json(
        { success: false, error: 'Aktion muss "freigeben" oder "ablehnen" sein.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    // 2. Fahrt laden + Ownership-Check
    const fahrt = await db.get(
      `SELECT f.*,
              fa.vorname AS fahrer_vorname, fa.nachname AS fahrer_nachname,
              t.ik_nummer
       FROM fahrten f
       JOIN fahrer fa       ON f.fahrer_id      = fa.id
       JOIN taxiunternehmen t ON f.unternehmen_id = t.id
       WHERE f.id = ?`,
      [fahrt_id]
    );

    if (!fahrt) {
      return NextResponse.json(
        { success: false, error: 'Fahrt nicht gefunden.' },
        { status: 404 }
      );
    }

    // Nur eigene Fahrten freigeben
    if (fahrt.unternehmen_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Zugriff verweigert.' },
        { status: 403 }
      );
    }

    // Nur nicht-freigegebene Fahrten können freigegeben werden
    if (fahrt.freigabe_status !== 'nicht_freigegeben') {
      const meldung = fahrt.freigabe_status === 'gebuendelt'
        ? 'Diese Fahrt wurde mit der Rückfahrt desselben Fahrers zusammengeführt und kann nicht mehr separat freigegeben werden — die kombinierte Fahrt findest du als eigenen Eintrag.'
        : `Fahrt hat bereits Status: ${fahrt.freigabe_status}`;
      return NextResponse.json(
        { success: false, error: meldung },
        { status: 409 }
      );
    }

    const jetzt = new Date().toISOString();

    // ==========================================
    // ABLEHNEN
    // ==========================================
    if (aktion === 'ablehnen') {
      await db.run(
        `UPDATE fahrten
         SET freigabe_status = 'abgelehnt',
             freigabe_zeitstempel = ?,
             freigabe_begruendung = ?
         WHERE id = ?`,
        [jetzt, begruendung ?? 'Keine Begründung angegeben', fahrt_id]
      );

      console.log(`❌ Fahrt abgelehnt: ${fahrt_id}`);

      return NextResponse.json(
        {
          success: true,
          aktion: 'abgelehnt',
          fahrt_id,
          message: 'Fahrt wurde abgelehnt.',
        },
        { status: 200 }
      );
    }

    // ==========================================
    // FREIGEBEN → EDIFACT generieren → GKV senden
    // ==========================================

    // 3. Verordnung laden (für EDIFACT-Daten)
    const verordnung = await db.get(
      `SELECT * FROM verordnungen WHERE id = ?`,
      [fahrt.verordnung_id]
    );

    if (!verordnung) {
      return NextResponse.json(
        { success: false, error: 'Zugehörige Verordnung nicht gefunden.' },
        { status: 404 }
      );
    }

    // 4. Laufende Nummer für Dateiname
    const anzahl = await db.get(
      `SELECT COUNT(*) as count FROM fahrten
       WHERE unternehmen_id = ? AND freigabe_status = 'freigegeben'`,
      [fahrt.unternehmen_id]
    );
    const lfdNr = String((anzahl?.count ?? 0) + 1).padStart(5, '0');

    // 5. EDIFACT generieren — funktioniert unverändert für alle drei
    // fahrtrichtung-Werte ('hinfahrt' / 'rueckfahrt' / 'beide'), weil seit
    // der Bündelungs-Korrektur in abschliessen/route.ts pro wirtschaftlicher
    // Fahrt immer genau ein fahrten-Eintrag mit den korrekten kombinierten
    // Werten existiert (km, Grundpauschale, Streckenpreis) — keine
    // Sonderbehandlung hier nötig.
    let edifact_datei:     string | null = null;
    let edifact_dateiname: string | null = null;
    let gkv_status         = 'failed';
    let gkv_referenz:      string | null = null;
    let gkv_uebermittelt_am: string | null = null;

    try {
      const ergebnis = generiereEdifact({
        ik_taxi:              fahrt.ik_nummer,
        ik_kasse:             verordnung.kasse_ik,
        datei_referenz:       lfdNr,
        rechnungsnummer:      `RN${Date.now()}`,
        fahrtdatum:           fahrt.fahrtdatum,
        patient_nachname:     verordnung.patient_nachname,
        patient_vorname:      verordnung.patient_vorname,
        patient_geburtsdatum: verordnung.patient_geburtsdatum,
        versichertenstatus:   verordnung.versichertenstatus,
        patient_kvnr:         verordnung.patient_kvnr,
        arzt_lanr:            verordnung.arzt_lanr,
        arzt_bsnr:            verordnung.arzt_bsnr,
        verordnungsdatum:     verordnung.verordnungsdatum,
        km_einfach:           fahrt.km_einfach,
        grundpauschale:       fahrt.grundpauschale,
        streckenpreis:        fahrt.streckenpreis,
        gesamt_brutto:        fahrt.gesamt_brutto,
        zuzahlung:            fahrt.zuzahlung,
        gesamt_netto:         fahrt.gesamt_netto,
      });

      edifact_datei     = ergebnis.inhalt;
      edifact_dateiname = ergebnis.dateiname;

      // 6. An GKV-Datenannahmestelle senden
      const gkvAntwort = await sendeAnGkv(
        edifact_datei,
        edifact_dateiname,
        fahrt.ik_nummer,
        verordnung.kasse_ik
      );

      gkv_status          = gkvAntwort.status;
      gkv_referenz        = gkvAntwort.referenz_id;
      gkv_uebermittelt_am = gkvAntwort.uebermittelt_am;

    } catch (e: any) {
      console.error('⚠️ EDIFACT/GKV Fehler:', e.message);
      gkv_status = 'failed';
    }

    // 7. Fahrt aktualisieren
    await db.run(
      `UPDATE fahrten
       SET freigabe_status      = 'freigegeben',
           freigabe_zeitstempel = ?,
           freigabe_begruendung = NULL,
           edifact_datei        = ?,
           edifact_generiert_am = ?,
           edifact_dateiname    = ?,
           gkv_status           = ?,
           gkv_uebermittelt_am  = ?,
           gkv_referenz         = ?
       WHERE id = ?`,
      [
        jetzt,
        edifact_datei,
        edifact_datei ? jetzt : null,
        edifact_dateiname,
        gkv_status,
        gkv_uebermittelt_am,
        gkv_referenz,
        fahrt_id,
      ]
    );

    console.log(`✅ Fahrt freigegeben: ${fahrt_id} | GKV: ${gkv_status}`);

    return NextResponse.json(
      {
        success: true,
        aktion:  'freigegeben',
        fahrt_id,
        fahrtrichtung: fahrt.fahrtrichtung,
        edifact_dateiname,
        gkv_status,
        gkv_referenz,
        message: gkv_status === 'success'
          ? 'Fahrt freigegeben und erfolgreich an GKV übermittelt.'
          : 'Fahrt freigegeben — GKV-Übermittlung fehlgeschlagen, bitte erneut versuchen.',
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ FREIGABE FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}