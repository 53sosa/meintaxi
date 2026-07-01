"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

// Lesbare Bezeichnung für Grund a–f
const FAHRT_GRUND_MAP: Record<string, string> = {
  a: 'Voll-/teilstationäre Krankenhausbehandlung',
  b: 'Ambulante Behandlung (Pflegegrad / Mobilitätsbeeinträchtigung)',
  c: 'Anderer Grund (z.B. Hospiz)',
  d: 'Hochfrequente Behandlung (Dialyse, Chemo, Strahlentherapie)',
  e: 'Dauerhafte Mobilitätsbeeinträchtigung ≥ 6 Monate',
  f: 'Anderer Grund für KTW (Lagerung, Tragen, Heben)',
};

// Live-Status-Anzeige für den Patienten (US-2.2 AC3)
const STATUS_ANZEIGE: Record<string, { label: string; badge: string; punkt: string }> = {
  offen: {
    label: 'Offen — noch keine Fahrt durchgeführt',
    badge: 'bg-gray-100 text-gray-600',
    punkt: 'bg-gray-400',
  },
  hinfahrt_abgeschlossen: {
    label: 'Hinfahrt durchgeführt ✓',
    badge: 'bg-amber-50 text-amber-700',
    punkt: 'bg-amber-400',
  },
  abgeschlossen: {
    label: 'Vollständig abgeschlossen',
    badge: 'bg-green-50 text-green-700',
    punkt: 'bg-green-500',
  },
};

