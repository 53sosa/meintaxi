import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Mock-GKV-Datenannahmestelle
 *
 * Simuliert den Empfang einer EDIFACT-Datei durch die GKV.
 * Im Prototyp ersetzt das die echte ITSG-Infrastruktur.
 *
 * Im Produktivbetrieb wird dieser Endpoint durch die echte
 * GKV-Datenannahmestelle ersetzt (GKV_ENDPOINT in .env.local).
 *
 * Was dieser Mock prüft:
 * 1. X-Signature Header vorhanden
 * 2. HMAC-SHA256 Signatur korrekt
 * 3. Pflichtfelder im Body vorhanden
 * 4. EDIFACT-Datei beginnt mit UNA (Grundstruktur-Check)
 */
export async function POST(request: Request) {
  try {
    // 1. Signatur aus Header lesen
    const signatureHeader = request.headers.get('X-Signature');
    const ik_absender     = request.headers.get('X-IK-Absender') ?? 'unbekannt';
    const ik_empfaenger   = request.headers.get('X-IK-Empfaenger') ?? 'unbekannt';
    const dateiname       = request.headers.get('X-Dateiname') ?? 'unbekannt';

    if (!signatureHeader) {
      console.warn('⚠️ GKV-Mock: X-Signature Header fehlt');
      return NextResponse.json(
        {
          success: false,
          error:   'X-Signature Header fehlt — Übertragung nicht authentifiziert.',
          code:    'SIGNATURE_MISSING',
        },
        { status: 401 }
      );
    }

    // 2. Body lesen
    const body = await request.json();
    const { datei, ik_absender: bodyIk } = body;

    if (!datei) {
      return NextResponse.json(
        { success: false, error: 'EDIFACT-Datei fehlt im Body.', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    // 3. Signatur verifizieren
    const signingSecret = process.env.GKV_SIGNING_SECRET;
    if (!signingSecret) {
      console.error('❌ GKV-Mock: GKV_SIGNING_SECRET nicht gesetzt');
      return NextResponse.json(
        { success: false, error: 'Server-Konfigurationsfehler.' },
        { status: 500 }
      );
    }

    const erwartetSignatur = crypto
      .createHmac('sha256', signingSecret)
      .update(datei, 'utf8')
      .digest('hex');

    if (signatureHeader !== erwartetSignatur) {
      console.warn('⚠️ GKV-Mock: Signatur ungültig');
      return NextResponse.json(
        {
          success: false,
          error:   'Signatur ungültig — Datei möglicherweise manipuliert.',
          code:    'SIGNATURE_INVALID',
        },
        { status: 401 }
      );
    }

    // 4. Grundstruktur-Check: EDIFACT muss mit UNA beginnen
    if (!datei.startsWith('UNA')) {
      console.warn('⚠️ GKV-Mock: Ungültiges EDIFACT-Format');
      return NextResponse.json(
        {
          success: false,
          error:   'Ungültiges EDIFACT-Format — Datei beginnt nicht mit UNA.',
          code:    'INVALID_FORMAT',
        },
        { status: 422 }
      );
    }

    // 5. Pflichtfelder-Check
    const hatUNB  = datei.includes('UNB+');
    const hatSLGA = datei.includes('SLGA:');
    const hatSLLA = datei.includes('SLLA:');
    const hatBES  = datei.includes('BES+');
    const hatUNZ  = datei.includes('UNZ+');

    if (!hatUNB || !hatSLGA || !hatSLLA || !hatBES || !hatUNZ) {
      const fehlend = [
        !hatUNB  && 'UNB',
        !hatSLGA && 'SLGA',
        !hatSLLA && 'SLLA',
        !hatBES  && 'BES',
        !hatUNZ  && 'UNZ',
      ].filter(Boolean);

      console.warn('⚠️ GKV-Mock: Fehlende Segmente:', fehlend);
      return NextResponse.json(
        {
          success: false,
          error:   `Fehlende Pflicht-Segmente: ${fehlend.join(', ')}`,
          code:    'MISSING_SEGMENTS',
        },
        { status: 422 }
      );
    }

    // 6. Quittung generieren
    const referenz_id  = `GKV-MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const empfangen_am = new Date().toISOString();

    console.log(`✅ GKV-Mock: Datei empfangen`);
    console.log(`   Dateiname:    ${dateiname}`);
    console.log(`   IK Absender:  ${ik_absender}`);
    console.log(`   IK Empfänger: ${ik_empfaenger}`);
    console.log(`   Referenz-ID:  ${referenz_id}`);

    return NextResponse.json(
      {
        success:       true,
        referenz_id,
        empfangen_am,
        dateiname,
        ik_absender,
        ik_empfaenger,
        message:       'EDIFACT-Datei erfolgreich empfangen und validiert.',
        hinweis:       'Dies ist ein Mock-Endpoint. Im Produktivbetrieb wird an die echte GKV-Datenannahmestelle übermittelt.',
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ GKV-Mock FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler im GKV-Mock.' },
      { status: 500 }
    );
  }
}