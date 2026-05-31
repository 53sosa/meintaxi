"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [step, setStep] = useState(1);
  const [wagenNr, setWagenNr] = useState('');
  const [fahrerName, setFahrerName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = step === 1 ? { email, password } : { email, password, wagenNr };
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      if (data.requireWagenNr) {
        setFahrerName(data.vorname);
        setStep(2);
        setLoading(false);
        return;
      }

      if (data.redirect) {
        // NEU: Fahrer-Daten für das Frontend im Browser merken!
        if (data.role === 'fahrer') {
          localStorage.setItem('fahrerName', fahrerName || data.vorname || 'Fahrer');
          localStorage.setItem('wagenNr', wagenNr);
        }
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
            {step === 1 ? 'Willkommen zurück! Bitte einloggen.' : 'Schichtbeginn'}
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold text-center animate-fade-in">⚠️ {error}</div>}

        <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
          
          {step === 1 && (
            <>
              <input type="email" placeholder="E-Mail Adresse" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </>
          )}

          {step === 2 && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-2xl block mb-2">👋</span>
                <p className="font-bold text-blue-800">Hallo, {fahrerName}!</p>
                <p className="text-sm text-blue-600">Welchen Wagen fährst du heute?</p>
              </div>
              <input type="number" placeholder="Wagennummer (z.B. 103)" value={wagenNr} onChange={e => setWagenNr(e.target.value)} required className="w-full p-3 border-2 border-blue-300 rounded-xl text-center text-lg font-bold outline-none focus:border-blue-500" />
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
            {loading ? 'Laden...' : (step === 1 ? 'Einloggen' : 'Schicht starten')}
          </button>
        </form>
      </div>
    </div>
  );
}