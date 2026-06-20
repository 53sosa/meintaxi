import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { openDb } from '../../../../lib/db';
import { getSession } from '../../../../lib/session';
import { berechneVdekFahrt } from '../../../../lib/preisberechnung';
import { ladeTarif } from '../../../../lib/tarifLookup';

export async function POST(request: Request) {
  try {
    // 1. JWT-Session prüfen — nur eingeloggte Fahrer
    const session = await getSession();
    if (!session || session.role !== 'fahrer') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      verordnung_id,
      fahrt_von,
      fahrt_nach,
      fahrtdatum,
      km_einfach,
      hinfahrt,
      rueckfahrt,
      unterschrift_blob,
    } = body;

    // 2. Pflichtfelder prüfen
    if (
      !verordnung_id || !fahrt_von || !fahrt_nach ||
      !fahrtdatum || km_einfach === undefined || !unterschrift_blob
    ) {
      return NextResponse.json(
        { success: false, error: 'Pflichtfelder fehlen.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    // 3. Verordnung laden und Status prüfen
    const verordnung = await db.get(
      `SELECT * FROM verordnungen WHERE id = ?`,
      [verordnung_id]
    );
    if (!verordnung) {
      return NextResponse.json(
        { success: false, error: 'Verordnung nicht gefunden.' },
        { status: 404 }
      );
    }

    // Verordnung darf nicht bereits vollständig abgeschlossen sein
    if (verordnung.status === 'abgeschlossen') {
      return NextResponse.json(
        { success: false, error: 'Verordnung wurde bereits vollständig abgerechnet.' },
        { status: 409 }
      );
    }

    // 4. Fahrer + Unternehmen laden
    const fahrer = await db.get(
      `SELECT f.*, t.ik_nummer, t.tarif_region, t.id as unternehmen_id
       FROM fahrer f
       JOIN taxiunternehmen t ON f.unternehmen_id = t.id
       WHERE f.id = ?`,
      [session.userId]
    );
    if (!fahrer) {
      return NextResponse.json(
        { success: false, error: 'Fahrer nicht gefunden.' },
        { status: 404 }
      );
    }

    // 5. Fahrtrichtung bestimmen
    const istHinfahrt  = hinfahrt  === true || hinfahrt  === 1;
    const istRueckfahrt = rueckfahrt === true || rueckfahrt === 1;

    let fahrtrichtung: string;
    if (istHinfahrt && istRueckfahrt) {
      fahrtrichtung = 'beide';
    } else if (istHinfahrt) {
      fahrtrichtung = 'hinfahrt';
    } else {
      fahrtrichtung = 'rueckfahrt';
    }

    // 6. Tarif laden (datum-basiert)
    const tarif = await ladeTarif(verordnung.kasse_name, fahrtdatum);

    // 7. Preis berechnen
    const preis = berechneVdekFahrt(
      km_einfach,
      tarif,
      verordnung.zuzahlungspflichtig === 1 && verordnung.zuzahlungsbefreit === 0,
      istHinfahrt,
      istRueckfahrt
    );

    // 8. Unterschrift-Hash berechnen
    const unterschrift_hash = createHash('sha256')
      .update(unterschrift_blob)
      .digest('hex');
    const unterschrift_zeitstempel = new Date().toISOString();
    const fahrt_id = randomUUID();

    // 9. Fahrt in DB speichern
    // EDIFACT wird NICHT hier generiert — erst nach Freigabe durch Unternehmer
    await db.run(
      `INSERT INTO fahrten (
        id, verordnung_id, fahrer_id, unternehmen_id,
        fahrtrichtung,
        wagennummer, fahrtdatum, fahrt_von, fahrt_nach,
        km_einfach, hinfahrt, rueckfahrt,
        grundpauschale, streckenpreis, gesamt_brutto,
        zuzahlung, gesamt_netto,
        unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
        freigabe_status,
        gkv_status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        fahrt_id,
        verordnung_id,
        session.userId,
        fahrer.unternehmen_id,
        fahrtrichtung,
        session.wagenNr ?? 'unbekannt',
        fahrtdatum,
        fahrt_von,
        fahrt_nach,
        preis.km_abgerechnet,
        istHinfahrt  ? 1 : 0,
        istRueckfahrt ? 1 : 0,
        preis.grundpauschale,
        preis.streckenpreis,
        preis.gesamt_brutto,
        preis.zuzahlung,
        preis.gesamt_netto,
        unterschrift_blob,
        unterschrift_zeitstempel,
        unterschrift_hash,
        'nicht_freigegeben',
        'ausstehend',
      ]
    );

    // 10. Verordnungsstatus aktualisieren
    // Logik:
    // - Nur Hinfahrt verordnet  → abgeschlossen
    // - Nur Rückfahrt verordnet → abgeschlossen
    // - Hin+Rück verordnet UND nur Hinfahrt gemacht → hinfahrt_abgeschlossen
    // - Hin+Rück verordnet UND beide gemacht        → abgeschlossen
    const beidesVerordnet = verordnung.hinfahrt === 1 && verordnung.rueckfahrt === 1;

    let neuerStatus: string;
    if (beidesVerordnet && fahrtrichtung === 'hinfahrt') {
      neuerStatus = 'hinfahrt_abgeschlossen';
    } else {
      neuerStatus = 'abgeschlossen';
    }

    await db.run(
      `UPDATE verordnungen SET status = ? WHERE id = ?`,
      [neuerStatus, verordnung_id]
    );

    console.log(`✅ Fahrt gespeichert [${fahrtrichtung}]: ${fahrt_id} → wartet auf Freigabe`);

    return NextResponse.json(
      {
        success: true,
        fahrt_id,
        fahrtrichtung,
        preis,
        freigabe_status: 'nicht_freigegeben',
        verordnung_status: neuerStatus,
        message: 'Fahrt erfolgreich dokumentiert. Wartet auf Freigabe durch Taxiunternehmen.',
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ ABSCHLIESSEN FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}