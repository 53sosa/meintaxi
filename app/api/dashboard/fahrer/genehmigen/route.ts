import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session';
import { openDb } from '../../../../../lib/db';

// Genehmigt oder lehnt einen ausstehenden Fahrer ab. Nur der eigene
// Taxiunternehmer darf das (Ownership-Check über unternehmen_id).
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'unternehmen') {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fahrer_id, aktion } = body; // aktion: 'genehmigen' | 'ablehnen'

    if (!fahrer_id || !aktion || !['genehmigen', 'ablehnen'].includes(aktion)) {
      return NextResponse.json(
        { success: false, error: 'fahrer_id und aktion ("genehmigen"/"ablehnen") sind Pflicht.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    const fahrer = await db.get(
      `SELECT id, unternehmen_id, status FROM fahrer WHERE id = ?`,
      [fahrer_id]
    );

    if (!fahrer) {
      return NextResponse.json(
        { success: false, error: 'Fahrer nicht gefunden.' },
        { status: 404 }
      );
    }

    if (fahrer.unternehmen_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Zugriff verweigert.' },
        { status: 403 }
      );
    }

    if (fahrer.status !== 'ausstehend') {
      return NextResponse.json(
        { success: false, error: `Fahrer hat bereits Status: ${fahrer.status}` },
        { status: 409 }
      );
    }

    const neuerStatus = aktion === 'genehmigen' ? 'aktiv' : 'abgelehnt';

    await db.run(`UPDATE fahrer SET status = ? WHERE id = ?`, [neuerStatus, fahrer_id]);

    console.log(`${aktion === 'genehmigen' ? '✅' : '❌'} Fahrer ${fahrer_id}: ${neuerStatus}`);

    return NextResponse.json(
      { success: true, fahrer_id, status: neuerStatus },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ FAHRER-GENEHMIGEN FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}