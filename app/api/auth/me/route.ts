import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '../../../../lib/session';
import { openDb } from '../../../../lib/db';

export async function GET() {
  try {
    // Session-Cookie auslesen und verifizieren
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Nicht eingeloggt' },
        { status: 401 }
      );
    }

    const session = await decrypt(sessionCookie);
    if (!session || !session.userId || !session.role) {
      return NextResponse.json(
        { error: 'Ungültige Session' },
        { status: 401 }
      );
    }

    const db = await openDb();

    // ==========================================
    // PATIENT
    // ==========================================
    if (session.role === 'patient') {
      const patient = await db.get(
        `SELECT id, vorname, nachname, email, kvnr FROM patienten WHERE id = ?`,
        [session.userId]
      );

      if (!patient) {
        return NextResponse.json(
          { error: 'Patient nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ role: 'patient', patient });
    }

    // ==========================================
    // FAHRER
    // ==========================================
    if (session.role === 'fahrer') {
      const fahrer = await db.get(
        `SELECT f.id, f.vorname, f.nachname, f.email, f.unternehmen_id,
                t.ik_nummer, t.tarif_region, t.firmen_name
         FROM fahrer f
         JOIN taxiunternehmen t ON f.unternehmen_id = t.id
         WHERE f.id = ?`,
        [session.userId]
      );

      if (!fahrer) {
        return NextResponse.json(
          { error: 'Fahrer nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ role: 'fahrer', fahrer });
    }

    // ==========================================
    // TAXIUNTERNEHMEN
    // ==========================================
    if (session.role === 'unternehmen') {
      const unternehmen = await db.get(
        `SELECT id, firmen_name, email, firmen_code, ik_nummer, tarif_region
         FROM taxiunternehmen WHERE id = ?`,
        [session.userId]
      );

      if (!unternehmen) {
        return NextResponse.json(
          { error: 'Unternehmen nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ role: 'unternehmen', unternehmen });
    }

    return NextResponse.json(
      { error: 'Unbekannte Rolle' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ Fehler in /api/auth/me:', error);
    return NextResponse.json(
      { error: 'Server-Fehler', details: error.message },
      { status: 500 }
    );
  }
}