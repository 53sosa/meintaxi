import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = new TextEncoder().encode('meintaxi-super-secret-key-2026-sprint');

export async function encrypt(payload: any, expiresIn: string) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn) 
    .sign(secretKey);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null; // Wenn Session abgelaufen oder ungültig, gib null zurück
  }
}

// Funktion: Nutzer einloggen (Strikte 60 Minuten für ALLE Rollen)
export async function createSession(userId: number, role: 'fahrer' | 'unternehmen', wagenNr?: string) {
  const hours = 1;
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000); 
  const expiresInString = `${hours}h`; // Backticks für die Variable

  const session = await encrypt({ userId, role, wagenNr, expires }, expiresInString);

  // WICHTIG FÜR NEXT.JS 15: cookies() muss mit "await" aufgerufen werden!
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// Funktion: Nutzer ausloggen (US-02)
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}