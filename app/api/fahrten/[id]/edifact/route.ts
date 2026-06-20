import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session';
import { openDb } from '../../../../../lib/db';

export async function GET(
  request: Request,
  context: any
) {
  try {
    // 1. JWT-Session prüfen
    const session = await getSession();
    if (!session || (session.role !== 'fahrer' && session.role !== 'unternehmen')) {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
    }

    // 2. Fahrt-ID aus URL
    const resolvedParams = await context.params;
    const fahrt_id = resolvedParams.id?.trim();

    if (!fahrt_id) {
      return NextResponse.json(
        { success: false, error: 'Keine Fahrt-ID angegeben.' },
        { status: 400 }
      );
    }

    const db = await openDb();

    // 3. Fahrt laden
    const fahrt = await db.get(
      `SELECT f.id, f.edifact_datei, f.edifact_dateiname,
              f.unternehmen_id, f.fahrer_id
       FROM fahrten f
       WHERE f.id = ?`,
      [fahrt_id]
    );

    if (!fahrt) {
      return NextResponse.json(
        { success: false, error: 'Fahrt nicht gefunden.' },
        { status: 404 }
      );
    }

    // 4. Ownership-Check
    // Fahrer darf nur eigene Fahrten herunterladen
    // Unternehmer darf alle Fahrten seines Unternehmens herunterladen
    if (session.role === 'fahrer' && fahrt.fahrer_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Zugriff verweigert.' },
        { status: 403 }
      );
    }

    if (session.role === 'unternehmen') {
      const unternehmen = await db.get(
        `SELECT id FROM taxiunternehmen WHERE id = ?`,
        [session.userId]
      );
      if (!unternehmen || fahrt.unternehmen_id !== unternehmen.id) {
        return NextResponse.json(
          { success: false, error: 'Zugriff verweigert.' },
          { status: 403 }
        );
      }
    }

    // 5. EDIFACT vorhanden?
    if (!fahrt.edifact_datei) {
      return NextResponse.json(
        { success: false, error: 'Für diese Fahrt wurde noch keine EDIFACT-Datei generiert.' },
        { status: 404 }
      );
    }

    // 6. Als .txt Datei ausliefern
    const dateiname = fahrt.edifact_dateiname ?? `DTA_${fahrt_id}.txt`;

    return new Response(fahrt.edifact_datei, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=iso-8859-1',
        'Content-Disposition': `attachment; filename="${dateiname}"`,
      },
    });

  } catch (error: any) {
    console.error('❌ EDIFACT-DOWNLOAD FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}