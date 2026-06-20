import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { openDb } from '../../../../lib/db';
import { createSession } from '../../../../lib/session';

// Rate-Limiting: max 5 Login-Versuche pro IP pro Minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Versuche. Bitte warte eine Minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, wagenNr, mfaCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Passwort erforderlich.' },
        { status: 400 }
      );
    }

    const db = await openDb();
    const cleanEmail = email.trim().toLowerCase();

    // ==========================================
    // 1. TAXIUNTERNEHMEN
    // ==========================================
    const unternehmen = await db.get(
      `SELECT * FROM taxiunternehmen WHERE LOWER(email) = ?`,
      [cleanEmail]
    );
    if (unternehmen) {
      const isMatch = await bcrypt.compare(password, unternehmen.passwort_hash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'E-Mail oder Passwort falsch.' },
          { status: 401 }
        );
      }
      await createSession(unternehmen.id, 'unternehmen');
      return NextResponse.json(
        { success: true, role: 'unternehmen', redirect: '/dashboard' },
        { status: 200 }
      );
    }

    // ==========================================
    // 2. FAHRER
    // ==========================================
    const fahrer = await db.get(
      `SELECT * FROM fahrer WHERE LOWER(email) = ?`,
      [cleanEmail]
    );
    if (fahrer) {
      const isMatch = await bcrypt.compare(password, fahrer.passwort_hash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'E-Mail oder Passwort falsch.' },
          { status: 401 }
        );
      }

      // Status-Check: nur aktive Fahrer dürfen sich einloggen
      if (fahrer.status === 'ausstehend') {
        return NextResponse.json(
          { success: false, error: 'Dein Account wurde noch nicht freigegeben. Bitte wende dich an dein Taxiunternehmen.' },
          { status: 403 }
        );
      }
      if (fahrer.status === 'abgelehnt') {
        return NextResponse.json(
          { success: false, error: 'Dein Account wurde abgelehnt. Bitte wende dich an dein Taxiunternehmen.' },
          { status: 403 }
        );
      }

      // Wagennummer noch nicht angegeben → Frontend zeigt Schritt 2
      if (!wagenNr) {
        return NextResponse.json(
          { success: true, requireWagenNr: true, vorname: fahrer.vorname },
          { status: 200 }
        );
      }

      // Wagennummer in Session speichern (nicht localStorage)
      await createSession(fahrer.id, 'fahrer', wagenNr);
      return NextResponse.json(
        { success: true, role: 'fahrer', redirect: '/fahrer' },
        { status: 200 }
      );
    }

    // ==========================================
    // 3. PATIENT (mit MFA)
    // ==========================================
    const patient = await db.get(
      `SELECT * FROM patienten WHERE LOWER(email) = ?`,
      [cleanEmail]
    );
    if (patient) {
      const isMatch = await bcrypt.compare(password, patient.passwort_hash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'E-Mail oder Passwort falsch.' },
          { status: 401 }
        );
      }

      // MFA-Code wurde mitgeschickt → verifizieren
      if (mfaCode) {
        const codeStimmt  = patient.mfa_code === mfaCode.trim();
        const nochGueltig = patient.mfa_expires && new Date(patient.mfa_expires) > new Date();

        if (codeStimmt && nochGueltig) {
          // Code verbraucht → löschen
          await db.run(
            `UPDATE patienten SET mfa_code = NULL, mfa_expires = NULL WHERE id = ?`,
            [patient.id]
          );
          await createSession(patient.id, 'patient');
          return NextResponse.json(
            { success: true, role: 'patient', redirect: '/patient' },
            { status: 200 }
          );
        } else {
          return NextResponse.json(
            { success: false, error: 'Ungültiger oder abgelaufener Code.' },
            { status: 400 }
          );
        }
      }

      // Kein MFA-Code → neuen generieren (10 min gültig)
      const generierterCode = Math.floor(100000 + Math.random() * 900000).toString();
      const ablaufzeit = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await db.run(
        `UPDATE patienten SET mfa_code = ?, mfa_expires = ? WHERE id = ?`,
        [generierterCode, ablaufzeit, patient.id]
      );

      // In Produktion: hier E-Mail senden
      // Für Entwicklung: Code in Konsole ausgeben
      console.log(`\n🔐 MFA-CODE FÜR ${patient.email}: ${generierterCode}\n`);

      return NextResponse.json(
        { success: true, requireMFA: true },
        { status: 200 }
      );
    }

    // Kein Account gefunden
    return NextResponse.json(
      { success: false, error: 'Kein Account gefunden.' },
      { status: 404 }
    );

  } catch (error: any) {
    console.error('❌ LOGIN-FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}