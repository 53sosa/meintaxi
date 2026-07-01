import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { openDb } from '../../../../lib/db';
import { getSession } from '../../../../lib/session';
import { berechneVdekFahrt } from '../../../../lib/preisberechnung';
import { ladeTarif } from '../../../../lib/tarifLookup';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'fahrer') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      verordnung_id,
      fahrt_von,
      fahrt_nach,
      fahrtdatum,
      km_einfach,
      km_identisch_hinfahrt, // TASK-03: true = km identisch mit Hinfahrt
      km_kommentar,
      unterschrift_blob,
    } = body;

    // Pflichtfelder (km_einfach nur wenn km_identisch_hinfahrt !== true)
    if (!verordnung_id || !fahrt_von || !fahrt_nach || !fahrtdatum || !unterschrift_blob) {
      return NextResponse.json({ success: false, error: 'Pflichtfelder fehlen.' }, { status: 400 });
    }
    if (!km_identisch_hinfahrt && km_einfach === undefined) {
      return NextResponse.json({ success: false, error: 'Kilometer fehlen.' }, { status: 400 });
    }

    const db = await openDb();

    const verordnung = await db.get(`SELECT * FROM verordnungen WHERE id = ?`, [verordnung_id]);
    if (!verordnung) {
      return NextResponse.json({ success: false, error: 'Verordnung nicht gefunden.' }, { status: 404 });
    }
    if (verordnung.status === 'abgeschlossen') {
      return NextResponse.json(
        { success: false, error: 'Verordnung wurde bereits vollständig abgerechnet.' },
        { status: 409 }
      );
    }

    const fahrer = await db.get(
      `SELECT f.*, t.ik_nummer, t.tarif_region, t.id as unternehmen_id
       FROM fahrer f JOIN taxiunternehmen t ON f.unternehmen_id = t.id
       WHERE f.id = ?`,
      [session.userId]
    );
    if (!fahrer) {
      return NextResponse.json({ success: false, error: 'Fahrer nicht gefunden.' }, { status: 404 });
    }

    const tarif = await ladeTarif(verordnung.kasse_name, fahrtdatum);
    const zuzahlungspflichtig =
      verordnung.zuzahlungspflichtig === 1 && verordnung.zuzahlungsbefreit === 0;
    const beidesVerordnet = verordnung.hinfahrt === 1 && verordnung.rueckfahrt === 1;

    const unterschrift_hash = createHash('sha256').update(unterschrift_blob).digest('hex');
    const unterschrift_zeitstempel = new Date().toISOString();
    const fahrt_id = randomUUID();

    // ═══════════════════════════════════════════════════════════════
    // FALL A: ERSTER SCAN — Status 'offen' → Hinfahrt abschließen
    // ═══════════════════════════════════════════════════════════════
    if (verordnung.status === 'offen') {
      let fahrtrichtung: 'hinfahrt' | 'rueckfahrt';
      if (verordnung.hinfahrt === 1) {
        fahrtrichtung = 'hinfahrt';
      } else if (verordnung.rueckfahrt === 1) {
        fahrtrichtung = 'rueckfahrt';
      } else {
        return NextResponse.json(
          { success: false, error: 'Verordnung enthält keine gültige Fahrtrichtung.' },
          { status: 422 }
        );
      }

      const kmGerundet = Math.ceil(Number(km_einfach));
      if (isNaN(kmGerundet) || kmGerundet < 0) {
        return NextResponse.json({ success: false, error: 'Ungültiger km-Wert.' }, { status: 400 });
      }

      const preis = berechneVdekFahrt(
        kmGerundet, tarif, zuzahlungspflichtig,
        fahrtrichtung === 'hinfahrt',
        fahrtrichtung === 'rueckfahrt'
      );

      // TASK-01: Hinfahrt bei Hin+Rück-Verordnung wartet auf Rückfahrt —
      // erscheint noch NICHT im Dashboard des Unternehmers.
      const freigabeStatus = beidesVerordnet && fahrtrichtung === 'hinfahrt'
        ? 'wartet_auf_rueckfahrt'
        : 'nicht_freigegeben';

      await db.run(
        `INSERT INTO fahrten (
          id, verordnung_id, fahrer_id, unternehmen_id,
          fahrtrichtung, fahrtdatum, fahrt_von, fahrt_nach,
          km_einfach, km_kommentar, hinfahrt, rueckfahrt,
          grundpauschale, streckenpreis, gesamt_brutto, zuzahlung, gesamt_netto,
          unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
          freigabe_status, gkv_status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          fahrt_id, verordnung_id, session.userId, fahrer.unternehmen_id,
          fahrtrichtung, fahrtdatum, fahrt_von, fahrt_nach,
          kmGerundet, km_kommentar?.trim() || null,
          fahrtrichtung === 'hinfahrt' ? 1 : 0,
          fahrtrichtung === 'rueckfahrt' ? 1 : 0,
          preis.grundpauschale, preis.streckenpreis, preis.gesamt_brutto,
          preis.zuzahlung, preis.gesamt_netto,
          unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
          freigabeStatus, 'ausstehend',
        ]
      );

      const neuerStatus = beidesVerordnet ? 'hinfahrt_abgeschlossen' : 'abgeschlossen';
      await db.run(`UPDATE verordnungen SET status = ? WHERE id = ?`, [neuerStatus, verordnung_id]);

      console.log(`✅ Hinfahrt gespeichert [${freigabeStatus}]: ${fahrt_id}`);
      return NextResponse.json({
        success: true, fahrt_id, fahrtrichtung, preis,
        freigabe_status: freigabeStatus, verordnung_status: neuerStatus,
        message: neuerStatus === 'hinfahrt_abgeschlossen'
          ? 'Hinfahrt dokumentiert. Wartet auf Rückfahrt.'
          : 'Fahrt dokumentiert. Wartet auf Freigabe.',
      }, { status: 201 });
    }

    // ═══════════════════════════════════════════════════════════════
    // FALL B: ZWEITER SCAN — Status 'hinfahrt_abgeschlossen' → Rückfahrt
    // ═══════════════════════════════════════════════════════════════
    const hinfahrtEintrag = await db.get(
      `SELECT id, fahrer_id, km_einfach FROM fahrten
       WHERE verordnung_id = ? AND fahrtrichtung = 'hinfahrt'`,
      [verordnung_id]
    );
    if (!hinfahrtEintrag) {
      return NextResponse.json(
        { success: false, error: 'Inkonsistente Daten: Hinfahrt nicht gefunden.' },
        { status: 500 }
      );
    }

    const gleicherFahrer = hinfahrtEintrag.fahrer_id === session.userId;
    const hinfahrtKmGerundet = Math.ceil(hinfahrtEintrag.km_einfach);

    if (gleicherFahrer) {
      // ── GLEICHER FAHRER: Hinfahrt-Eintrag zu Hin+Rück upgraden ──
      // TASK-01: Kein neuer INSERT — bestehender Eintrag wird aktualisiert.
      // TASK-03: km bestimmen — Checkbox "identisch" oder neue Eingabe.
      let kmFuerBerechnung: number;
      let neuerKmKommentar: string | null = km_kommentar?.trim() || null;

      if (km_identisch_hinfahrt === true) {
        // Checkbox "km identisch" — Hinfahrt-km wiederverwenden
        kmFuerBerechnung = hinfahrtKmGerundet;
      } else {
        kmFuerBerechnung = Math.ceil(Number(km_einfach));
        if (isNaN(kmFuerBerechnung) || kmFuerBerechnung < 0) {
          return NextResponse.json({ success: false, error: 'Ungültiger km-Wert.' }, { status: 400 });
        }
        // Pflicht-Kommentar bei km-Abweichung (TASK-03)
        if (kmFuerBerechnung !== hinfahrtKmGerundet && !neuerKmKommentar) {
          return NextResponse.json(
            { success: false, error: 'Kilometer weichen von der Hinfahrt ab — Begründung ist Pflicht.' },
            { status: 422 }
          );
        }
      }

      // Eine Grundpauschale, km × 2 (TASK-01: korrekte Bündelungs-Preisberechnung)
      const preisBeide = berechneVdekFahrt(kmFuerBerechnung, tarif, zuzahlungspflichtig, true, true);

      // Zuzahlung wird pro Fahrt separat berechnet und addiert — der Patient
      // zahlt bei Hinfahrt UND Rückfahrt je einzeln (hatte das so bestätigt).
      // berechneVdekFahrt gibt nur eine Zuzahlung auf den Gesamtbetrag zurück,
      // was zu wenig wäre (5€ statt 10€). Wir korrigieren das hier:
      if (zuzahlungspflichtig) {
        const preisEinzel = berechneVdekFahrt(kmFuerBerechnung, tarif, true, true, false);
        preisBeide.zuzahlung = Math.round(preisEinzel.zuzahlung * 2 * 100) / 100;
        preisBeide.gesamt_netto = Math.round((preisBeide.gesamt_brutto - preisBeide.zuzahlung) * 100) / 100;
      }

      // Hinfahrt-Eintrag zur vollständigen Hin+Rück-Fahrt upgraden
      await db.run(
        `UPDATE fahrten SET
          fahrtrichtung = 'beide',
          fahrtdatum = ?,
          fahrt_von = ?, fahrt_nach = ?,
          km_einfach = ?,
          km_kommentar = ?,
          hinfahrt = 1, rueckfahrt = 1,
          grundpauschale = ?, streckenpreis = ?, gesamt_brutto = ?,
          zuzahlung = ?, gesamt_netto = ?,
          unterschrift_blob = ?,
          unterschrift_zeitstempel = ?,
          unterschrift_hash = ?,
          freigabe_status = 'nicht_freigegeben'
        WHERE id = ?`,
        [
          fahrtdatum, fahrt_von, fahrt_nach,
          kmFuerBerechnung, neuerKmKommentar,
          preisBeide.grundpauschale, preisBeide.streckenpreis, preisBeide.gesamt_brutto,
          preisBeide.zuzahlung, preisBeide.gesamt_netto,
          unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
          hinfahrtEintrag.id,
        ]
      );

      await db.run(`UPDATE verordnungen SET status = 'abgeschlossen' WHERE id = ?`, [verordnung_id]);

      console.log(`✅ Hin+Rück gebündelt [${hinfahrtEintrag.id}] → freigabefähig`);
      return NextResponse.json({
        success: true,
        fahrt_id: hinfahrtEintrag.id,
        fahrtrichtung: 'beide',
        preis: preisBeide,
        freigabe_status: 'nicht_freigegeben',
        verordnung_status: 'abgeschlossen',
        message: 'Hin- und Rückfahrt gebündelt. Wartet auf Freigabe durch Taxiunternehmen.',
      }, { status: 201 });

    } else {
      // ── ANDERER FAHRER: Hinfahrt freischalten + eigene Rückfahrt anlegen ──
      // TASK-01: Hinfahrt war 'wartet_auf_rueckfahrt' — jetzt sichtbar machen
      await db.run(
        `UPDATE fahrten SET freigabe_status = 'nicht_freigegeben' WHERE id = ?`,
        [hinfahrtEintrag.id]
      );

      const kmGerundet = Math.ceil(Number(km_einfach));
      if (isNaN(kmGerundet) || kmGerundet < 0) {
        return NextResponse.json({ success: false, error: 'Ungültiger km-Wert.' }, { status: 400 });
      }

      // Eigene Grundpauschale für den anderen Fahrer (nur Rückfahrt)
      const preisRueck = berechneVdekFahrt(kmGerundet, tarif, zuzahlungspflichtig, false, true);

      await db.run(
        `INSERT INTO fahrten (
          id, verordnung_id, fahrer_id, unternehmen_id,
          fahrtrichtung, fahrtdatum, fahrt_von, fahrt_nach,
          km_einfach, km_kommentar, hinfahrt, rueckfahrt,
          grundpauschale, streckenpreis, gesamt_brutto, zuzahlung, gesamt_netto,
          unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
          freigabe_status, gkv_status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          fahrt_id, verordnung_id, session.userId, fahrer.unternehmen_id,
          'rueckfahrt', fahrtdatum, fahrt_von, fahrt_nach,
          kmGerundet, km_kommentar?.trim() || null,
          0, 1,
          preisRueck.grundpauschale, preisRueck.streckenpreis, preisRueck.gesamt_brutto,
          preisRueck.zuzahlung, preisRueck.gesamt_netto,
          unterschrift_blob, unterschrift_zeitstempel, unterschrift_hash,
          'nicht_freigegeben', 'ausstehend',
        ]
      );

      await db.run(`UPDATE verordnungen SET status = 'abgeschlossen' WHERE id = ?`, [verordnung_id]);

      console.log(`✅ Rückfahrt (anderer Fahrer) gespeichert: ${fahrt_id}`);
      return NextResponse.json({
        success: true, fahrt_id,
        fahrtrichtung: 'rueckfahrt',
        preis: preisRueck,
        freigabe_status: 'nicht_freigegeben',
        verordnung_status: 'abgeschlossen',
        message: 'Rückfahrt dokumentiert. Wartet auf Freigabe durch Taxiunternehmen.',
      }, { status: 201 });
    }

  } catch (error: any) {
    console.error('❌ ABSCHLIESSEN FEHLER:', error);
    return NextResponse.json({ success: false, error: 'Serverfehler' }, { status: 500 });
  }
}