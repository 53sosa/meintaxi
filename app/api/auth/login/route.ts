import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { openDb } from '../../../../lib/db';
import { createSession } from '../../../../lib/session';

export async function POST(request: Request) {
  try {
    const { email, password, wagenNr } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "E-Mail und Passwort erforderlich." }, { status: 400 });
    }

    const db = await openDb();

    // 1. Prüfen, ob es ein UNTERNEHMER ist
    const unternehmen = await db.get(`SELECT * FROM taxiunternehmen WHERE email = ?`, [email]);
    if (unternehmen) {
      const isMatch = await bcrypt.compare(password, unternehmen.passwort_hash);
      if (!isMatch) return NextResponse.json({ success: false, error: "Falsches Passwort." }, { status: 401 });

      // Session setzen & Chef zum Dashboard leiten
      await createSession(unternehmen.id, 'unternehmen');
      await db.close();
      return NextResponse.json({ success: true, role: 'unternehmen', redirect: '/dashboard' }, { status: 200 });
    }

    // 2. Prüfen, ob es ein FAHRER ist
    const fahrer = await db.get(`SELECT * FROM fahrer WHERE email = ?`, [email]);
    if (fahrer) {
      const isMatch = await bcrypt.compare(password, fahrer.passwort_hash);
      if (!isMatch) return NextResponse.json({ success: false, error: "Falsches Passwort." }, { status: 401 });

      // US-1.3: Wagennummer abfragen!
      if (!wagenNr) {
        await db.close();
        // Wir loggen ihn noch nicht ein, sondern sagen dem Frontend: Frag nach dem Wagen!
        return NextResponse.json({ success: true, requireWagenNr: true, vorname: fahrer.vorname }, { status: 200 });
      }

      // Wenn die Wagennummer mitgeschickt wurde: Session inkl. Wagen setzen!
      await createSession(fahrer.id, 'fahrer', wagenNr);
      await db.close();
      return NextResponse.json({ success: true, role: 'fahrer', redirect: '/fahrer' }, { status: 200 });
    }

    // 3. Weder Chef noch Fahrer gefunden
    await db.close();
    return NextResponse.json({ success: false, error: "Kein Account mit dieser E-Mail gefunden." }, { status: 404 });

  } catch (error) {
    console.error("❌ LOGIN-FEHLER:", error);
    return NextResponse.json({ success: false, error: "Serverfehler beim Login" }, { status: 500 });
  }
}