import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { createSession } from '../../../../lib/session';

// Bestätigt den bei der Patienten-Registrierung versendeten MFA-Code,
// aktiviert den Account (mfa_verifiziert = 1) und loggt direkt ein.
// Danach ist beim Login kein MFA-Code mehr nötig (US-7.1).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, mfaCode } = body;

    if (!email || !mfaCode) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Code sind Pflicht.' },
        { status: 400 }
      );
    }

    const db = await openDb();
    const cleanEmail = email.trim().toLowerCase();

    const patient = await db.get(
      `SELECT * FROM patienten WHERE LOWER(email) = ?`,
      [cleanEmail]
    );

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Kein Account gefunden.' },
        { status: 404 }
      );
    }

    if (patient.mfa_verifiziert === 1) {
      return NextResponse.json(
        { success: false, error: 'Account ist bereits bestätigt. Bitte einloggen.' },
        { status: 409 }
      );
    }

    const codeStimmt  = patient.mfa_code === mfaCode.trim();
    const nochGueltig = patient.mfa_expires && new Date(patient.mfa_expires) > new Date();

    if (!codeStimmt || !nochGueltig) {
      return NextResponse.json(
        { success: false, error: 'Ungültiger oder abgelaufener Code.' },
        { status: 400 }
      );
    }

    await db.run(
      `UPDATE patienten
       SET mfa_verifiziert = 1, mfa_code = NULL, mfa_expires = NULL
       WHERE id = ?`,
      [patient.id]
    );

    await createSession(patient.id, 'patient');

    return NextResponse.json(
      { success: true, role: 'patient', redirect: '/patient' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ MFA-VERIFY FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}