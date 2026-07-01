import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET ist nicht gesetzt in .env.local');
  return new TextEncoder().encode(secret);
};

// JWTPayload erweitern damit jose keine Typ-Fehler wirft
export interface SessionPayload extends JWTPayload {
  userId: number;
  role: 'fahrer' | 'unternehmen' | 'patient';
  expires: string;
}

export async function createSession(
  userId: number,
  role: 'fahrer' | 'unternehmen' | 'patient'
) {
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  const payload: SessionPayload = {
    userId,
    role,
    expires: expires.toISOString(),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}