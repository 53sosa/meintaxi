import { NextResponse } from 'next/server';
import { deleteSession } from '../../../../lib/session';

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json(
      { success: true, message: 'Erfolgreich ausgeloggt.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ LOGOUT-FEHLER:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler beim Logout' },
      { status: 500 }
    );
  }
}