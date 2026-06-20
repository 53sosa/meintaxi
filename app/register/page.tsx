"use client";

import { useState } from 'react';

export default function RegisterPage() {
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

      setSuccessMsg(data.message);
      if (data.firmen_code) setGeneratedCode(data.firmen_code);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        {!successMsg && (
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
                    🔒 Nach dem Login erhältst du einen Sicherheitscode per E-Mail
                    zur Bestätigung deiner Identität (Zwei-Faktor-Authentifizierung).
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