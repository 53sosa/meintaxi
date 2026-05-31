"use client";

import { useState } from 'react';

export default function RegisterPage() {
  const [role, setRole] = useState<'unternehmen' | 'fahrer'>('unternehmen');
  
  // States für Formulardaten
  const [formData, setFormData] = useState({
    email: '', password: '', 
    firmen_name: '', ik_nummer: '', tarif_region: 'Bonn', // Nur für Chef
    vorname: '', nachname: '', firmen_code: ''           // Nur für Fahrer
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setGeneratedCode('');

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
          <h1 className="text-2xl font-bold text-blue-600">MEINTAXI Registrierung</h1>
          <p className="text-sm text-gray-500 mt-1">Lege hier deinen Account an</p>
        </div>

        {/* ROLLER SWITCHER */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button 
            onClick={() => setRole('unternehmen')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${role === 'unternehmen' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Taxiunternehmen
          </button>
          <button 
            onClick={() => setRole('fahrer')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${role === 'fahrer' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Fahrer
          </button>
        </div>

        {/* ERFOLGSMELDUNG */}
        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center animate-fade-in">
            <p className="text-green-700 font-bold mb-2">✅ {successMsg}</p>
            {generatedCode && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-green-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Dein Firmen-Code für die Fahrer</p>
                <p className="text-2xl font-mono font-bold text-blue-600">{generatedCode}</p>
              </div>
            )}
            <a href="/login" className="block mt-4 text-sm text-blue-600 font-bold underline">Jetzt einloggen</a>
          </div>
        )}

        {/* FEHLERMELDUNG */}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold">⚠️ {error}</div>}

        {/* FORMULAR */}
        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {role === 'unternehmen' ? (
              // FELDER FÜR UNTERNEHMEN
              <>
                <input type="text" name="firmen_name" placeholder="Firmenname (z.B. Taxi Meier GmbH)" onChange={handleChange} required className="w-full p-3 border rounded-xl" />
                <input type="text" name="ik_nummer" placeholder="IK-Nummer (exakt 9 Zahlen)" minLength={9} maxLength={9} onChange={handleChange} required className="w-full p-3 border rounded-xl" />
                <select name="tarif_region" onChange={handleChange} className="w-full p-3 border rounded-xl bg-white text-gray-700">
                  <option value="Bonn">Region Bonn</option>
                  <option value="Köln">Region Köln</option>
                  <option value="Rhein-Sieg">Rhein-Sieg-Kreis</option>
                </select>
              </>
            ) : (
              // FELDER FÜR FAHRER
              <>
                <div className="flex gap-2">
                  <input type="text" name="vorname" placeholder="Vorname" onChange={handleChange} required className="w-1/2 p-3 border rounded-xl" />
                  <input type="text" name="nachname" placeholder="Nachname" onChange={handleChange} required className="w-1/2 p-3 border rounded-xl" />
                </div>
                <input type="text" name="firmen_code" placeholder="Firmen-Code vom Chef (z.B. BONN-123)" onChange={handleChange} required className="w-full p-3 border border-blue-300 rounded-xl uppercase" />
              </>
            )}

            {/* GEMEINSAME FELDER */}
            <input type="email" name="email" placeholder="E-Mail Adresse" onChange={handleChange} required className="w-full p-3 border rounded-xl" />
            <input type="password" name="password" placeholder="Sicheres Passwort" onChange={handleChange} required minLength={6} className="w-full p-3 border rounded-xl" />

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Wird verarbeitet...' : 'Kostenlos registrieren'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}