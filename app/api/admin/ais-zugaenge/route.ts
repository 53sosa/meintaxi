import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { randomBytes, createHash } from 'crypto';

// Admin-Endpoint — nur per Postman, nie vom Frontend.
// POST   → neue Praxis anlegen (gibt client_id + client_secret zurück)
// GET    → alle Zugänge auflisten
// PATCH  → Zugang aktivieren / deaktivieren

function pruefeAdminAuth(request: Request): boolean {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  return token === process.env.ADMIN_SECRET;
}

// GET — alle Praxis-Zugänge auflisten
export async function GET(request: Request) {
  if (!pruefeAdminAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const db = await openDb();
  const zugaenge = await db.all(
    `SELECT id, bsnr, client_id, praxis_name, aktiv, erstellt_am
     FROM ais_zugaenge ORDER BY erstellt_am DESC`
  );
  return NextResponse.json({ success: true, zugaenge });
}

// POST — neue Praxis anlegen (OAuth 2.0 Client Credentials)
export async function POST(request: Request) {
  if (!pruefeAdminAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { bsnr, praxis_name } = await request.json();

    if (!bsnr || !/^\d{9}$/.test(bsnr))
      return NextResponse.json({ success: false, error: 'bsnr: exakt 9 Ziffern.' }, { status: 400 });
    if (!praxis_name)
      return NextResponse.json({ success: false, error: 'praxis_name fehlt.' }, { status: 400 });

    const db = await openDb();
    const vorhanden = await db.get(`SELECT id FROM ais_zugaenge WHERE bsnr = ?`, [bsnr]);
    if (vorhanden)
      return NextResponse.json({ success: false, error: `BSNR ${bsnr} bereits registriert.` }, { status: 409 });

    // client_id: öffentlich, kein Geheimnis, kein Hinweis auf BSNR
    const client_id = `cid_${randomBytes(12).toString('hex')}`;

    // client_secret: einmalig zurückgegeben, nur Hash gespeichert
    const client_secret = randomBytes(32).toString('hex');
    const client_secret_hash = createHash('sha256').update(client_secret).digest('hex');

    await db.run(
      `INSERT INTO ais_zugaenge (bsnr, client_id, client_secret_hash, praxis_name, aktiv)
       VALUES (?, ?, ?, ?, 1)`,
      [bsnr, client_id, client_secret_hash, praxis_name]
    );

    console.log(`✅ AIS-Zugang angelegt: ${praxis_name} (BSNR ${bsnr}) → ${client_id}`);

    return NextResponse.json({
      success: true,
      praxis_name,
      bsnr,
      client_id,
      client_secret,
      hinweis: 'client_secret jetzt kopieren — wird nicht nochmal angezeigt. ' +
               'Zum Abrufen eines Access Tokens: POST /api/auth/ais-token',
    }, { status: 201 });

  } catch (err: any) {
    console.error('❌ AIS-ZUGAENGE:', err);
    return NextResponse.json({ success: false, error: 'Serverfehler' }, { status: 500 });
  }
}

// PATCH — Zugang aktivieren / deaktivieren
export async function PATCH(request: Request) {
  if (!pruefeAdminAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { bsnr, aktiv } = await request.json();
    if (!bsnr || aktiv === undefined)
      return NextResponse.json({ success: false, error: 'bsnr und aktiv sind Pflicht.' }, { status: 400 });

    const db = await openDb();
    const result = await db.run(
      `UPDATE ais_zugaenge SET aktiv = ? WHERE bsnr = ?`, [aktiv ? 1 : 0, bsnr]
    );
    if (result.changes === 0)
      return NextResponse.json({ success: false, error: `BSNR ${bsnr} nicht gefunden.` }, { status: 404 });

    console.log(`${aktiv ? '✅' : '🔒'} AIS-Zugang ${bsnr}: ${aktiv ? 'aktiviert' : 'deaktiviert'}`);
    return NextResponse.json({ success: true, bsnr, aktiv });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Serverfehler' }, { status: 500 });
  }
}