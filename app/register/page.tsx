"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'unternehmen' | 'fahrer' | 'patient'>('unternehmen');

  const [formData, setFormData] = useState({
    email: '', password: '',
    firmen_name: '', ik_nummer: '', tarif_region: 'Bonn',
    vorname: '', nachname: '', firmen_code: '',
    kvnr: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  // Patienten-MFA-Bestätigung direkt nach der Registrierung (US-7.1 AC2/AC3)
  const [mfaStep, setMfaStep] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Frontend-Validierung vor dem API-Call
  const validiereFormular = (): string | null => {
    if (role === 'unternehmen') {
      if (!/^\d{9}$/.test(formData.ik_nummer))
        return 'IK-Nummer muss exakt 9 Ziffern haben.';
    }
    if (role === 'patient' && formData.kvnr) {
      if (!/^[A-Z]\d{9}$/i.test(formData.kvnr.trim()))
        return 'KVNR muss 1 Buchstabe + 9 Ziffern sein (z.B. A123456789).';
    }
    if (formData.password.length < 6)
      return 'Passwort muss mindestens 6 Zeichen lang sein.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setGeneratedCode('');

    const validierungsFehler = validiereFormular();
    if (validierungsFehler) {
      setError(validierungsFehler);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.requireMfaVerification) {
        setRegisteredEmail(data.email);
        setMfaStep(true);
      } else {
        setSuccessMsg(data.message);
        if (data.firmen_code) setGeneratedCode(data.firmen_code);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError('');

    try {
      const response = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail, mfaCode }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      router.push(data.redirect);

    } catch (err: any) {
      setMfaError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">MEINTAXI</h1>
          <p className="text-sm text-gray-500 mt-1">Registrierung</p>
        </div>

        {/* ROLLEN-SWITCHER */}
        <div className="grid grid-cols-3 bg-gray-100 p-1 rounded-xl mb-6 gap-1">
          {(['unternehmen', 'fahrer', 'patient'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r); setError(''); }}
              className={`py-2 rounded-lg text-xs font-bold transition-all text-center capitalize ${
                role === r ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r === 'unternehmen' ? 'Unternehmen' : r === 'fahrer' ? 'Fahrer' : 'Patient'}
            </button>
          ))}
        </div>

        {/* MFA-BESTÄTIGUNG NACH PATIENTEN-REGISTRIERUNG */}
        {mfaStep && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
              <span className="text-2xl block mb-2">🔒</span>
              <p className="font-bold text-green-800">E-Mail bestätigen</p>
              <p className="text-xs text-green-600 mt-1">
                Wir haben einen 6-stelligen Code an {registeredEmail} gesendet.
                Der Code ist 10 Minuten gültig.
              </p>
            </div>

            {mfaError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold text-center">
                ⚠️ {mfaError}
              </div>
            )}

            <form onSubmit={handleMfaVerify} className="space-y-4">
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
                type="submit"
                disabled={mfaLoading}
                className="w-full bg-green-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {mfaLoading ? 'Prüfe...' : 'Code bestätigen'}
              </button>
            </form>
          </div>
        )}

        {/* ERFOLGSMELDUNG */}
        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-green-700 font-bold mb-2">✅ {successMsg}</p>
            {generatedCode && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-green-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Dein Firmen-Code für die Fahrer
                </p>
                <p className="text-2xl font-mono font-bold text-blue-600 tracking-widest">
                  {generatedCode}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Teile diesen Code mit deinen Fahrern zur Registrierung.
                </p>
              </div>
            )}
            <a href="/login" className="block mt-4 text-sm text-blue-600 font-bold underline">
              Jetzt einloggen
            </a>
          </div>
        )}

        {/* FEHLERMELDUNG */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* FORMULAR */}
        {!successMsg && !mfaStep && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* UNTERNEHMEN */}
            {role === 'unternehmen' && (
              <>
                <input
                  type="text" name="firmen_name"
                  placeholder="Firmenname (z.B. Taxi Meier GmbH)"
                  onChange={handleChange} required
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text" name="ik_nummer"
                  placeholder="IK-Nummer (exakt 9 Ziffern)"
                  minLength={9} maxLength={9}
                  onChange={handleChange} required
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select
                  name="tarif_region"
                  onChange={handleChange}
                  className="w-full p-3 border rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Bonn">Region Bonn</option>
                  <option value="Köln">Region Köln</option>
                  <option value="Rhein-Sieg">Rhein-Sieg-Kreis</option>
                </select>
              </>
            )}

            {/* FAHRER */}
            {role === 'fahrer' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text" name="vorname" placeholder="Vorname"
                    onChange={handleChange} required
                    className="w-1/2 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="text" name="nachname" placeholder="Nachname"
                    onChange={handleChange} required
                    className="w-1/2 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text" name="firmen_code"
                    placeholder="Firmen-Code vom Chef (z.B. BONN7X)"
                    onChange={handleChange} required
                    className="w-full p-3 border border-blue-300 rounded-xl uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 ml-1">
                    6-stelliger Code den dein Chef bei der Registrierung erhalten hat.
                  </p>
                </div>
              </>
            )}

            {/* PATIENT */}
            {role === 'patient' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text" name="vorname" placeholder="Vorname"
                    onChange={handleChange} required
                    className="w-1/2 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="text" name="nachname" placeholder="Nachname"
                    onChange={handleChange} required
                    className="w-1/2 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <input
                  type="text" name="kvnr"
                  placeholder="Versichertennummer (z.B. A123456789)"
                  minLength={10} maxLength={10}
                  onChange={handleChange} required
                  className="w-full p-3 border border-blue-300 rounded-xl uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 -mt-2 ml-1">
                  Steht auf deiner Krankenkassenkarte (1 Buchstabe + 9 Ziffern).
                </p>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700">
                    🔒 Direkt nach der Registrierung erhältst du einen
                    Sicherheitscode per E-Mail zur einmaligen Bestätigung
                    deiner Identität. Danach reichen E-Mail und Passwort zum Einloggen.
                  </p>
                </div>
              </>
            )}

            {/* GEMEINSAME FELDER */}
            <input
              type="email" name="email" placeholder="E-Mail Adresse"
              onChange={handleChange} required
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="password" name="password"
              placeholder="Sicheres Passwort (min. 6 Zeichen)"
              onChange={handleChange} required minLength={6}
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {loading ? 'Wird verarbeitet...' : 'Kostenlos registrieren'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-4">
          Bereits registriert?{' '}
          <a href="/login" className="text-blue-600 font-semibold hover:underline">
            Einloggen
          </a>
        </p>

      </div>
    </div>
  );
}