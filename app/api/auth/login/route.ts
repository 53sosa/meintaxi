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
    const { email, password } = body;

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

      // Identifikation läuft ausschließlich über fahrer.id in der Session —
      // kein Wagennummer-Zwischenschritt mehr (US-1.3 AC1/AC3)
      await createSession(fahrer.id, 'fahrer');
      return NextResponse.json(
        { success: true, role: 'fahrer', redirect: '/fahrer' },
        { status: 200 }
      );
    }

    // ==========================================
    // 3. PATIENT
    // MFA passiert nur einmalig bei der Registrierung (siehe
    // /api/auth/verify-mfa) — Login danach nur E-Mail + Passwort (US-7.1 AC5)
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

      if (patient.mfa_verifiziert !== 1) {
        return NextResponse.json(
          { success: false, error: 'Bitte zuerst E-Mail-Adresse bestätigen.' },
          { status: 403 }
        );
      }

      await createSession(patient.id, 'patient');
      return NextResponse.json(
        { success: true, role: 'patient', redirect: '/patient' },
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