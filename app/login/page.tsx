"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScissorsSquareDashedBottom } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // step 1: E-Mail + Passwort
  // step 2: Fahrer Wagennummer
  // step 3: Patient MFA-Code
  const [step, setStep]         = useState(1);
  const [wagenNr, setWagenNr]   = useState('');
  const [fahrerName, setFahrerName] = useState('');
  const [mfaCode, setMfaCode]   = useState('');

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Payload je nach Schritt zusammenstellen
      let payload: any = { email, password };
      if (step === 2) payload = { email, password, wagenNr };
      if (step === 3) payload = { email, password, mfaCode };

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Fahrer braucht noch Wagennummer → Schritt 2
      if (data.requireWagenNr) {
        setFahrerName(data.vorname);
        setStep(2);
        setLoading(false);
        return;
      }

      // Patient braucht MFA-Code → Schritt 3
      if (data.requireMFA) {
        setStep(3);
        setLoading(false);
        return;
      }

      // Erfolgreich eingeloggt → weiterleiten
      // Kein localStorage mehr — wagenNr steckt im JWT-Cookie
      if (data.redirect) {
        router.push(data.redirect);
      }

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">MEINTAXI</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1 && 'Willkommen zurück! Bitte einloggen.'}
            {step === 2 && 'Schichtbeginn'}
            {step === 3 && 'Zwei-Faktor-Authentifizierung'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">

          {/* SCHRITT 1: E-Mail + Passwort */}
          {step === 1 && (
            <>
              <input
                type="email"
                placeholder="E-Mail Adresse"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </>
          )}

          {/* SCHRITT 2: Fahrer Wagennummer */}
          {step === 2 && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-2xl block mb-2">👋</span>
                <p className="font-bold text-blue-800">Hallo, {fahrerName}!</p>
                <p className="text-sm text-blue-600">Welchen Wagen fährst du heute?</p>
              </div>
              <input
                type="text"
                placeholder="Wagennummer (z.B. 103)"
                value={wagenNr}
                onChange={e => setWagenNr(e.target.value)}
                required
                className="w-full p-3 border-2 border-blue-300 rounded-xl text-center text-lg font-bold outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-400">
                Die Wagennummer wird dieser Schicht zugeordnet und in der Abrechnung gespeichert.
              </p>
            </div>
          )}

          {/* SCHRITT 3: Patient MFA-Code */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <span className="text-2xl block mb-2">🔒</span>
                <p className="font-bold text-green-800">Sicherheitscode bestätigen</p>
                <p className="text-xs text-green-600 mt-1">
                  Wir haben einen 6-stelligen Code an deine E-Mail gesendet.
                  Bitte gib ihn hier ein. Der Code ist 10 Minuten gültig.
                </p>
              </div>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                required
                className="w-full p-3 border-2 border-green-300 rounded-xl text-center text-2xl tracking-widest font-mono font-bold outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => { setStep(1); setMfaCode(''); setError(''); }}
                className="text-xs text-gray-400 underline"
              >
                Zurück zum Login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Laden...' : (
              step === 1 ? 'Einloggen' :
              step === 2 ? 'Schicht starten' :
              'Code verifizieren'
            )}
          </button>
        </form>

        {step === 1 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Noch keinen Account?{' '}
            <a href="/register" className="text-blue-600 font-semibold hover:underline">
              Registrieren
            </a>
          </p>
        )}

      </div>
    </div>
  );
}