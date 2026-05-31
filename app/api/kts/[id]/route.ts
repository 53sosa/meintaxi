import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function GET(request: Request, context: any) {
  try {
    // DAS IST NEU: In aktuellen Next.js Versionen MUSS hier ein 'await' stehen!
    const resolvedParams = await context.params;
    const kts_id = resolvedParams.id;
    
    console.log("📱 SCANNER HAT DIESE ID GESCHICKT:", kts_id);

    const db = await openDb();
    
    // .trim() schneidet unsichtbare Leerzeichen ab
    const ride = await db.get('SELECT * FROM verordnungen WHERE id = ?', [kts_id.trim()]);
    await db.close();

    if (!ride) {
      console.log("❌ FEHLER: Diese ID gibt es nicht in der Datenbank!");
      return NextResponse.json({ success: false, error: "KTS-ID nicht gefunden." }, { status: 404 });
    }

    console.log("✅ ERFOLG: Daten gefunden für", ride.patient_vorname);
    return NextResponse.json({ success: true, ride }, { status: 200 });

  } catch (error) {
    console.error("❌ FAHRER-API-FEHLER:", error);
    return NextResponse.json({ success: false, error: "Fehler beim Abruf" }, { status: 500 });
  }
}