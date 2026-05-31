import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from '../../lib/session';
import { openDb } from '../../lib/db';

// Das hier ist eine Next.js SERVER COMPONENT. 
// Sie läuft sicher auf dem Server und greift direkt auf die DB zu!
export default async function DashboardPage() {
  
  // 1. Sicherheit: Prüfen, ob der User einen gültigen Cookie hat
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  
  if (!sessionCookie) {
    redirect('/login'); // Nicht eingeloggt? Zurück zum Login!
  }

  const session = await decrypt(sessionCookie);
  
  // 2. Sicherheit: Ist das wirklich ein "unternehmen"?
  if (!session || session.role !== 'unternehmen') {
    redirect('/login'); 
  }

  // 3. Daten laden
  const db = await openDb();
  
  // Für das MVP holen wir einfach alle Verordnungen aus der Datenbank, 
  // sortiert nach dem neuesten Datum.
  const fahrten = await db.all(`
    SELECT * FROM verordnungen 
    ORDER BY erstellt_am DESC
  `);
  
  await db.close();

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">Chef-Dashboard</h1>
            <p className="text-gray-500">Übersicht aller E-KTS Verordnungen</p>
          </div>
          
          {/* LOGOUT FUNKTION FÜR DAS DASHBOARD (US-02) */}
          <form action={async () => {
            'use server';
            const cookiesStore = await cookies();
            cookiesStore.delete('session');
            redirect('/login');
          }}>
            <button type="submit" className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">
              Logout
            </button>
          </form>
        </div>

        {/* TABELLE: FAHRTEN-HISTORIE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                <th className="p-4 border-b">Status</th>
                <th className="p-4 border-b">Patient</th>
                <th className="p-4 border-b">Kasse</th>
                <th className="p-4 border-b">Von ➔ Nach</th>
                <th className="p-4 border-b">Datum</th>
              </tr>
            </thead>
            <tbody>
              {fahrten.map((fahrt) => (
                <tr key={fahrt.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      fahrt.status === 'offen' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {fahrt.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-gray-700">
                    {fahrt.patient_vorname} {fahrt.patient_nachname}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {fahrt.kasse_name} <br/>
                    <span className="text-xs text-gray-400">IK: {fahrt.kasse_ik}</span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {fahrt.fahrt_von} <br/>
                    <span className="text-gray-400">➔ {fahrt.fahrt_nach}</span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(fahrt.erstellt_am).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              ))}
              
              {fahrten.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Noch keine Fahrten im System vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}