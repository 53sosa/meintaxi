import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { openDb } from '../../../../lib/db';
import { createHash } from 'crypto';

// POST /api/auth/ais-token
// OAuth 2.0 Client Credentials Flow
//
// Body: { "client_id": "cid_...", "client_secret": "..." }
// Response: { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600 }
//
// Der Access Token ist ein JWT, gültig für 60 Minuten.
// kts/create prüft diesen Token — kein statisches Geheimnis mehr.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_id, client_secret } = body;

    if (!client_id || !client_secret) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'client_id und client_secret sind Pflicht.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    // client_id in DB nachschlagen
    const praxis = await db.get(
      `SELECT bsnr, client_secret_hash, praxis_name, aktiv
       FROM ais_zugaenge WHERE client_id = ?`,
      [client_id]
    );

    if (!praxis) {
      console.warn(`⚠️ Unbekannte client_id: ${client_id}`);
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Unbekannte client_id.' },
        { status: 401 }
      );
    }

    if (praxis.aktiv !== 1) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Dieser Zugang ist deaktiviert.' },
        { status: 401 }
      );
    }

    // client_secret prüfen (Timing-sicherer Vergleich via Hash)
    const eingabe_hash = createHash('sha256').update(client_secret).digest('hex');
    if (eingabe_hash !== praxis.client_secret_hash) {
      console.warn(`⚠️ Falsches client_secret für client_id: ${client_id}`);
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Falsches client_secret.' },
        { status: 401 }
      );
    }

    // JWT Access Token ausstellen — 60 Minuten gültig
    const secret = new TextEncoder().encode(
      process.env.AIS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'fallback_dev_only'
    );

    const access_token = await new SignJWT({
      sub:          client_id,
      bsnr:         praxis.bsnr,
      praxis_name:  praxis.praxis_name,
      scope:        'kts:create',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('meintaxi')
      .setAudience('meintaxi-api')
      .sign(secret);

    console.log(`✅ Access Token ausgestellt: ${praxis.praxis_name} (BSNR ${praxis.bsnr})`);

    // OAuth 2.0 Standard-Response
    return NextResponse.json({
      access_token,
      token_type:  'Bearer',
      expires_in:  3600,
    });

  } catch (err: any) {
    console.error('❌ AIS-TOKEN FEHLER:', err);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Serverfehler' },
      { status: 500 }
    );
  }
}