import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { openDb } from '../../../../lib/db';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function generiereFiremenCode(region: string): string {
  const prefix = region.substring(0, 4).toUpperCase().padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}${suffix}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Anfragen. Bitte warte eine Minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { role, email, password } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'Bitte alle Pflichtfelder ausfüllen.' },
        { status: 400 }
      );
    }

    const db = await openDb();
    const cleanEmail = email.toLowerCase().trim();

    const existingPatient     = await db.get(`SELECT id FROM patienten WHERE LOWER(email) = ?`, [cleanEmail]);
    const existingFahrer      = await db.get(`SELECT id FROM fahrer WHERE LOWER(email) = ?`, [cleanEmail]);
    const existingUnternehmen = await db.get(`SELECT id FROM taxiunternehmen WHERE LOWER(email) = ?`, [cleanEmail]);

    if (existingPatient || existingFahrer || existingUnternehmen) {
      return NextResponse.json(
        { success: false, error: 'Diese E-Mail-Adresse wird bereits verwendet.' },
        { status: 400 }
      );
    }

    const passwort_hash = await bcrypt.hash(password, 10);

    if (role === 'unternehmen') {
      const { firmen_name, ik_nummer, tarif_region } = body;

      if (!firmen_name || !ik_nummer || !tarif_region) {
        return NextResponse.json(
          { success: false, error: 'Firmenname, IK-Nummer und Region sind Pflicht.' },
          { status: 400 }
        );
      }
      if (!/^\d{9}$/.test(ik_nummer)) {
        return NextResponse.json(
          { success: false, error: 'IK-Nummer muss exakt 9 Ziffern haben.' },
          { status: 400 }
        );
      }

      const firmen_code = generiereFiremenCode(tarif_region);

      await db.run(
        `INSERT INTO taxiunternehmen (firmen_name, ik_nummer, tarif_region, firmen_code, email, passwort_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [firmen_name, ik_nummer, tarif_region, firmen_code, cleanEmail, passwort_hash]
      );

      return NextResponse.json(
        { success: true, firmen_code, message: 'Unternehmen erfolgreich registriert!' },
        { status: 201 }
      );
    }

    if (role === 'fahrer') {
      const { vorname, nachname, firmen_code } = body;

      if (!vorname || !nachname || !firmen_code) {
        return NextResponse.json(
          { success: false, error: 'Vorname, Nachname und Firmen-Code sind Pflicht.' },
          { status: 400 }
        );
      }

      const unternehmen = await db.get(
        `SELECT id FROM taxiunternehmen WHERE firmen_code = ?`,
        [firmen_code.trim().toUpperCase()]
      );

      if (!unternehmen) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Firmen-Code.' },
          { status: 400 }
        );
      }

      // Status explizit 'ausstehend' — Fahrer kann erst nach Genehmigung
      // durch den Taxiunternehmer einloggen (US-1.2 AC2/AC3, US-NEXT-09)
      await db.run(
        `INSERT INTO fahrer (unternehmen_id, vorname, nachname, email, passwort_hash, status)
         VALUES (?, ?, ?, ?, ?, 'ausstehend')`,
        [unternehmen.id, vorname, nachname, cleanEmail, passwort_hash]
      );

      return NextResponse.json(
        {
          success: true,
          message: 'Registrierung erfolgreich. Dein Account muss erst vom Taxiunternehmen freigeschaltet werden, bevor du dich einloggen kannst.',
        },
        { status: 201 }
      );
    }

    if (role === 'patient') {
      const { vorname, nachname, kvnr } = body;

      if (!vorname || !nachname) {
        return NextResponse.json(
          { success: false, error: 'Vorname und Nachname sind Pflicht.' },
          { status: 400 }
        );
      }
      if (kvnr && !/^[A-Z]\d{9}$/i.test(kvnr.trim())) {
        return NextResponse.json(
          { success: false, error: 'KVNR muss 1 Buchstabe + 9 Ziffern sein (10-stellig).' },
          { status: 400 }
        );
      }

      const result = await db.run(
        `INSERT INTO patienten (vorname, nachname, email, passwort_hash, kvnr)
         VALUES (?, ?, ?, ?, ?)`,
        [vorname, nachname, cleanEmail, passwort_hash, kvnr?.trim().toUpperCase() ?? null]
      );

      // MFA-Code generieren — einmalig bei Registrierung, 10 Min gültig
      // (US-7.1 AC2/AC3). Account bleibt bis zur Bestätigung mfa_verifiziert=0
      // und kann sich nicht einloggen.
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      const mfaExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await db.run(
        `UPDATE patienten SET mfa_code = ?, mfa_expires = ? WHERE id = ?`,
        [mfaCode, mfaExpires, result.lastID]
      );

      // E-Mail mit MFA-Code via Resend senden (US-7.1 AC2)
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: cleanEmail,
          subject: 'Ihr MEINTAXI Bestätigungscode',
          text: `Ihr MEINTAXI Bestätigungscode lautet: ${mfaCode}\n\nGültig für 10 Minuten.\n\nFalls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.`,
        });
      } catch (emailError) {
        console.error('❌ E-Mail-Versand fehlgeschlagen:', emailError);
        // Registrierung trotzdem abbrechen wenn E-Mail nicht ankommt
        await db.run(`DELETE FROM patienten WHERE id = ?`, [result.lastID]);
        return NextResponse.json(
          { success: false, error: 'E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          requireMfaVerification: true,
          email: cleanEmail,
          message: 'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse mit dem zugesendeten Code.',
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ungültige Rolle.' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ REG-FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}