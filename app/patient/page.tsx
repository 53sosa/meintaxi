"use client";

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react'; // Paket zur Live-Generierung

export default function PatientFrontend() {
  // States für das Login-Formular
  const [kvnr, setKvnr] = useState('');
  const [geburtsdatum, setGeburtsdatum] = useState('');
  
  // States für die geladene Fahrt
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Funktion zum Abrufen der Fahrtdaten
  const handleFetchRides = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRide(null);

    try {
      const response = await fetch(`/api/patient/rides?kvnr=${kvnr}&geburtsdatum=${geburtsdatum}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ein Fehler ist aufgetreten.");
      }

      setRide(data.ride);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">MEINTAXI</h1>
          <p className="text-sm text-gray-500 mt-1">Patienten-Portal & Digitaler E-KTS</p>
        </div>

        {/* LOGIN-MASKE (Wenn noch keine Fahrt geladen wurde) */}
        {!ride && (
          <form onSubmit={handleFetchRides} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Versichertennummer (KVNR)</label>
              <input 
                type="text" 
                placeholder="z.B. M987654321" 
                value={kvnr}
                onChange={(e) => setKvnr(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg uppercase tracking-wider"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Geburtsdatum</label>
              <input 
                type="text" 
                placeholder="z.B. 1975-08-22" 
                value={geburtsdatum}
                onChange={(e) => setGeburtsdatum(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition duration-200 shadow-lg shadow-blue-100 disabled:bg-blue-300"
            >
              {loading ? "Suche Verordnung..." : "Meine Verordnung abrufen"}
            </button>
          </form>
        )}

        {/* DIGITALE ANZEIGE & QR-CODE (Wenn Fahrt gefunden wurde) */}
        {ride && (
          <div className="space-y-6 text-center animate-fade-in">
            
            {/* Der QR-Code für den Taxifahrer */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Code beim Einstieg vorzeigen</span>
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                {/* Wichtig: QR-Code enthält NUR die ID (Weg B) */}
                <QRCodeSVG value={ride.id} size={200} level="M" />
              </div>
              <span className="text-[10px] text-gray-400 mt-2 font-mono">ID: {ride.id}</span>
            </div>

            {/* Detailliertes Formular (Muster 4) */}
            <div className="text-left space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
              <h3 className="font-bold text-blue-800 text-sm border-b border-blue-100 pb-1 uppercase tracking-wider">Ärztliche Verordnung (Muster 4)</h3>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block">Patient:</span>
                  <span className="font-semibold text-gray-700">{ride.patient_vorname} {ride.patient_nachname}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Krankenkasse:</span>
                  <span className="font-semibold text-gray-700">{ride.kasse_name}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Fahrt von:</span>
                  <span className="font-semibold text-gray-700 truncate block">{ride.fahrt_von}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Fahrt nach:</span>
                  <span className="font-semibold text-gray-700 truncate block">{ride.fahrt_nach}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block">Medizinischer Grund:</span>
                  <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-100 inline-block mt-0.5">{ride.fahrt_grund}</span>
                </div>
              </div>
            </div>

            {/* Zurück-Button */}
            <button 
              onClick={() => setRide(null)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Abmelden
            </button>
          </div>
        )}

      </div>
    </div>
  );
}