"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  const [unternehmen, setUnternehmen] = useState<any>(null);
  const [fahrten, setFahrten]         = useState<any[]>([]);
  const [stats, setStats]             = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [freigabeLoading, setFreigabeLoading] = useState<string | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState('alle');
  const [filterJahr, setFilterJahr]     = useState(new Date().getFullYear().toString());
  const [filterMonat, setFilterMonat]   = useState('');

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const ladeFahrten = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus !== 'alle') params.set('status', filterStatus);
    if (filterJahr)  params.set('jahr',  filterJahr);
    if (filterMonat) params.set('monat', filterMonat);

    const res = await fetch(`/api/dashboard/fahrten?${params.toString()}`);
    if (!res.ok) throw new Error('Fehler beim Laden der Fahrten.');
    const data = await res.json();
    setFahrten(data.fahrten ?? []);
    setStats(data.stats ?? null);
  }, [filterStatus, filterJahr, filterMonat]);

  useEffect(() => {
    const ladeDashboard = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) { router.push('/login'); return; }
        const meData = await meRes.json();
        if (meData.role !== 'unternehmen') { router.push('/login'); return; }
        setUnternehmen(meData.unternehmen);
        await ladeFahrten();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    ladeDashboard();
  }, [router]);

  useEffect(() => {
    if (!loading) ladeFahrten();
  }, [filterStatus, filterJahr, filterMonat]);

  const handleFreigabe = async (
    fahrt_id: string,
    aktion: 'freigeben' | 'ablehnen',
    begruendung?: string
  ) => {
    setFreigabeLoading(fahrt_id);
    try {
      const res = await fetch(`/api/fahrten/${fahrt_id}/freigeben`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion, begruendung }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await ladeFahrten();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFreigabeLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-blue-600 font-bold animate-pulse">Lade Dashboard...</p>
      </div>
    );
  }

  const jahre = ['2025', '2026', '2027'];
  const monate = [
    { val: '', label: 'Alle Monate' },
    { val: '01', label: 'Januar' }, { val: '02', label: 'Februar' },
    { val: '03', label: 'März' },   { val: '04', label: 'April' },
    { val: '05', label: 'Mai' },    { val: '06', label: 'Juni' },
    { val: '07', label: 'Juli' },   { val: '08', label: 'August' },
    { val: '09', label: 'September' }, { val: '10', label: 'Oktober' },
    { val: '11', label: 'November' }, { val: '12', label: 'Dezember' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* HEADER */}
      <div className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-600">MEINTAXI</h1>
          <p className="text-xs text-gray-500">
            {unternehmen?.firmen_name} · IK: {unternehmen?.ik_nummer}
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-bold">
          Ausloggen
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-600">{stats?.nicht_freigegeben ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Zur Freigabe</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.freigegeben ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Freigegeben</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">
              {stats?.kassenanteil?.toFixed(2) ?? '0.00'} €
            </p>
            <p className="text-xs text-gray-500 mt-1">Kassenanteil gesamt</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm text-center">
            <p className="text-2xl font-bold text-red-600">{stats?.gkv_failed ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">GKV-Fehler</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            ⚠️ {error}
          </div>
        )}

        {/* FILTER */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter:</span>

          <div className="flex gap-1 flex-wrap">
            {[
              { val: 'alle',               label: 'Alle' },
              { val: 'nicht_freigegeben',  label: '⏳ Zur Freigabe' },
              { val: 'freigegeben',        label: '✓ Freigegeben' },
              { val: 'abgelehnt',          label: '✗ Abgelehnt' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === val
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <select value={filterJahr} onChange={e => setFilterJahr(e.target.value)}
            className="p-2 border rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
            {jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>

          <select value={filterMonat} onChange={e => setFilterMonat(e.target.value)}
            className="p-2 border rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
            {monate.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>

        {/* FAHRTEN-TABELLE */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-800">Fahrtenhistorie</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {fahrten.length} Fahrten · {filterStatus === 'alle' ? 'Alle Status' : filterStatus}
              </p>
            </div>
          </div>

          {fahrten.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">🚕</p>
              <p className="text-sm">Keine Fahrten für diesen Filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Datum</th>
                    <th className="px-4 py-3 text-left">Patient</th>
                    <th className="px-4 py-3 text-left">Fahrer</th>
                    <th className="px-4 py-3 text-left">Strecke</th>
                    <th className="px-4 py-3 text-center">Fahrtart</th>
                    <th className="px-4 py-3 text-right">km</th>
                    <th className="px-4 py-3 text-right">Brutto</th>
                    <th className="px-4 py-3 text-right">Zuzahlung</th>
                    <th className="px-4 py-3 text-left">GKV</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fahrten.map((fahrt) => (
                    <tr key={fahrt.id} className={`hover:bg-gray-50 transition-colors ${
                      fahrt.freigabe_status === 'nicht_freigegeben' ? 'bg-amber-50/30' : ''
                    }`}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fahrt.fahrtdatum}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {fahrt.patient_vorname} {fahrt.patient_nachname}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fahrt.fahrer_vorname} {fahrt.fahrer_nachname}
                        <span className="text-xs text-gray-400 ml-1">· Wgn {fahrt.wagennummer}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px] truncate">
                        {fahrt.fahrt_von} → {fahrt.fahrt_nach}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fahrt.fahrtrichtung === 'beide'
                          ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">Hin + Rück</span>
                          : fahrt.fahrtrichtung === 'hinfahrt'
                          ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">Hinfahrt</span>
                          : <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">Rückfahrt</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fahrt.km_einfach} km
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fahrt.gesamt_brutto?.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600 font-semibold">
                        {fahrt.zuzahlung > 0
                          ? `${fahrt.zuzahlung?.toFixed(2)} €`
                          : <span className="text-green-600">befreit</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fahrt.kasse_name}
                      </td>

                      {/* FREIGABE STATUS */}
                      <td className="px-4 py-3 text-center">
                        {fahrt.freigabe_status === 'nicht_freigegeben' && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                            ⏳ Ausstehend
                          </span>
                        )}
                        {fahrt.freigabe_status === 'freigegeben' && (
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              fahrt.gkv_status === 'success'
                                ? 'bg-green-100 text-green-700'
                                : fahrt.gkv_status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {fahrt.gkv_status === 'success' ? '✓ GKV übermittelt'
                               : fahrt.gkv_status === 'failed' ? '✗ GKV Fehler'
                               : '↗ Freigegeben'}
                            </span>
                          </div>
                        )}
                        {fahrt.freigabe_status === 'abgelehnt' && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold"
                            title={fahrt.freigabe_begruendung ?? ''}>
                            ✗ Abgelehnt
                          </span>
                        )}
                      </td>

                      {/* AKTIONEN */}
                      <td className="px-4 py-3 text-center">
                        {fahrt.freigabe_status === 'nicht_freigegeben' && (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleFreigabe(fahrt.id, 'freigeben')}
                              disabled={freigabeLoading === fahrt.id}
                              className="bg-green-600 text-white text-xs px-2 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                            >
                              {freigabeLoading === fahrt.id ? '...' : '✓ Freigeben'}
                            </button>
                            <button
                              onClick={() => {
                                const grund = window.prompt('Begründung für Ablehnung:');
                                if (grund !== null) handleFreigabe(fahrt.id, 'ablehnen', grund);
                              }}
                              disabled={freigabeLoading === fahrt.id}
                              className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50 font-semibold"
                            >
                              ✗
                            </button>
                          </div>
                        )}
                        {fahrt.freigabe_status === 'freigegeben' && fahrt.edifact_dateiname && (
                          <a href={`/api/fahrten/${fahrt.id}/edifact`} target="_blank"
                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline">
                            ↓ EDIFACT
                          </a>
                        )}
                        {fahrt.freigabe_status === 'freigegeben' && fahrt.gkv_status === 'failed' && (
                          <button
                            onClick={() => handleFreigabe(fahrt.id, 'freigeben')}
                            className="text-xs text-amber-600 underline font-semibold ml-1"
                          >
                            ↺ Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}