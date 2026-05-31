import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { openDb } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, email, password } = body;

    // 1. Basis-Check
    if (!email || !password || !role) {
      return NextResponse.json({ success: false, error: "Bitte alle Pflichtfelder ausfüllen." }, { status: 400 });
    }

    const db = await openDb();

    // 2. Passwort sicher verschlüsseln (Hashing) - Niemals im Klartext speichern!
    const salt = await bcrypt.genSalt(10);
    const passwort_hash = await bcrypt.hash(password, salt);

    // ==========================================
    // US-1.1: REGISTRIERUNG FÜR TAXIUNTERNEHMEN
    // ==========================================
    if (role === 'unternehmen') {
      const { firmen_name, ik_nummer, tarif_region } = body;
      
      // Einen einzigartigen 6-stelligen Firmen-Code generieren (z.B. BONN-A1B2C)
      const randomString = Math.random().toString(36).substring(2, 7).toUpperCase();
      const firmen_code = `${tarif_region.substring(0, 4).toUpperCase()}-${randomString}`;

      try {
        await db.run(
          `INSERT INTO taxiunternehmen (firmen_name, ik_nummer, tarif_region, firmen_code, email, passwort_hash) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [firmen_name, ik_nummer, tarif_region, firmen_code, email, passwort_hash]
        );
        await db.close();
        return NextResponse.json({ success: true, firmen_code, message: "Unternehmen erfolgreich registriert!" }, { status: 201 });
      } catch (err: any) {
        await db.close();
        return NextResponse.json({ success: false, error: "Diese E-Mail oder IK-Nummer existiert bereits." }, { status: 400 });
      }
    }

    // ==========================================
    // US-1.2: REGISTRIERUNG FÜR FAHRER
    // ==========================================
    if (role === 'fahrer') {
      const { vorname, nachname, firmen_code } = body;

      // Zuerst prüfen, ob der eingegebene Firmen-Code des Chefs überhaupt existiert!
      const unternehmen = await db.get(`SELECT id FROM taxiunternehmen WHERE firmen_code = ?`, [firmen_code.trim().toUpperCase()]);
      
      if (!unternehmen) {
        await db.close();
        return NextResponse.json({ success: false, error: "Ungültiger Firmen-Code. Bitte frage deinen Chef!" }, { status: 400 });
      }

      // Fahrer anlegen und über 'unternehmen.id' direkt mit dem Chef verknüpfen
      try {
        await db.run(
          `INSERT INTO fahrer (unternehmen_id, vorname, nachname, email, passwort_hash) 
           VALUES (?, ?, ?, ?, ?)`,
          [unternehmen.id, vorname, nachname, email, passwort_hash]
        );
        await db.close();
        return NextResponse.json({ success: true, message: "Fahrer erfolgreich registriert und mit Firma verknüpft!" }, { status: 201 });
      } catch (err: any) {
        await db.close();
        return NextResponse.json({ success: false, error: "Diese E-Mail wird bereits verwendet." }, { status: 400 });
      }
    }

    return NextResponse.json({ success: false, error: "Ungültige Rolle übergeben." }, { status: 400 });

  } catch (error) {
    console.error("❌ REGISTRIERUNGS-FEHLER:", error);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}