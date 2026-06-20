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

      await db.run(
        `INSERT INTO fahrer (unternehmen_id, vorname, nachname, email, passwort_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [unternehmen.id, vorname, nachname, cleanEmail, passwort_hash]
      );

      return NextResponse.json(
        { success: true, message: 'Fahrer erfolgreich registriert!' },
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

      await db.run(
        `INSERT INTO patienten (vorname, nachname, email, passwort_hash, kvnr)
         VALUES (?, ?, ?, ?, ?)`,
        [vorname, nachname, cleanEmail, passwort_hash, kvnr?.trim().toUpperCase() ?? null]
      );

      return NextResponse.json(
        { success: true, message: 'Patient erfolgreich registriert!' },
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