export default function PatientDashboard() {
  const router = useRouter();
  const [patientData, setPatientData]     = useState<any>(null);
  const [ride, setRide]                   = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  // DSGVO: Formular erst nach Geburtsdatum-Eingabe sichtbar
  const [entsperrt, setEntsprerrt]        = useState(false);
  const [geburtsdatumEingabe, setGeburtsdatumEingabe] = useState('');
  const [entsperrFehler, setEntsprrFehler] = useState('');

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleEntsprerren = () => {
    setEntsprrFehler('');
    if (!ride) return;

    // Geburtsdatum vergleichen
    const eingabe = geburtsdatumEingabe.trim();
    const gespeichert = ride.patient_geburtsdatum;

    if (eingabe === gespeichert) {
      setEntsprerrt(true);
    } else {
      setEntsprrFehler('Geburtsdatum stimmt nicht überein. Bitte erneut versuchen.');
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. Session prüfen
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) throw new Error('Nicht autorisiert. Bitte einloggen.');
        const userData = await userRes.json();
        setPatientData(userData.patient);

        // 2. Offene Verordnung laden
        const ridesRes = await fetch(
          `/api/patient/rides?kvnr=${userData.patient.kvnr}`
        );
        const ridesData = await ridesRes.json();

        if (ridesRes.ok && ridesData.ride) {
          setRide(ridesData.ride);
        } else {
          setError('Aktuell liegt keine aktive Transportverordnung vor.');
        }
      } catch (err: any) {
        setError(err.message);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-blue-600 font-bold text-lg animate-pulse">
          Lade Patienten-Portal...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">

        {/* HEADER */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-blue-600">MEINTAXI</h1>
          <p className="text-sm text-gray-500 mt-1">Digitaler Krankentransportschein (E-KTS)</p>
          {patientData && (
            <p className="text-xs bg-gray-100 text-gray-600 inline-block px-3 py-1 rounded-full mt-2 font-semibold">
              👤 {patientData.vorname} {patientData.nachname}
            </p>
          )}
        </div>

        {/* KEINE FAHRT */}
        {error && (
          <div className="p-4 bg-amber-50 text-amber-700 text-sm rounded-xl border border-amber-200 text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        {ride && (
          <div className="space-y-5">

            {/* QR-CODE — sichtbar solange nicht vollständig abgeschlossen,
                danach ausgegraut mit Hinweis (US-2.2 AC2/AC4) */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Code beim Einstieg vorzeigen
              </span>
              <div className={`bg-white p-3 rounded-xl shadow-sm border border-gray-100 ${
                ride.status === 'abgeschlossen' ? 'opacity-30 grayscale' : ''
              }`}>
                <QRCodeSVG value={ride.id} size={200} level="M" />
              </div>
              <span className="text-[10px] text-gray-400 mt-2 font-mono">
                ID: {ride.id}
              </span>
              <div className={`mt-2 px-3 py-1 rounded-full flex items-center gap-1.5 ${
                (STATUS_ANZEIGE[ride.status] ?? STATUS_ANZEIGE.offen).badge
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  (STATUS_ANZEIGE[ride.status] ?? STATUS_ANZEIGE.offen).punkt
                }`} />
                <span className="text-xs font-semibold">
                  {(STATUS_ANZEIGE[ride.status] ?? STATUS_ANZEIGE.offen).label}
                </span>
              </div>
              {ride.status === 'abgeschlossen' && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  Dieser QR-Code ist nicht mehr gültig.
                </p>
              )}
            </div>

            {/* DSGVO-ENTSPERRUNG */}
            {!entsperrt && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-bold text-blue-800 mb-1">
                  🔒 Medizinische Details geschützt
                </p>
                <p className="text-xs text-blue-600 mb-3">
                  Zur Anzeige deiner vollständigen Verordnung bitte Geburtsdatum eingeben.
                </p>
                <input
                  type="date"
                  value={geburtsdatumEingabe}
                  onChange={e => setGeburtsdatumEingabe(e.target.value)}
                  className="w-full p-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                {entsperrFehler && (
                  <p className="text-xs text-red-500 mt-1">{entsperrFehler}</p>
                )}
                <button
                  onClick={handleEntsprerren}
                  className="w-full mt-2 bg-blue-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  Verordnung anzeigen
                </button>
              </div>
            )}

            {/* VOLLSTÄNDIGE VERORDNUNG — nur nach Entsperrung */}
            {entsperrt && (
              <div className="text-left space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 text-sm border-b border-blue-100 pb-2 uppercase tracking-wider">
                  Ärztliche Verordnung (Muster 4/E)
                </h3>

                {/* Kostenträger */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Kostenträger</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 block">Krankenkasse</span>
                      <span className="font-semibold text-gray-700">{ride.kasse_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">IK-Nummer</span>
                      <span className="font-semibold text-gray-700">{ride.kasse_ik}</span>
                    </div>
                  </div>
                </div>

                {/* Versichertendaten */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Versicherter</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 block">Name</span>
                      <span className="font-semibold text-gray-700">
                        {ride.patient_vorname} {ride.patient_nachname}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">KVNR</span>
                      <span className="font-semibold text-gray-700">{ride.patient_kvnr}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Verordnungsdatum</span>
                      <span className="font-semibold text-gray-700">{ride.verordnungsdatum}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Arzt BSNR</span>
                      <span className="font-semibold text-gray-700">{ride.arzt_bsnr}</span>
                    </div>
                  </div>
                </div>

                {/* Grund der Beförderung */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Grund der Beförderung
                  </p>
                  <div className="bg-white rounded-lg px-3 py-2 border border-blue-100 text-xs">
                    <span className="font-bold text-blue-700 mr-1">
                      {ride.fahrt_grund_code?.toUpperCase()})
                    </span>
                    <span className="text-gray-700">
                      {FAHRT_GRUND_MAP[ride.fahrt_grund_code] ?? 'Unbekannt'}
                    </span>
                  </div>
                </div>

                {/* Fahrt */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fahrt</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 block">Von</span>
                      <span className="font-semibold text-gray-700">{ride.fahrt_von}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Nach</span>
                      <span className="font-semibold text-gray-700">{ride.fahrt_nach}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Hinfahrt</span>
                      <span className={`font-semibold ${ride.hinfahrt ? 'text-green-600' : 'text-gray-400'}`}>
                        {ride.hinfahrt ? '✓ Ja' : '✗ Nein'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Rückfahrt</span>
                      <span className={`font-semibold ${ride.rueckfahrt ? 'text-green-600' : 'text-gray-400'}`}>
                        {ride.rueckfahrt ? '✓ Ja' : '✗ Nein'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Beförderungsart */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Art der Beförderung
                  </p>
                  <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                    {ride.befoerderungsart}
                  </span>
                </div>

                {/* Behandlung */}
                {ride.behandlung_beschreibung && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Behandlung
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Beschreibung</span>
                        <span className="font-semibold text-gray-700">
                          {ride.behandlung_beschreibung}
                        </span>
                      </div>
                      {ride.gueltig_bis && (
                        <div>
                          <span className="text-gray-400 block">Gültig bis</span>
                          <span className="font-semibold text-gray-700">{ride.gueltig_bis}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Zuzahlung */}
                <div className={`p-2 rounded-lg text-xs text-center font-semibold ${
                  ride.zuzahlungsbefreit
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {ride.zuzahlungsbefreit
                    ? '✓ Von Zuzahlung befreit'
                    : '⚠️ Zuzahlung erforderlich (wird nach der Fahrt berechnet)'}
                </div>

                <button
                  onClick={() => setEntsprerrt(false)}
                  className="text-xs text-gray-400 underline w-full text-center"
                >
                  Details ausblenden
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOGOUT */}
        <div className="text-center mt-6 pt-4 border-t">
          <button
            onClick={handleLogout}
            className="text-xs text-red-500 hover:text-red-700 font-bold underline"
          >
            Sicher ausloggen
          </button>
        </div>

      </div>
    </div>
  );
}