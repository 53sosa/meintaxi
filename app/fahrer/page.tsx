"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('./QrScanner'), { ssr: false });

type Step =
  | 'scan'          // 1. QR scannen
  | 'formular'      // 2. Fahrtdetails (ohne km)
  | 'fahrt_laeuft'  // 3. Fahrt läuft (Wartezustand)
  | 'abschluss_km'  // 4. km eingeben + Preis
  | 'uebersicht'    // 5. Zusammenfassung
  | 'unterschrift'  // 6. Patient unterschreibt
  | 'fertig';       // 7. Erfolg + Download

export default function FahrerPage() {
  const router = useRouter();

  const [fahrerName, setFahrerName] = useState('');
  const [wagenNr, setWagenNr]       = useState('');

  const [step, setStep]             = useState<Step>('scan');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [verordnung, setVerordnung] = useState<any>(null);
  const [tarif, setTarif]           = useState<any>(null);

  // Formular-Felder
  const [fahrtVon, setFahrtVon]     = useState('');
  const [fahrtNach, setFahrtNach]   = useState('');
  const [fahrtdatum, setFahrtdatum] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [hinfahrt, setHinfahrt]     = useState(true);
  const [rueckfahrt, setRueckfahrt] = useState(false);

  // Abschluss-Felder
  const [kmEinfach, setKmEinfach]   = useState('');
  const [preis, setPreis]           = useState<any>(null);

  // Unterschrift
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Ergebnis
  const [fahrtId, setFahrtId]               = useState('');
  const [edifactDateiname, setEdifactDateiname] = useState('');
  const [dmrzStatus, setDmrzStatus]         = useState('');

  // Scanner
  const [scanModus, setScanModus]           = useState<'kamera' | 'manuell'>('kamera');
  const [manuelleId, setManuelleId]         = useState('');
  const [scannerFehler, setScannerFehler]   = useState('');

  useEffect(() => {
    const ladeSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { router.push('/login'); return; }
        const data = await res.json();
        if (data.role !== 'fahrer') { router.push('/login'); return; }
        setFahrerName(`${data.fahrer.vorname} ${data.fahrer.nachname}`);
        setWagenNr(data.fahrer.wagenNr ?? '');
      } catch { router.push('/login'); }
    };
    ladeSession();
  }, [router]);

  // Live-Preisberechnung (nur im abschluss_km Schritt)
  useEffect(() => {
    if (!tarif || !kmEinfach || isNaN(Number(kmEinfach))) {
      setPreis(null); return;
    }
    const km = Number(kmEinfach);
    const fahrtenAnzahl = (hinfahrt ? 1 : 0) + (rueckfahrt ? 1 : 0);
    const km_gesamt  = km * (fahrtenAnzahl > 0 ? fahrtenAnzahl : 1);
    const zusatzKm   = Math.max(0, km_gesamt - 5);
    const grund      = tarif.grundpauschale ?? 12.20;
    const kmPreis    = tarif.preis_pro_zusatz_km ?? 2.39;
    const strecke    = Math.round(zusatzKm * kmPreis * 100) / 100;
    const brutto     = Math.round((grund + strecke) * 100) / 100;

    const pflichtig  =
      verordnung?.zuzahlungspflichtig === 1 &&
      verordnung?.zuzahlungsbefreit   === 0;

    let zuzahlung = 0;
    if (pflichtig) {
      const roh = brutto * 0.10;
      zuzahlung = Math.round(Math.max(5.00, Math.min(10.00, roh)) * 100) / 100;
    }

    setPreis({
      grundpauschale: grund,
      streckenpreis: strecke,
      gesamt_brutto: brutto,
      zuzahlung,
      gesamt_netto: Math.round((brutto - zuzahlung) * 100) / 100,
      km_abgerechnet: km_gesamt,
    });
  }, [kmEinfach, tarif, verordnung, hinfahrt, rueckfahrt]);

  const handleScan = async (ktsId: string) => {
    setLoading(true); setError(''); setScannerFehler('');
    try {
      const res = await fetch(`/api/kts/${ktsId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerordnung(data.verordnung);
      setTarif(data.tarif);
      setFahrtVon(data.verordnung.fahrt_von);
      setFahrtNach(data.verordnung.fahrt_nach);
      setHinfahrt(data.verordnung.hinfahrt === 1);
      setRueckfahrt(data.verordnung.rueckfahrt === 1);
      setStep('formular');
    } catch (err: any) {
      setError(err.message);
      setScanModus('kamera');
    } finally { setLoading(false); }
  };

  const handleManuelleEingabe = (e: React.FormEvent) => {
    e.preventDefault();
    if (manuelleId.trim()) handleScan(manuelleId.trim());
  };

  const handleAbschliessen = async () => {
    if (!hasSignature) return;
    setLoading(true); setError('');
    try {
      const canvas = canvasRef.current;
      const unterschrift_blob = canvas?.toDataURL('image/png') ?? '';
      const res = await fetch('/api/fahrten/abschliessen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verordnung_id: verordnung.id,
          fahrt_von: fahrtVon,
          fahrt_nach: fahrtNach,
          fahrtdatum,
          km_einfach: Number(kmEinfach),
          hinfahrt,
          rueckfahrt,
          unterschrift_blob,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFahrtId(data.fahrt_id);
      setEdifactDateiname(data.edifact_dateiname ?? '');
      setDmrzStatus(data.dmrz_status ?? '');
      setStep('fertig');
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  // Canvas
  const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    setIsDrawing(true); setHasSignature(true);
    const { x, y } = getXY(e, canvas.getBoundingClientRect());
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, canvas.getBoundingClientRect());
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f';
    ctx.lineTo(x, y); ctx.stroke();
  };
  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const resetFahrt = () => {
    setStep('scan'); setVerordnung(null); setTarif(null);
    setKmEinfach(''); setFahrtVon(''); setFahrtNach('');
    setPreis(null); setHasSignature(false);
    setFahrtId(''); setEdifactDateiname(''); setError('');
    setManuelleId(''); setScanModus('kamera');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-blue-600">MEINTAXI</h1>
            <p className="text-xs text-gray-500">{fahrerName} · Wagen {wagenNr || '—'}</p>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-bold">
            Ausloggen
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* ======= SCHRITT 1: QR SCAN ======= */}
        {step === 'scan' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-center">QR-Code scannen</h2>
            <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl gap-1">
              <button type="button" onClick={() => { setScanModus('kamera'); setScannerFehler(''); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${scanModus === 'kamera' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                📷 Kamera
              </button>
              <button type="button" onClick={() => setScanModus('manuell')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${scanModus === 'manuell' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                ⌨️ Manuell
              </button>
            </div>
            {scanModus === 'kamera' && (
              <div className="space-y-3">
                {scannerFehler ? (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                    <p className="text-red-600 text-sm font-semibold">⚠️ {scannerFehler}</p>
                    <button onClick={() => setScanModus('manuell')} className="text-xs text-blue-600 underline mt-2">
                      Manuell eingeben
                    </button>
                  </div>
                ) : (
                  <QrScanner onScan={handleScan} onError={setScannerFehler} />
                )}
                <p className="text-xs text-center text-blue-600">
                  Patient bittet, QR-Code in der MEINTAXI App zu öffnen.
                </p>
              </div>
            )}
            {scanModus === 'manuell' && (
              <form onSubmit={handleManuelleEingabe} className="space-y-3">
                <input type="text" placeholder="KTS-ID eingeben..."
                  value={manuelleId} onChange={e => setManuelleId(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                <button type="submit" disabled={loading || !manuelleId.trim()}
                  className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
                  {loading ? 'Lade...' : 'Verordnung laden'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ======= SCHRITT 2: FORMULAR (ohne km) ======= */}
        {step === 'formular' && verordnung && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-bold text-blue-800">
                {verordnung.patient_vorname} {verordnung.patient_nachname}
              </p>
              <p className="text-xs text-blue-600">
                {verordnung.kasse_name} · {verordnung.befoerderungsart}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrt von</label>
                <input type="text" value={fahrtVon} onChange={e => setFahrtVon(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrt nach</label>
                <input type="text" value={fahrtNach} onChange={e => setFahrtNach(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrtdatum</label>
                <input type="date" value={fahrtdatum} onChange={e => setFahrtdatum(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={hinfahrt} onChange={e => setHinfahrt(e.target.checked)}
                    className="w-4 h-4 accent-blue-600" /> Hinfahrt
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={rueckfahrt} onChange={e => setRueckfahrt(e.target.checked)}
                    className="w-4 h-4 accent-blue-600" /> Rückfahrt
                </label>
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 text-center">
              💡 Tarif: {tarif?.kasse_name ?? 'vdek-NRW'} · {tarif?.grundpauschale ?? 12.20} € Grundpauschale · {tarif?.preis_pro_zusatz_km ?? 2.39} € / km ab km 6
            </div>
            <button onClick={() => setStep('fahrt_laeuft')}
              disabled={!fahrtVon || !fahrtNach}
              className="w-full bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all text-lg">
              🚕 Fahrt starten
            </button>
          </div>
        )}

        {/* ======= SCHRITT 3: FAHRT LÄUFT ======= */}
        {step === 'fahrt_laeuft' && verordnung && (
          <div className="space-y-5 text-center">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-200">
              <div className="text-4xl mb-3 animate-pulse">🚕</div>
              <p className="font-bold text-green-800 text-lg">Fahrt läuft</p>
              <p className="text-sm text-green-600 mt-1">
                {verordnung.patient_vorname} {verordnung.patient_nachname}
              </p>
              <p className="text-xs text-green-500 mt-2">
                {fahrtVon} → {fahrtNach}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border text-xs text-gray-500">
              <p>Du kannst das Gerät jetzt weglegen.</p>
              <p className="mt-1">Klicke auf "Am Zielort angekommen" wenn die Fahrt beendet ist.</p>
            </div>
            <button onClick={() => setStep('abschluss_km')}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all text-base">
              📍 Am Zielort angekommen
            </button>
          </div>
        )}

        {/* ======= SCHRITT 4: KM EINGABE + PREIS ======= */}
        {step === 'abschluss_km' && verordnung && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Fahrt abschließen</h2>
            <p className="text-xs text-gray-500">
              {verordnung.patient_vorname} {verordnung.patient_nachname} ·
              {fahrtVon} → {fahrtNach}
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-semibold">
                Kilometer vom Taxameter
              </label>
              <input type="number" placeholder="z.B. 12" value={kmEinfach}
                onChange={e => setKmEinfach(e.target.value)} min="0" step="0.1"
                className="w-full p-4 border-2 border-blue-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none" />
              {hinfahrt && rueckfahrt && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Hin- und Rückfahrt: km × 2 = {kmEinfach ? Number(kmEinfach) * 2 : '?'} km gesamt
                </p>
              )}
            </div>

            {preis && (
              <div className="p-4 bg-gray-50 rounded-xl border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Grundpauschale (km 1–5)</span>
                  <span className="font-semibold">{preis.grundpauschale.toFixed(2)} €</span>
                </div>
                {preis.streckenpreis > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Strecke ab km 6 ({preis.km_abgerechnet - 5} km × {tarif?.preis_pro_zusatz_km ?? 2.39} €)
                    </span>
                    <span className="font-semibold">{preis.streckenpreis.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Gesamt Brutto</span>
                  <span className="font-bold">{preis.gesamt_brutto.toFixed(2)} €</span>
                </div>
                {preis.zuzahlung > 0 ? (
                  <div className="p-2 bg-red-50 rounded-lg text-center">
                    <span className="text-red-600 font-bold">
                      ⚠️ Patient zahlt: {preis.zuzahlung.toFixed(2)} € Zuzahlung
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-green-50 rounded-lg text-center text-green-600 text-xs font-semibold">
                    ✓ Von Zuzahlung befreit
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setStep('uebersicht')}
              disabled={!kmEinfach || !preis}
              className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
              Weiter zur Übersicht
            </button>
          </div>
        )}

        {/* ======= SCHRITT 5: ÜBERSICHT ======= */}
        {step === 'uebersicht' && verordnung && preis && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Übersicht für Patient</h2>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="font-bold">{verordnung.patient_vorname} {verordnung.patient_nachname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Strecke</span>
                <span className="font-bold">{fahrtVon} → {fahrtNach}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kilometer</span>
                <span className="font-bold">{preis.km_abgerechnet} km</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">Gesamtkosten</span>
                <span className="font-bold">{preis.gesamt_brutto.toFixed(2)} €</span>
              </div>
              {preis.zuzahlung > 0 ? (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                  <p className="text-red-700 font-bold">Es fällt eine gesetzliche Zuzahlung an:</p>
                  <p className="text-red-700 font-bold text-xl mt-1">{preis.zuzahlung.toFixed(2)} €</p>
                  <p className="text-red-500 text-xs mt-1">Bitte an den Fahrer entrichten.</p>
                </div>
              ) : (
                <div className="p-2 bg-green-50 rounded-lg text-center text-green-700 text-xs font-semibold">
                  ✓ Von Zuzahlung befreit
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('abschluss_km')}
                className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Zurück
              </button>
              <button onClick={() => setStep('unterschrift')}
                className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
                Zur Unterschrift
              </button>
            </div>
          </div>
        )}

        {/* ======= SCHRITT 6: UNTERSCHRIFT ======= */}
        {step === 'unterschrift' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Digitale Unterschrift</h2>
            <p className="text-sm text-gray-500">Bitte dem Patienten das Gerät zur Unterschrift vorlegen.</p>
            <canvas ref={canvasRef} width={380} height={180}
              className="w-full border-2 border-gray-300 rounded-xl bg-white touch-none cursor-crosshair"
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            <div className="flex gap-2">
              <button onClick={clearCanvas}
                className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Löschen
              </button>
              <button onClick={handleAbschliessen} disabled={!hasSignature || loading}
                className="flex-1 bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all">
                {loading ? 'Speichere...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        )}

        {/* ======= SCHRITT 7: FERTIG ======= */}
        {step === 'fertig' && (
          <div className="space-y-4 text-center">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-green-800 text-lg">Fahrt erfolgreich dokumentiert!</p>
              {preis?.zuzahlung > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-amber-700 font-bold text-sm">
                    💰 Zuzahlung kassieren: {preis.zuzahlung.toFixed(2)} €
                  </p>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              dmrzStatus === 'success' ? 'bg-green-50 text-green-700' :
              dmrzStatus === 'failed'  ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-600'
            }`}>
              {dmrzStatus === 'success' && '✓ Abrechnung an DMRZ übermittelt'}
              {dmrzStatus === 'failed'  && '⚠️ DMRZ-Übermittlung fehlgeschlagen'}
              {dmrzStatus === 'pending' && '⏳ Übermittlung ausstehend'}
            </div>
            {edifactDateiname && (
              <button onClick={() => window.open(`/api/fahrten/${fahrtId}/edifact`, '_blank')}
                className="w-full bg-gray-800 text-white p-3 rounded-xl font-bold hover:bg-gray-900 transition-all">
                📄 EDIFACT herunterladen ({edifactDateiname})
              </button>
            )}
            <button onClick={resetFahrt}
              className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
              Neue Fahrt starten
            </button>
          </div>
        )}

      </div>
    </div>
  );
}