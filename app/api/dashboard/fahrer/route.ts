import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { openDb } from '../../../../lib/db';

// Liefert die ausstehenden Fahrer-Genehmigungen für den eingeloggten
// Taxiunternehmer (US-1.4 AC3, Voraussetzung für US-1.2 AC2/AC3 + US-NEXT-09)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'unternehmen') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    const db = await openDb();
    const fahrer = await db.all(
      `SELECT id, vorname, nachname, email, erstellt_am
       FROM fahrer
       WHERE unternehmen_id = ? AND status = 'ausstehend'
       ORDER BY erstellt_am ASC`,
      [session.userId]
    );

    return NextResponse.json({ success: true, fahrer }, { status: 200 });

  } catch (error: any) {
    console.error('❌ AUSSTEHENDE-FAHRER FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}