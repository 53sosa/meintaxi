"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Login ist für alle drei Rollen ein einziger Schritt — kein
  // Wagennummer-Zwischenschritt (Fahrer) und kein MFA-Schritt (Patient)
  // mehr. MFA passiert nur noch einmalig bei der Patienten-Registrierung
  // (siehe /register), siehe US-1.3 AC1 und US-7.1 AC5.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

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
          <p className="text-sm text-gray-500 mt-1">Willkommen zurück! Bitte einloggen.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Laden...' : 'Einloggen'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Noch keinen Account?{' '}
          <a href="/register" className="text-blue-600 font-semibold hover:underline">
            Registrieren
          </a>
        </p>

      </div>
    </div>
  );
}