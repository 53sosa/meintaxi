import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { randomUUID } from 'crypto';

// Rate-Limiting: max 30 Verordnungen pro IP pro Minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// Pflichtfelder validieren — gibt Array mit Fehlern zurück
function validiereVerordnung(body: any): string[] {
  const fehler: string[] = [];

  if (!body.patient_kvnr || !/^[A-Z]\d{9}$/i.test(body.patient_kvnr))
    fehler.push('patient_kvnr: fehlt oder ungültig (1 Buchstabe + 9 Ziffern)');

  if (!body.patient_vorname)
    fehler.push('patient_vorname: fehlt');

  if (!body.patient_nachname)
    fehler.push('patient_nachname: fehlt');

  if (!body.patient_geburtsdatum)
    fehler.push('patient_geburtsdatum: fehlt');

  if (!body.kasse_ik || !/^\d{9}$/.test(body.kasse_ik))
    fehler.push('kasse_ik: fehlt oder ungültig (exakt 9 Ziffern)');

  if (!body.kasse_name)
    fehler.push('kasse_name: fehlt');

  if (!body.arzt_bsnr || !/^\d{9}$/.test(body.arzt_bsnr))
    fehler.push('arzt_bsnr: fehlt oder ungültig (exakt 9 Ziffern)');

  if (!body.arzt_lanr || !/^\d{9}$/.test(body.arzt_lanr))
    fehler.push('arzt_lanr: fehlt oder ungültig (exakt 9 Ziffern)');

  if (!body.verordnungsdatum)
    fehler.push('verordnungsdatum: fehlt');

  if (!body.fahrt_grund_code || !/^[a-f]$/.test(body.fahrt_grund_code))
    fehler.push('fahrt_grund_code: fehlt oder ungültig (a/b/c/d/e/f)');

  if (!body.befoerderungsart || !['TAXI', 'KTW', 'RTW'].includes(body.befoerderungsart))
    fehler.push('befoerderungsart: fehlt oder ungültig (TAXI/KTW/RTW)');

  if (!body.fahrt_von)
    fehler.push('fahrt_von: fehlt');

  if (!body.fahrt_nach)
    fehler.push('fahrt_nach: fehlt');

  return fehler;
}

export async function POST(request: Request) {
  try {
    // 1. API-Token prüfen
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token || token !== process.env.AIS_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Rate-Limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Anfragen. Bitte warte eine Minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // 3. Pflichtfelder validieren
    const fehler = validiereVerordnung(body);

    if (fehler.length > 0) {
      // Validierungsversuch loggen
      console.warn(`⚠️ Validierung fehlgeschlagen [${new Date().toISOString()}]:`, fehler);
      return NextResponse.json(
        {
          success: false,
          error: 'Pflichtfelder fehlen oder ungültig',
          fehlende_felder: fehler,
        },
        { status: 422 }
      );
    }

    // 4. Verordnung in DB speichern
    const kts_id = randomUUID();
    const db = await openDb();

    await db.run(
      `INSERT INTO verordnungen (
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
      ) VALUES (
        ?, 'offen',
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?
      )`,
      [
        kts_id,
        body.patient_vorname,
        body.patient_nachname,
        body.patient_geburtsdatum,
        body.patient_kvnr.trim().toUpperCase(),
        body.versichertenstatus ?? '1000',
        body.kasse_name,
        body.kasse_ik,
        body.arzt_bsnr,
        body.arzt_lanr,
        body.verordnungsdatum,
        body.fahrt_von,
        body.fahrt_nach,
        body.fahrt_grund_code.toLowerCase(),
        body.befoerderungsart.toUpperCase(),
        body.hinfahrt  ? 1 : 0,
        body.rueckfahrt ? 1 : 0,
        body.zuzahlungspflichtig  !== false ? 1 : 0,
        body.zuzahlungsbefreit    === true  ? 1 : 0,
        body.behandlung_beschreibung ?? null,
        body.gueltig_bis ?? null,
      ]
    );

    // Erfolg loggen
    console.log(`✅ Verordnung angelegt [${new Date().toISOString()}]: ${kts_id}`);

    return NextResponse.json(
      {
        success: true,
        kts_id,
        message: 'Verordnung erfolgreich angelegt.',
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ KTS-CREATE FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}